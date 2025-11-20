import WebTorrent from "webtorrent";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";
import { addTrackersToMagnet, createMagnetUri } from "../config/trackers.js";
import logger from "../utils/logger.js";

/**
 * Comprehensive Torrent Service with WebTorrent
 * Features:
 * - Magnet link and .torrent file support
 * - DHT and tracker connectivity
 * - Sequential download for faster streaming
 * - Progress tracking and reporting
 * - 60-second timeout for peer discovery
 * - Retry logic with exponential backoff
 * - Multi-file torrent support
 */
class TorrentService {
  constructor(cacheManager) {
    this.client = null;
    this.cacheManager = cacheManager;
    this.activeTorrents = new Map(); // infoHash -> torrent metadata
    this.downloadQueue = new Map(); // infoHash -> download promise
    this.maxRetries = config.torrent.maxRetries || 3;
    this.timeout = config.torrent.timeout || 60000;
    this.downloadPath = config.torrent.downloadPath || "./temp";

    // Ensure download directory exists
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }

    this.initialize();
  }

  initialize() {
    // Create WebTorrent client with optimized settings
    this.client = new WebTorrent({
      maxConnections: config.torrent.maxConnections || 25,
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

    // Setup event listeners
    this.client.on("error", (err) => {
      logger.error("WebTorrent client error:", err);
    });

    this.client.on("warning", (err) => {
      logger.warn("WebTorrent client warning:", err);
    });

    logger.info("TorrentService initialized", {
      maxConnections: config.torrent.maxConnections,
      timeout: this.timeout,
      maxRetries: this.maxRetries,
      dhtEnabled: !!this.client.dht,
    });
  }

  /**
   * Add a torrent by magnet link or info hash
   * @param {string} magnetOrHash - Magnet URI or info hash
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Torrent info
   */
  async addTorrent(magnetOrHash, options = {}) {
    const infoHash = this.extractInfoHash(magnetOrHash);

    if (!infoHash) {
      throw new Error("Invalid magnet link or info hash");
    }

    // Check if torrent is already in cache
    if (this.cacheManager && this.cacheManager.has(infoHash)) {
      const cached = this.cacheManager.get(infoHash);
      logger.info(`Torrent found in cache: ${infoHash}`);
      return {
        infoHash,
        cached: true,
        files: cached.files || [],
        filePath: cached.filePath,
      };
    }

    // Check if torrent is already being downloaded
    if (this.downloadQueue.has(infoHash)) {
      logger.info(`Torrent already in download queue: ${infoHash}`);
      return await this.downloadQueue.get(infoHash);
    }

    // Start new download with retry logic
    const downloadPromise = this.downloadWithRetry(
      magnetOrHash,
      infoHash,
      options,
    );
    this.downloadQueue.set(infoHash, downloadPromise);

    try {
      const result = await downloadPromise;
      return result;
    } finally {
      this.downloadQueue.delete(infoHash);
    }
  }

  /**
   * Download torrent with retry logic and exponential backoff
   */
  async downloadWithRetry(magnetOrHash, infoHash, options = {}, attempt = 1) {
    try {
      logger.info(
        `Download attempt ${attempt}/${this.maxRetries} for ${infoHash}`,
      );
      return await this.downloadTorrent(magnetOrHash, infoHash, options);
    } catch (error) {
      if (attempt >= this.maxRetries) {
        logger.error(`Max retries reached for ${infoHash}`, error);
        throw new Error(
          `Failed to download torrent after ${this.maxRetries} attempts: ${error.message}`,
        );
      }

      // Exponential backoff: 2^attempt seconds
      const backoffMs = Math.pow(2, attempt) * 1000;
      logger.warn(
        `Retry ${attempt}/${this.maxRetries} failed, backing off ${backoffMs}ms`,
        error.message,
      );

      await this.sleep(backoffMs);
      return await this.downloadWithRetry(
        magnetOrHash,
        infoHash,
        options,
        attempt + 1,
      );
    }
  }

  /**
   * Download a torrent
   */
  async downloadTorrent(magnetOrHash, infoHash, options = {}) {
    return new Promise((resolve, reject) => {
      // Prepare magnet URI with all trackers
      let magnetUri = magnetOrHash;
      if (!magnetOrHash.startsWith("magnet:")) {
        magnetUri = createMagnetUri(infoHash);
      } else {
        magnetUri = addTrackersToMagnet(magnetOrHash);
      }

      logger.info(`Adding torrent: ${infoHash}`);
      logger.debug(`Magnet URI: ${magnetUri}`);

      // Timeout handler
      const timeoutId = setTimeout(() => {
        const torrent = this.client.get(infoHash);
        if (torrent && torrent.numPeers === 0) {
          logger.warn(
            `Timeout: No peers found for ${infoHash} after ${this.timeout}ms`,
          );
          torrent.destroy();
          reject(
            new Error(
              `Timeout: No peers found after ${this.timeout / 1000} seconds. The torrent may be dead or unpopular.`,
            ),
          );
        }
      }, this.timeout);

      // Add torrent to client
      const torrent = this.client.add(magnetUri, {
        path: this.downloadPath,
        ...options,
      });

      // Track torrent metadata
      const torrentMeta = {
        infoHash,
        magnetUri,
        addedAt: Date.now(),
        status: "connecting",
      };
      this.activeTorrents.set(infoHash, torrentMeta);

      // Event: Metadata received
      torrent.on("metadata", () => {
        clearTimeout(timeoutId);
        logger.info(`Metadata received for ${infoHash}: ${torrent.name}`);

        torrentMeta.name = torrent.name;
        torrentMeta.status = "downloading";
        torrentMeta.files = torrent.files.map((f) => ({
          name: f.name,
          path: f.path,
          length: f.length,
        }));

        // Enable sequential download for faster streaming
        if (torrent.files.length > 0) {
          const largestFile = this.getLargestFile(torrent);
          if (largestFile) {
            // Prioritize pieces from the beginning for streaming
            largestFile.select();
            logger.info(`Sequential download enabled for: ${largestFile.name}`);
          }
        }
      });

      // Event: First peer connected
      torrent.on("wire", (wire, addr) => {
        logger.debug(`Connected to peer: ${addr}`);
        torrentMeta.status = "downloading";
      });

      // Event: Download progress
      torrent.on("download", (bytes) => {
        if (!torrentMeta.lastLog || Date.now() - torrentMeta.lastLog > 5000) {
          const progress = (torrent.progress * 100).toFixed(2);
          const speed = (torrent.downloadSpeed / 1024 / 1024).toFixed(2);
          logger.info(
            `Download progress ${infoHash}: ${progress}% at ${speed} MB/s`,
          );
          torrentMeta.lastLog = Date.now();
        }
      });

      // Event: Ready (torrent ready to stream but not necessarily complete)
      torrent.on("ready", () => {
        logger.info(`Torrent ready for streaming: ${infoHash}`);

        const largestFile = this.getLargestFile(torrent);
        if (!largestFile) {
          clearTimeout(timeoutId);
          reject(new Error("No files found in torrent"));
          return;
        }

        const filePath = path.join(this.downloadPath, largestFile.path);

        // Cache the torrent info
        if (this.cacheManager) {
          this.cacheManager.set(infoHash, {
            infoHash,
            name: torrent.name,
            filePath,
            files: torrent.files.map((f) => ({
              name: f.name,
              path: f.path,
              length: f.length,
            })),
            size: largestFile.length,
            lastAccessed: Date.now(),
          });
        }

        resolve({
          infoHash,
          name: torrent.name,
          filePath,
          files: torrent.files.map((f) => ({
            name: f.name,
            path: f.path,
            length: f.length,
          })),
          torrent,
          cached: false,
        });
      });

      // Event: Download complete
      torrent.on("done", () => {
        clearTimeout(timeoutId);
        logger.info(`Download complete: ${infoHash}`);
        torrentMeta.status = "complete";
        torrentMeta.completedAt = Date.now();
      });

      // Event: Error
      torrent.on("error", (err) => {
        clearTimeout(timeoutId);
        logger.error(`Torrent error for ${infoHash}:`, err);
        this.activeTorrents.delete(infoHash);
        reject(err);
      });

      // Event: No peers timeout
      setTimeout(() => {
        if (torrent.numPeers === 0 && torrent.progress === 0) {
          logger.warn(
            `Still no peers after ${this.timeout / 2}ms for ${infoHash}`,
          );
        }
      }, this.timeout / 2);
    });
  }

  /**
   * Get torrent status and progress
   */
  getTorrentStatus(infoHash) {
    const torrent = this.client.get(infoHash);

    if (!torrent) {
      const meta = this.activeTorrents.get(infoHash);
      if (meta) {
        return {
          infoHash,
          status: meta.status,
          name: meta.name,
          exists: false,
        };
      }
      return null;
    }

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

  /**
   * Get status of torrent
   */
  getStatus(torrent) {
    if (torrent.done) return "complete";
    if (torrent.progress > 0) return "downloading";
    if (torrent.numPeers > 0) return "connected";
    return "connecting";
  }

  /**
   * Get list of files in a torrent
   */
  async getTorrentFiles(infoHash) {
    const torrent = this.client.get(infoHash);

    if (!torrent) {
      // Check cache
      if (this.cacheManager && this.cacheManager.has(infoHash)) {
        const cached = this.cacheManager.get(infoHash);
        return cached.files || [];
      }
      throw new Error("Torrent not found");
    }

    return torrent.files.map((f, index) => ({
      index,
      name: f.name,
      path: f.path,
      length: f.length,
      downloaded: f.downloaded,
      progress: ((f.downloaded / f.length) * 100).toFixed(2),
    }));
  }

  /**
   * Create a read stream for a specific file in a torrent
   */
  createFileStream(infoHash, fileIndex = 0, options = {}) {
    const torrent = this.client.get(infoHash);

    if (!torrent) {
      throw new Error("Torrent not found");
    }

    const file = torrent.files[fileIndex];
    if (!file) {
      throw new Error(`File index ${fileIndex} not found`);
    }

    logger.info(`Creating stream for file: ${file.name} (${fileIndex})`);

    // Enable sequential download for this file
    file.select();

    return file.createReadStream(options);
  }

  /**
   * Remove a torrent
   */
  async removeTorrent(infoHash, deleteFiles = true) {
    return new Promise((resolve, reject) => {
      const torrent = this.client.get(infoHash);

      if (!torrent) {
        this.activeTorrents.delete(infoHash);
        resolve(false);
        return;
      }

      torrent.destroy({ destroyStore: deleteFiles }, (err) => {
        if (err) {
          logger.error(`Error removing torrent ${infoHash}:`, err);
          reject(err);
        } else {
          logger.info(`Removed torrent: ${infoHash}`);
          this.activeTorrents.delete(infoHash);

          // Remove from cache
          if (this.cacheManager) {
            this.cacheManager.delete(infoHash);
          }

          resolve(true);
        }
      });
    });
  }

  /**
   * Get largest file in torrent (usually the video file)
   */
  getLargestFile(torrent) {
    if (!torrent.files || torrent.files.length === 0) {
      return null;
    }

    return torrent.files.reduce((largest, file) => {
      return file.length > largest.length ? file : largest;
    });
  }

  /**
   * Extract info hash from magnet URI or return as-is if already a hash
   */
  extractInfoHash(magnetOrHash) {
    if (!magnetOrHash) return null;

    // If it's already a 40-character hex hash
    if (/^[a-f0-9]{40}$/i.test(magnetOrHash)) {
      return magnetOrHash.toLowerCase();
    }

    // Extract from magnet URI
    if (magnetOrHash.startsWith("magnet:")) {
      const match = magnetOrHash.match(/xt=urn:btih:([a-f0-9]{40})/i);
      return match ? match[1].toLowerCase() : null;
    }

    return null;
  }

  /**
   * Get overall client statistics
   */
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
      dhtNodes: this.client.dht ? this.client.dht.nodes.length : 0,
    };
  }

  /**
   * Cleanup old/inactive torrents
   */
  async cleanup(maxAge = 3600000) {
    // Default: 1 hour
    const now = Date.now();
    const torrentsToRemove = [];

    for (const [infoHash, meta] of this.activeTorrents.entries()) {
      const age = now - meta.addedAt;
      if (age > maxAge && meta.status === "complete") {
        torrentsToRemove.push(infoHash);
      }
    }

    for (const infoHash of torrentsToRemove) {
      try {
        await this.removeTorrent(infoHash, false); // Keep files in cache
        logger.info(`Cleaned up old torrent: ${infoHash}`);
      } catch (error) {
        logger.error(`Error cleaning up torrent ${infoHash}:`, error);
      }
    }

    return torrentsToRemove.length;
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown() {
    logger.info("Shutting down TorrentService...");

    if (this.client) {
      await new Promise((resolve) => {
        this.client.destroy((err) => {
          if (err) {
            logger.error("Error destroying WebTorrent client:", err);
          } else {
            logger.info("WebTorrent client destroyed");
          }
          resolve();
        });
      });
    }

    this.activeTorrents.clear();
    this.downloadQueue.clear();
  }
}

export default TorrentService;
