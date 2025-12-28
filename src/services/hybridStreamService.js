/**
 * Hybrid Stream Service with HTTP Download Fallback
 * Fixed: Better .torrent file validation and DHT fallback
 * Enhanced: Dynamic download sources instead of hardcoded WebTor.io
 * Enhanced: Multi-part parallel downloading for speed optimization
 * Enhanced: Instant streaming - start playback before download completes
 */

import logger from "../utils/logger.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";
import parseTorrent from "parse-torrent";
import { pipeline } from "stream/promises";
import downloadSources from "./torrentDownloadSources.js";
import MultipartDownloader from "./multipartDownloader.js";
import StreamingDownloader from "./streamingDownloader.js";

class HybridStreamService {
  constructor(torrentService, cacheManager) {
    this.torrentService = torrentService;
    this.cacheManager = cacheManager;
    this.p2pTimeout = parseInt(process.env.P2P_TIMEOUT, 10) || 60000; // Increased to 60s for better P2P success
    this.enableHttpFallback = process.env.ENABLE_HTTP_FALLBACK !== "false";
    this.downloadPath = path.join(config.paths.temp, "downloads");
    this.maxRetries = parseInt(process.env.HTTP_MAX_RETRIES, 10) || 2; // Retry failed sources
    this.excludedSources = process.env.EXCLUDE_DOWNLOAD_SOURCES
      ? process.env.EXCLUDE_DOWNLOAD_SOURCES.split(",").map((s) => s.trim())
      : []; // Allow filtering sources via env var
    this.parallelDownloads = parseInt(process.env.PARALLEL_DOWNLOADS, 10) || 3; // Try multiple sources simultaneously
    this.enableParallelRace = process.env.ENABLE_PARALLEL_RACE !== "false"; // Race multiple sources
    this.sourceErrors = new Map(); // Track detailed errors per source

    // Multi-part download configuration
    this.enableMultipart = process.env.ENABLE_MULTIPART_DOWNLOAD !== "false";
    this.multipartChunkSize =
      parseInt(process.env.MULTIPART_CHUNK_SIZE, 10) || 10 * 1024 * 1024; // 10MB
    this.multipartConnections =
      parseInt(process.env.MULTIPART_CONNECTIONS, 10) || 8; // 8 parallel connections
    this.multipartMinSize =
      parseInt(process.env.MULTIPART_MIN_SIZE, 10) || 50 * 1024 * 1024; // 50MB minimum

    this.multipartDownloader = new MultipartDownloader({
      chunkSize: this.multipartChunkSize,
      maxConnections: this.multipartConnections,
      minFileSizeForMultipart: this.multipartMinSize,
    });

    // Instant streaming configuration
    this.enableInstantStreaming =
      process.env.ENABLE_INSTANT_STREAMING !== "false";
    this.initialBufferSize =
      parseInt(process.env.INITIAL_BUFFER_SIZE, 10) || 10 * 1024 * 1024; // 10MB buffer

    this.streamingDownloader = new StreamingDownloader({
      chunkSize: 2 * 1024 * 1024, // 2MB chunks for responsive streaming
      maxConnections: 4, // Conservative for stability
      initialBufferSize: this.initialBufferSize,
    });

    try {
      if (!fs.existsSync(this.downloadPath)) {
        fs.mkdirSync(this.downloadPath, { recursive: true });
      }
    } catch (error) {
      logger.error(`[Hybrid] Failed to create download directory ${this.downloadPath}: ${error.message}`);
    }

    logger.info("[Hybrid] Service initialized");
    logger.info(`[Hybrid] P2P timeout: ${this.p2pTimeout}ms`);
    logger.info(`[Hybrid] HTTP fallback: ${this.enableHttpFallback}`);
    logger.info(`[Hybrid] Parallel downloads: ${this.parallelDownloads}`);
    logger.info(`[Hybrid] Parallel race mode: ${this.enableParallelRace}`);
    logger.info(`[Hybrid] Multi-part download: ${this.enableMultipart}`);
    if (this.enableMultipart) {
      logger.info(
        `[Hybrid] Chunk size: ${this.formatBytes(this.multipartChunkSize)}`,
      );
      logger.info(`[Hybrid] Connections: ${this.multipartConnections}`);
      logger.info(
        `[Hybrid] Min file size: ${this.formatBytes(this.multipartMinSize)}`,
      );
    }
    logger.info(`[Hybrid] Instant streaming: ${this.enableInstantStreaming}`);
    if (this.enableInstantStreaming) {
      logger.info(
        `[Hybrid] Initial buffer: ${this.formatBytes(this.initialBufferSize)}`,
      );
    }
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
    let client;
    try {
      const WebTorrent = (await import("webtorrent")).default;
      client = new WebTorrent({ dht: true, tracker: false });

      return new Promise(async (resolve, reject) => {
        const magnet = `magnet:?xt=urn:btih:${infoHash}`;
        const timeout = setTimeout(async () => {
          if (client) await client.destroy();
          reject(new Error("DHT timeout"));
        }, 30000);

        try {
          const torrent = await client.add(magnet);

          torrent.on("metadata", async () => {
            clearTimeout(timeout);

            try {
              const torrentFile = parseTorrent.toTorrentFile(torrent);
              await client.destroy();
              resolve(torrentFile);
            } catch (err) {
              await client.destroy();
              reject(err);
            }
          });

          torrent.on("error", async (err) => {
            clearTimeout(timeout);
            await client.destroy();
            reject(err);
          });
        } catch (err) {
          clearTimeout(timeout);
          if (client) await client.destroy();
          reject(err);
        }
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

    // Get all available sources dynamically
    const allSources = downloadSources.getAllSources(
      infoHash,
      fileName,
      torrentData,
    );

    // Filter out excluded sources (configurable via EXCLUDE_DOWNLOAD_SOURCES env var)
    const sources = allSources.filter(
      (source) => !this.excludedSources.includes(source.name),
    );

    logger.info(
      `[Hybrid] 🔍 Found ${sources.length} download sources (excluded: ${this.excludedSources.length > 0 ? this.excludedSources.join(", ") : "none"})`,
    );
    logger.info(`[Hybrid] Sources: ${sources.map((s) => s.name).join(", ")}`);

    if (sources.length === 0) {
      throw new Error(
        "No download sources available. Configure premium debrid service or remove EXCLUDE_DOWNLOAD_SOURCES filter.",
      );
    }

    // Clear previous errors for this attempt
    this.sourceErrors.clear();

    // Use parallel race mode if enabled and we have multiple sources
    if (this.enableParallelRace && sources.length > 1) {
      logger.info(
        `[Hybrid] 🏁 Racing ${Math.min(this.parallelDownloads, sources.length)} sources in parallel for fastest result...`,
      );

      try {
        return await this.downloadWithParallelRace(
          sources,
          infoHash,
          fileName,
          torrentData,
          localPath,
          fileSize,
        );
      } catch (error) {
        logger.warn(`[Hybrid] Parallel race failed: ${error.message}`);
        // Fall through to sequential mode
      }
    }

    // Sequential mode (original behavior)
    logger.info(`[Hybrid] 📥 Trying sources sequentially...`);
    for (const source of sources) {
      let lastError = null;

      // Retry each source up to maxRetries times
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const retryMsg =
            attempt > 1 ? ` (attempt ${attempt}/${this.maxRetries})` : "";
          logger.info(`[Hybrid] 📥 Trying ${source.name}${retryMsg}...`);

          const result = await this.downloadFromSource(
            source,
            infoHash,
            fileName,
            torrentData,
            localPath,
            fileSize,
          );

          if (result) {
            logger.info(
              `[Hybrid] ✓ Successfully downloaded from ${source.name}!`,
            );
            downloadSources.updateSourceHealth(source.name, true);
            return localPath;
          }
        } catch (error) {
          lastError = error;
          const errorDetails = this.formatError(error);
          this.sourceErrors.set(source.name, errorDetails);

          logger.error(
            `[Hybrid] ${source.name} failed (attempt ${attempt}/${this.maxRetries}): ${errorDetails}`,
          );
          downloadSources.updateSourceHealth(source.name, false);
          if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

          // Wait before retry (exponential backoff)
          if (attempt < this.maxRetries) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            logger.info(`[Hybrid] Waiting ${waitTime}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        }
      }

      // All retries failed for this source, log final error
      if (lastError) {
        logger.error(
          `[Hybrid] ${source.name} exhausted all retries: ${this.formatError(lastError)}`,
        );
      }
    }

    // Provide detailed error summary with specific failures
    const errorDetails = Array.from(this.sourceErrors.entries())
      .map(([name, error]) => `  • ${name}: ${error}`)
      .join("\n");

    const errorMsg =
      `Download failed from all ${sources.length} sources.\n\n` +
      `Failures:\n${errorDetails}\n\n` +
      `Solutions:\n` +
      `  1. Add Real-Debrid API key (95% success): REAL_DEBRID_API_KEY=your_key\n` +
      `  2. Check if torrent has seeders (might be dead)\n` +
      `  3. Try a different/more popular torrent\n` +
      `  4. Wait 30-60 minutes (rate limits reset)\n` +
      `  5. See: docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md`;

    logger.error(`[Hybrid] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  /**
   * Download from a single source (extracted for reuse)
   */
  async downloadFromSource(
    source,
    infoHash,
    fileName,
    torrentData,
    localPath,
    fileSize,
  ) {
    // Handle async URL building (for premium services)
    let url = source.url;
    if (source.isAsync && typeof source.buildUrl === "function") {
      logger.info(`[Hybrid] Getting URL from ${source.name}...`);
      url = await source.buildUrl(infoHash, fileName, torrentData);
    }

    if (!url) {
      logger.warn(`[Hybrid] ${source.name} returned no URL, skipping...`);
      return null;
    }

    logger.info(`[Hybrid] Downloading from: ${source.name}`);
    logger.info(`[Hybrid] URL: ${url.substring(0, 80)}...`);
    logger.info(
      `[Hybrid] Size: ${this.formatBytes(fileSize)} - may take several minutes`,
    );

    const tempPath = `${localPath}.${source.name}.tmp`;

    // Use instant streaming if enabled (start playback before download completes)
    if (this.enableInstantStreaming && source.supportsResume) {
      try {
        logger.info(
          `[Hybrid] [${source.name}] 🎬 Using instant streaming mode (playback starts immediately)`,
        );

        const result = await this.streamingDownloader.startStreamingDownload(
          url,
          tempPath,
          {
            fileSize,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Accept: "*/*",
              Referer: new URL(url).origin,
            },
            onProgress: (progress) => {
              if (
                progress.percent % 10 === 0 ||
                progress.downloaded < this.initialBufferSize
              ) {
                logger.info(
                  `[Hybrid] [${source.name}] Progress: ${progress.percent}% (${this.formatBytes(progress.downloaded)}/${this.formatBytes(progress.total)})`,
                );
              }
            },
          },
        );

        if (result.success && result.ready) {
          // File is ready to stream (initial buffer downloaded)
          // Background download continues automatically
          logger.info(
            `[Hybrid] ✅ Ready to stream! Initial buffer downloaded, continuing in background...`,
          );

          // Move temp file to final location
          if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
          fs.renameSync(tempPath, localPath);

          return true;
        }
      } catch (error) {
        logger.warn(
          `[Hybrid] Instant streaming failed: ${error.message}, trying multi-part download`,
        );
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        // Fall through to multi-part or single connection
      }
    }

    // Use multi-part downloader if enabled and supported
    if (
      this.enableMultipart &&
      fileSize >= this.multipartMinSize &&
      source.supportsResume
    ) {
      try {
        logger.info(
          `[Hybrid] [${source.name}] Using multi-part download (${this.multipartConnections} connections)`,
        );

        const result = await this.multipartDownloader.download(url, tempPath, {
          fileSize,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "*/*",
            Referer: new URL(url).origin,
          },
          onProgress: (progress) => {
            logger.info(
              `[Hybrid] [${source.name}] Progress: ${progress.percent}% (${this.formatBytes(progress.downloaded)}/${this.formatBytes(progress.total)}) @ ${progress.speed} ETA: ${progress.eta}`,
            );
          },
        });

        if (result.success) {
          // Verify size
          const stats = fs.statSync(tempPath);
          if (stats.size < fileSize * 0.95) {
            logger.warn(
              `[Hybrid] Size mismatch (expected ${this.formatBytes(fileSize)}, got ${this.formatBytes(stats.size)})`,
            );
            fs.unlinkSync(tempPath);
            throw new Error(
              `Size mismatch: expected ${this.formatBytes(fileSize)}, got ${this.formatBytes(stats.size)}`,
            );
          }

          // Move temp file to final location
          if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
          fs.renameSync(tempPath, localPath);

          logger.info(
            `[Hybrid] ✅ Multi-part download complete: ${this.formatBytes(stats.size)} in ${this.formatBytes(result.avgSpeed)}/s`,
          );
          return true;
        }
      } catch (error) {
        logger.warn(
          `[Hybrid] Multi-part download failed: ${error.message}, falling back to single connection`,
        );
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        // Fall through to single connection download
      }
    }

    // Single connection download (fallback or default)
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 600000,
      maxContentLength: fileSize + 10000000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
        "Accept-Encoding": "identity",
        Referer: new URL(url).origin,
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const writer = fs.createWriteStream(tempPath);
    let downloaded = 0;
    let lastLog = Date.now();
    const startTime = Date.now();

    response.data.on("data", (chunk) => {
      downloaded += chunk.length;
      if (Date.now() - lastLog > 5000) {
        const percent = ((downloaded / fileSize) * 100).toFixed(1);
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = downloaded / elapsed;
        const eta = (fileSize - downloaded) / speed;
        logger.info(
          `[Hybrid] [${source.name}] Progress: ${percent}% (${this.formatBytes(downloaded)}/${this.formatBytes(fileSize)}) @ ${this.formatBytes(speed)}/s ETA: ${this.formatTime(eta)}`,
        );
        lastLog = Date.now();
      }
    });

    await pipeline(response.data, writer);

    const stats = fs.statSync(tempPath);
    logger.info(
      `[Hybrid] ✅ Downloaded from ${source.name}: ${this.formatBytes(stats.size)}`,
    );

    if (stats.size < fileSize * 0.95) {
      logger.warn(
        `[Hybrid] Size mismatch (expected ${this.formatBytes(fileSize)}, got ${this.formatBytes(stats.size)})`,
      );
      fs.unlinkSync(tempPath);
      throw new Error(
        `Size mismatch: expected ${this.formatBytes(fileSize)}, got ${this.formatBytes(stats.size)}`,
      );
    }

    // Move temp file to final location
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    fs.renameSync(tempPath, localPath);

    return true;
  }

  /**
   * Format seconds to human readable time
   */
  formatTime(seconds) {
    if (!seconds || seconds <= 0) return "0s";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600)
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }

  /**
   * Race multiple sources in parallel - first one to complete wins
   */
  async downloadWithParallelRace(
    sources,
    infoHash,
    fileName,
    torrentData,
    localPath,
    fileSize,
  ) {
    const raceSources = sources.slice(0, this.parallelDownloads);
    logger.info(
      `[Hybrid] 🏁 Starting parallel race with: ${raceSources.map((s) => s.name).join(", ")}`,
    );

    const downloadPromises = raceSources.map(async (source) => {
      try {
        const sourcePath = `${localPath}.${source.name}.race`;
        const result = await this.downloadFromSource(
          source,
          infoHash,
          fileName,
          torrentData,
          sourcePath,
          fileSize,
        );

        if (result) {
          // Winner! Move file to final location
          if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
          fs.renameSync(sourcePath, localPath);

          logger.info(`[Hybrid] 🏆 ${source.name} won the race!`);
          return { success: true, source: source.name, path: sourcePath };
        }
        return {
          success: false,
          source: source.name,
          error: "Download failed",
        };
      } catch (error) {
        const errorDetails = this.formatError(error);
        this.sourceErrors.set(source.name, errorDetails);
        logger.warn(`[Hybrid] [Race] ${source.name} failed: ${errorDetails}`);
        return { success: false, source: source.name, error: errorDetails };
      }
    });

    // Race the downloads - first to complete wins
    const result = await Promise.race(downloadPromises);

    if (result.success) {
      // Cancel other downloads by cleaning up temp files
      setTimeout(() => {
        raceSources.forEach((source) => {
          const tempPath = `${localPath}.${source.name}.race`;
          if (fs.existsSync(tempPath)) {
            try {
              fs.unlinkSync(tempPath);
            } catch (e) {
              /* ignore */
            }
          }
        });
      }, 1000);

      return localPath;
    }

    // If race failed, wait for all to finish and collect errors
    const allResults = await Promise.allSettled(downloadPromises);
    const successResult = allResults.find(
      (r) => r.status === "fulfilled" && r.value.success,
    );

    if (successResult) {
      return localPath;
    }

    throw new Error("All parallel downloads failed");
  }

  /**
   * Format error for better logging
   */
  formatError(error) {
    if (error.response) {
      return `HTTP ${error.response.status} - ${error.response.statusText || "Error"}`;
    }
    if (error.code === "ECONNREFUSED") {
      return "Connection refused (service not running)";
    }
    if (error.code === "ENOTFOUND") {
      return "Domain not found (service down or DNS error)";
    }
    if (error.code === "ETIMEDOUT" || error.code === "ESOCKETTIMEDOUT") {
      return "Connection timeout (slow network or service overloaded)";
    }
    if (error.code === "ECONNRESET") {
      return "Connection reset by server";
    }
    if (error.message) {
      return error.message;
    }
    return String(error);
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
