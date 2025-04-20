import pkg from "stremio-addon-sdk";
const { addonBuilder } = pkg;
import { config } from "../config/index.js";
import mediaService from "../services/mediaService.js";
import torrentService from "../services/torrentService.js";
import logger from "../utils/logger.js";
import express from "express";
import cors from "cors";
import axios from "axios";

// Create the builder with manifest
const builder = new addonBuilder({
  id: config.addon.id,
  version: config.addon.version,
  name: config.addon.name,
  description: config.addon.description,
  catalogs: config.addon.catalogs,
  resources: config.addon.resources,
  types: config.addon.types,
  idPrefixes: config.addon.idPrefixes,
  background: config.addon.background,
});

// Helper function to generate a Stremio ID
function generateStremioId(mediaInfo) {
  return Buffer.from(mediaInfo.name).toString("base64url");
}

// Helper function to search Stremio
async function searchStremio(query, type) {
  try {
    const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(query)}.json`);
    return response.data.metas || [];
  } catch (error) {
    logger.error("Stremio search error:", error);
    return [];
  }
}

// Define catalog handler
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  try {
    if (type !== "movie" && type !== "series") {
      return { metas: [] };
    }

    // Handle search
    if (extra && extra.search) {
      const stremioResults = await searchStremio(extra.search, type);
      const localResults = await mediaService.searchMedia(extra.search);
      
      // Combine results
      const metas = [
        ...stremioResults,
        ...localResults.map(item => ({
          id: generateStremioId(item),
          type,
          name: item.name,
          poster: config.addon.background,
          background: config.addon.background,
          logo: config.addon.background,
          description: `Watch ${item.name}`,
          releaseInfo: new Date(item.modified).getFullYear().toString(),
        }))
      ];

      return { metas };
    }

    // Return local media list by default
    const mediaList = await mediaService.scanDirectory();
    const metas = mediaList.map((item) => ({
      id: generateStremioId(item),
      type,
      name: item.name,
      poster: config.addon.background,
      background: config.addon.background,
      logo: config.addon.background,
      description: `Watch ${item.name}`,
      releaseInfo: new Date(item.modified).getFullYear().toString(),
    }));

    return { metas };
  } catch (error) {
    logger.error("Catalog handler error:", error);
    return { metas: [] };
  }
});

// Define meta handler
builder.defineMetaHandler(async ({ type, id }) => {
  try {
    if (type !== "movie" && type !== "series") {
      return { meta: null };
    }

    // Try to get meta from Stremio first
    try {
      const response = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${id}.json`);
      if (response.data && response.data.meta) {
        return response.data;
      }
    } catch (error) {
      logger.debug("Stremio meta not found, checking local library");
    }

    // Fall back to local media
    const mediaList = await mediaService.scanDirectory();
    const mediaInfo = mediaList.find(
      (item) => generateStremioId(item) === id
    );

    if (!mediaInfo) {
      return { meta: null };
    }

    return {
      meta: {
        id,
        type,
        name: mediaInfo.name,
        poster: config.addon.background,
        background: config.addon.background,
        logo: config.addon.background,
        description: `Watch ${mediaInfo.name}`,
        releaseInfo: new Date(mediaInfo.modified).getFullYear().toString(),
        videos: type === "series" ? [
          {
            id: `${id}:1:1`,
            title: mediaInfo.name,
            released: new Date(mediaInfo.modified).toISOString(),
            season: 1,
            episode: 1,
            available: true,
          },
        ] : [
          {
            id: `${id}`,
            title: mediaInfo.name,
            released: new Date(mediaInfo.modified).toISOString(),
            available: true,
          },
        ],
      },
    };
  } catch (error) {
    logger.error("Meta handler error:", error);
    return { meta: null };
  }
});

// Define stream handler
builder.defineStreamHandler(async ({ type, id }) => {
  try {
    if (type !== "movie" && type !== "series") {
      return { streams: [] };
    }

    const videoId = type === "series" ? id.split(":")[0] : id;
    
    // Try to get streams from Stremio first
    try {
      const response = await axios.get(`https://v3-cinemeta.strem.io/stream/${type}/${id}.json`);
      if (response.data && response.data.streams) {
        // Convert Stremio streams to torrent streams
        const torrentStreams = response.data.streams
          .filter(stream => stream.infoHash)
          .map(stream => ({
            name: stream.name || "Unknown quality",
            title: `[${stream.name}] ${stream.title || "Stremio stream"}`,
            url: `${config.server.baseUrl}/torrent/stream?magnet=${encodeURIComponent(
              torrentService.createMagnet(stream.infoHash, stream.title)
            )}`,
            behaviorHints: {
              bingeGroup: stream.name?.includes("1080p") ? "hd" : "sd",
              notWebReady: false,
            },
          }));

        return { streams: torrentStreams };
      }
    } catch (error) {
      logger.debug("Stremio streams not found, checking local library");
    }

    // Fall back to local media and torrent search
    const mediaList = await mediaService.scanDirectory();
    const mediaInfo = mediaList.find(
      (item) => generateStremioId(item) === videoId
    );

    // Start with local streams if available
    let streams = [];
    if (mediaInfo) {
      streams = [
        {
          name: "1080p",
          title: "[Local] 1080p Multi Audio",
          url: `${config.server.baseUrl}/stream/${mediaInfo.id}?quality=1080p`,
          behaviorHints: {
            bingeGroup: "hd",
            notWebReady: false,
          },
        },
        {
          name: "720p",
          title: "[Local] 720p WebRip",
          url: `${config.server.baseUrl}/stream/${mediaInfo.id}?quality=720p`,
          behaviorHints: {
            bingeGroup: "sd",
            notWebReady: false,
          },
        },
      ];

      // Add subtitles if available
      if (await mediaService.getSubtitles(mediaInfo.id)) {
        streams.forEach((stream) => {
          stream.subtitles = [
            {
              url: `${config.server.baseUrl}/subtitles/${mediaInfo.id}`,
              lang: "en",
              id: "default",
            },
          ];
        });
      }
    }

    // Add torrent streams from search
    const torrentResults = await torrentService.searchTorrents(mediaInfo ? mediaInfo.name : id, type);
    const torrentStreams = torrentResults.map(result => ({
      name: result.quality,
      title: `[${result.source}] ${result.title}`,
      url: `${config.server.baseUrl}/torrent/stream?magnet=${encodeURIComponent(result.magnet)}`,
      behaviorHints: {
        bingeGroup: result.quality.includes("1080p") ? "hd" : "sd",
        notWebReady: false,
      },
    }));

    return { streams: [...streams, ...torrentStreams] };
  } catch (error) {
    logger.error("Stream handler error:", error);
    return { streams: [] };
  }
});

// Export the serveHTTP function
export const serveAddon = (port) => {
  const app = express();
  app.use(cors());

  // Get the interface once
  const addonInterface = builder.getInterface();

  // Serve the manifest
  app.get("/manifest.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(addonInterface.manifest);
  });

  // Handle catalog requests
  app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
    try {
      const { type, id } = req.params;
      const extra = req.params.extra ? JSON.parse(req.params.extra) : undefined;
      const result = await addonInterface.get("catalog", { type, id, extra });
      res.setHeader("Content-Type", "application/json");
      res.send(result);
    } catch (error) {
      logger.error("Catalog request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Handle meta requests
  app.get("/meta/:type/:id.json", async (req, res) => {
    try {
      const { type, id } = req.params;
      const result = await addonInterface.get("meta", { type, id });
      res.setHeader("Content-Type", "application/json");
      res.send(result);
    } catch (error) {
      logger.error("Meta request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Handle stream requests
  app.get("/stream/:type/:id.json", async (req, res) => {
    try {
      const { type, id } = req.params;
      const result = await addonInterface.get("stream", { type, id });
      res.setHeader("Content-Type", "application/json");
      res.send(result);
    } catch (error) {
      logger.error("Stream request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.listen(port, () => {
    logger.info(`Stremio addon server running on port ${port}`);
    logger.info(
      `Addon manifest available at: http://localhost:${port}/manifest.json`
    );
  });
};
