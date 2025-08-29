import express from "express";
import streamService from "./src/core/streamService.js";

const app = express();
const PORT = 3001;

/**
 * דינמי לסרטים וסדרות
 * דוגמה:
 *  - סרט: GET /stream/movie/tt1234567
 *  - סדרה: GET /stream/series/tt1234567/1/2  (S1E2)
 */
app.get("/stream/:type/:imdbId/:season?/:episode?", async (req, res) => {
  const { type, imdbId, season, episode } = req.params;

  if (!["movie", "series"].includes(type)) {
    return res.status(400).json({ error: "Invalid type, must be 'movie' or 'series'" });
  }

  try {
    const streams = await streamService.getStreams(
      type,
      imdbId,
      season ? Number(season) : undefined,
      episode ? Number(episode) : undefined
    );

    res.json({ streams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});
