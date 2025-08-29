import express from "express";
import cors from "cors";
import manifest from "./manifest.js";
import streamService from "./core/streamService.js"; // המקור הקיים שלך
import logger from "./utils/logger.js";

const app = express();
app.use(cors());

// Serve HTML installation page
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve HTML installation page
app.get("/", (req, res) => {
  const htmlPath = path.join(__dirname, "install.html"); // נתיב כמחרוזת
  res.sendFile(htmlPath);
});


// Serve manifest
app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

// Catalog endpoint – נטען מיד
app.get("/catalog/:type", async (req, res) => {
  const type = req.params.type;

  // דוגמה ל-catalog מהיר
  const catalog = [
    { id: "tt0000001", type, name: "Sample Movie 1", poster: "https://via.placeholder.com/200x300" },
    { id: "tt0000002", type, name: "Sample Movie 2", poster: "https://via.placeholder.com/200x300" }
  ];

  res.json({ metas: catalog });
});

// Stream endpoint – נטען רק כשבוחרים סרט/סדרה
app.get("/stream/:type/:imdbId", async (req, res) => {
  let { type, imdbId } = req.params;

  // מסיר סיומת .json אם קיימת
  if (imdbId.endsWith(".json")) {
    imdbId = imdbId.replace(".json", "");
  }

  try {
    logger.info(`Fetching streams for ${type}:${imdbId}`);

    const streams = await streamService.getStreams(type, imdbId);

    res.json({ streams });
  } catch (err) {
    logger.error(`Error fetching streams for ${imdbId}:`, err);
    res.status(500).json({ streams: [] });
  }
});


// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Addon server running on http://127.0.0.1:${PORT}`);
});
