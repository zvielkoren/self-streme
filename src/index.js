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

// Create WebTorrent client
const torrentClient = new WebTorrent();

// Streaming server routes
app.get("/stream/:mediaId", async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { quality } = req.query;
    const range = req.headers.range;

    const mediaInfo = await mediaService.getMediaInfo(mediaId);
    if (!mediaInfo) {
      return res.status(404).send("Media not found");
    }

    // Get the appropriate file path based on quality
    let filePath = mediaInfo.path;
    if (quality) {
      const qualityPath = await mediaService.getQualityPath(mediaId, quality);
      if (qualityPath) {
        filePath = qualityPath;
      } else {
        logger.warn(`Quality ${quality} not found for ${mediaId}, using default`);
      }
    }

    if (!range) {
      return res.status(400).send("Requires Range header");
    }

    const videoSize = await mediaService.getFileSize(filePath);
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
    const videoStream = await mediaService.createReadStream(filePath, start, end);
    videoStream.pipe(res);
  } catch (error) {
    logger.error("Stream error:", error);
    res.status(500).send("Internal Server Error");
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
      // Don't destroy the torrent immediately as other clients might be streaming
      // The torrent will be destroyed when all clients disconnect
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

// Start streaming server
const streamingPort = config.server.port;
app.listen(streamingPort, () => {
  logger.info(`Streaming server running on port ${streamingPort}`);
});

// Start addon server
serveAddon(config.server.addonPort);
