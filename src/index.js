import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import WebTorrent from "webtorrent";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import torrentService from "./services/torrentService.js";
import { serveAddon } from "./addon/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express app
const app = express();
app.use(cors());

// WebTorrent client
const torrentClient = new WebTorrent();
torrentService.client = torrentClient;

// ---------------- Local file streaming ----------------
app.get("/stream/:mediaId", async (req, res) => {
  try {
    const { mediaId } = req.params;
    const range = req.headers.range;
    const filePath = path.join(config.media.localPath, mediaId);
    await fs.access(filePath);
    const stat = await fs.stat(filePath);

    if (!range) {
      res.writeHead(200, {
        "Content-Length": stat.size,
        "Content-Type": "video/mp4",
      });
      fs.createReadStream(filePath).pipe(res);
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
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } catch (error) {
    logger.error("Local stream error:", error);
    res.status(404).send("File not found");
  }
});

// ---------------- Torrent streaming ----------------
app.get("/torrent/stream", async (req, res) => {
  try {
    const { magnet } = req.query;
    const range = req.headers.range;
    if (!magnet) return res.status(400).send("Magnet link required");
    if (!range) return res.status(400).send("Requires Range header");

    const torrentData = await torrentService.streamTorrent(magnet);
    const { file, createStream } = torrentData;

    const videoSize = file.length;
    const CHUNK_SIZE = 10 ** 6;
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, videoSize - 1);
    const contentLength = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${videoSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": "video/mp4",
    });

    createStream(start, end).pipe(res);
  } catch (error) {
    logger.error("Torrent stream error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ---------------- Start servers ----------------
const startServers = async () => {
  try {
    app.listen(config.server.port, () => {
      logger.info(`Streaming server running on port ${config.server.port}`);
    });

    await serveAddon(config.server.addonPort, torrentService);
    logger.info(`Stremio addon server running on port ${config.server.addonPort}`);
  } catch (error) {
    logger.error("Failed to start servers:", error);
    process.exit(1);
  }
};

startServers();
