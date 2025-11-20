import express from 'express';
import fs from 'fs';
import path from 'path';
import pump from 'pump';
import logger from '../utils/logger.js';

/**
 * Streaming API Router
 * Provides HTTP streaming with Range Request support (206 Partial Content)
 * Optimized for video playback with seeking and mobile device support
 */
export function createStreamingRouter(torrentService, cacheManager) {
  const router = express.Router();

  /**
   * GET /stream/proxy/:infoHash
   * Stream a torrent file with full Range Request support
   * Query params:
   *   - fileIndex: Index of file to stream (default: 0, largest file)
   *   - download: Set to 'true' to force download instead of stream
   */
  router.get('/stream/proxy/:infoHash', async (req, res) => {
    const { infoHash } = req.params;
    const fileIndex = parseInt(req.query.fileIndex, 10) || 0;
    const forceDownload = req.query.download === 'true';

    try {
      logger.info(`Stream request for ${infoHash}, fileIndex: ${fileIndex}`);

      // Check if file is in cache
      let filePath = null;
      let fileSize = null;
      let fileName = null;
      let torrent = null;

      if (cacheManager.has(infoHash)) {
        const cached = cacheManager.get(infoHash);
        filePath = cached.filePath;

        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          fileSize = stat.size;
          fileName = path.basename(filePath);
          logger.info(`Streaming from cache: ${filePath}`);
        } else {
          logger.warn(`Cached file not found: ${filePath}`);
          cacheManager.delete(infoHash);
        }
      }

      // If not in cache, download torrent
      if (!filePath) {
        logger.info(`File not in cache, starting torrent download: ${infoHash}`);

        const result = await torrentService.addTorrent(infoHash);
        torrent = result.torrent;

        if (!torrent) {
          return res.status(404).json({
            error: 'Torrent not found or failed to start',
            infoHash,
          });
        }

        // Get the file from torrent
        const file = torrent.files[fileIndex] || torrent.files[0];
        if (!file) {
          return res.status(404).json({
            error: 'File not found in torrent',
            infoHash,
            fileIndex,
          });
        }

        filePath = path.join(torrent.path, file.path);
        fileSize = file.length;
        fileName = file.name;

        // Enable sequential download for streaming
        file.select();

        logger.info(`Streaming from torrent: ${fileName} (${fileSize} bytes)`);
      }

      // Set up streaming response
      await streamFile(req, res, filePath, fileSize, fileName, forceDownload, torrent, fileIndex);

    } catch (error) {
      logger.error('Streaming error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Streaming failed',
          message: error.message,
          infoHash,
        });
      }
    }
  });

  /**
   * GET /stream/file/:infoHash/:fileIndex
   * Stream a specific file from a torrent by index
   */
  router.get('/stream/file/:infoHash/:fileIndex', async (req, res) => {
    const { infoHash, fileIndex } = req.params;
    const index = parseInt(fileIndex, 10);

    if (isNaN(index) || index < 0) {
      return res.status(400).json({
        error: 'Invalid file index',
      });
    }

    // Redirect to main stream endpoint
    res.redirect(`/stream/proxy/${infoHash}?fileIndex=${index}`);
  });

  /**
   * Helper function to stream a file with Range Request support
   */
  async function streamFile(req, res, filePath, fileSize, fileName, forceDownload, torrent, fileIndex) {
    const range = req.headers.range;

    // Determine MIME type
    const mimeType = getMimeType(fileName);

    // Handle Range Requests (HTTP 206 Partial Content)
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).set({
          'Content-Range': `bytes */${fileSize}`,
        });
        return res.end();
      }

      logger.debug(`Range request: ${start}-${end}/${fileSize}`);

      // Set response headers for partial content
      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
      });

      if (forceDownload) {
        res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      }

      // Stream from torrent if available
      if (torrent) {
        const file = torrent.files[fileIndex] || torrent.files[0];
        const stream = file.createReadStream({ start, end });

        stream.on('error', (err) => {
          logger.error('Stream error:', err);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        pump(stream, res, (err) => {
          if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
            logger.error('Pump error:', err);
          }
        });
      } else {
        // Stream from file system
        const stream = fs.createReadStream(filePath, { start, end });

        stream.on('error', (err) => {
          logger.error('File stream error:', err);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        pump(stream, res, (err) => {
          if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
            logger.error('Pump error:', err);
          }
        });
      }
    } else {
      // No range request - stream entire file
      logger.debug(`Full file stream: ${fileSize} bytes`);

      res.status(200);
      res.set({
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });

      if (forceDownload) {
        res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      }

      // Stream from torrent if available
      if (torrent) {
        const file = torrent.files[fileIndex] || torrent.files[0];
        const stream = file.createReadStream();

        stream.on('error', (err) => {
          logger.error('Stream error:', err);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        pump(stream, res, (err) => {
          if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
            logger.error('Pump error:', err);
          }
        });
      } else {
        // Stream from file system
        const stream = fs.createReadStream(filePath);

        stream.on('error', (err) => {
          logger.error('File stream error:', err);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        pump(stream, res, (err) => {
          if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
            logger.error('Pump error:', err);
          }
        });
      }
    }
  }

  /**
   * Helper function to determine MIME type from file extension
   */
  function getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.flv': 'video/x-flv',
      '.m4v': 'video/x-m4v',
      '.wmv': 'video/x-ms-wmv',
      '.mpg': 'video/mpeg',
      '.mpeg': 'video/mpeg',
      '.ogv': 'video/ogg',
      '.3gp': 'video/3gpp',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.m4a': 'audio/mp4',
      '.srt': 'text/plain',
      '.vtt': 'text/vtt',
      '.ass': 'text/plain',
      '.ssa': 'text/plain',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * GET /stream/info/:infoHash
   * Get information about streamable files in a torrent
   */
  router.get('/stream/info/:infoHash', async (req, res) => {
    const { infoHash } = req.params;

    try {
      const files = await torrentService.getTorrentFiles(infoHash);

      // Filter video files
      const videoExtensions = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.flv', '.m4v'];
      const videoFiles = files.filter(file => {
        const ext = path.extname(file.name).toLowerCase();
        return videoExtensions.includes(ext);
      });

      res.json({
        success: true,
        data: {
          infoHash,
          totalFiles: files.length,
          videoFiles: videoFiles.length,
          files: files.map(file => ({
            ...file,
            streamUrl: `/stream/file/${infoHash}/${file.index}`,
            isVideo: videoExtensions.includes(path.extname(file.name).toLowerCase()),
          })),
        },
      });
    } catch (error) {
      logger.error('Error getting stream info:', error);
      res.status(500).json({
        error: 'Failed to get stream info',
        message: error.message,
      });
    }
  });

  /**
   * OPTIONS /stream/proxy/:infoHash
   * CORS preflight for streaming
   */
  router.options('/stream/proxy/:infoHash', (req, res) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
      'Access-Control-Max-Age': '86400',
    });
    res.status(204).end();
  });

  return router;
}

export default createStreamingRouter;
