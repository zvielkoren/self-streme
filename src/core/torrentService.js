import WebTorrent from "webtorrent";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";
import { addTrackersToMagnet, createMagnetUri } from "../config/trackers.js";
import logger from "../utils/logger.js";
import diskManager from "../utils/diskManager.js";
import P2PCoordinator from "../services/p2pCoordinator.js";

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
    this.downloadPath = config.torrent.downloadPath || "./temp";
    this.headSize = 20 * 1024 * 1024; // 20MB protected head

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
    const infoHash = this.extractInfoHash(magnetOrHash);
    if (!infoHash) throw new Error("Invalid magnet or infoHash");

    const magnetUri = magnetOrHash.startsWith("magnet:") 
      ? addTrackersToMagnet(magnetOrHash) 
      : createMagnetUri(infoHash);

    let torrent = this.client.get(infoHash);
    if (!torrent) {
      // In WebTorrent 2.x, client.add returns a Promise
      torrent = await this.client.add(magnetUri, { path: this.downloadPath });
    }

    if (torrent.ready) {
      return this.prepareStreamObject(torrent, fileIdx);
    }

    return new Promise((resolve, reject) => {
      const timeoutDuration = (config.torrent.timeoutProgression && config.torrent.timeoutProgression[retryCount]) || 60000;
      const timeout = setTimeout(async () => {
        if (!torrent.ready) {
          logger.error(`Torrent timeout for ${infoHash} after ${timeoutDuration}ms`);
          try {
            await torrent.destroy();
          } catch (err) {
            logger.error(`Error destroying timed out torrent: ${err.message}`);
          }
          reject(new Error("Torrent discovery timeout"));
        }
      }, timeoutDuration);

      torrent.on("metadata", () => {
        logger.info(`Metadata received for ${torrent.name}`);
        this.applyHeadStrategy(torrent);
      });

      torrent.once("ready", () => {
        clearTimeout(timeout);
        resolve(this.prepareStreamObject(torrent, fileIdx));
      });

      torrent.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
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
        logger.info(`Applying Head Strategy to ${file.name}: protecting first ${Math.round(protectSize / 1024 / 1024)}MB`);
        
        // Select the head pieces with high priority
        file.select(0, Math.ceil(protectSize / torrent.pieceLength), 10);
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

    for (const torrent of this.client.torrents) {
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
          await torrent.destroy().catch(err => logger.error(`Error destroying old torrent: ${err.message}`));
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

    let torrent = this.client.get(infoHash);
    if (!torrent) {
      torrent = await this.client.add(magnetUri, { path: this.downloadPath, ...options });
    }

    if (torrent.ready) {
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
      const timeout = setTimeout(async () => {
        if (!torrent.ready) {
          try {
            await torrent.destroy();
          } catch (err) {
            logger.error(`Error destroying timed out torrent: ${err.message}`);
          }
          reject(new Error("Timeout waiting for torrent metadata"));
        }
      }, 30000);

      torrent.once("ready", () => {
        clearTimeout(timeout);
        this.applyHeadStrategy(torrent);
        resolve({
          infoHash: torrent.infoHash,
          name: torrent.name,
          files: torrent.files.map(f => ({ name: f.name, path: f.path, length: f.length })),
          torrent: torrent,
          cached: false
        });
      });

      torrent.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
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
    if (/^[a-f0-9]{40}$/i.test(magnetOrHash)) return magnetOrHash.toLowerCase();
    const match = magnetOrHash.match(/btih:([a-fA-F0-9]{40})/i);
    return match ? match[1].toLowerCase() : null;
  }

  isVideoFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return [".mp4", ".mkv", ".avi", ".webm", ".mov", ".flv"].includes(ext);
  }

  getLargestFile(torrent) {
    return torrent.files.reduce((a, b) => a.length > b.length ? a : b);
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