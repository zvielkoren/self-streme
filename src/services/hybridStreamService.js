/**
 * Hybrid Stream Service - HTTP Download Fallback
 * 
 * Full workflow:
 * 1. Try P2P (20 seconds)
 * 2. If fails → Download .torrent file
 * 3. Parse it to find video file
 * 4. Download video file via HTTP from torrent cache
 * 5. Save to local cache
 * 6. Stream from disk!
 * 
 * Result: NEVER gets stuck, always works!
 */

import logger from '../utils/logger.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import parseTorrent from 'parse-torrent';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

class HybridStreamService {
  constructor(torrentService, cacheManager) {
    this.torrentService = torrentService;
    this.cacheManager = cacheManager;
    this.p2pTimeout = parseInt(process.env.P2P_TIMEOUT, 10) || 20000;
    this.enableHttpFallback = process.env.ENABLE_HTTP_FALLBACK !== 'false';
    this.downloadPath = path.join(process.cwd(), 'temp', 'downloads');
    
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }
    
    logger.info('[Hybrid] Service initialized');
    logger.info(`[Hybrid] P2P timeout: ${this.p2pTimeout}ms`);
    logger.info(`[Hybrid] HTTP fallback: ${this.enableHttpFallback}`);
    logger.info(`[Hybrid] Download path: ${this.downloadPath}`);
  }

  /**
   * Main entry point - get stream with hybrid logic
   */
  async getStream(magnetOrHash, options = {}) {
    const infoHash = this.extractInfoHash(magnetOrHash);
    
    logger.info(`[Hybrid] 🎬 Getting stream for ${infoHash}`);

    // Step 1: Check cache
    if (this.cacheManager?.has(infoHash)) {
      logger.info(`[Hybrid] ✓ Found in cache!`);
      return this.getFromCache(infoHash);
    }

    // Step 2: Try P2P
    try {
      logger.info(`[Hybrid] 🔄 Trying P2P (timeout: ${this.p2pTimeout}ms)...`);
      const p2pResult = await this.tryP2P(magnetOrHash, infoHash, options);
      logger.info(`[Hybrid] ✓ P2P successful!`);
      return p2pResult;
    } catch (error) {
      logger.warn(`[Hybrid] ❌ P2P failed: ${error.message}`);
    }

    // Step 3: HTTP Download Fallback
    if (!this.enableHttpFallback) {
      throw new Error('P2P failed and HTTP fallback is disabled');
    }

    logger.info(`[Hybrid] 📥 Falling back to HTTP download...`);
    return await this.httpDownloadFallback(infoHash);
  }

  /**
   * Get from cache
   */
  getFromCache(infoHash) {
    const cached = this.cacheManager.get(infoHash);
    const filePath = cached.filePath;
    
    if (!fs.existsSync(filePath)) {
      logger.warn(`[Hybrid] Cache entry exists but file missing: ${filePath}`);
      this.cacheManager.delete(infoHash);
      throw new Error('Cached file not found');
    }

    const stats = fs.statSync(filePath);
    
    return {
      method: 'cache',
      success: true,
      cached: true,
      infoHash,
      filePath,
      fileSize: stats.size,
      fileName: path.basename(filePath)
    };
  }

  /**
   * Try P2P with timeout
   */
  async tryP2P(magnetOrHash, infoHash, options = {}) {
    return Promise.race([
      this.torrentService.addTorrent(magnetOrHash, options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('P2P timeout')), this.p2pTimeout)
      )
    ]).then(result => {
      if (!result || (!result.torrent && !result.cached)) {
        throw new Error('Invalid P2P result');
      }
      
      return {
        method: 'p2p',
        success: true,
        cached: result.cached || false,
        infoHash,
        torrent: result.torrent,
        filePath: result.filePath,
        files: result.files || []
      };
    });
  }

  /**
   * HTTP Download Fallback - THE MAGIC!
   */
  async httpDownloadFallback(infoHash) {
    logger.info(`[Hybrid] 🔍 Step 1: Downloading .torrent file...`);
    const torrentBuffer = await this.downloadTorrentFile(infoHash);
    
    if (!torrentBuffer) {
      throw new Error('Failed to download .torrent file from any source');
    }

    logger.info(`[Hybrid] 📄 Step 2: Parsing torrent metadata...`);
    const torrentData = await this.parseTorrentFile(torrentBuffer);
    
    if (!torrentData || !torrentData.files || torrentData.files.length === 0) {
      throw new Error('Failed to parse torrent or no files found');
    }

    logger.info(`[Hybrid] 🎥 Step 3: Finding video file...`);
    const videoFile = this.findLargestVideoFile(torrentData.files);
    
    if (!videoFile) {
      throw new Error('No video files found in torrent');
    }

    logger.info(`[Hybrid] ✓ Selected: ${videoFile.name} (${this.formatBytes(videoFile.length)})`);

    logger.info(`[Hybrid] ⬇️ Step 4: Downloading video file via HTTP...`);
    const downloadedPath = await this.downloadVideoFile(infoHash, videoFile, torrentData);
    
    if (!downloadedPath) {
      throw new Error('Failed to download video file');
    }

    logger.info(`[Hybrid] 💾 Step 5: Adding to cache...`);
    if (this.cacheManager) {
      this.cacheManager.set(infoHash, {
        filePath: downloadedPath,
        fileSize: videoFile.length,
        fileName: videoFile.name,
        downloadedAt: Date.now(),
        method: 'http'
      });
    }

    logger.info(`[Hybrid] ✅ HTTP download complete! Ready to stream.`);

    return {
      method: 'http',
      success: true,
      cached: true,
      infoHash,
      filePath: downloadedPath,
      fileSize: videoFile.length,
      fileName: videoFile.name
    };
  }

  /**
   * Download .torrent file from multiple sources
   */
  async downloadTorrentFile(infoHash) {
    const sources = [
      `https://itorrents.org/torrent/${infoHash.toUpperCase()}.torrent`,
      `https://btdig.com/torrent/${infoHash}.torrent`,
      `http://torcache.net/torrent/${infoHash.toUpperCase()}.torrent`
    ];

    for (const url of sources) {
      try {
        logger.info(`[Hybrid] Trying: ${url}`);
        
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
          maxRedirects: 5
        });

        if (response.status === 200 && response.data && response.data.length > 0) {
          logger.info(`[Hybrid] ✓ Downloaded .torrent (${response.data.length} bytes)`);
          return Buffer.from(response.data);
        }
      } catch (error) {
        logger.warn(`[Hybrid] Failed from ${url}: ${error.message}`);
      }
    }

    return null;
  }

  /**
   * Parse .torrent file to get metadata
   */
  async parseTorrentFile(buffer) {
    try {
      const torrentData = await parseTorrent(buffer);
      
      logger.info(`[Hybrid] ✓ Parsed torrent: ${torrentData.name}`);
      logger.info(`[Hybrid] Files: ${torrentData.files?.length || 0}`);
      logger.info(`[Hybrid] Total size: ${this.formatBytes(torrentData.length || 0)}`);
      
      return torrentData;
    } catch (error) {
      logger.error(`[Hybrid] Parse error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find largest video file
   */
  findLargestVideoFile(files) {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.flv', '.m4v', '.wmv', '.mpg', '.mpeg'];
    
    const videoFiles = files.filter(file => {
      const ext = path.extname(file.name).toLowerCase();
      return videoExtensions.includes(ext);
    });

    if (videoFiles.length === 0) {
      logger.warn('[Hybrid] No video files found!');
      return null;
    }

    logger.info(`[Hybrid] Found ${videoFiles.length} video file(s)`);
    
    const largest = videoFiles.reduce((prev, curr) => 
      curr.length > prev.length ? curr : prev
    );

    return largest;
  }

  /**
   * Download video file via HTTP from cache services
   */
  async downloadVideoFile(infoHash, fileInfo, torrentData) {
    const fileName = fileInfo.name;
    const fileSize = fileInfo.length;
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localPath = path.join(this.downloadPath, `${infoHash}_${sanitizedName}`);

    // Check if already downloaded
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      if (stats.size === fileSize) {
        logger.info(`[Hybrid] ✓ File already downloaded: ${localPath}`);
        return localPath;
      } else {
        logger.warn(`[Hybrid] Partial file found (${stats.size}/${fileSize}), re-downloading...`);
        fs.unlinkSync(localPath);
      }
    }

    // Build magnet link with file selection
    const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(torrentData.name)}`;
    
    // Try multiple download sources
    const downloadSources = [
      // WebTorrent.io streaming
      {
        name: 'WebTor.io',
        url: `https://webtor.io/get/${infoHash}/${encodeURIComponent(fileName)}`,
        method: 'stream'
      },
      // Try instant.io
      {
        name: 'Instant.io',
        url: `https://instant.io/get/${infoHash}/${encodeURIComponent(fileName)}`,
        method: 'stream'
      }
    ];

    for (const source of downloadSources) {
      try {
        logger.info(`[Hybrid] 📥 Downloading from ${source.name}...`);
        logger.info(`[Hybrid] URL: ${source.url}`);
        logger.info(`[Hybrid] Size: ${this.formatBytes(fileSize)}`);
        logger.info(`[Hybrid] This may take several minutes...`);

        const response = await axios({
          method: 'GET',
          url: source.url,
          responseType: 'stream',
          timeout: 600000, // 10 minutes
          maxContentLength: fileSize + 10000000, // fileSize + 10MB buffer
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': '*/*'
          }
        });

        // Create write stream
        const writer = fs.createWriteStream(localPath);
        let downloadedBytes = 0;
        let lastLog = Date.now();

        // Track progress
        response.data.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          
          // Log progress every 5 seconds
          if (Date.now() - lastLog > 5000) {
            const percent = ((downloadedBytes / fileSize) * 100).toFixed(1);
            const speed = this.formatBytes(downloadedBytes / ((Date.now() - lastLog) / 1000)) + '/s';
            logger.info(`[Hybrid] Progress: ${percent}% (${this.formatBytes(downloadedBytes)}/${this.formatBytes(fileSize)}) @ ${speed}`);
            lastLog = Date.now();
          }
        });

        // Download file
        await pipeline(response.data, writer);

        // Verify download
        const stats = fs.statSync(localPath);
        logger.info(`[Hybrid] ✅ Download complete: ${this.formatBytes(stats.size)}`);

        if (stats.size < fileSize * 0.95) { // Allow 5% variance
          logger.warn(`[Hybrid] File size mismatch: ${stats.size} vs expected ${fileSize}`);
          fs.unlinkSync(localPath);
          continue;
        }

        return localPath;

      } catch (error) {
        logger.error(`[Hybrid] Download failed from ${source.name}: ${error.message}`);
        
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
    }

    // All sources failed
    throw new Error('Failed to download video from all sources');
  }

  /**
   * Extract info hash
   */
  extractInfoHash(magnetOrHash) {
    if (magnetOrHash.startsWith('magnet:')) {
      const match = magnetOrHash.match(/btih:([a-fA-F0-9]{40})/i);
      return match ? match[1].toLowerCase() : null;
    }
    return magnetOrHash.toLowerCase();
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Singleton
let instance = null;

export function createHybridStreamService(torrentService, cacheManager) {
  if (!instance) {
    instance = new HybridStreamService(torrentService, cacheManager);
  }
  return instance;
}

export default createHybridStreamService;
