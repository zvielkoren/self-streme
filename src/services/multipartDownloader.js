/**
 * Multi-Part Parallel Downloader
 *
 * Splits large files into chunks and downloads them in parallel for maximum speed.
 * Supports resume, progress tracking, and automatic retry.
 */

import fs from "fs";
import axios from "axios";
import logger from "../utils/logger.js";

class MultipartDownloader {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 10 * 1024 * 1024; // 10MB chunks
    this.maxConnections = options.maxConnections || 8; // Parallel connections
    this.timeout = options.timeout || 300000; // 5 minutes per chunk
    this.retries = options.retries || 3;
    this.minFileSizeForMultipart = options.minFileSizeForMultipart || 50 * 1024 * 1024; // 50MB
  }

  /**
   * Download file with multi-part parallelization
   */
  async download(url, outputPath, options = {}) {
    const { fileSize, onProgress, headers = {} } = options;

    // Check if server supports range requests
    const supportsRange = await this.checkRangeSupport(url, headers);

    if (!supportsRange) {
      logger.info(`[MultiPart] Server doesn't support range requests, using single connection`);
      return await this.downloadSingleConnection(url, outputPath, { fileSize, onProgress, headers });
    }

    // Get file size if not provided
    const totalSize = fileSize || await this.getFileSize(url, headers);

    // Use single connection for small files
    if (totalSize < this.minFileSizeForMultipart) {
      logger.info(`[MultiPart] File too small (${this.formatBytes(totalSize)}), using single connection`);
      return await this.downloadSingleConnection(url, outputPath, { fileSize: totalSize, onProgress, headers });
    }

    logger.info(`[MultiPart] Starting multi-part download: ${this.formatBytes(totalSize)}`);
    logger.info(`[MultiPart] Chunks: ${Math.ceil(totalSize / this.chunkSize)}, Connections: ${this.maxConnections}`);

    // Create chunks
    const chunks = this.createChunks(totalSize);

    // Create temp directory for chunks
    const tempDir = `${outputPath}.parts`;
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Download chunks in parallel
    const startTime = Date.now();
    let downloadedBytes = 0;
    let lastProgressUpdate = Date.now();

    try {
      // Process chunks in batches (limited parallelism)
      const results = [];
      for (let i = 0; i < chunks.length; i += this.maxConnections) {
        const batch = chunks.slice(i, i + this.maxConnections);
        const batchPromises = batch.map(chunk =>
          this.downloadChunk(url, chunk, tempDir, headers, (chunkDownloaded) => {
            downloadedBytes += chunkDownloaded;

            // Throttle progress updates
            if (Date.now() - lastProgressUpdate > 1000 && onProgress) {
              const percent = (downloadedBytes / totalSize) * 100;
              const speed = downloadedBytes / ((Date.now() - startTime) / 1000);
              const eta = (totalSize - downloadedBytes) / speed;

              onProgress({
                downloaded: downloadedBytes,
                total: totalSize,
                percent: percent.toFixed(1),
                speed: this.formatBytes(speed) + '/s',
                eta: this.formatTime(eta),
              });

              lastProgressUpdate = Date.now();
            }
          })
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        logger.info(`[MultiPart] Completed batch ${Math.floor(i / this.maxConnections) + 1}/${Math.ceil(chunks.length / this.maxConnections)}`);
      }

      // Merge chunks into final file
      logger.info(`[MultiPart] All chunks downloaded, merging...`);
      await this.mergeChunks(results, outputPath);

      // Cleanup temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      const totalTime = (Date.now() - startTime) / 1000;
      const avgSpeed = totalSize / totalTime;
      logger.info(`[MultiPart] ✅ Download complete in ${this.formatTime(totalTime)}`);
      logger.info(`[MultiPart] Average speed: ${this.formatBytes(avgSpeed)}/s`);

      return {
        success: true,
        path: outputPath,
        size: totalSize,
        time: totalTime,
        avgSpeed: avgSpeed,
      };
    } catch (error) {
      // Cleanup on error
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  /**
   * Check if server supports HTTP range requests
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
      const contentRange = response.headers['content-range'];

      return acceptRanges === 'bytes' || contentRange !== undefined;
    } catch (error) {
      logger.warn(`[MultiPart] Failed to check range support: ${error.message}`);
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
   * Create chunk ranges
   */
  createChunks(totalSize) {
    const chunks = [];
    const numChunks = Math.ceil(totalSize / this.chunkSize);

    for (let i = 0; i < numChunks; i++) {
      const start = i * this.chunkSize;
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
   * Download a single chunk with retry
   */
  async downloadChunk(url, chunk, tempDir, headers, onProgress) {
    const chunkPath = `${tempDir}/chunk_${chunk.index}`;

    // Skip if chunk already exists and has correct size
    if (fs.existsSync(chunkPath)) {
      const stats = fs.statSync(chunkPath);
      if (stats.size === chunk.size) {
        logger.debug(`[MultiPart] Chunk ${chunk.index} already exists, skipping`);
        return { ...chunk, path: chunkPath };
      }
    }

    let lastError;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'stream',
          headers: {
            ...headers,
            'Range': `bytes=${chunk.start}-${chunk.end}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Encoding': 'identity',
          },
          timeout: this.timeout,
          maxRedirects: 5,
        });

        // Verify partial content response
        if (response.status !== 206) {
          throw new Error(`Expected 206 Partial Content, got ${response.status}`);
        }

        const writer = fs.createWriteStream(chunkPath);
        let downloaded = 0;

        response.data.on('data', (data) => {
          downloaded += data.length;
          if (onProgress) {
            onProgress(data.length);
          }
        });

        await new Promise((resolve, reject) => {
          response.data.pipe(writer);
          writer.on('finish', resolve);
          writer.on('error', reject);
          response.data.on('error', reject);
        });

        // Verify chunk size
        const stats = fs.statSync(chunkPath);
        if (stats.size !== chunk.size) {
          throw new Error(`Chunk size mismatch: expected ${chunk.size}, got ${stats.size}`);
        }

        logger.debug(`[MultiPart] ✓ Chunk ${chunk.index} downloaded (${this.formatBytes(chunk.size)})`);
        return { ...chunk, path: chunkPath };

      } catch (error) {
        lastError = error;
        logger.warn(`[MultiPart] Chunk ${chunk.index} failed (attempt ${attempt}/${this.retries}): ${error.message}`);

        // Clean up partial download
        if (fs.existsSync(chunkPath)) {
          fs.unlinkSync(chunkPath);
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to download chunk ${chunk.index} after ${this.retries} attempts: ${lastError.message}`);
  }

  /**
   * Merge chunks into final file
   */
  async mergeChunks(chunks, outputPath) {
    // Sort chunks by index
    chunks.sort((a, b) => a.index - b.index);

    const output = fs.createWriteStream(outputPath);

    for (const chunk of chunks) {
      const chunkData = fs.readFileSync(chunk.path);
      output.write(chunkData);
    }

    await new Promise((resolve, reject) => {
      output.end(() => resolve());
      output.on('error', reject);
    });

    logger.info(`[MultiPart] ✓ Merged ${chunks.length} chunks into ${outputPath}`);
  }

  /**
   * Download with single connection (fallback)
   */
  async downloadSingleConnection(url, outputPath, options = {}) {
    const { fileSize, onProgress, headers = {} } = options;

    logger.info(`[MultiPart] Downloading with single connection...`);

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: {
        ...headers,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Encoding': 'identity',
      },
      timeout: this.timeout,
      maxRedirects: 5,
    });

    const totalSize = fileSize || parseInt(response.headers['content-length'] || '0', 10);
    const writer = fs.createWriteStream(outputPath);
    let downloaded = 0;
    let lastUpdate = Date.now();
    const startTime = Date.now();

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;

      if (Date.now() - lastUpdate > 1000 && onProgress) {
        const percent = totalSize > 0 ? (downloaded / totalSize) * 100 : 0;
        const speed = downloaded / ((Date.now() - startTime) / 1000);
        const eta = totalSize > 0 ? (totalSize - downloaded) / speed : 0;

        onProgress({
          downloaded,
          total: totalSize,
          percent: percent.toFixed(1),
          speed: this.formatBytes(speed) + '/s',
          eta: this.formatTime(eta),
        });

        lastUpdate = Date.now();
      }
    });

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
    });

    const totalTime = (Date.now() - startTime) / 1000;
    const avgSpeed = downloaded / totalTime;

    logger.info(`[MultiPart] ✓ Download complete in ${this.formatTime(totalTime)}`);
    logger.info(`[MultiPart] Average speed: ${this.formatBytes(avgSpeed)}/s`);

    return {
      success: true,
      path: outputPath,
      size: downloaded,
      time: totalTime,
      avgSpeed: avgSpeed,
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
   * Format seconds to human readable time
   */
  formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

export default MultipartDownloader;
