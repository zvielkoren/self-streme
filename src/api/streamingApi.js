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

  // Store for async link generation
  const linkGenerationCache = new Map();
  const linkGenerationTimeout = 300000; // 5 minutes

  /**
   * POST /stream/prepare/:infoHash
   * Pre-generate stream link (async) to avoid Cloudflare tunnel timeout
   * Returns job ID immediately, client polls for readiness
   */
  router.post("/stream/prepare/:infoHash", async (req, res) => {
    const { infoHash } = req.params;
    const fileIndex = parseInt(req.query.fileIndex, 10) || 0;
    const jobId = `${infoHash}:${fileIndex}:${Date.now()}`;

    logger.info(
      `[API] Preparing stream for ${infoHash}, fileIndex: ${fileIndex}, jobId: ${jobId}`,
    );

    // Return job ID immediately
    res.json({
      success: true,
      jobId,
      infoHash,
      fileIndex,
      statusUrl: `/stream/status/${jobId}`,
      streamUrl: `/stream/ready/${jobId}`,
      estimatedTime: "30-90 seconds",
      message: "Stream preparation started. Poll statusUrl for progress.",
    });

    // Start async preparation
    linkGenerationCache.set(jobId, {
      status: "preparing",
      progress: 0,
      infoHash,
      fileIndex,
      startedAt: Date.now(),
      message: "Starting stream preparation...",
    });

    // Prepare stream in background
    (async () => {
      try {
        logger.info(
          `[API] Background: Starting stream preparation for ${jobId}`,
        );

        // Update progress
        linkGenerationCache.set(jobId, {
          ...linkGenerationCache.get(jobId),
          status: "connecting",
          progress: 10,
          message: "Trying P2P connections...",
        });

        const dedupKey = `stream:${infoHash}:${fileIndex}`;
        const result = await deduplicator.deduplicate(dedupKey, async () => {
          return await hybridService.getStream(infoHash, { fileIndex });
        });

        logger.info(
          `[API] Background: Stream ready via ${result.method} for ${jobId}`,
        );

        // Mark as ready
        linkGenerationCache.set(jobId, {
          status: "ready",
          progress: 100,
          infoHash,
          fileIndex,
          method: result.method,
          filePath: result.filePath,
          fileSize: result.fileSize || fs.statSync(result.filePath).size,
          fileName: result.fileName || path.basename(result.filePath),
          torrent: result.torrent,
          readyAt: Date.now(),
          expiresAt: Date.now() + linkGenerationTimeout,
          message: `Stream ready via ${result.method}`,
        });

        // Auto-cleanup after timeout
        setTimeout(() => {
          linkGenerationCache.delete(jobId);
          logger.info(`[API] Cleaned up expired job: ${jobId}`);
        }, linkGenerationTimeout);
      } catch (error) {
        logger.error(
          `[API] Background: Stream preparation failed for ${jobId}:`,
          error,
        );

        linkGenerationCache.set(jobId, {
          status: "failed",
          progress: 0,
          infoHash,
          fileIndex,
          error: error.message,
          failedAt: Date.now(),
          message: `Failed: ${error.message}`,
        });

        // Cleanup failed jobs after 1 minute
        setTimeout(() => {
          linkGenerationCache.delete(jobId);
        }, 60000);
      }
    })();
  });

  /**
   * GET /stream/status/:jobId
   * Check status of async stream preparation
   */
  router.get("/stream/status/:jobId", async (req, res) => {
    const { jobId } = req.params;
    const job = linkGenerationCache.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
        message: "Job may have expired or never existed",
      });
    }

    res.json({
      success: true,
      jobId,
      status: job.status,
      progress: job.progress,
      message: job.message,
      ...(job.status === "ready" && {
        streamUrl: `/stream/ready/${jobId}`,
        method: job.method,
        fileName: job.fileName,
        fileSize: job.fileSize,
        expiresAt: job.expiresAt,
      }),
      ...(job.status === "failed" && {
        error: job.error,
      }),
    });
  });

  /**
   * GET /stream/ready/:jobId
   * Stream pre-generated link (instant response)
   */
  router.get("/stream/ready/:jobId", async (req, res) => {
    const { jobId } = req.params;
    const job = linkGenerationCache.get(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
        message: "Job may have expired. Please prepare stream again.",
      });
    }

    if (job.status !== "ready") {
      return res.status(202).json({
        success: false,
        status: job.status,
        message: job.message,
        progress: job.progress,
        statusUrl: `/stream/status/${jobId}`,
      });
    }

    // Stream is ready - serve it immediately
    logger.info(`[API] Streaming ready job ${jobId}: ${job.fileName}`);

    try {
      await streamFile(
        req,
        res,
        job.filePath,
        job.fileSize,
        job.fileName,
        false,
        job.torrent,
        job.fileIndex,
      );
    } catch (error) {
      logger.error(`[API] Stream error for job ${jobId}:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Streaming failed",
          message: error.message,
        });
      }
    }
  });

  /**
   * GET /stream/proxy/:infoHash
   * Smart streaming with request deduplication (original endpoint, kept for compatibility)
   */
  router.get("/stream/proxy/:infoHash", async (req, res) => {
    const { infoHash } = req.params;
    const fileIndex = parseInt(req.query.fileIndex, 10) || 0;
    const forceDownload = req.query.download === "true";

    try {
      logger.info(
        `[API] Stream request for ${infoHash}, fileIndex: ${fileIndex}`,
      );

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

      logger.info(
        `[API] Streaming ${fileName} (${formatBytes(fileSize)}) via ${result.method}`,
      );

      // Stream the file with Range support
      return await streamFile(
        req,
        res,
        filePath,
        fileSize,
        fileName,
        forceDownload,
        result.torrent,
        fileIndex,
      );
    } catch (error) {
      logger.error(`[API] Streaming error for ${infoHash}:`, error);

      if (!res.headersSent) {
        res.status(500).json({
          error: "Streaming failed",
          message: error.message,
          infoHash,
          hint: "The torrent may be unavailable or have no seeders",
        });
      }
    }
  });

  /**
   * GET /:infoHash/:fileIndex
   * Compatibility endpoint for internal/legacy stream URLs (e.g. from stremio-addon-sdk)
   */
  router.get("/:infoHash/:fileIndex", async (req, res) => {
    const { infoHash, fileIndex } = req.params;
    
    // Check if infoHash is valid (40 char hex)
    if (!/^[a-f0-9]{40}$/i.test(infoHash)) {
      return res.status(404).end();
    }

    const index = parseInt(fileIndex, 10) || 0;
    const tr = req.query.tr; // Tracker/Magnet parameter

    logger.info(`[API] Compatibility stream request: ${infoHash}, index: ${index}`);

    try {
      const dedupKey = `stream:${infoHash}:${index}`;
      const identifier = tr || infoHash;

      const result = await deduplicator.deduplicate(dedupKey, async () => {
        return await hybridService.getStream(identifier, { fileIndex: index });
      });

      const filePath = result.filePath;
      const fileSize = result.fileSize || fs.statSync(filePath).size;
      const fileName = result.fileName || path.basename(filePath);

      return await streamFile(
        req,
        res,
        filePath,
        fileSize,
        fileName,
        false,
        result.torrent,
        index,
      );
    } catch (error) {
      logger.error(`[API] Compatibility stream error:`, error);
      if (!res.headersSent) res.status(500).send("Streaming failed");
    }
  });

  /**
   * Helper function to stream a file with Range Request support
   */
  async function streamFile(
    req,
    res,
    filePath,
    fileSize,
    fileName,
    forceDownload,
    torrent,
    fileIndex,
  ) {
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
        "Access-Control-Expose-Headers":
          "Content-Range, Accept-Ranges, Content-Length",
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
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
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
    const fileIndex = parseInt(req.query.fileIndex, 10) || 0;

    try {
      const inCache = cacheManager && cacheManager.has(infoHash);

      res.json({
        success: true,
        infoHash,
        fileIndex,
        cached: inCache,
        methods: {
          p2p: "Will try P2P first (60s timeout)",
          httpFallback: "Will download via HTTP if P2P fails",
          cache: inCache ? "Available in cache" : "Not cached yet",
        },
        endpoints: {
          directStream: `/stream/proxy/${infoHash}?fileIndex=${fileIndex}`,
          asyncPrepare: `/stream/prepare/${infoHash}?fileIndex=${fileIndex}`,
          info: `/stream/info/${infoHash}?fileIndex=${fileIndex}`,
        },
        recommendation:
          "Use /stream/prepare for slow connections or Cloudflare tunnel to avoid timeout",
        note: "Duplicate requests are automatically deduplicated",
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
      "Access-Control-Expose-Headers":
        "Content-Range, Accept-Ranges, Content-Length",
      "Access-Control-Max-Age": "86400",
    });
    res.status(204).end();
  });

  return router;
}

export default createStreamingRouter;
