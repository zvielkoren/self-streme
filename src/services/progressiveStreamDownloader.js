/**
 * Progressive Stream Downloader
 *
 * Allows streaming to start immediately while downloading continues in background.
 * Perfect for UX - customers can start watching within seconds instead of waiting
 * for entire file to download.
 *
 * Features:
 * - Start streaming after minimal buffer (5-10 MB)
 * - Download ahead of playback position
 * - Handle range requests from video player
 * - Parallel chunk downloading for speed
 * - Resume support
 */

import fs from "fs";
import { Readable, PassThrough } from "stream";
import axios from "axios";
import logger from "../utils/logger.js";
import EventEmitter from "events";

class ProgressiveStreamDownloader extends EventEmitter {
  constructor(options = {}) {
    super();

    // Buffer settings
    this.initialBufferSize = options.initialBufferSize || 10 * 1024 * 1024; // 10 MB to start streaming
    this.lookAheadSize = options.lookAheadSize || 50 * 1024 * 1024; // 50 MB ahead of playback
    this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5 MB chunks
    this.maxConnections = options.maxConnections || 4; // Parallel downloads

    // Timeouts
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;

    // State
    this.downloads = new Map(); // Track active downloads
  }

  /**
   * Start progressive download and return stream immediately
   */
  async createProgressiveStream(url, outputPath, options = {}) {
    const { fileSize, headers = {}, onProgress } = options;

    logger.info(`[Progressive] Starting progressive download for ${outputPath}`);

    // Get file size if not provided
    const totalSize = fileSize || await this.getFileSize(url, headers);

    // Check if server supports range requests
    const supportsRange = await this.checkRangeSupport(url, headers);

    if (!supportsRange) {
      logger.warn(`[Progressive] Server doesn't support ranges, using simple stream`);
      return this.createSimpleStream(url, outputPath, { totalSize, headers, onProgress });
    }

    // Create download session
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      url,
      outputPath,
      totalSize,
      headers,
      downloadedRanges: [], // Array of {start, end} ranges that are downloaded
      activeChunks: new Set(), // Currently downloading chunks
      completed: false,
      streamStarted: false,
      bytesStreamed: 0,
      bytesDownloaded: 0,
    };

    this.downloads.set(sessionId, session);

    logger.info(`[Progressive] File size: ${this.formatBytes(totalSize)}`);
    logger.info(`[Progressive] Initial buffer: ${this.formatBytes(this.initialBufferSize)}`);
    logger.info(`[Progressive] Will start streaming after initial buffer is ready`);

    // Create the output file
    const fileHandle = fs.openSync(outputPath, 'w');

    // Pre-allocate file size (makes random writes faster)
    try {
      fs.ftruncateSync(fileHandle, totalSize);
    } catch (err) {
      logger.warn(`[Progressive] Could not pre-allocate file: ${err.message}`);
    }
    fs.closeSync(fileHandle);

    // Start downloading initial buffer
    const initialBufferReady = this.downloadInitialBuffer(session);

    // Create readable stream that will be returned immediately
    const progressiveStream = this.createReadStream(session, onProgress);

    // Wait for initial buffer before allowing reads
    progressiveStream.once('resume', async () => {
      try {
        await initialBufferReady;
        logger.info(`[Progressive] ✓ Initial buffer ready, starting playback`);
        session.streamStarted = true;
        this.emit('streamReady', { sessionId, initialBuffer: this.initialBufferSize });

        // Start background download of rest of file
        this.startBackgroundDownload(session);
      } catch (error) {
        logger.error(`[Progressive] Initial buffer failed: ${error.message}`);
        progressiveStream.destroy(error);
      }
    });

    return {
      stream: progressiveStream,
      sessionId,
      totalSize,
      cleanup: () => this.cleanup(sessionId),
    };
  }

  /**
   * Download initial buffer to allow streaming to start
   */
  async downloadInitialBuffer(session) {
    const bufferEnd = Math.min(this.initialBufferSize - 1, session.totalSize - 1);

    logger.info(`[Progressive] Downloading initial buffer: 0-${this.formatBytes(bufferEnd)}`);

    await this.downloadChunk(session, 0, bufferEnd, true);

    session.downloadedRanges.push({ start: 0, end: bufferEnd });
    session.bytesDownloaded = bufferEnd + 1;

    logger.info(`[Progressive] ✅ Initial buffer downloaded`);
  }

  /**
   * Start background download of remaining file
   */
  async startBackgroundDownload(session) {
    logger.info(`[Progressive] Starting background download of remaining file`);

    const startPosition = this.initialBufferSize;
    const chunks = this.createChunkPlan(startPosition, session.totalSize);

    logger.info(`[Progressive] Will download ${chunks.length} additional chunks in background`);

    // Download chunks in parallel, but prioritize chunks near playback position
    this.downloadChunksWithPriority(session, chunks);
  }

  /**
   * Create readable stream that reads from partially downloaded file
   */
  createReadStream(session, onProgress) {
    const stream = new Readable({
      highWaterMark: 256 * 1024, // 256 KB buffer
      read() {}, // Will be manually pushed
    });

    let position = 0;
    let lastProgressTime = Date.now();

    const readInterval = setInterval(async () => {
      if (session.completed || stream.destroyed) {
        clearInterval(readInterval);
        if (!stream.destroyed) {
          stream.push(null); // EOF
        }
        return;
      }

      try {
        // Check if data at current position is available
        if (this.isRangeDownloaded(session, position, position + 65536)) {
          // Read chunk from file
          const buffer = Buffer.alloc(65536);
          const fd = fs.openSync(session.outputPath, 'r');
          const bytesRead = fs.readSync(fd, buffer, 0, 65536, position);
          fs.closeSync(fd);

          if (bytesRead > 0) {
            const chunk = buffer.slice(0, bytesRead);
            const canPush = stream.push(chunk);
            position += bytesRead;
            session.bytesStreamed = position;

            // Progress reporting
            if (Date.now() - lastProgressTime > 2000 && onProgress) {
              const percent = (position / session.totalSize) * 100;
              const downloadPercent = (session.bytesDownloaded / session.totalSize) * 100;
              onProgress({
                streamed: position,
                downloaded: session.bytesDownloaded,
                total: session.totalSize,
                streamPercent: percent.toFixed(1),
                downloadPercent: downloadPercent.toFixed(1),
              });
              lastProgressTime = Date.now();
            }

            // If position reaches end of file
            if (position >= session.totalSize) {
              stream.push(null); // EOF
              clearInterval(readInterval);
              session.completed = true;
              logger.info(`[Progressive] ✅ Streaming completed`);
              this.cleanup(session.id);
            }

            // If buffer is full, pause reading
            if (!canPush) {
              return;
            }
          }
        } else {
          // Data not ready yet, ensure we're downloading it
          this.ensureRangeBeingDownloaded(session, position);
        }
      } catch (error) {
        logger.error(`[Progressive] Stream read error: ${error.message}`);
        stream.destroy(error);
        clearInterval(readInterval);
      }
    }, 100); // Check every 100ms

    // Cleanup on stream close
    stream.on('close', () => {
      clearInterval(readInterval);
    });

    return stream;
  }

  /**
   * Check if a range has been downloaded
   */
  isRangeDownloaded(session, start, end) {
    for (const range of session.downloadedRanges) {
      if (start >= range.start && end <= range.end) {
        return true;
      }
    }
    return false;
  }

  /**
   * Ensure a range is being downloaded
   */
  ensureRangeBeingDownloaded(session, position) {
    // Check if position is in an active chunk
    const activeChunkKeys = Array.from(session.activeChunks);
    for (const key of activeChunkKeys) {
      const [start, end] = key.split('-').map(Number);
      if (position >= start && position <= end) {
        return; // Already downloading
      }
    }

    // Not being downloaded, start downloading this chunk with high priority
    const chunkStart = Math.floor(position / this.chunkSize) * this.chunkSize;
    const chunkEnd = Math.min(chunkStart + this.chunkSize - 1, session.totalSize - 1);

    if (!this.isRangeDownloaded(session, chunkStart, chunkEnd)) {
      logger.info(`[Progressive] 🚨 Playback waiting for data at ${this.formatBytes(position)}, downloading urgently`);
      this.downloadChunk(session, chunkStart, chunkEnd, true).catch(err => {
        logger.error(`[Progressive] Urgent chunk download failed: ${err.message}`);
      });
    }
  }

  /**
   * Download chunks with priority (closer to playback position = higher priority)
   */
  async downloadChunksWithPriority(session, chunks) {
    const queue = [...chunks];

    while (queue.length > 0 && !session.completed) {
      // Get next batch of chunks (limited by maxConnections)
      const batch = [];
      const activeCount = session.activeChunks.size;
      const availableSlots = this.maxConnections - activeCount;

      for (let i = 0; i < Math.min(availableSlots, queue.length); i++) {
        // Prioritize chunks near current playback position
        const closestIndex = this.findClosestChunk(queue, session.bytesStreamed);
        const chunk = queue.splice(closestIndex, 1)[0];
        batch.push(chunk);
      }

      if (batch.length === 0) {
        // All slots busy, wait a bit
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Download batch in parallel
      const promises = batch.map(chunk =>
        this.downloadChunk(session, chunk.start, chunk.end, false)
          .then(() => {
            session.downloadedRanges.push({ start: chunk.start, end: chunk.end });
            session.bytesDownloaded += (chunk.end - chunk.start + 1);

            // Merge overlapping/adjacent ranges
            this.mergeRanges(session);

            // Check if download is complete
            if (this.isFullyDownloaded(session)) {
              session.completed = true;
              logger.info(`[Progressive] ✅ Background download completed`);
              this.emit('downloadComplete', { sessionId: session.id });
            }
          })
          .catch(err => {
            logger.error(`[Progressive] Chunk ${chunk.start}-${chunk.end} failed: ${err.message}`);
            // Put back in queue for retry
            queue.push(chunk);
          })
      );

      await Promise.allSettled(promises);
    }
  }

  /**
   * Find chunk closest to playback position
   */
  findClosestChunk(chunks, playbackPosition) {
    let closestIndex = 0;
    let closestDistance = Math.abs(chunks[0].start - playbackPosition);

    for (let i = 1; i < chunks.length; i++) {
      const distance = Math.abs(chunks[i].start - playbackPosition);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  /**
   * Download a single chunk
   */
  async downloadChunk(session, start, end, urgent = false) {
    const chunkKey = `${start}-${end}`;

    // Skip if already downloaded
    if (this.isRangeDownloaded(session, start, end)) {
      return;
    }

    // Skip if already downloading (unless urgent)
    if (!urgent && session.activeChunks.has(chunkKey)) {
      return;
    }

    session.activeChunks.add(chunkKey);

    try {
      const size = end - start + 1;
      const logPrefix = urgent ? '🚨 [URGENT]' : '';
      logger.debug(`${logPrefix}[Progressive] Downloading chunk ${this.formatBytes(start)}-${this.formatBytes(end)} (${this.formatBytes(size)})`);

      const response = await axios({
        method: 'GET',
        url: session.url,
        responseType: 'arraybuffer',
        headers: {
          ...session.headers,
          'Range': `bytes=${start}-${end}`,
        },
        timeout: this.timeout,
        maxRedirects: 5,
      });

      if (response.status !== 206) {
        throw new Error(`Expected 206 Partial Content, got ${response.status}`);
      }

      // Write chunk to file at correct position
      const buffer = Buffer.from(response.data);
      const fd = fs.openSync(session.outputPath, 'r+');
      fs.writeSync(fd, buffer, 0, buffer.length, start);
      fs.closeSync(fd);

      logger.debug(`${logPrefix}[Progressive] ✓ Chunk ${this.formatBytes(start)}-${this.formatBytes(end)} written`);

    } finally {
      session.activeChunks.delete(chunkKey);
    }
  }

  /**
   * Create chunk plan for download
   */
  createChunkPlan(startPosition, totalSize) {
    const chunks = [];
    let position = startPosition;

    while (position < totalSize) {
      const chunkEnd = Math.min(position + this.chunkSize - 1, totalSize - 1);
      chunks.push({
        start: position,
        end: chunkEnd,
        size: chunkEnd - position + 1,
      });
      position = chunkEnd + 1;
    }

    return chunks;
  }

  /**
   * Merge overlapping or adjacent ranges
   */
  mergeRanges(session) {
    if (session.downloadedRanges.length <= 1) return;

    // Sort ranges by start position
    session.downloadedRanges.sort((a, b) => a.start - b.start);

    const merged = [session.downloadedRanges[0]];

    for (let i = 1; i < session.downloadedRanges.length; i++) {
      const current = session.downloadedRanges[i];
      const last = merged[merged.length - 1];

      // Check if ranges overlap or are adjacent
      if (current.start <= last.end + 1) {
        // Merge
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push(current);
      }
    }

    session.downloadedRanges = merged;
  }

  /**
   * Check if file is fully downloaded
   */
  isFullyDownloaded(session) {
    if (session.downloadedRanges.length === 0) return false;

    const firstRange = session.downloadedRanges[0];
    const lastRange = session.downloadedRanges[session.downloadedRanges.length - 1];

    return firstRange.start === 0 && lastRange.end === session.totalSize - 1;
  }

  /**
   * Create simple stream (no range support)
   */
  async createSimpleStream(url, outputPath, options) {
    const { totalSize, headers, onProgress } = options;

    logger.info(`[Progressive] Using simple stream (no range support)`);

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: {
        ...headers,
        'User-Agent': 'Mozilla/5.0',
      },
      timeout: this.timeout,
    });

    // Use PassThrough to allow streaming while saving
    const passThrough = new PassThrough();
    const fileStream = fs.createWriteStream(outputPath);

    let downloaded = 0;
    let lastProgress = Date.now();

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;

      // Write to file
      fileStream.write(chunk);

      // Stream to client
      passThrough.write(chunk);

      // Progress
      if (Date.now() - lastProgress > 2000 && onProgress) {
        const percent = totalSize > 0 ? (downloaded / totalSize) * 100 : 0;
        onProgress({
          streamed: downloaded,
          downloaded: downloaded,
          total: totalSize,
          streamPercent: percent.toFixed(1),
          downloadPercent: percent.toFixed(1),
        });
        lastProgress = Date.now();
      }
    });

    response.data.on('end', () => {
      fileStream.end();
      passThrough.end();
      logger.info(`[Progressive] ✅ Simple stream completed`);
    });

    response.data.on('error', (error) => {
      fileStream.destroy(error);
      passThrough.destroy(error);
    });

    const sessionId = this.generateSessionId();
    return {
      stream: passThrough,
      sessionId,
      totalSize,
      cleanup: () => {
        fileStream.destroy();
        passThrough.destroy();
      },
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
          'User-Agent': 'Mozilla/5.0',
        },
        timeout: 10000,
      });

      return response.headers['accept-ranges'] === 'bytes';
    } catch (error) {
      logger.warn(`[Progressive] Could not check range support: ${error.message}`);
      return false;
    }
  }

  /**
   * Get file size
   */
  async getFileSize(url, headers = {}) {
    const response = await axios.head(url, {
      headers: {
        ...headers,
        'User-Agent': 'Mozilla/5.0',
      },
      timeout: 10000,
    });

    const contentLength = response.headers['content-length'];
    if (!contentLength) {
      throw new Error('Content-Length header not found');
    }

    return parseInt(contentLength, 10);
  }

  /**
   * Cleanup session
   */
  cleanup(sessionId) {
    const session = this.downloads.get(sessionId);
    if (session) {
      logger.info(`[Progressive] Cleaning up session ${sessionId}`);
      session.activeChunks.clear();
      this.downloads.delete(sessionId);
    }
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `progressive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Get active sessions info (for monitoring)
   */
  getActiveSessions() {
    const sessions = [];
    for (const [id, session] of this.downloads.entries()) {
      sessions.push({
        id,
        totalSize: session.totalSize,
        bytesDownloaded: session.bytesDownloaded,
        bytesStreamed: session.bytesStreamed,
        downloadPercent: ((session.bytesDownloaded / session.totalSize) * 100).toFixed(1),
        streamPercent: ((session.bytesStreamed / session.totalSize) * 100).toFixed(1),
        activeChunks: session.activeChunks.size,
        streamStarted: session.streamStarted,
        completed: session.completed,
      });
    }
    return sessions;
  }
}

export default ProgressiveStreamDownloader;
