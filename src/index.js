import express from "express";
import cors from "cors";
import path from "path";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import mediaService from "./services/mediaService.js";
import subtitleService from "./services/subtitleService.js";
import { serveAddon } from "./addon/index.js";
import WebTorrent from "webtorrent";
import fs from "fs";
import pump from "pump";
import torrentService from "./services/torrentService.js";

// Create Express app for streaming server
const app = express();
app.use(cors());

// Create a single WebTorrent client instance
const torrentClient = new WebTorrent({
  maxConns: config.torrent.maxConnections,
  downloadLimit: config.torrent.downloadLimit,
  uploadLimit: config.torrent.uploadLimit,
});

// Set the WebTorrent client in the torrent service
torrentService.client = torrentClient;

// Streaming server routes
app.get("/stream/:mediaId", async (req, res) => {
  try {
    const { mediaId } = req.params;
    const range = req.headers.range;

    // Check if it's a local file first
    const localPath = path.join(config.media.localPath, mediaId);
    try {
      await fs.promises.access(localPath);
      // Handle local file streaming
      const stat = await fs.promises.stat(localPath);
      if (!range) {
        res.writeHead(200, {
          "Content-Length": stat.size,
          "Content-Type": "video/mp4",
        });
        fs.createReadStream(localPath).pipe(res);
        return;
      }

      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": "video/mp4",
      });
      fs.createReadStream(localPath, { start, end }).pipe(res);
      return;
    } catch (err) {
      logger.debug(`Local file not found for ${mediaId}, trying torrent`);
    }

    // If not local, try to get the torrent stream
    const stream = await torrentService.getTorrentStream(mediaId);
    if (!stream) {
      throw new Error("Stream not found");
    }

    const { file, createStream } = stream;

    if (!range) {
      res.writeHead(200, {
        "Content-Length": file.length,
        "Content-Type": "video/mp4",
      });
      createStream(0, file.length - 1).pipe(res);
      return;
    }

    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${file.length}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": "video/mp4",
    });

    createStream(start, end).pipe(res);
  } catch (error) {
    logger.error("Error streaming media:", error);
    res.status(500).json({ error: "Error streaming media" });
  }
});

// Stream endpoint for torrents
app.get("/torrent/stream", async (req, res) => {
  const { magnet } = req.query;
  const range = req.headers.range;

  if (!magnet) {
    return res.status(400).send("Magnet link is required");
  }

  if (!range) {
    return res.status(400).send("Requires Range header");
  }

  try {
    const torrentData = await torrentService.streamTorrent(magnet);
    const { file, createStream } = torrentData;

    const videoSize = file.length;
    const CHUNK_SIZE = 10 ** 6; // 1MB
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

    const contentLength = end - start + 1;
    const headers = {
      "Content-Range": `bytes ${start}-${end}/${videoSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": "video/mp4",
    };

    res.writeHead(206, headers);

    // Create a new stream for this specific range request
    const stream = createStream(start, end);
    stream.pipe(res);

    // Handle client disconnect
    res.on("close", () => {
      stream.destroy();
    });

    // Handle stream errors
    stream.on("error", (error) => {
      logger.error("Stream error:", error);
      if (!res.headersSent) {
        res.status(500).send("Stream error");
      }
    });
  } catch (error) {
    logger.error("Torrent stream error:", error);
    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }
});

app.get("/subtitles/:mediaId", async (req, res) => {
  try {
    const { mediaId } = req.params;
    const subtitles = await mediaService.getSubtitles(mediaId);
    if (!subtitles) {
      return res.status(404).send("Subtitles not found");
    }
    res.setHeader("Content-Type", "text/vtt");
    res.send(subtitles);
  } catch (error) {
    logger.error("Subtitles error:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/media/list", async (req, res) => {
  try {
    const mediaList = await mediaService.scanDirectory();
    res.json(mediaList);
  } catch (error) {
    logger.error("Media list error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Get torrent status
app.get("/torrent/status/:infoHash", async (req, res) => {
  try {
    const status = torrentService.getTorrentStatus(req.params.infoHash);
    res.json(status);
  } catch (error) {
    logger.error("Error getting torrent status:", error);
    if (error.message === "Torrent not found") {
      res.status(404).json({ error: "Torrent not found" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Stop torrent download
app.post("/torrent/stop/:infoHash", async (req, res) => {
  try {
    await torrentService.destroyTorrent(req.params.infoHash);
    res.json({ message: "Torrent stopped successfully" });
  } catch (error) {
    logger.error("Error stopping torrent:", error);
    if (error.message === "Torrent not found") {
      res.status(404).json({ error: "Torrent not found" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Initialize servers
const startServers = async () => {
  try {
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(config.media.tempPath)) {
      fs.mkdirSync(config.media.tempPath);
    }

    // Create media directory if it doesn't exist
    if (!fs.existsSync(config.media.libraryPath)) {
      fs.mkdirSync(config.media.libraryPath);
    }

    // Start streaming server
    const port = config.server.port;
    app.listen(port, "0.0.0.0", () => {
      logger.info(`Streaming server running on port ${port}`);
    });

    // Start Stremio addon server
    const addonPort = config.server.addonPort;
    serveAddon(addonPort, torrentService);

    // Log server URLs
    logger.info(`Streaming server URL: ${config.server.baseUrl}`);
    logger.info(
      `Addon manifest URL: http://0.0.0.0:${addonPort}/manifest.json`
    );
  } catch (error) {
    logger.error("Error starting servers:", error);
    process.exit(1);
  }
};

// Start servers
startServers();
