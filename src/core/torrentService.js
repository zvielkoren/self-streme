import WebTorrent from "webtorrent";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";
import { addTrackersToMagnet, createMagnetUri } from "../config/trackers.js";
import logger from "../utils/logger.js";
import diskManager from "../utils/diskManager.js";
import P2PCoordinator from "../services/p2pCoordinator.js";
import { extractInfoHash } from "../utils/infoHash.js";

/**
 * Advanced Singleton Torrent Service
 * 
 * Implements "Head & Holes" strategy, uTP priority, and Pterodactyl-optimized port binding.
 */
class TorrentService {
  constructor() {
    if (TorrentService.instance) {
      return TorrentService.instance;
    }

    this.client = null;
    this.p2pCoordinator = null;
    this.activeTorrents = new Map(); // infoHash -> torrent object + metadata
    this.downloadPath = config.paths.temp;
    this.headSize = 20 * 1024 * 1024; // 20MB protected head
    this.handleAcquireTimeoutMs =
      parseInt(process.env.TORRENT_HANDLE_ACQUIRE_TIMEOUT_MS, 10) || 5000;
    this.fastMetadataTimeoutMs =
      parseInt(process.env.TORRENT_FAST_METADATA_TIMEOUT_MS, 10) || 8000;

    // Ensure download directory exists
    try {
      if (!fs.existsSync(this.downloadPath)) {
        fs.mkdirSync(this.downloadPath, { recursive: true });
      }
    } catch (error) {
      console.warn(`[Torrent] Could not create download directory ${this.downloadPath}: ${error.message}`);
    }

    this.initialize();
    TorrentService.instance = this;
  }

  async initialize() {
    // Determine the port for WebTorrent to listen on.
    // We try to use the same port as the server if explicitly requested,
    // though this usually causes a conflict unless handled by a proxy.
    // For Pterodactyl, we often bind to the SERVER_PORT or SERVER_PORT + 1.
    const torrentPort = parseInt(process.env.TORRENT_PORT, 10) || 0; // 0 = random by default

    // 1. Initialize WebTorrent Client immediately (Synchronous)
    this.client = new WebTorrent({
      maxConnections: config.torrent.maxConnections || 25,
      torrentPort: torrentPort,
      utp: true, // Prioritize uTP for NAT traversal
      dht: {
        bootstrap: config.torrent.dhtBootstrap || [
          "router.bittorrent.com:6881",
          "router.utorrent.com:6881",
          "dht.transmissionbt.com:6881",
        ],
      },
      tracker: {
        announce: config.torrent.trackers || [],
      },
      downloadLimit: config.torrent.downloadLimit || 0,
      uploadLimit: config.torrent.uploadLimit || 0,
    });

    this.client.on("error", (err) => logger.error("WebTorrent client error:", err));
    this.client.on("warning", (err) => logger.warn("WebTorrent client warning:", err));

    // 2. Initialize P2P Coordinator for Hole Punching (Async background)
    try {
      this.p2pCoordinator = new P2PCoordinator({
        localPort: torrentPort, // Try to coordinate ports
        enableDetailedLogging: config.logging.level === 'debug'
      });
      
      await this.p2pCoordinator.initialize();
      logger.info("P2P Coordinator initialized for Hole Punching");

      // Register our peer with the coordinator
      if (this.client && this.client.peerId) {
        this.p2pCoordinator.registerPeer(this.client.peerId, { 
          client: 'self-streme',
          version: config.addon.version
        });
      }
    } catch (err) {
      logger.error("Failed to initialize P2P Coordinator:", err);
    }

    logger.info("Advanced TorrentService initialized", {
      utp: true,
      torrentPort: torrentPort || "random",
      maxConnections: config.torrent.maxConnections,
      holePunching: !!this.p2pCoordinator
    });
  }

  /**
   * Get or add a torrent
   */
  async getStream(magnetOrHash, fileIdx = 0, retryCount = 0) {
    const startedAt = Date.now();
    const infoHash = this.extractInfoHash(magnetOrHash);
    if (!infoHash) throw new Error("Invalid magnet or infoHash");

    const magnetUri = magnetOrHash.startsWith("magnet:") 
      ? addTrackersToMagnet(magnetOrHash) 
      : createMagnetUri(infoHash);

    const acquireStartedAt = Date.now();
    const torrent = await this.acquireTorrentHandle(infoHash, magnetUri);
    const acquisitionMs = Date.now() - acquireStartedAt;

    if (!this.isTorrentHandle(torrent)) {
      const immediateGet = await this.getTorrentCandidate(infoHash, "client.get.getStream.failure");
      logger.error(`[Torrent] Failed to acquire torrent handle for ${infoHash}`, {
        immediateGet: this.describeRuntimeValue(immediateGet),
        isPromiseLike: this.isPromiseLike(immediateGet),
      });
      throw new Error("Failed to acquire torrent handle");
    }

    logger.info(`[Torrent] Handle acquired for ${infoHash}`, {
      acquisitionMs,
      peers: torrent.numPeers || 0,
      progress: Number.isFinite(torrent.progress)
        ? Number((torrent.progress * 100).toFixed(2))
        : 0,
    });

    if (this.canStreamFromTorrent(torrent)) {
      logger.info(`[Torrent] Startup ready (cached metadata) for ${infoHash}`, {
        totalStartupMs: Date.now() - startedAt,
      });
      return this.prepareStreamObject(torrent, fileIdx);
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const configuredTimeout =
        (config.torrent.timeoutProgression &&
          config.torrent.timeoutProgression[retryCount]) ||
        60000;
      const timeoutDuration =
        retryCount === 0
          ? Math.min(configuredTimeout, this.fastMetadataTimeoutMs)
          : configuredTimeout;

      const resolveStream = (reason) => {
        if (settled) return;
        settled = true;
        logger.info(`[Torrent] Stream source became available for ${infoHash} via ${reason}`, {
          totalStartupMs: Date.now() - startedAt,
          peers: torrent.numPeers || 0,
          progress: Number.isFinite(torrent.progress) ? Number((torrent.progress * 100).toFixed(2)) : 0,
        });
        resolve(this.prepareStreamObject(torrent, fileIdx));
      };

      const rejectStream = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const timeout = setTimeout(async () => {
        if (!settled) {
          if (this.canStreamFromTorrent(torrent)) {
            logger.warn(`[Torrent] Timeout reached for ${infoHash}, but metadata is available. Proceeding with stream.`, {
              peers: torrent.numPeers || 0,
              progress: Number.isFinite(torrent.progress) ? Number((torrent.progress * 100).toFixed(2)) : 0,
            });
            resolveStream("timeout-with-metadata");
            return;
          }
          logger.error(`Torrent timeout for ${infoHash} after ${timeoutDuration}ms`, {
            peers: torrent.numPeers || 0,
            progress: Number.isFinite(torrent.progress) ? Number((torrent.progress * 100).toFixed(2)) : 0,
          });
          try {
            await torrent.destroy();
          } catch (err) {
            logger.error(`Error destroying timed out torrent: ${err.message}`);
          }
          rejectStream(new Error("Torrent discovery timeout"));
        }
      }, timeoutDuration);

      torrent.once("metadata", () => {
        logger.info(`Metadata received for ${torrent.name || infoHash}`);
        this.applyHeadStrategy(torrent);
        clearTimeout(timeout);
        resolveStream("metadata");
      });

      torrent.once("ready", () => {
        clearTimeout(timeout);
        this.applyHeadStrategy(torrent);
        resolveStream("ready");
      });

      torrent.once("error", (err) => {
        clearTimeout(timeout);
        rejectStream(err);
      });
    });
  }

  /**
   * "The Head" Strategy: Prioritize first 5% or 20MB of the file.
   */
  applyHeadStrategy(torrent) {
    torrent.files.forEach(file => {
      if (this.isVideoFile(file.name)) {
        const protectSize = Math.min(this.headSize, file.length * 0.05);
        const endPiece = Math.ceil(protectSize / torrent.pieceLength);
        logger.info(`Applying Head Strategy to ${file.name}: protecting first ${Math.round(protectSize / 1024 / 1024)}MB (pieces 0-${endPiece})`);
        
        // Select the head pieces with high priority using torrent.select()
        // start=0, end=endPiece, priority=10
        torrent.select(0, endPiece, 10);
      }
    });
  }

  prepareStreamObject(torrent, fileIdx) {
    const file = torrent.files[fileIdx] || this.getLargestFile(torrent);
    torrent.lastAccessed = Date.now();

    return {
      file,
      torrent,
      createStream: (options) => file.createReadStream(options),
      destroy: () => torrent.destroy(),
      lastAccessed: Date.now()
    };
  }

  /**
   * Cleanup: Punch holes in the "Body" of inactive torrents, keeping the "Head".
   */
  async cleanup() {
    const now = Date.now();
    const TTL = config.torrent.cleanupInterval || 1800000; // 30 mins

    // Create a copy of the torrents array to avoid concurrent modification issues
    const torrents = [...this.client.torrents];
    for (const torrent of torrents) {
      const lastAccessed = torrent.lastAccessed || 0;
      if (now - lastAccessed > TTL) {
        logger.info(`Cleaning up inactive torrent: ${torrent.name}`);
        
        for (const file of torrent.files) {
          const filePath = path.join(this.downloadPath, file.path);
          if (fs.existsSync(filePath) && this.isVideoFile(file.name)) {
            // Reclaim space for the body, keeping the head
            await diskManager.cleanupBody(filePath, this.headSize);
          }
        }
        
        // Pause the torrent to prevent automatic re-downloading of punched holes
        torrent.pause();
        // If really old, destroy
        if (now - lastAccessed > TTL * 4) {
          try {
            torrent.destroy();
          } catch (err) {
            logger.error(`Error destroying old torrent: ${err.message}`);
          }
        }
      }
    }
  }

  /**
   * Add a torrent by magnet link or info hash
   * @param {string} magnetOrHash - Magnet URI or info hash
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Torrent info
   */
  async addTorrent(magnetOrHash, options = {}) {
    const infoHash = this.extractInfoHash(magnetOrHash);
    if (!infoHash) throw new Error("Invalid magnet link or info hash");

    const magnetUri = magnetOrHash.startsWith("magnet:") 
      ? addTrackersToMagnet(magnetOrHash) 
      : createMagnetUri(infoHash);

    const torrent = await this.acquireTorrentHandle(infoHash, magnetUri, {
      ...options,
    });

    if (!this.isTorrentHandle(torrent)) {
      throw new Error(`Failed to add torrent: could not resolve torrent handle for ${infoHash}`);
    }

    if (this.canStreamFromTorrent(torrent)) {
      this.applyHeadStrategy(torrent);
      return {
        infoHash: torrent.infoHash,
        name: torrent.name,
        files: torrent.files.map(f => ({ name: f.name, path: f.path, length: f.length })),
        torrent: torrent,
        cached: false
      };
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const finishResolve = () => {
        if (settled) return;
        settled = true;
        this.applyHeadStrategy(torrent);
        resolve({
          infoHash: torrent.infoHash,
          name: torrent.name,
          files: torrent.files.map(f => ({ name: f.name, path: f.path, length: f.length })),
          torrent: torrent,
          cached: false
        });
      };

      const timeout = setTimeout(async () => {
        if (!settled && !this.canStreamFromTorrent(torrent)) {
          try {
            await torrent.destroy();
          } catch (err) {
            logger.error(`Error destroying timed out torrent: ${err.message}`);
          }
          reject(new Error("Timeout waiting for torrent metadata"));
        } else if (!settled) {
          finishResolve();
        }
      }, 30000);

      torrent.once("metadata", () => {
        clearTimeout(timeout);
        finishResolve();
      });

      torrent.once("ready", () => {
        clearTimeout(timeout);
        finishResolve();
      });

      torrent.once("error", (err) => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
    });
  }

  /**
   * Get torrent status and progress
   */
  getTorrentStatus(infoHash) {
    const torrent = this.client.get(infoHash);
    if (!torrent) return null;

    return {
      infoHash: torrent.infoHash,
      name: torrent.name,
      status: this.getStatus(torrent),
      progress: (torrent.progress * 100).toFixed(2),
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      downloaded: torrent.downloaded,
      uploaded: torrent.uploaded,
      numPeers: torrent.numPeers,
      timeRemaining: torrent.timeRemaining,
      files: torrent.files.map((f) => ({
        name: f.name,
        path: f.path,
        length: f.length,
        downloaded: f.downloaded,
      })),
      exists: true,
    };
  }

  getStatus(torrent) {
    if (torrent.done) return "complete";
    if (torrent.progress > 0) return "downloading";
    if (torrent.numPeers > 0) return "connected";
    return "connecting";
  }

  async getTorrentFiles(infoHash) {
    const torrent = this.client.get(infoHash);
    if (!torrent) throw new Error("Torrent not found");

    return torrent.files.map((f, index) => ({
      index,
      name: f.name,
      path: f.path,
      length: f.length,
      downloaded: f.downloaded,
      progress: ((f.downloaded / f.length) * 100).toFixed(2),
    }));
  }

  async removeTorrent(infoHash, deleteFiles = true) {
    const torrent = this.client.get(infoHash);
    if (!torrent) return false;

    try {
      await torrent.destroy({ destroyStore: deleteFiles });
      return true;
    } catch (error) {
      logger.error(`Error removing torrent ${infoHash}:`, error);
      return false;
    }
  }

  getClientStats() {
    return {
      activeTorrents: this.client.torrents.length,
      downloadSpeed: this.client.downloadSpeed,
      uploadSpeed: this.client.uploadSpeed,
      progress: this.client.progress,
      torrents: this.client.torrents.map((t) => ({
        infoHash: t.infoHash,
        name: t.name,
        progress: (t.progress * 100).toFixed(2),
        peers: t.numPeers,
        downloadSpeed: t.downloadSpeed,
        uploadSpeed: t.uploadSpeed,
      })),
      dhtEnabled: !!this.client.dht,
      dhtNodes: this.client.dht?.nodes?.toArray?.()?.length || 0,
    };
  }

  extractInfoHash(magnetOrHash) {
    return extractInfoHash(magnetOrHash);
  }

  describeRuntimeValue(value) {
    if (value === null) return { type: "null" };
    if (value === undefined) return { type: "undefined" };

    const valueType = typeof value;
    if (valueType !== "object") {
      return { type: valueType, preview: String(value).slice(0, 120) };
    }

    return {
      type: value?.constructor?.name || "Object",
      keys: Object.keys(value).slice(0, 10),
      hasOn: typeof value.on === "function",
      hasOnce: typeof value.once === "function",
      hasDestroy: typeof value.destroy === "function",
      hasInfoHash: typeof value.infoHash === "string",
    };
  }

  isPromiseLike(value) {
    return (
      value &&
      (typeof value === "object" || typeof value === "function") &&
      typeof value.then === "function"
    );
  }

  async resolvePromiseLike(value, timeoutMs = 3000, source = "unknown") {
    if (!this.isPromiseLike(value)) return value;

    let timeout = null;
    try {
      const resolved = await Promise.race([
        value,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`Promise resolution timeout (${timeoutMs}ms)`)),
            timeoutMs,
          );
        }),
      ]);
      return resolved;
    } catch (error) {
      logger.warn(`[Torrent] Failed to resolve promise-like torrent value from ${source}`, {
        source,
        error: error.message,
      });
      return null;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async getTorrentCandidate(infoHash, source = "client.get") {
    let candidate = null;
    try {
      candidate = this.client.get(infoHash);
    } catch (error) {
      logger.warn(`[Torrent] ${source} threw for ${infoHash}`, {
        source,
        error: error.message,
      });
      return null;
    }

    if (this.isPromiseLike(candidate)) {
      logger.debug(`[Torrent] ${source} returned promise-like candidate for ${infoHash}`, {
        source,
        candidate: this.describeRuntimeValue(candidate),
      });
      candidate = await this.resolvePromiseLike(candidate, 3000, source);
    }

    return candidate;
  }

  isTorrentHandle(candidate) {
    return (
      candidate &&
      typeof candidate === "object" &&
      typeof candidate.on === "function" &&
      typeof candidate.once === "function" &&
      typeof candidate.destroy === "function"
    );
  }

  async waitForTorrentHandle(infoHash, timeoutMs = 2000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const existing = await this.getTorrentCandidate(infoHash, "client.get.poll");
      if (this.isTorrentHandle(existing)) return existing;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  async acquireTorrentHandle(infoHash, magnetUri, options = {}) {
    let torrent = await this.getTorrentCandidate(infoHash, "client.get.initial");

    // Some runtimes may return a pending/non-torrent placeholder from get().
    if (torrent && !this.isTorrentHandle(torrent)) {
      logger.warn(`[Torrent] client.get returned non-torrent value for ${infoHash}`, {
        value: this.describeRuntimeValue(torrent),
      });
      torrent = await this.waitForTorrentHandle(infoHash, 1500);
    }

    if (this.isTorrentHandle(torrent)) {
      return torrent;
    }

    try {
      const addResult = this.client.add(magnetUri, { path: this.downloadPath, ...options });
      const resolvedAddResult = await this.resolvePromiseLike(
        addResult,
        5000,
        "client.add",
      );

      if (this.isTorrentHandle(resolvedAddResult)) {
        logger.debug(`[Torrent] Resolved torrent handle directly from client.add for ${infoHash}`, {
          source: "client.add",
          handle: this.describeRuntimeValue(resolvedAddResult),
        });
        return resolvedAddResult;
      }

      if (resolvedAddResult) {
        logger.debug(`[Torrent] client.add returned non-handle value for ${infoHash}`, {
          source: "client.add",
          value: this.describeRuntimeValue(resolvedAddResult),
        });
      }
    } catch (error) {
      logger.warn(`[Torrent] client.add threw for ${infoHash}; continuing with handle polling`, {
        error: error.message,
      });
    }

    torrent = await this.waitForTorrentHandle(
      infoHash,
      this.handleAcquireTimeoutMs,
    );
    if (this.isTorrentHandle(torrent)) {
      return torrent;
    }

    const existing = await this.getTorrentCandidate(infoHash, "client.get.final");
    logger.warn(`[Torrent] Unable to resolve torrent handle after add/poll for ${infoHash}`, {
      getResult: this.describeRuntimeValue(existing),
    });

    return null;
  }

  async resolveTorrentHandle(addResult, infoHash, waitTimeoutMs = 2000) {
    // WebTorrent versions may return a torrent object immediately or a promise-like value.
    const resolved = await this.resolvePromiseLike(addResult, waitTimeoutMs, "resolveTorrentHandle.addResult");
    if (this.isTorrentHandle(resolved)) return resolved;

    const existing = await this.getTorrentCandidate(infoHash, "resolveTorrentHandle.client.get");
    if (this.isTorrentHandle(existing)) return existing;

    logger.warn(`[Torrent] Unexpected torrent add/get result shape for ${infoHash}`, {
      addResult: this.describeRuntimeValue(resolved),
      getResult: this.describeRuntimeValue(existing),
    });

    return this.waitForTorrentHandle(infoHash, waitTimeoutMs);
  }

  isVideoFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return [".mp4", ".mkv", ".avi", ".webm", ".mov", ".flv"].includes(ext);
  }

  getLargestFile(torrent) {
    return torrent.files.reduce((a, b) => a.length > b.length ? a : b);
  }

  canStreamFromTorrent(torrent) {
    return Boolean(
      torrent &&
      !torrent.destroyed &&
      Array.isArray(torrent.files) &&
      torrent.files.length > 0,
    );
  }

  getVideoMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      ".mp4": "video/mp4",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
      ".webm": "video/webm",
    };
    return mimeTypes[ext] || "video/mp4";
  }

  /**
   * Stream a torrent over HTTP with full Range support
   */
  async streamTorrent(req, res, infoHash) {
    try {
      const magnetUri = createMagnetUri(infoHash);
      const streamObj = await this.getStream(magnetUri);
      const { file, torrent } = streamObj;

      const fileSize = file.length;
      const range = req.headers.range;
      const contentType = this.getVideoMimeType(file.name);

      // Important: Send headers immediately to prevent timeout
      res.set({
        "Accept-Ranges": "bytes",
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      });

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        logger.debug(`Streaming range ${start}-${end}/${fileSize} for ${file.name}`);

        res.status(206).set({
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": chunksize,
        });

        file.createReadStream({ start, end }).pipe(res);
      } else {
        res.set("Content-Length", fileSize);
        file.createReadStream().pipe(res);
      }

      torrent.lastAccessed = Date.now();
    } catch (error) {
      logger.error(`Streaming error for ${infoHash}:`, error);
      if (!res.headersSent) res.status(500).send("Streaming failed");
    }
  }

  /**
   * Gracefully shutdown the service
   */
  async shutdown() {
    logger.info("Shutting down TorrentService...");
    
    if (this.p2pCoordinator) {
      try {
        await this.p2pCoordinator.shutdown();
      } catch (err) {
        logger.error("Error shutting down P2P Coordinator:", err);
      }
    }

    if (this.client) {
      try {
        await this.client.destroy();
        logger.info("WebTorrent client destroyed");
      } catch (err) {
        logger.error("Error destroying WebTorrent client:", err);
      }
    }
  }
}

export default new TorrentService();
