import express from "express";
import fs from "fs";
import path from "path";
import pump from "pump";
import logger from "../utils/logger.js";
import { createHybridStreamService } from "../services/hybridStreamService.js";
import deduplicator from "../services/requestDeduplicator.js";

/**
 * Streaming API Router with Deduplication
 */
export function createStreamingRouter(torrentService, cacheManager) {
  const router = express.Router();
  const hybridService = createHybridStreamService(torrentService, cacheManager);

  /**
   * GET /stream/proxy/:infoHash
   * Smart streaming with request deduplication
   */
  router.get("/stream/proxy/:infoHash", async (req, res) => {
    const { infoHash } = req.params;
    const fileIndex = parseInt(req.query.fileIndex, 10) || 0;
    const forceDownload = req.query.download === "true";

    try {
      logger.info(`[API] Stream request for ${infoHash}, fileIndex: ${fileIndex}`);

      // Deduplicate concurrent requests for same torrent
      const dedupKey = `stream:${infoHash}:${fileIndex}`;
      
      const result = await deduplicator.deduplicate(dedupKey, async () => {
        return await hybridService.getStream(infoHash, { fileIndex });
      });

      logger.info(`[API] Stream method: ${result.method} for ${infoHash}`);

      // All methods result in a local file we can stream
      const filePath = result.filePath;
      const fileSize = result.fileSize || fs.statSync(filePath).size;
      const fileName = result.fileName || path.basename(filePath);

      logger.info(`[API] Streaming ${fileName} (${formatBytes(fileSize)}) via ${result.method}`);

      // Stream the file with Range support
      return await streamFile(req, res, filePath, fileSize, fileName, forceDownload, result.torrent, fileIndex);

    } catch (error) {
      logger.error(`[API] Streaming error for ${infoHash}:`, error);

      if (!res.headersSent) {
        res.status(500).json({
          error: "Streaming failed",
          message: error.message,
          infoHash,
          hint: "The torrent may be unavailable or have no seeders"
        });
      }
    }
  });

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

      logger.debug(`[API] Range request: ${start}-${end}/${fileSize}`);

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
      let stream;
      if (torrent && !torrent.destroyed) {
        const file = torrent.files[fileIndex] || torrent.files[0];
        stream = file.createReadStream({ start, end });
      } else {
        stream = fs.createReadStream(filePath, { start, end });
      }

      stream.on("error", (err) => {
        logger.error("[API] Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      pump(stream, res, (err) => {
        if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
          logger.error("[API] Pump error:", err);
        }
      });
    } else {
      // Full file stream
      logger.debug(`[API] Full file stream: ${fileSize} bytes`);

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

      let stream;
      if (torrent && !torrent.destroyed) {
        const file = torrent.files[fileIndex] || torrent.files[0];
        stream = file.createReadStream();
      } else {
        stream = fs.createReadStream(filePath);
      }

      stream.on("error", (err) => {
        logger.error("[API] Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      pump(stream, res, (err) => {
        if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
          logger.error("[API] Pump error:", err);
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
      ".wmv": "video/x-ms-wmv",
      ".mpg": "video/mpeg",
      ".mpeg": "video/mpeg",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  /**
   * Format bytes
   */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * GET /stream/file/:infoHash/:fileIndex
   */
  router.get("/stream/file/:infoHash/:fileIndex", async (req, res) => {
    const { infoHash, fileIndex } = req.params;
    const index = parseInt(fileIndex, 10);

    if (isNaN(index) || index < 0) {
      return res.status(400).json({
        error: "Invalid file index",
      });
    }

    res.redirect(`/stream/proxy/${infoHash}?fileIndex=${index}`);
  });

  /**
   * GET /stream/info/:infoHash
   */
  router.get("/stream/info/:infoHash", async (req, res) => {
    const { infoHash } = req.params;

    try {
      const inCache = cacheManager && cacheManager.has(infoHash);
      
      res.json({
        success: true,
        infoHash,
        cached: inCache,
        methods: {
          p2p: "Will try P2P first (20s timeout)",
          httpFallback: "Will download via HTTP if P2P fails",
          cache: inCache ? "Available in cache" : "Not cached yet"
        },
        streamUrl: `/stream/proxy/${infoHash}`,
        note: "Duplicate requests are automatically deduplicated"
      });
    } catch (error) {
      logger.error("[API] Info error:", error);
      res.status(500).json({
        error: "Failed to get stream info",
        message: error.message,
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
