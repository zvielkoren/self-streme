/**
 * Hybrid Stream Service with HTTP Download Fallback
 * Fixed: Better .torrent file validation and DHT fallback
 * Enhanced: Dynamic download sources instead of hardcoded WebTor.io
 */

import logger from "../utils/logger.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";
import parseTorrent from "parse-torrent";
import { pipeline } from "stream/promises";
import downloadSources from "./torrentDownloadSources.js";

class HybridStreamService {
  constructor(torrentService, cacheManager) {
    this.torrentService = torrentService;
    this.cacheManager = cacheManager;
    this.p2pTimeout = parseInt(process.env.P2P_TIMEOUT, 10) || 20000;
    this.enableHttpFallback = process.env.ENABLE_HTTP_FALLBACK !== "false";
    this.downloadPath = path.join(process.cwd(), "temp", "downloads");

    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }

    logger.info("[Hybrid] Service initialized");
    logger.info(`[Hybrid] P2P timeout: ${this.p2pTimeout}ms`);
    logger.info(`[Hybrid] HTTP fallback: ${this.enableHttpFallback}`);
  }

  async getStream(magnetOrHash, options = {}) {
    const infoHash = this.extractInfoHash(magnetOrHash);

    logger.info(`[Hybrid] 🎬 Getting stream for ${infoHash}`);

    // Check cache first
    if (this.cacheManager?.has(infoHash)) {
      logger.info(`[Hybrid] ✓ Found in cache!`);
      return this.getFromCache(infoHash);
    }

    // Try P2P
    try {
      logger.info(`[Hybrid] 🔄 Trying P2P (timeout: ${this.p2pTimeout}ms)...`);
      const p2pResult = await this.tryP2P(magnetOrHash, infoHash, options);
      logger.info(`[Hybrid] ✓ P2P successful!`);
      return p2pResult;
    } catch (error) {
      logger.warn(`[Hybrid] ❌ P2P failed: ${error.message}`);
    }

    // HTTP Download Fallback
    if (!this.enableHttpFallback) {
      throw new Error("P2P failed and HTTP fallback is disabled");
    }

    logger.info(`[Hybrid] 📥 Falling back to HTTP download...`);
    return await this.httpDownloadFallback(infoHash);
  }

  getFromCache(infoHash) {
    const cached = this.cacheManager.get(infoHash);
    const filePath = cached.filePath;

    if (!fs.existsSync(filePath)) {
      this.cacheManager.delete(infoHash);
      throw new Error("Cached file not found");
    }

    const stats = fs.statSync(filePath);
    return {
      method: "cache",
      success: true,
      cached: true,
      infoHash,
      filePath,
      fileSize: stats.size,
      fileName: path.basename(filePath),
    };
  }

  async tryP2P(magnetOrHash, infoHash, options = {}) {
    return Promise.race([
      this.torrentService.addTorrent(magnetOrHash, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("P2P timeout")), this.p2pTimeout),
      ),
    ]).then((result) => {
      if (!result || (!result.torrent && !result.cached)) {
        throw new Error("Invalid P2P result");
      }

      return {
        method: "p2p",
        success: true,
        cached: result.cached || false,
        infoHash,
        torrent: result.torrent,
        filePath: result.filePath,
        files: result.files || [],
      };
    });
  }

  async httpDownloadFallback(infoHash) {
    logger.info(`[Hybrid] 🔍 Step 1: Getting torrent metadata...`);
    const torrentBuffer = await this.downloadTorrentFile(infoHash);

    if (!torrentBuffer) {
      throw new Error("Failed to get torrent metadata - torrent may be dead");
    }

    logger.info(`[Hybrid] 📄 Step 2: Parsing torrent...`);
    const torrentData = await this.parseTorrentFile(torrentBuffer);

    if (!torrentData || !torrentData.files || torrentData.files.length === 0) {
      throw new Error("No files found in torrent");
    }

    logger.info(`[Hybrid] 🎥 Step 3: Finding video file...`);
    const videoFile = this.findLargestVideoFile(torrentData.files);

    if (!videoFile) {
      throw new Error("No video files found");
    }

    logger.info(
      `[Hybrid] ✓ Selected: ${videoFile.name} (${this.formatBytes(videoFile.length)})`,
    );

    logger.info(`[Hybrid] ⬇️ Step 4: Downloading video...`);
    const downloadedPath = await this.downloadVideoFile(
      infoHash,
      videoFile,
      torrentData,
    );

    if (!downloadedPath) {
      throw new Error("Download failed");
    }

    if (this.cacheManager) {
      this.cacheManager.set(infoHash, {
        filePath: downloadedPath,
        fileSize: videoFile.length,
        fileName: videoFile.name,
        downloadedAt: Date.now(),
        method: "http",
      });
    }

    logger.info(`[Hybrid] ✅ Ready to stream!`);

    return {
      method: "http",
      success: true,
      cached: true,
      infoHash,
      filePath: downloadedPath,
      fileSize: videoFile.length,
      fileName: videoFile.name,
    };
  }

  /**
   * Download .torrent file with validation
   */
  async downloadTorrentFile(infoHash) {
    const sources = [
      {
        url: `https://itorrents.org/torrent/${infoHash.toUpperCase()}.torrent`,
        name: "iTorrents",
      },
      {
        url: null,
        name: "DHT",
        useDHT: true,
      },
    ];

    for (const source of sources) {
      try {
        if (source.useDHT) {
          logger.info(`[Hybrid] Trying DHT method...`);
          const dhtResult = await this.getTorrentViaDHT(infoHash);
          if (dhtResult) {
            logger.info(`[Hybrid] ✓ Got metadata via DHT`);
            return dhtResult;
          }
          continue;
        }

        logger.info(`[Hybrid] Trying ${source.name}...`);

        const response = await axios.get(source.url, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/x-bittorrent",
          },
          maxRedirects: 5,
        });

        if (!response.data || response.data.length === 0) {
          continue;
        }

        const buffer = Buffer.from(response.data);

        // Validate: torrent files start with 'd' (bencode)
        if (buffer[0] !== 0x64) {
          const preview = buffer.toString("utf-8", 0, 100);
          if (preview.includes("<html") || preview.includes("<!doctype")) {
            logger.warn(`[Hybrid] ${source.name}: Got HTML instead of torrent`);
            continue;
          }
          logger.warn(`[Hybrid] ${source.name}: Invalid format`);
          continue;
        }

        logger.info(`[Hybrid] ✓ Valid torrent from ${source.name}`);
        return buffer;
      } catch (error) {
        logger.warn(`[Hybrid] ${source.name} failed: ${error.message}`);
      }
    }

    return null;
  }

  /**
   * Get metadata via DHT (fallback method)
   */
  async getTorrentViaDHT(infoHash) {
    try {
      const WebTorrent = (await import("webtorrent")).default;
      const client = new WebTorrent({ dht: true, tracker: false });

      return new Promise((resolve, reject) => {
        const magnet = `magnet:?xt=urn:btih:${infoHash}`;
        const timeout = setTimeout(() => {
          client.destroy();
          reject(new Error("DHT timeout"));
        }, 30000);

        const torrent = client.add(magnet);

        torrent.on("metadata", async () => {
          clearTimeout(timeout);

          try {
            const torrentFile = await parseTorrent.toTorrentFile(torrent);
            client.destroy();
            resolve(torrentFile);
          } catch (err) {
            client.destroy();
            reject(err);
          }
        });

        torrent.on("error", (err) => {
          clearTimeout(timeout);
          client.destroy();
          reject(err);
        });
      });
    } catch (error) {
      logger.warn(`[Hybrid] DHT failed: ${error.message}`);
      return null;
    }
  }

  async parseTorrentFile(buffer) {
    try {
      const torrentData = await parseTorrent(buffer);
      logger.info(`[Hybrid] ✓ Parsed: ${torrentData.name}`);
      logger.info(`[Hybrid] Files: ${torrentData.files?.length || 0}`);
      return torrentData;
    } catch (error) {
      logger.error(`[Hybrid] Parse error: ${error.message}`);
      throw error;
    }
  }

  findLargestVideoFile(files) {
    const videoExts = [
      ".mp4",
      ".mkv",
      ".avi",
      ".webm",
      ".mov",
      ".flv",
      ".m4v",
      ".wmv",
    ];
    const videos = files.filter((f) =>
      videoExts.includes(path.extname(f.name).toLowerCase()),
    );

    if (videos.length === 0) return null;

    return videos.reduce((prev, curr) =>
      curr.length > prev.length ? curr : prev,
    );
  }

  async downloadVideoFile(infoHash, fileInfo, torrentData) {
    const fileName = fileInfo.name;
    const fileSize = fileInfo.length;
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const localPath = path.join(this.downloadPath, `${infoHash}_${sanitized}`);

    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      if (stats.size === fileSize) {
        logger.info(`[Hybrid] ✓ Already downloaded`);
        return localPath;
      }
      fs.unlinkSync(localPath);
    }

    // Get all available sources dynamically (excluding WebTor.io if requested)
    const allSources = downloadSources.getAllSources(
      infoHash,
      fileName,
      torrentData,
    );

    // Filter out WebTor.io if needed
    const sources = allSources.filter((source) => source.name !== "WebTor.io");

    logger.info(
      `[Hybrid] 🔍 Found ${sources.length} alternative download sources`,
    );
    logger.info(`[Hybrid] Sources: ${sources.map((s) => s.name).join(", ")}`);

    for (const source of sources) {
      try {
        logger.info(`[Hybrid] 📥 Trying ${source.name}...`);

        // Handle async URL building (for premium services)
        let url = source.url;
        if (source.isAsync && typeof source.buildUrl === "function") {
          logger.info(`[Hybrid] Getting URL from ${source.name}...`);
          url = await source.buildUrl(infoHash, fileName, torrentData);
        }

        logger.info(`[Hybrid] URL: ${url}`);
        logger.info(
          `[Hybrid] Size: ${this.formatBytes(fileSize)} - may take several minutes`,
        );

        const response = await axios({
          method: "GET",
          url: url,
          responseType: "stream",
          timeout: 600000,
          maxContentLength: fileSize + 10000000,
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "*/*",
            "Accept-Encoding": "identity",
          },
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 300,
        });

        const writer = fs.createWriteStream(localPath);
        let downloaded = 0;
        let lastLog = Date.now();

        response.data.on("data", (chunk) => {
          downloaded += chunk.length;
          if (Date.now() - lastLog > 5000) {
            const percent = ((downloaded / fileSize) * 100).toFixed(1);
            logger.info(
              `[Hybrid] [${source.name}] Progress: ${percent}% (${this.formatBytes(downloaded)}/${this.formatBytes(fileSize)})`,
            );
            lastLog = Date.now();
          }
        });

        await pipeline(response.data, writer);

        const stats = fs.statSync(localPath);
        logger.info(
          `[Hybrid] ✅ Downloaded from ${source.name}: ${this.formatBytes(stats.size)}`,
        );

        if (stats.size < fileSize * 0.95) {
          logger.warn(
            `[Hybrid] Size mismatch (expected ${this.formatBytes(fileSize)}, got ${this.formatBytes(stats.size)})`,
          );
          fs.unlinkSync(localPath);
          downloadSources.updateSourceHealth(source.name, false);
          continue;
        }

        logger.info(`[Hybrid] ✓ Successfully downloaded from ${source.name}!`);
        downloadSources.updateSourceHealth(source.name, true);
        return localPath;
      } catch (error) {
        logger.error(`[Hybrid] ${source.name} failed: ${error.message}`);
        downloadSources.updateSourceHealth(source.name, false);
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        // Continue to next source
      }
    }

    throw new Error(`Download failed from all ${sources.length} sources`);
  }

  extractInfoHash(magnetOrHash) {
    if (magnetOrHash.startsWith("magnet:")) {
      const match = magnetOrHash.match(/btih:([a-fA-F0-9]{40})/i);
      return match ? match[1].toLowerCase() : null;
    }
    return magnetOrHash.toLowerCase();
  }

  formatBytes(bytes) {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}

let instance = null;

export function createHybridStreamService(torrentService, cacheManager) {
  if (!instance) {
    instance = new HybridStreamService(torrentService, cacheManager);
  }
  return instance;
}

export default createHybridStreamService;
