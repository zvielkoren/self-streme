import pkg from "stremio-addon-sdk";
const { addonBuilder, serveHTTP } = pkg;
import path from "path";
import fs from "fs/promises";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

// Create a new addon builder
const manifest = {
  id: "org.stremio.self-streme",
  version: "1.0.0",
  name: "Self-Streme",
  description: "Stream your local media and torrents",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt", "local"],
  catalogs: [
    {
      type: "movie",
      id: "local.movies",
      name: "Local Movies",
      extra: [{ name: "search" }],
    },
    {
      type: "series",
      id: "local.series",
      name: "Local Series",
      extra: [{ name: "search" }],
    },
  ],
};

const builder = new addonBuilder(manifest);

// Helper function to generate Stremio ID for local media
function generateStremioId(mediaInfo) {
  return `local:${mediaInfo.type}:${mediaInfo.id}`;
}

// Export the serve function that takes the port and torrent service
export async function serveAddon(port, torrentService) {
  try {
    // Catalog handler
    builder.defineCatalogHandler(async ({ type, id }) => {
      try {
        logger.info(`Catalog request: ${type} ${id}`);
        const results = [];

        // Get local media
        const mediaDir = path.join(config.media.localPath);
        const files = await fs.readdir(mediaDir);

        for (const file of files) {
          if (file.endsWith(".mp4") || file.endsWith(".mkv")) {
            const mediaInfo = {
              id: file,
              type: type,
              name: path.parse(file).name,
            };

            results.push({
              id: generateStremioId(mediaInfo),
              type: type,
              name: mediaInfo.name,
              poster: null,
            });
          }
        }

        // Search for torrents if enabled
        if (config.torrent.enabled) {
          const torrents = await torrentService.searchTorrents("", type);
          for (const torrent of torrents) {
            results.push({
              id: `tt:${torrent.imdbId}`,
              type: type,
              name: torrent.title,
              poster: torrent.poster,
            });
          }
        }

        return { metas: results };
      } catch (error) {
        logger.error("Catalog error:", error);
        throw error;
      }
    });

    // Meta handler
    builder.defineMetaHandler(async ({ type, id }) => {
      try {
        logger.info(`Meta request: ${type} ${id}`);

        if (id.startsWith("local:")) {
          const mediaId = id.split(":")[2];
          const mediaPath = path.join(config.media.localPath, mediaId);

          try {
            await fs.access(mediaPath);
            const name = path.parse(mediaId).name;

            if (type === "series") {
              // Handle series meta
              const seasonMatch = name.match(/S(\d+)E(\d+)/i);
              if (seasonMatch) {
                const [, season, episode] = seasonMatch;
                return {
                  id,
                  type,
                  name,
                  videos: [
                    {
                      id: `${id}:${season}:${episode}`,
                      title: `Episode ${episode}`,
                      season: parseInt(season),
                      episode: parseInt(episode),
                      available: true,
                    },
                  ],
                };
              }
            }

            // Handle movie meta
            return {
              id,
              type,
              name,
              videos: [
                {
                  id: id,
                  title: name,
                  available: true,
                },
              ],
            };
          } catch (error) {
            logger.error(`Media not found: ${mediaPath}`, error);
            throw new Error("Media not found");
          }
        } else if (id.startsWith("tt:")) {
          // Handle torrent meta
          const imdbId = id.split(":")[1];
          const torrentInfo = await torrentService.getTorrentInfo(imdbId, type);

          if (!torrentInfo) {
            throw new Error("Torrent not found");
          }

          if (type === "series") {
            return {
              id,
              type,
              name: torrentInfo.title,
              videos: torrentInfo.episodes.map((episode) => ({
                id: `${id}:${episode.season}:${episode.episode}`,
                title: episode.title,
                season: episode.season,
                episode: episode.episode,
                available: true,
              })),
            };
          }

          return {
            id,
            type,
            name: torrentInfo.title,
            videos: [
              {
                id: id,
                title: torrentInfo.title,
                available: true,
              },
            ],
          };
        }

        throw new Error("Invalid ID format");
      } catch (error) {
        logger.error("Meta error:", error);
        throw error;
      }
    });

    // Stream handler
    builder.defineStreamHandler(async ({ type, id }) => {
      try {
        logger.info(`Stream request: ${type} ${id}`);

        if (!id || !type) {
          logger.error("Missing required parameters");
          return { streams: [] };
        }

        if (id.startsWith("local:")) {
          const parts = id.split(":");
          if (parts.length < 3) {
            logger.error("Invalid local ID format");
            return { streams: [] };
          }

          const mediaId = parts[2];
          const mediaPath = path.join(config.media.localPath, mediaId);

          try {
            await fs.access(mediaPath);
            return {
              streams: [
                {
                  url: `${config.server.baseUrl}/stream/${encodeURIComponent(
                    mediaId
                  )}`,
                  title: "Local Stream",
                  name: "Local",
                },
              ],
            };
          } catch (error) {
            logger.error(`Media not found: ${mediaPath}`);
            return { streams: [] };
          }
        } else if (id.match(/^tt\d+/)) {
          const parts = id.split(":");
          const imdbId = parts[0];
          const season = parts[1] ? parseInt(parts[1]) : null;
          const episode = parts[2] ? parseInt(parts[2]) : null;

          try {
            // Construct search query for series episodes
            const searchQuery =
              type === "series" && season && episode
                ? `${imdbId} S${String(season).padStart(2, "0")}E${String(
                    episode
                  ).padStart(2, "0")}`
                : imdbId;

            logger.debug(`Searching torrents with query: ${searchQuery}`);
            const searchResults = await torrentService.searchTorrents(
              searchQuery,
              type
            );

            if (!searchResults || searchResults.length === 0) {
              logger.debug("No torrents found");
              return { streams: [] };
            }

            // Use the first result
            const torrent = searchResults[0];
            logger.debug(`Selected torrent: ${torrent.title}`);

            const torrentStream = await torrentService.streamTorrent(
              torrent.magnetLink
            );
            if (!torrentStream) {
              logger.debug("Failed to create torrent stream");
              return { streams: [] };
            }

            return {
              streams: [
                {
                  url: `${config.server.baseUrl}/stream/${encodeURIComponent(
                    torrentStream.infoHash
                  )}`,
                  title: torrent.title,
                  name: "Torrent",
                },
              ],
            };
          } catch (error) {
            logger.error("Torrent stream error:", error);
            return { streams: [] };
          }
        }

        logger.error(`Unrecognized ID format: ${id}`);
        return { streams: [] };
      } catch (error) {
        logger.error("Stream error:", error);
        return { streams: [] };
      }
    });

    const addonInterface = builder.getInterface();
    serveHTTP(addonInterface, { port });

    return addonInterface;
  } catch (error) {
    logger.error("Failed to serve addon:", error);
    throw error;
  }
}
