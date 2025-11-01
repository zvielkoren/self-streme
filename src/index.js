import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";
import mime from "mime-types";
import { fileURLToPath } from "url";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import addon, { addonApp } from "./addon.js";
import streamService from "./core/streamService.js";
import torrentService from "./core/torrentService.js";
import manifest from "./manifest.js";
import {
  getProxyAwareBaseUrl,
  getBaseUrlFromRequest,
  isCloudflareRequest,
  getClientIp,
} from "./utils/urlHelper.js";
import ScalableCacheManager from "./services/scalableCacheManager.js";

// File paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporary cache for downloaded files
const TEMP_DIR = path.join(os.tmpdir(), "self-streme");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Scalable cache manager with configurable backend and limits
const cacheManager = new ScalableCacheManager({
  backend: config.cache.backend,
  maxSize: config.cache.maxSize,
  maxDiskUsage: config.cache.maxDiskUsage,
  cleanupInterval: config.cache.cleanupInterval,
  tempDir: TEMP_DIR,
});

// Legacy compatibility - maintain old constants for existing code
const CACHE_LIFETIME = config.cache.ttl * 1000;
const CLEANUP_INTERVAL = config.cache.cleanupInterval * 1000;

// Initialize Express app
const app = express();

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something broke!" });
});

// Trust proxy headers from any reverse proxy (Cloudflare, nginx, Apache, etc.)
app.set("trust proxy", true);

// CORS configuration for Render
app.use(
  cors({
    origin: "*",
    methods: ["GET", "HEAD", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Origin"],
    credentials: true,
  }),
);

// Serve installation page at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "install.html"));
});

// Serve iOS fix test page
app.get("/test-ios-fix", (req, res) => {
  res.sendFile(path.join(__dirname, "test-ios-fix.html"));
});

// Serve source selection test page
app.get("/test-source-selection", (req, res) => {
  res.sendFile(path.join(__dirname, "test-source-selection.html"));
});

// Test endpoint for source selection with direct URL
app.get("/test-stream/:fileIdx", (req, res) => {
  const { fileIdx } = req.params;
  const testStreams = [
    {
      url: "https://file-examples.com/storage/fe5deb0ffdce38e1fe1e39a/2017/10/file_example_MP4_1280_10MG.mp4",
      title: "Sample Video 1",
    },
    {
      url: "https://file-examples.com/storage/fe5deb0ffdce38e1fe1e39a/2017/10/file_example_MP4_640_3MG.mp4",
      title: "Sample Video 2",
    },
    {
      url: "https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4",
      title: "Sample Video 3",
    },
  ];

  const stream = testStreams[parseInt(fileIdx) || 0];
  if (stream) {
    logger.info(`Test stream redirect to: ${stream.url}`);
    res.redirect(stream.url);
  } else {
    res.status(404).send("Test stream not found");
  }
});

// Serve static files from src directory
app.use(express.static(path.join(__dirname)));

// Serve static assets (like placeholder video)
app.use("/static", express.static(path.join(__dirname, "static")));

// Placeholder video endpoint for when no streams are available
app.get("/static/placeholder.mp4", (req, res) => {
  // Return a proper error response for video requests
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(__dirname, "static", "placeholder-error.html"));
});

// Status endpoints
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Debug endpoint - shows URL detection info (helpful for Cloudflare/proxy debugging)
app.get("/debug/url", (req, res) => {
  const { protocol, host, baseUrl } = getBaseUrlFromRequest(req);
  const isCloudflare = isCloudflareRequest(req);
  const clientIp = getClientIp(req);

  res.json({
    detected: {
      protocol,
      host,
      baseUrl,
      isCloudflare,
      clientIp,
    },
    headers: {
      "x-forwarded-proto": req.get("X-Forwarded-Proto") || null,
      "x-forwarded-host": req.get("X-Forwarded-Host") || null,
      "cf-visitor": req.get("CF-Visitor") || null,
      "cf-connecting-ip": req.get("CF-Connecting-IP") || null,
      "cf-ray": req.get("CF-Ray") || null,
      host: req.get("Host") || null,
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV || "development",
      BASE_URL: process.env.BASE_URL || "(auto-detect)",
      RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL || null,
    },
    request: {
      secure: req.secure,
      protocol: req.protocol,
      hostname: req.hostname,
      ip: req.ip,
    },
  });
});

// Explicit manifest endpoint
app.get("/manifest.json", (req, res) => {
  // Get proxy-aware URL information
  const { protocol, host, baseUrl } = getBaseUrlFromRequest(req);

  // Create a copy of the manifest with the correct URL
  const manifestResponse = {
    ...manifest,
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
  };

  res.setHeader("Content-Type", "application/json");
  res.json(manifestResponse);
});

app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

// API endpoint to get current base URL for frontend
app.get("/api/base-url", (req, res) => {
  const { baseUrl } = getBaseUrlFromRequest(req);
  res.json({
    baseUrl: baseUrl,
    manifestUrl: `${baseUrl}/manifest.json`,
    stremioUrl: `stremio://${getBaseUrlFromRequest(req).host}/manifest.json`,
  });
});

// API endpoint to configure cache scheduling
app.get("/api/cache-config", (req, res) => {
  const stats = cacheManager.getStats();
  res.json(stats);
});

app.post("/api/cache-config", express.json(), (req, res) => {
  try {
    const { forceCleanup } = req.body;

    if (forceCleanup) {
      cacheManager
        .forceCleanup()
        .then((result) => {
          logger.info(`Forced cleanup: ${JSON.stringify(result)}`);
          res.json({
            message: `Cleaned ${result.cleanedCount} files, freed ${result.freedSpaceMB.toFixed(2)}MB`,
            ...result,
          });
        })
        .catch((error) => {
          logger.error("Force cleanup error:", error);
          res.status(500).json({ error: "Cleanup failed" });
        });
    } else {
      res.json({
        message: "No action specified",
        stats: cacheManager.getStats(),
      });
    }
  } catch (error) {
    logger.error("Cache config error:", error);
    res.status(500).json({ error: "Configuration error" });
  }
});

// New endpoint for cache statistics and scaling information
app.get("/api/cache-stats", (req, res) => {
  const stats = cacheManager.getStats();
  res.json({
    ...stats,
    scalingInfo: {
      backend: stats.backend,
      isScalable: stats.backend !== "memory",
      supportsPersistence: config.cache.persistent,
      recommendedForProduction:
        stats.backend === "redis" || stats.backend === "sqlite",
    },
  });
});

// iOS stream caching endpoint
app.get("/stream/cache/:infoHash", async (req, res) => {
  try {
    const { infoHash } = req.params;
    const streamInfo = streamService.handler.getStreamInfo(infoHash);

    if (!streamInfo) {
      return res.status(404).json({ error: "Stream not found" });
    }

    // Return cached stream info for iOS
    res.json({
      streams: [streamService.handler.formatStream(streamInfo, true)],
    });
  } catch (error) {
    logger.error("Stream cache error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Direct streaming endpoint
// Proxy streaming endpoint - Downloads torrent on server and streams as HTTP
app.get("/stream/proxy/:infoHash", async (req, res) => {
  try {
    const { infoHash } = req.params;
    const userAgent = req.headers["user-agent"] || "";
    const isIOS =
      userAgent.toLowerCase().includes("iphone") ||
      userAgent.toLowerCase().includes("ipad") ||
      userAgent.toLowerCase().includes("ipod") ||
      userAgent.toLowerCase().includes("ios");

    logger.info(
      `Proxy stream request for ${infoHash} from ${isIOS ? "iOS" : "other"} device`,
    );

    let streamInfo = streamService.handler.getStreamInfo(infoHash);

    // If no stream info is cached, log warning but still try to stream
    if (!streamInfo) {
      logger.warn(
        `No cached stream info for ${infoHash}, will attempt to stream anyway`,
      );

      // Check if this is a test/mock hash
      const isTestHash =
        infoHash === "39730aa7c09b864432bc8c878c20c933059241fd";
      const isDevelopment = process.env.NODE_ENV !== "production";
      const isTestKeyword =
        infoHash.startsWith("test_") || infoHash.startsWith("mock_test_");

      if (isTestHash || (isDevelopment && isTestKeyword)) {
        // Create mock stream info for testing
        streamInfo = {
          infoHash: infoHash,
          type: "movie",
          title: "Test Stream",
          quality: "1080p",
          timestamp: Date.now(),
        };

        // Cache the mock data
        streamService.handler.cacheStream(
          infoHash,
          "movie",
          "Test Stream",
          "1080p",
        );
        logger.info(`Created mock stream info for testing: ${infoHash}`);
      }
      // For real torrents without cached info, we'll still try to stream them
      // torrentService will handle the magnet URI construction
    }

    // Stream through our proxy service - this downloads the torrent and streams it
    // This is the key part that makes iOS work - torrent is downloaded on server
    logger.info(`Initiating torrent download and stream for ${infoHash}`);
    await torrentService.streamTorrent(req, res, infoHash);
  } catch (error) {
    logger.error("Proxy stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// iOS-specific stream endpoint that provides HTTP streams instead of magnets
app.get("/stream/:type/:imdbId.json", async (req, res) => {
  try {
    const { type, imdbId } = req.params;
    const userAgent = req.headers["user-agent"] || "";

    // Input validation
    if (!type || !["movie", "series"].includes(type)) {
      logger.warn(`Invalid type parameter: ${type}`);
      return res
        .status(400)
        .json({
          error: 'Invalid type. Must be "movie" or "series"',
          streams: [],
        });
    }

    if (!imdbId || !imdbId.match(/^tt\d+/)) {
      logger.warn(`Invalid IMDb ID format: ${imdbId}`);
      return res
        .status(400)
        .json({ error: "Invalid IMDb ID format", streams: [] });
    }

    // Parse season and episode from series IMDb ID (format: tt1234567:season:episode)
    let season, episode;
    let cleanImdbId = imdbId;

    if (type === "series" && imdbId.includes(":")) {
      const parts = imdbId.split(":");
      cleanImdbId = parts[0];
      season = parts[1] ? parseInt(parts[1], 10) : undefined;
      episode = parts[2] ? parseInt(parts[2], 10) : undefined;

      // Validate clean IMDb ID after parsing
      if (!cleanImdbId.match(/^tt\d+$/)) {
        logger.warn(`Invalid IMDb ID format after parsing: ${cleanImdbId}`);
        return res
          .status(400)
          .json({ error: "Invalid IMDb ID format", streams: [] });
      }
    }

    logger.info(
      `Stream request: ${type}:${cleanImdbId}${season ? ":" + season : ""}${episode ? ":" + episode : ""} from ${userAgent.substring(0, 50)}...`,
    );

    // Detect iOS
    const isIOS = streamService.isIOSDevice(userAgent);
    logger.info(`iOS device detected: ${isIOS}`);

    // Get proxy-aware base URL for iOS stream URLs
    const streamBaseUrl = getProxyAwareBaseUrl(req);
    const streams = await streamService.getStreams(
      type,
      cleanImdbId,
      season,
      episode,
      userAgent,
      streamBaseUrl,
    );

    if (streams.length > 0) {
      logger.info(
        `Found ${streams.length} streams for ${cleanImdbId}${season ? ":" + season : ""}${episode ? ":" + episode : ""} (iOS: ${isIOS})`,
      );
      // Log first stream details for debugging
      const firstStream = streams[0];
      logger.info(
        `First stream: name="${firstStream.name}", url="${firstStream.url || "null"}", infoHash="${firstStream.infoHash || "null"}"`,
      );
    } else {
      logger.warn(
        `No streams found for ${cleanImdbId}${season ? ":" + season : ""}${episode ? ":" + episode : ""}`,
      );
    }

    res.json({ streams });
  } catch (error) {
    logger.error("Stream endpoint error:", error);
    res.status(500).json({ error: "Internal server error", streams: [] });
  }
});

// Main streaming endpoint
app.get("/stream/:type/:imdbId", async (req, res) => {
  try {
    const { type, imdbId } = req.params;
    const userAgent = req.headers["user-agent"] || "";

    // Input validation
    if (!type || !["movie", "series"].includes(type)) {
      logger.warn(`Invalid type parameter: ${type}`);
      return res
        .status(400)
        .json({
          error: 'Invalid type. Must be "movie" or "series"',
          streams: [],
        });
    }

    if (!imdbId || !imdbId.match(/^tt\d+/)) {
      logger.warn(`Invalid IMDb ID format: ${imdbId}`);
      return res
        .status(400)
        .json({ error: "Invalid IMDb ID format", streams: [] });
    }

    // Parse season and episode from series IMDb ID (format: tt1234567:season:episode)
    let season, episode;
    let cleanImdbId = imdbId;

    if (type === "series" && imdbId.includes(":")) {
      const parts = imdbId.split(":");
      cleanImdbId = parts[0];
      season = parts[1] ? parseInt(parts[1], 10) : undefined;
      episode = parts[2] ? parseInt(parts[2], 10) : undefined;

      // Validate clean IMDb ID after parsing
      if (!cleanImdbId.match(/^tt\d+$/)) {
        logger.warn(`Invalid IMDb ID format after parsing: ${cleanImdbId}`);
        return res
          .status(400)
          .json({ error: "Invalid IMDb ID format", streams: [] });
      }
    }

    // Get proxy-aware base URL for stream URLs
    const streamBaseUrl = getProxyAwareBaseUrl(req);
    const streams = await streamService.getStreams(
      type,
      cleanImdbId,
      season,
      episode,
      userAgent,
      streamBaseUrl,
    );
    res.json({ streams });
  } catch (error) {
    logger.error("Stream request error:", error);
    res.status(500).json({ error: "Internal server error", streams: [] });
  }
});

// Source selection and streaming endpoint
app.get("/play/:type/:imdbId/:fileIdx/:season?/:episode?", async (req, res) => {
  let { type, imdbId, fileIdx, season, episode } = req.params;
  fileIdx = parseInt(fileIdx, 10);

  try {
    logger.info(
      `Play request: ${type}:${imdbId}:${fileIdx} S${season || "-"}E${episode || "-"}`,
    );

    // Get stream from cache or create new one
    let cachedStream = streamService.getCachedStream(
      imdbId,
      season ? Number(season) : undefined,
      episode ? Number(episode) : undefined,
      fileIdx,
    );

    logger.info(
      `Cached stream result: ${cachedStream ? "found" : "not found"}`,
    );

    if (!cachedStream) {
      logger.info(`Getting streams for ${type}:${imdbId}`);
      const streams = await streamService.getStreams(
        type,
        imdbId,
        season ? Number(season) : undefined,
        episode ? Number(episode) : undefined,
      );
      logger.info(
        `Found ${streams.length} streams, looking for index ${fileIdx}`,
      );
      cachedStream = streams[fileIdx];
      if (!cachedStream) {
        logger.warn(`Stream not found at index ${fileIdx}`);
        return res.status(404).send("Stream not found");
      }
    }

    logger.info(
      `Stream details: infoHash=${cachedStream.infoHash}, sources=${cachedStream.sources?.length || 0}, url=${cachedStream.url ? "present" : "none"}`,
    );

    // If there's a magnet link – download and stream
    if (cachedStream.infoHash && cachedStream.sources?.length) {
      const magnetUri = cachedStream.sources[0];
      logger.info(
        `Attempting to stream magnet: ${magnetUri.substring(0, 50)}...`,
      );

      let tempFile = cacheManager.get(magnetUri);

      if (!tempFile) {
        logger.info("Downloading file from magnet...");
        const torrentStream = await torrentService.getStream(magnetUri);
        const file = torrentStream.file;

        const tempPath = path.join(
          TEMP_DIR,
          `${cachedStream.infoHash}-${file.name}`,
        );
        await new Promise((resolve, reject) => {
          const writeStream = fs.createWriteStream(tempPath);
          file
            .createReadStream()
            .on("error", reject)
            .pipe(writeStream)
            .on("finish", resolve)
            .on("error", reject);
        });

        tempFile = { filePath: tempPath, lastAccessed: Date.now() };
        await cacheManager.set(magnetUri, tempFile);
        torrentStream.destroy();
        logger.info(`File downloaded to: ${tempPath}`);
      } else {
        tempFile.lastAccessed = Date.now();
        await cacheManager.set(magnetUri, tempFile); // Update access time
        logger.info(`Using cached file: ${tempFile.filePath}`);
      }

      // Range streaming
      const stat = fs.statSync(tempFile.filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      const mimeType = mime.lookup(tempFile.filePath) || "video/mp4";

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": mimeType,
        });

        fs.createReadStream(tempFile.filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": mimeType,
        });
        fs.createReadStream(tempFile.filePath).pipe(res);
      }
      return;
    }

    // Otherwise external URL
    if (cachedStream.url) {
      logger.info(`Redirecting to external URL: ${cachedStream.url}`);
      return res.redirect(cachedStream.url);
    }

    logger.warn("No playable stream available");
    res.status(404).send("No playable stream available");
  } catch (err) {
    logger.error(`Error playing stream for ${imdbId} index ${fileIdx}:`, err);
    res.status(500).send("Failed to play stream");
  }
});

// Initialize server
async function startServer() {
  try {
    const port = process.env.PORT || 7000;
    const host = process.env.HOST || "0.0.0.0";

    // For now, disable the addon mounting until we fix the interface issue
    // app.use('/', addonApp);

    app.listen(port, host, () => {
      const isProduction = process.env.NODE_ENV === "production";

      logger.info(`🚀 Server running on port ${port}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(
        `🔧 Trust Proxy: enabled (supports Cloudflare, nginx, Apache, Plesk, etc.)`,
      );

      if (process.env.BASE_URL) {
        const urlParts = new URL(process.env.BASE_URL);
        logger.info(
          `🌐 Base URL: ${process.env.BASE_URL} (manually configured)`,
        );
        logger.info(
          `📺 Add to Stremio: stremio://${urlParts.host}/manifest.json`,
        );
      } else {
        logger.info(`🌐 Base URL: Auto-detect mode (will use proxy headers)`);
        logger.info(`   - Local: http://${host}:${port}`);
        if (process.env.RENDER_EXTERNAL_URL) {
          logger.info(`   - Render: ${process.env.RENDER_EXTERNAL_URL}`);
        }
        logger.info(`📺 Stremio URL will be generated from first request`);
      }

      logger.info(`🔍 Debug URL detection: http://${host}:${port}/debug/url`);
      logger.info(`💚 Health check: http://${host}:${port}/health`);
      logger.info(``);
      logger.info(`ℹ️  URLs are automatically detected from request headers`);
      logger.info(
        `ℹ️  Works with: Cloudflare, nginx, Apache, Plesk, Render, Heroku, Railway`,
      );
      if (!process.env.BASE_URL && isProduction) {
        logger.warn(`⚠️  No BASE_URL set - relying on auto-detection`);
        logger.warn(
          `   Set BASE_URL=https://your-domain.com for guaranteed consistency`,
        );
      }
    });
  } catch (error) {
    logger.error("Failed to start servers:", error);
    process.exit(1);
  }
}

// Clean up on process termination
process.on("SIGINT", () => {
  logger.info("Shutting down...");
  // Stop scalable cache manager
  cacheManager.stop();
  // Graceful shutdown
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down...");
  // Stop scalable cache manager
  cacheManager.stop();
  // Graceful shutdown
  process.exit(0);
});

// Start servers
startServer();
