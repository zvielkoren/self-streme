import fs from "fs";
import path from "path";
import os from "os";
import mime from "mime-types";
import logger from "./utils/logger.js";
import express from "express";
import streamService from "./core/streamService.js";
import torrentService from "./core/torrentService.js";
// Serve HTML installation page
import { fileURLToPath } from "url";

const app = express();
const TEMP_DIR = path.join(os.tmpdir(), "self-streme");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Cache Map – infoHash -> { filePath, lastAccessed }
const tempCache = new Map();
const CACHE_LIFETIME = 60 * 60 * 1000; // שעה


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "install.html"));
});
// ניקוי אוטומטי
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of tempCache.entries()) {
    if (now - val.lastAccessed > CACHE_LIFETIME) {
      try {
        if (fs.existsSync(val.filePath)) fs.unlinkSync(val.filePath);
      } catch (err) {
        logger.error("Error cleaning temp file:", err);
      }
      tempCache.delete(key);
    }
  }
}, 15 * 60 * 1000); // כל 15 דקות

// Play endpoint משודרג
app.get("/play/:type/:imdbId/:fileIdx/:season?/:episode?", async (req, res) => {
  let { type, imdbId, fileIdx, season, episode } = req.params;
  fileIdx = parseInt(fileIdx, 10);

  try {
    // קבלת stream מהקאש או יצירתו מחדש
    let cachedStream = streamService.getCachedStream(
      imdbId,
      season ? Number(season) : undefined,
      episode ? Number(episode) : undefined,
      fileIdx
    );

    if (!cachedStream) {
      const streams = await streamService.getStreams(
        type,
        imdbId,
        season ? Number(season) : undefined,
        episode ? Number(episode) : undefined
      );
      cachedStream = streams[fileIdx];
      if (!cachedStream) return res.status(404).send("Stream not found");
    }

    // אם יש magnet – הורדה והזרמה
    if (cachedStream.infoHash && cachedStream.sources?.length) {
      const magnetUri = cachedStream.sources[0];
      let tempFile = tempCache.get(magnetUri);

      if (!tempFile) {
        const torrentStream = await torrentService.getStream(magnetUri);
        const file = torrentStream.file;

        const tempPath = path.join(TEMP_DIR, `${cachedStream.infoHash}-${file.name}`);
        await new Promise((resolve, reject) => {
          const writeStream = fs.createWriteStream(tempPath);
          file.createReadStream()
            .on("error", reject)
            .pipe(writeStream)
            .on("finish", resolve)
            .on("error", reject);
        });

        tempFile = { filePath: tempPath, lastAccessed: Date.now() };
        tempCache.set(magnetUri, tempFile);
        torrentStream.destroy();
      } else {
        tempFile.lastAccessed = Date.now();
      }

      // זרימת Range
      const stat = fs.statSync(tempFile.filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      const mimeType = mime.lookup(tempFile.filePath) || "video/mp4";

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": mimeType
        });

        fs.createReadStream(tempFile.filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": mimeType
        });
        fs.createReadStream(tempFile.filePath).pipe(res);
      }
      return;
    }

    // אחרת URL חיצוני
    if (cachedStream.url) return res.redirect(cachedStream.url);

    res.status(404).send("No playable stream available");
  } catch (err) {
    logger.error(`Error playing stream for ${imdbId} index ${fileIdx}:`, err);
    res.status(500).send("Failed to play stream");
  }
});

// Start server
const PORT = 10000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
