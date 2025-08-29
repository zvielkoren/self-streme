import pkg from "stremio-addon-sdk";
const { addonBuilder, serveHTTP } = pkg;
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifest = {
  id: "org.stremio.self-streme",
  version: "1.0.0",
  name: "Self-Streme",
  description: "Stream your local media and torrents",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt", "local"],
  catalogs: [
    { type: "movie", id: "local.movies", name: "Local Movies", extra: [{ name: "search" }] },
    { type: "series", id: "local.series", name: "Local Series", extra: [{ name: "search" }] },
  ],
};

const builder = new addonBuilder(manifest);

function generateStremioId(mediaInfo) {
  return `local:${mediaInfo.type}:${mediaInfo.id}`;
}

export async function serveAddon(port, torrentService) {
  try {
    // ---------------- Catalog ----------------
    builder.defineCatalogHandler(async ({ type, id }) => {
      const results = [];
      const files = await fs.readdir(config.media.localPath);
      for (const file of files) {
        if (file.endsWith(".mp4") || file.endsWith(".mkv")) {
          results.push({
            id: generateStremioId({ type, id: file }),
            type,
            name: path.parse(file).name,
            poster: null,
          });
        }
      }

      if (config.torrent.enabled) {
        const torrents = await torrentService.searchTorrents("", type);
        for (const t of torrents) results.push({ id: `tt:${t.imdbId}`, type, name: t.title, poster: t.poster });
      }

      return { metas: results };
    });

    // ---------------- Meta ----------------
    builder.defineMetaHandler(async ({ type, id }) => {
      if (id.startsWith("local:")) {
        const mediaId = id.split(":")[2];
        const mediaPath = path.join(config.media.localPath, mediaId);
        await fs.access(mediaPath);
        const name = path.parse(mediaId).name;
        const seasonMatch = name.match(/S(\d+)E(\d+)/i);

        if (type === "series" && seasonMatch) {
          const [, season, episode] = seasonMatch;
          return {
            id,
            type,
            name,
            videos: [{ id: `${id}:${season}:${episode}`, title: `Episode ${episode}`, season: parseInt(season), episode: parseInt(episode), available: true }],
          };
        }

        return { id, type, name, videos: [{ id, title: name, available: true }] };
      }

      if (id.startsWith("tt:")) {
        const imdbId = id.includes(":") ? id.split(":")[1] : id;
        const tInfo = await torrentService.getTorrentInfo(imdbId, type);
        if (!tInfo) throw new Error("Torrent not found");

        if (type === "series") {
          return { id, type, name: tInfo.title, videos: tInfo.episodes.map(ep => ({ id: `tt:${imdbId}:${ep.season}:${ep.episode}`, title: ep.title, season: ep.season, episode: ep.episode, available: true })) };
        }

        return { id, type, name: tInfo.title, videos: [{ id, title: tInfo.title, available: true }] };
      }

      throw new Error("Invalid ID format");
    });

    // ---------------- Stream ----------------
    builder.defineStreamHandler(async ({ type, id }) => {
      if (id.startsWith("local:")) {
        const mediaId = id.split(":")[2];
        return { streams: [{ url: `${config.server.baseUrl}/stream/${encodeURIComponent(mediaId)}`, title: "Local Stream", name: "Local" }] };
      }

      if (id.startsWith("tt:")) {
        const parts = id.split(":");
        const imdbId = parts[1];
        const season = parts[2] ? parseInt(parts[2]) : null;
        const episode = parts[3] ? parseInt(parts[3]) : null;

        const searchQuery = type === "series" && season && episode ? `${imdbId} S${String(season).padStart(2,"0")}E${String(episode).padStart(2,"0")}` : imdbId;
        const results = await torrentService.searchTorrents(searchQuery, type);
        if (!results || results.length === 0) return { streams: [] };

        const torrent = results[0];
        const tStream = await torrentService.streamTorrent(torrent.magnetLink);
        return { streams: [{ url: `${config.server.baseUrl}/stream/${encodeURIComponent(tStream.infoHash)}`, title: torrent.title, name: "Torrent" }] };
      }

      return { streams: [] };
    });

    await serveHTTP(builder.getInterface(), { port });
    logger.info(`Stremio addon server running on port ${port}`);
  } catch (error) {
    logger.error("Failed to serve addon:", error);
    throw error;
  }
}
