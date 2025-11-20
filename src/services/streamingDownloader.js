/**
 * Streaming Downloader
 *
 * Downloads files while allowing immediate streaming playback.
 * Prioritizes downloading the beginning of the file first for instant playback.
 *
 * Features:
 * - Instant streaming (start playback before download completes)
 * - Priority-based chunk downloading (beginning first, then sequential)
 * - Range request support for seeking
 * - Progress tracking
 * - Resume support
 */

import fs from "fs";
import axios from "axios";
import { EventEmitter } from "events";
import logger from "../utils/logger.js";

class StreamingDownloader extends EventEmitter {
  constructor(options = {}) {
    super();

    this.chunkSize = options.chunkSize || 2 * 1024 * 1024; // 2MB chunks for responsive streaming
    this.maxConnections = options.maxConnections || 4; // Conservative for streaming
    this.initialBufferSize = options.initialBufferSize || 10 * 1024 * 1024; // 10MB initial buffer
    this.timeout = options.timeout || 300000; // 5 minutes per chunk
    this.retries = options.retries || 3;

    // Streaming state
    this.downloadedChunks = new Map(); // chunkIndex -> buffer
    this.downloadingChunks = new Set(); // Currently downloading chunk indexes
    this.readyToStream = false;
    this.totalSize = 0;
    this.filePath = null;
    this.fileHandle = null;
  }

  /**
   * Start streaming download
   * Returns immediately with file path, download continues in background
   */
  async startStreamingDownload(url, outputPath, options = {}) {
    const { fileSize, headers = {}, onProgress } = options;

    this.filePath = outputPath;
    this.onProgressCallback = onProgress;

    logger.info(`[StreamDownload] Starting streaming download to ${outputPath}`);

    // Check if server supports range requests
    const supportsRange = await this.checkRangeSupport(url, headers);
    if (!supportsRange) {
      logger.warn(`[StreamDownload] Server doesn't support ranges, using progressive download`);
      return await this.progressiveDownload(url, outputPath, { fileSize, headers, onProgress });
    }

    // Get file size
    this.totalSize = fileSize || await this.getFileSize(url, headers);
    logger.info(`[StreamDownload] File size: ${this.formatBytes(this.totalSize)}`);

    // Create sparse file (reserve space)
    await this.createSparseFile(outputPath, this.totalSize);

    // Start downloading initial buffer (first 10MB) for immediate playback
    logger.info(`[StreamDownload] Downloading initial buffer (${this.formatBytes(this.initialBufferSize)})...`);
    await this.downloadInitialBuffer(url, headers);

    logger.info(`[StreamDownload] ✅ Ready to stream! Continuing background download...`);
    this.readyToStream = true;
    this.emit('ready', { path: outputPath, size: this.totalSize });

    // Continue downloading rest of file in background
    this.continueBackgroundDownload(url, headers).catch(error => {
      logger.error(`[StreamDownload] Background download failed: ${error.message}`);
      this.emit('error', error);
    });

    return {
      success: true,
      path: outputPath,
      size: this.totalSize,
      streaming: true,
      ready: true,
    };
  }

  /**
   * Check if server supports range requests
   */
  async checkRangeSupport(url, headers = {}) {
    try {
      const response = await axios.head(url, {
        headers: {
          ...headers,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
        maxRedirects: 5,
      });

      const acceptRanges = response.headers['accept-ranges'];
      return acceptRanges === 'bytes';
    } catch (error) {
      logger.warn(`[StreamDownload] Failed to check range support: ${error.message}`);
      return false;
    }
  }

  /**
   * Get file size from server
   */
  async getFileSize(url, headers = {}) {
    try {
      const response = await axios.head(url, {
        headers: {
          ...headers,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
        maxRedirects: 5,
      });

      const contentLength = response.headers['content-length'];
      if (!contentLength) {
        throw new Error('Content-Length header not found');
      }

      return parseInt(contentLength, 10);
    } catch (error) {
      throw new Error(`Failed to get file size: ${error.message}`);
    }
  }

  /**
   * Create sparse file (allocate space without writing)
   */
  async createSparseFile(path, size) {
    // Create file and set size
    const fd = fs.openSync(path, 'w');
    fs.ftruncateSync(fd, size);
    fs.closeSync(fd);

    logger.debug(`[StreamDownload] Created sparse file: ${this.formatBytes(size)}`);
  }

  /**
   * Download initial buffer for immediate playback
   */
  async downloadInitialBuffer(url, headers) {
    const bufferEnd = Math.min(this.initialBufferSize - 1, this.totalSize - 1);

    logger.info(`[StreamDownload] Downloading bytes 0-${bufferEnd}...`);

    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        headers: {
          ...headers,
          'Range': `bytes=0-${bufferEnd}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: this.timeout,
        maxRedirects: 5,
      });

      if (response.status !== 206) {
        throw new Error(`Expected 206 Partial Content, got ${response.status}`);
      }

      // Write to file
      const buffer = Buffer.from(response.data);
      const fd = fs.openSync(this.filePath, 'r+');
      fs.writeSync(fd, buffer, 0, buffer.length, 0);
      fs.fsyncSync(fd); // Ensure data is written to disk
      fs.closeSync(fd);

      logger.info(`[StreamDownload] ✓ Initial buffer downloaded: ${this.formatBytes(buffer.length)}`);

      // Emit progress
      if (this.onProgressCallback) {
        this.onProgressCallback({
          downloaded: buffer.length,
          total: this.totalSize,
          percent: ((buffer.length / this.totalSize) * 100).toFixed(1),
        });
      }

    } catch (error) {
      logger.error(`[StreamDownload] Failed to download initial buffer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Continue downloading rest of file in background
   */
  async continueBackgroundDownload(url, headers) {
    const startByte = this.initialBufferSize;
    const chunks = this.createChunks(startByte, this.totalSize);

    logger.info(`[StreamDownload] Background download: ${chunks.length} chunks remaining`);

    let downloadedBytes = this.initialBufferSize;

    // Download chunks sequentially (prioritize sequential playback)
    for (let i = 0; i < chunks.length; i += this.maxConnections) {
      const batch = chunks.slice(i, i + this.maxConnections);

      const batchPromises = batch.map(async (chunk) => {
        try {
          await this.downloadChunk(url, chunk, headers);
          downloadedBytes += chunk.size;

          // Emit progress
          if (this.onProgressCallback) {
            const percent = ((downloadedBytes / this.totalSize) * 100).toFixed(1);
            this.onProgressCallback({
              downloaded: downloadedBytes,
              total: this.totalSize,
              percent: percent,
            });
          }

          return true;
        } catch (error) {
          logger.error(`[StreamDownload] Chunk ${chunk.index} failed: ${error.message}`);
          return false;
        }
      });

      await Promise.allSettled(batchPromises);
    }

    logger.info(`[StreamDownload] ✅ Background download complete!`);
    this.emit('complete', { path: this.filePath, size: this.totalSize });
  }

  /**
   * Create chunk ranges
   */
  createChunks(startByte, totalSize) {
    const chunks = [];
    const numChunks = Math.ceil((totalSize - startByte) / this.chunkSize);

    for (let i = 0; i < numChunks; i++) {
      const start = startByte + (i * this.chunkSize);
      const end = Math.min(start + this.chunkSize - 1, totalSize - 1);

      chunks.push({
        index: i,
        start,
        end,
        size: end - start + 1,
      });
    }

    return chunks;
  }

  /**
   * Download a single chunk
   */
  async downloadChunk(url, chunk, headers) {
    let lastError;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'arraybuffer',
          headers: {
            ...headers,
            'Range': `bytes=${chunk.start}-${chunk.end}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: this.timeout,
          maxRedirects: 5,
        });

        if (response.status !== 206) {
          throw new Error(`Expected 206 Partial Content, got ${response.status}`);
        }

        // Write chunk to file at correct position
        const buffer = Buffer.from(response.data);
        const fd = fs.openSync(this.filePath, 'r+');
        fs.writeSync(fd, buffer, 0, buffer.length, chunk.start);
        fs.closeSync(fd);

        logger.debug(`[StreamDownload] ✓ Chunk ${chunk.index} downloaded`);
        return true;

      } catch (error) {
        lastError = error;
        logger.debug(`[StreamDownload] Chunk ${chunk.index} attempt ${attempt}/${this.retries} failed: ${error.message}`);

        if (attempt < this.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to download chunk ${chunk.index} after ${this.retries} attempts: ${lastError.message}`);
  }

  /**
   * Progressive download (fallback when range requests not supported)
   */
  async progressiveDownload(url, outputPath, options = {}) {
    const { fileSize, headers = {}, onProgress } = options;

    logger.info(`[StreamDownload] Starting progressive download (no range support)`);

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: {
        ...headers,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: this.timeout,
      maxRedirects: 5,
    });

    const totalSize = fileSize || parseInt(response.headers['content-length'] || '0', 10);
    const writer = fs.createWriteStream(outputPath);
    let downloaded = 0;
    let initialBufferReady = false;

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;

      // Signal ready after initial buffer
      if (!initialBufferReady && downloaded >= this.initialBufferSize) {
        initialBufferReady = true;
        logger.info(`[StreamDownload] ✅ Ready to stream (progressive mode)`);
        this.emit('ready', { path: outputPath, size: totalSize });
      }

      // Progress callback
      if (onProgress) {
        const percent = totalSize > 0 ? (downloaded / totalSize) * 100 : 0;
        onProgress({
          downloaded,
          total: totalSize,
          percent: percent.toFixed(1),
        });
      }
    });

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', () => {
        logger.info(`[StreamDownload] ✅ Progressive download complete`);
        this.emit('complete', { path: outputPath, size: downloaded });
        resolve();
      });
      writer.on('error', reject);
      response.data.on('error', reject);
    });

    return {
      success: true,
      path: outputPath,
      size: downloaded,
      streaming: true,
      ready: true,
    };
  }

  /**
   * Get download progress
   */
  getProgress() {
    return {
      ready: this.readyToStream,
      totalSize: this.totalSize,
      path: this.filePath,
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.fileHandle) {
      try {
        fs.closeSync(this.fileHandle);
      } catch (e) {
        // Ignore
      }
      this.fileHandle = null;
    }
  }
}

export default StreamingDownloader;
