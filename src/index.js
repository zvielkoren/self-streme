import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";
import mime from "mime-types";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import addon, { addonApp } from "./addon.js";
import streamService from "./core/streamService.js";
import torrentService from "./core/torrentService.js";
import subtitleService from "./services/subtitleService.js";
import manifest from "./manifest.js";
import TorrentService from "./services/torrentService.js";
import { createTorrentRouter } from "./api/torrentApi.js";
import { createStreamingRouter } from "./api/streamingApi.js";
import {
  getProxyAwareBaseUrl,
  getBaseUrlFromRequest,
  isCloudflareRequest,
  getClientIp,
} from "./utils/urlHelper.js";
import ScalableCacheManager from "./services/scalableCacheManager.js";
import magnetToHttpService from "./services/magnetToHttpService.js";

// File paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment variables for tunnel
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN;

// Store child processes for cleanup
const childProcesses = [];

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

// Initialize Torrent Streaming Service
const torrentStreamingService = new TorrentService(cacheManager);
logger.info("Torrent Streaming Service initialized");

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

// Enhanced CORS configuration for streaming from all devices
// This allows the app to work from localhost, LAN devices, and remote connections
// SECURITY NOTE: origin: "*" is intentional for this self-hosted streaming server.
// Stremio addons must be accessible from various devices and networks.
// This is designed for personal/private use, not as a public API.
// For production environments, consider restricting to specific origins if needed.
app.use(
  cors({
    origin: "*", // Allow all origins (required for Stremio and cross-device access)
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Origin",
      "Range", // Critical for video streaming (seek/skip functionality)
      "Accept-Ranges",
      "Content-Range",
      "Authorization",
      "X-Requested-With",
    ],
    exposedHeaders: [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges", // Expose range headers for video streaming
      "Content-Type",
    ],
    credentials: true,
    maxAge: 86400, // Cache preflight requests for 24 hours
  }),
);

// Serve installation page at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "install.html"));
});

// Mount Torrent Streaming API routes
const torrentApiRouter = createTorrentRouter(
  torrentStreamingService,
  cacheManager,
);
const streamingApiRouter = createStreamingRouter(
  torrentStreamingService,
  cacheManager,
);
app.use("/api", torrentApiRouter);
app.use("/", streamingApiRouter);
logger.info("Torrent Streaming API routes mounted");

// Serve iOS fix test page
app.get("/test-ios-fix", (req, res) => {
  res.sendFile(path.join(__dirname, "test-ios-fix.html"));
});

// Serve torrent streaming test page
app.get("/test-torrent-streaming", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "test-torrent-streaming.html"));
});

// Serve source selection test page
app.get("/test-source-selection", (req, res) => {
  res.sendFile(path.join(__dirname, "test-source-selection.html"));
});

// Serve magnet converter test page
app.get("/test-magnet-converter", (req, res) => {
  res.sendFile(path.join(__dirname, "test-magnet-converter.html"));
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

// Debug endpoint - shows torrent/DHT status
app.get("/debug/torrent-status", (req, res) => {
  try {
    const client = torrentService.client;

    res.json({
      status: "ok",
      dht: {
        enabled: !!client.dht,
        ready: client.dht?.ready || false,
        nodes: client.dht?.nodes?.toArray?.()?.length || 0,
      },
      torrents: {
        active: client.torrents.length,
        details: client.torrents.map((t) => ({
          infoHash: t.infoHash,
          name: t.name || "Unknown",
          peers: t.numPeers || 0,
          progress: Math.round((t.progress || 0) * 100 * 10) / 10,
          downloadSpeed: Math.round((t.downloadSpeed || 0) / 1024),
          uploadSpeed: Math.round((t.uploadSpeed || 0) / 1024),
          downloaded: Math.round((t.downloaded || 0) / 1024 / 1024),
          uploaded: Math.round((t.uploaded || 0) / 1024 / 1024),
          timeRemaining: t.timeRemaining || 0,
        })),
      },
      config: {
        maxConnections: config.torrent.maxConnections,
        timeout: config.torrent.timeout,
        maxRetries: config.torrent.maxRetries,
        trackerCount: config.torrent.trackers.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error getting torrent status:", error);
    res.status(500).json({
      error: "Failed to get torrent status",
      message: error.message,
    });
  }
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
// Proxy streaming endpoint - Streams the file using infoHash
// Works without P2P by trying HTTP sources first, then falling back to P2P if needed
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
    // This works with or without P2P - will try HTTP sources first
    logger.info(`Initiating stream for ${infoHash}`);
    await torrentService.streamTorrent(req, res, infoHash);
  } catch (error) {
    logger.error("Proxy stream error:", error);
    if (!res.headersSent) {
      // Provide more specific error messages based on the error type
      if (error.message && error.message.includes("cooldown")) {
        return res.status(503).json({
          error: "Torrent temporarily unavailable",
          message: error.message,
          type: "cooldown",
        });
      } else if (error.message && error.message.includes("No peers")) {
        return res.status(404).json({
          error: "No peers found for this torrent",
          message:
            "This content may not be available in the torrent network. Please try a different source.",
          type: "no_peers",
        });
      } else {
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  }
});

// Convert magnet link to stream URL endpoint
// This endpoint allows users to provide a magnet link and get streamable URLs
// Uses external services that work on ANY server without P2P requirements
// Supports both GET (magnet in query param) and POST (magnet in body)
app.get("/stream/magnet", express.json(), async (req, res) => {
  try {
    const magnetLink = req.query.magnet || req.query.url;

    if (!magnetLink) {
      return res.status(400).json({
        error: "Missing magnet link",
        message:
          "Please provide a magnet link using the 'magnet' or 'url' query parameter",
        example: "/stream/magnet?magnet=magnet:?xt=urn:btih:...",
      });
    }

    // Validate it's a magnet link
    if (!magnetLink.startsWith("magnet:")) {
      return res.status(400).json({
        error: "Invalid magnet link",
        message:
          "The provided link is not a valid magnet URI. It must start with 'magnet:'",
        provided: magnetLink.substring(0, 50),
      });
    }

    // Extract infoHash from magnet link
    const infoHash = streamService.extractInfoHash(magnetLink);

    if (!infoHash) {
      return res.status(400).json({
        error: "Invalid magnet link",
        message: "Could not extract infoHash from the provided magnet link",
        provided: magnetLink.substring(0, 100),
      });
    }

    logger.info(
      `Magnet to stream conversion requested for infoHash: ${infoHash}`,
    );

    // Enhance magnet link with additional trackers for better connectivity
    const enhancedMagnet = magnetToHttpService.enhanceMagnetLink(
      magnetLink,
      infoHash,
    );

    // Generate stream URLs using external services (works without P2P)
    const streamResult = await magnetToHttpService.generateStreamUrls(
      enhancedMagnet,
      infoHash,
    );

    // Also provide local proxy option as fallback
    const baseUrl = getProxyAwareBaseUrl(req);
    const localStreamUrl = `${baseUrl}/stream/proxy/${infoHash}`;

    // Try to find torrent cache URL
    const cacheUrl = await magnetToHttpService.findTorrentCacheUrl(infoHash);

    // Return multiple streaming options
    res.json({
      success: true,
      magnet: magnetLink,
      enhancedMagnet: enhancedMagnet,
      infoHash: infoHash,
      streamUrls: {
        // External services (work on any server, no P2P required)
        external: streamResult.streamUrls,
        // Local proxy (requires P2P connectivity)
        local: {
          name: "Self-Streme Local Proxy",
          url: localStreamUrl,
          type: "local_proxy",
          priority: 10,
          note: "Requires P2P connectivity and peers",
        },
        // Torrent cache (direct torrent file download)
        cache: cacheUrl
          ? {
              name: "Torrent Cache",
              url: cacheUrl,
              type: "torrent_file",
              priority: 5,
              note: "Download .torrent file directly",
            }
          : null,
      },
      recommended: streamResult.primaryUrl || localStreamUrl,
      message:
        "Multiple streaming options available. External services work on any server without P2P.",
      usage: {
        external: "Use external URLs - work on any server, no P2P required",
        local: "Use local proxy - requires P2P connectivity",
        stremio: "Copy any URL to use in Stremio or video players",
      },
    });

    logger.info(
      `Successfully converted magnet to stream URLs. Primary: ${streamResult.primaryUrl || localStreamUrl}`,
    );
  } catch (error) {
    logger.error("Magnet to stream conversion error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

// POST endpoint for magnet link conversion (accepts JSON body)
app.post("/stream/magnet", express.json(), async (req, res) => {
  try {
    const magnetLink = req.body.magnet || req.body.url;

    if (!magnetLink) {
      return res.status(400).json({
        error: "Missing magnet link",
        message:
          "Please provide a magnet link in the request body using 'magnet' or 'url' field",
        example: { magnet: "magnet:?xt=urn:btih:..." },
      });
    }

    // Validate it's a magnet link
    if (!magnetLink.startsWith("magnet:")) {
      return res.status(400).json({
        error: "Invalid magnet link",
        message:
          "The provided link is not a valid magnet URI. It must start with 'magnet:'",
        provided: magnetLink.substring(0, 50),
      });
    }

    // Extract infoHash from magnet link
    const infoHash = streamService.extractInfoHash(magnetLink);

    if (!infoHash) {
      return res.status(400).json({
        error: "Invalid magnet link",
        message: "Could not extract infoHash from the provided magnet link",
        provided: magnetLink.substring(0, 100),
      });
    }

    logger.info(
      `Magnet to stream conversion requested (POST) for infoHash: ${infoHash}`,
    );

    // Enhance magnet link with additional trackers for better connectivity
    const enhancedMagnet = magnetToHttpService.enhanceMagnetLink(
      magnetLink,
      infoHash,
    );

    // Generate stream URLs using external services (works without P2P)
    const streamResult = await magnetToHttpService.generateStreamUrls(
      enhancedMagnet,
      infoHash,
    );

    // Also provide local proxy option as fallback
    const baseUrl = getProxyAwareBaseUrl(req);
    const localStreamUrl = `${baseUrl}/stream/proxy/${infoHash}`;

    // Try to find torrent cache URL
    const cacheUrl = await magnetToHttpService.findTorrentCacheUrl(infoHash);

    // Return multiple streaming options
    res.json({
      success: true,
      magnet: magnetLink,
      enhancedMagnet: enhancedMagnet,
      infoHash: infoHash,
      streamUrls: {
        // External services (work on any server, no P2P required)
        external: streamResult.streamUrls,
        // Local proxy (requires P2P connectivity)
        local: {
          name: "Self-Streme Local Proxy",
          url: localStreamUrl,
          type: "local_proxy",
          priority: 10,
          note: "Requires P2P connectivity and peers",
        },
        // Torrent cache (direct torrent file download)
        cache: cacheUrl
          ? {
              name: "Torrent Cache",
              url: cacheUrl,
              type: "torrent_file",
              priority: 5,
              note: "Download .torrent file directly",
            }
          : null,
      },
      recommended: streamResult.primaryUrl || localStreamUrl,
      message:
        "Multiple streaming options available. External services work on any server without P2P.",
      usage: {
        external: "Use external URLs - work on any server, no P2P required",
        local: "Use local proxy - requires P2P connectivity",
        stremio: "Copy any URL to use in Stremio or video players",
      },
    });

    logger.info(
      `Successfully converted magnet to stream URLs (POST). Primary: ${streamResult.primaryUrl || localStreamUrl}`,
    );
  } catch (error) {
    logger.error("Magnet to stream conversion error (POST):", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
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
      return res.status(400).json({
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
      return res.status(400).json({
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

// Subtitle endpoint - Get subtitles for content (includes Hebrew support)
app.get("/subtitles/:type/:imdbId/:season?/:episode?", async (req, res) => {
  try {
    const { type, imdbId, season, episode } = req.params;
    const { lang = "heb" } = req.query; // Default to Hebrew

    logger.info(
      `Subtitle request: ${type}:${imdbId} S${season || "-"}E${episode || "-"} lang=${lang}`,
    );

    const subtitles = await subtitleService.getStremioSubtitles(
      imdbId,
      type,
      season ? Number(season) : undefined,
      episode ? Number(episode) : undefined,
    );

    res.json({
      subtitles,
      count: subtitles.length,
      imdbId,
      type,
      language: lang,
    });
  } catch (error) {
    logger.error("Subtitle request error:", error);
    res.status(500).json({ error: "Failed to fetch subtitles", subtitles: [] });
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

// Torrent API Documentation endpoint
app.get("/docs", (req, res) => {
  res.json({
    name: "Self-Streme with Torrent Streaming",
    version: "1.0.0",
    description:
      "Self-hosted streaming server with Stremio addon support and torrent streaming",
    endpoints: {
      stremio: {
        "GET /manifest.json": "Stremio addon manifest",
        "GET /stream/:type/:id": "Get streams for content",
        "GET /stream/:type/:id.json": "iOS-optimized source listing",
        "GET /play/:type/:id/:fileIdx": "Play specific source by index",
      },
      torrents: {
        "POST /api/torrents": "Add new torrent",
        "GET /api/torrents/:infoHash": "Get torrent status",
        "GET /api/torrents/:infoHash/files": "List files in torrent",
        "DELETE /api/torrents/:infoHash": "Remove torrent",
        "GET /api/torrents": "List all active torrents",
      },
      streaming: {
        "GET /stream/proxy/:infoHash": "Stream file with Range Request support",
        "GET /stream/file/:infoHash/:fileIndex":
          "Stream specific file by index",
        "GET /stream/info/:infoHash": "Get streamable files info",
      },
      cache: {
        "GET /api/cache-stats": "Cache statistics",
        "GET /api/cache-config": "Cache configuration",
        "POST /api/cache-config": "Force cache cleanup",
      },
      system: {
        "GET /health": "Health check",
        "GET /status": "System status",
        "GET /": "Installation page",
        "GET /docs": "API documentation",
        "GET /test-torrent-streaming": "Torrent streaming test interface",
      },
    },
    features: [
      "Stremio addon integration",
      "WebTorrent streaming",
      "HTTP Range Request support (206 Partial Content)",
      "Sequential download for faster streaming",
      "LRU cache with multiple backends (Memory/SQLite/Redis)",
      "DHT and tracker connectivity",
      "60-second timeout with retry logic",
      "Multi-file torrent support",
      "iOS and mobile optimization",
    ],
  });
});

// Initialize server
// Start Cloudflare Tunnel
function startCloudfareTunnel(token) {
  return new Promise((resolve, reject) => {
    logger.info("[TUNNEL] Starting Cloudflare Tunnel...");

    // Check if cloudflared is available
    const checkCloudflared = spawn("which", ["cloudflared"]);

    checkCloudflared.on("close", (code) => {
      if (code !== 0) {
        logger.error("[TUNNEL] cloudflared binary not found in PATH");
        logger.error(
          "[TUNNEL] Please ensure cloudflared is installed in the container",
        );
        reject(new Error("cloudflared not found"));
        return;
      }

      // Start the tunnel
      const tunnel = spawn(
        "cloudflared",
        ["tunnel", "--no-autoupdate", "run", "--token", token],
        {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env },
        },
      );

      childProcesses.push(tunnel);

      let tunnelReady = false;

      // Handle stdout
      tunnel.stdout.on("data", (data) => {
        const output = data.toString().trim();
        output.split("\n").forEach((line) => {
          if (line) {
            logger.info(`[TUNNEL] ${line}`);

            // Check if tunnel is ready
            if (
              !tunnelReady &&
              (line.includes("Registered tunnel connection") ||
                line.includes("Connection registered") ||
                line.includes("Started") ||
                line.includes("serving"))
            ) {
              tunnelReady = true;
              logger.info("[TUNNEL] ✓ Cloudflare Tunnel is ready");
              resolve(tunnel);
            }
          }
        });
      });

      // Handle stderr
      tunnel.stderr.on("data", (data) => {
        const output = data.toString().trim();
        output.split("\n").forEach((line) => {
          if (line) {
            // Some informational messages come through stderr
            if (line.includes("INFO") || line.includes("config")) {
              logger.info(`[TUNNEL] ${line}`);
            } else {
              logger.error(`[TUNNEL] ${line}`);
            }
          }
        });
      });

      // Handle tunnel process errors
      tunnel.on("error", (err) => {
        logger.error(`[TUNNEL] Failed to start tunnel: ${err.message}`);
        if (!tunnelReady) {
          reject(err);
        }
      });

      // Handle tunnel exit
      tunnel.on("close", (code, signal) => {
        if (code !== 0 && code !== null) {
          logger.error(`[TUNNEL] Tunnel exited with code ${code}`);
        } else if (signal) {
          logger.warn(`[TUNNEL] Tunnel terminated by signal ${signal}`);
        } else {
          logger.info("[TUNNEL] Tunnel process ended");
        }
      });

      // Resolve after 3 seconds if no explicit ready signal
      setTimeout(() => {
        if (!tunnelReady) {
          logger.warn("[TUNNEL] Ready signal not detected, but proceeding...");
          tunnelReady = true;
          resolve(tunnel);
        }
      }, 3000);
    });
  });
}

// Start the server
async function startServer() {
  try {
    const port = process.env.PORT || 7000;
    const host = process.env.HOST || "0.0.0.0";

    // Start Cloudflare Tunnel if token is provided
    if (TUNNEL_TOKEN) {
      logger.info("=".repeat(60));
      logger.info("🌐 Cloudflare Tunnel Mode Enabled");
      logger.info("=".repeat(60));
      try {
        await startCloudfareTunnel(TUNNEL_TOKEN);
        logger.info("✓ Cloudflare Tunnel started successfully");
      } catch (err) {
        logger.error(`✗ Failed to start Cloudflare Tunnel: ${err.message}`);
        logger.warn("Continuing without tunnel...");
      }
      logger.info("=".repeat(60));
    } else {
      logger.info("ℹ️  No TUNNEL_TOKEN provided, skipping Cloudflare Tunnel");
    }

    // For now, disable the addon mounting until we fix the interface issue
    // app.use('/', addonApp);

    app.listen(port, host, () => {
      const isProduction = process.env.NODE_ENV === "production";

      logger.info(`🚀 Server running on port ${port}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`🌐 Listening on: ${host} (all network interfaces)`);
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
        logger.info(`   - Localhost: http://localhost:${port}`);
        logger.info(`   - LAN/Network: http://<YOUR_IP>:${port}`);
        if (process.env.RENDER_EXTERNAL_URL) {
          logger.info(`   - Render: ${process.env.RENDER_EXTERNAL_URL}`);
        }
        logger.info(`📺 Stremio URL will be generated from first request`);
      }

      logger.info(`🔍 Debug URL detection: http://localhost:${port}/debug/url`);
      logger.info(`💚 Health check: http://localhost:${port}/health`);
      logger.info(``);
      logger.info(`ℹ️  Access from devices on the same network:`);
      logger.info(
        `   1. Find your server's IP address (use 'hostname -I' or 'ipconfig')`,
      );
      logger.info(`   2. Use: http://<YOUR_IP>:${port}/manifest.json`);
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
    logger.error("Server failed to start:", error);
    process.exit(1);
  }
}

// Enhanced startup logging
logger.info("=".repeat(60));
logger.info("🎬 Self-Streme Server with Torrent Streaming");
logger.info("=".repeat(60));
logger.info(`📍 Main Server: http://localhost:${config.server.port}`);
logger.info(
  `📡 Stremio Addon: http://localhost:${config.server.addonPort}/manifest.json`,
);
logger.info(
  `🎥 Torrent Streaming: http://localhost:${config.server.port}/test-torrent-streaming`,
);
logger.info(`💾 Cache Backend: ${config.cache.backend}`);
logger.info(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
logger.info("=".repeat(60));

// Graceful shutdown handler
function setupGracefulShutdown() {
  const shutdown = (signal) => {
    logger.warn(`Received ${signal}, shutting down gracefully...`);

    // Kill all child processes (tunnel)
    childProcesses.forEach((child, index) => {
      if (child && !child.killed) {
        logger.info(`Terminating child process ${index + 1}...`);
        child.kill("SIGTERM");

        // Force kill after 5 seconds
        setTimeout(() => {
          if (!child.killed) {
            logger.warn(`Force killing child process ${index + 1}...`);
            child.kill("SIGKILL");
          }
        }, 5000);
      }
    });

    // Stop scalable cache manager
    cacheManager.stop();

    // Exit after giving processes time to clean up
    setTimeout(() => {
      logger.info("Shutdown complete");
      process.exit(0);
    }, 6000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));
}

// Setup graceful shutdown
setupGracefulShutdown();

// Start servers
startServer();
