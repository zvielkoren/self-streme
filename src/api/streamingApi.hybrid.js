import express from "express";
import fs from "fs";
import path from "path";
import pump from "pump";
import logger from "../utils/logger.js";
import { createHybridStreamService } from "../services/hybridStreamService.js";

/**
 * Streaming API Router with Hybrid P2P + External Fallback
 */
export function createStreamingRouter(torrentService, cacheManager) {
  const router = express.Router();
  const hybridService = createHybridStreamService(torrentService);

  /**
   * GET /stream/proxy/:infoHash
   * Smart hybrid streaming - tries P2P first, falls back to external
   */
  router.get("/stream/proxy/:infoHash", async (req, res) => {
    const { infoHash } = req.params;
    const fileIndex = parseInt(req.query.fileIndex, 10) || 0;
    const forceDownload = req.query.download === "true";

    try {
      logger.info(`[Streaming] Request for ${infoHash}, fileIndex: ${fileIndex}`);

      // Try hybrid approach (P2P + fallback)
      const result = await hybridService.getStreamUrl(infoHash, { fileIndex });

      if (result.method === 'p2p' && result.local) {
        // P2P succeeded - stream from local
        logger.info(`[Streaming] Using P2P for ${infoHash}`);
        return await streamFromP2P(req, res, result, fileIndex, forceDownload);
      } else if (result.method === 'external' && result.streamUrl) {
        // External service - redirect
        logger.info(`[Streaming] Using external service for ${infoHash}`);
        return res.redirect(302, result.streamUrl);
      }

      // Shouldn't reach here, but handle it
      return res.status(500).json({
        error: 'Unknown streaming method',
        result
      });

    } catch (error) {
      logger.error(`[Streaming] Error for ${infoHash}:`, error);

      if (!res.headersSent) {
        res.status(500).json({
          error: "Streaming failed",
          message: error.message,
          infoHash,
          hint: "Try accessing via /stream/magnet?magnet=... for guaranteed external fallback"
        });
      }
    }
  });

  /**
   * Stream from P2P (local torrent)
   */
  async function streamFromP2P(req, res, result, fileIndex, forceDownload) {
    const { torrent, infoHash, cached } = result;

    let filePath, fileSize, fileName;

    if (cached && result.localPath) {
      // Stream from cache
      filePath = result.localPath;
      const stat = fs.statSync(filePath);
      fileSize = stat.size;
      fileName = path.basename(filePath);
      logger.info(`[Streaming] From cache: ${filePath}`);
    } else if (torrent) {
      // Stream from active torrent
      const file = torrent.files[fileIndex] || torrent.files[0];
      if (!file) {
        throw new Error('File not found in torrent');
      }

      filePath = path.join(torrent.path, file.path);
      fileSize = file.length;
      fileName = file.name;

      // Enable sequential download
      file.select();
      logger.info(`[Streaming] From torrent: ${fileName}`);
    } else {
      throw new Error('Invalid P2P result');
    }

    // Set up streaming with Range support
    return await streamFile(req, res, filePath, fileSize, fileName, forceDownload, torrent, fileIndex);
  }

  /**
   * Helper function to stream a file with Range Request support
   */
  async function streamFile(req, res, filePath, fileSize, fileName, forceDownload, torrent, fileIndex) {
    const range = req.headers.range;
    const mimeType = getMimeType(fileName);

    // Handle Range Requests (HTTP 206 Partial Content)
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).set({
          "Content-Range": `bytes */${fileSize}`,
        });
        return res.end();
      }

      logger.debug(`[Streaming] Range: ${start}-${end}/${fileSize}`);

      res.status(206);
      res.set({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
      });

      if (forceDownload) {
        res.set("Content-Disposition", `attachment; filename="${fileName}"`);
      }

      // Stream from torrent or file system
      const stream = torrent
        ? (torrent.files[fileIndex] || torrent.files[0]).createReadStream({ start, end })
        : fs.createReadStream(filePath, { start, end });

      stream.on("error", (err) => {
        logger.error("[Streaming] Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      pump(stream, res, (err) => {
        if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
          logger.error("[Streaming] Pump error:", err);
        }
      });
    } else {
      // Full file stream
      logger.debug(`[Streaming] Full file: ${fileSize} bytes`);

      res.status(200);
      res.set({
        "Content-Length": fileSize,
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      });

      if (forceDownload) {
        res.set("Content-Disposition", `attachment; filename="${fileName}"`);
      }

      const stream = torrent
        ? (torrent.files[fileIndex] || torrent.files[0]).createReadStream()
        : fs.createReadStream(filePath);

      stream.on("error", (err) => {
        logger.error("[Streaming] Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      pump(stream, res, (err) => {
        if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
          logger.error("[Streaming] Pump error:", err);
        }
      });
    }
  }

  /**
   * Helper to determine MIME type
   */
  function getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      ".mp4": "video/mp4",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".flv": "video/x-flv",
      ".m4v": "video/x-m4v",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  /**
   * GET /stream/info/:infoHash
   * Get info about torrent with hybrid status
   */
  router.get("/stream/info/:infoHash", async (req, res) => {
    const { infoHash } = req.params;

    try {
      // Check if available via P2P
      const status = await hybridService.checkStatus(infoHash);

      res.json({
        success: true,
        infoHash,
        method: status.method,
        available: status.available,
        p2p: status.method === 'p2p' ? status : null,
        fallbackAvailable: hybridService.useExternalFallback
      });
    } catch (error) {
      logger.error("[Streaming] Info error:", error);
      res.status(500).json({
        error: "Failed to get stream info",
        message: error.message,
        infoHash,
      });
    }
  });

  /**
   * OPTIONS - CORS
   */
  router.options("/stream/proxy/:infoHash", (req, res) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
      "Access-Control-Max-Age": "86400",
    });
    res.status(204).end();
  });

  return router;
}

export default createStreamingRouter;
