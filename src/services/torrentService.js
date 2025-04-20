import WebTorrent from "webtorrent";
import logger from "../utils/logger.js";
import { config } from "../config/index.js";
import axios from "axios";

class TorrentService {
  constructor() {
    this.client = new WebTorrent({
      maxConns: 100,
      uploadLimit: 0,
      downloadLimit: 0,
    });
    this.activeTorrents = new Map();
    this.providers = {
      stremio: "https://v3-cinemeta.strem.io",
      yts: "https://yts.mx/api/v2",
      rarbg: "https://torrentapi.org/pubapi_v2.php",
    };

    // Setup event listeners for the client
    this.client.on("error", (err) => {
      logger.error("WebTorrent client error:", err);
    });
  }

  async searchTorrents(query, type = "series") {
    try {
      // Search on YTS
      const ytsResults = await this.searchYTS(query);

      // Search on RARBG
      const rarbgResults = await this.searchRARBG(query);

      // Search on Stremio
      const stremioResults = await this.searchStremio(query, type);

      // Combine and deduplicate results
      const allResults = [...ytsResults, ...rarbgResults, ...stremioResults];

      // Filter and sort by quality and seeders
      return this.filterAndSortResults(allResults);
    } catch (error) {
      logger.error("Error searching torrents:", error);
      return [];
    }
  }

  async searchYTS(query) {
    try {
      const response = await axios.get(
        `${this.providers.yts}/list_movies.json`,
        {
          params: {
            query_term: query,
            limit: 20,
          },
        }
      );

      if (response.data.status === "ok" && response.data.data.movies) {
        return response.data.data.movies.flatMap((movie) =>
          movie.torrents.map((torrent) => ({
            title: `${movie.title} ${torrent.quality}`,
            magnet: this.createMagnet(torrent.hash, movie.title),
            quality: torrent.quality,
            size: torrent.size,
            seeders: torrent.seeds,
            source: "YTS",
          }))
        );
      }
      return [];
    } catch (error) {
      logger.error("YTS search error:", error);
      return [];
    }
  }

  async searchRARBG(query) {
    try {
      // Get token first
      const tokenResponse = await axios.get(`${this.providers.rarbg}/token`, {
        params: { get_token: "get_token", app_id: "self_streme" },
      });

      const token = tokenResponse.data.token;

      // Search with token
      const response = await axios.get(this.providers.rarbg, {
        params: {
          token,
          mode: "search",
          search_string: query,
          format: "json_extended",
          app_id: "self_streme",
        },
      });

      if (response.data.torrent_results) {
        return response.data.torrent_results.map((torrent) => ({
          title: torrent.title,
          magnet: torrent.download,
          quality: this.parseQuality(torrent.title),
          size: torrent.size,
          seeders: torrent.seeders,
          source: "RARBG",
        }));
      }
      return [];
    } catch (error) {
      logger.error("RARBG search error:", error);
      return [];
    }
  }

  async searchStremio(query, type) {
    try {
      const response = await axios.get(
        `${this.providers.stremio}/meta/${type}/${encodeURIComponent(
          query
        )}.json`
      );

      if (response.data && response.data.meta) {
        const streams = await axios.get(
          `${this.providers.stremio}/stream/${type}/${response.data.meta.id}.json`
        );

        return streams.data.streams
          .filter((stream) => stream.infoHash)
          .map((stream) => ({
            title: `${response.data.meta.name} ${stream.title}`,
            magnet: this.createMagnet(stream.infoHash, response.data.meta.name),
            quality: this.parseQuality(stream.title),
            size: stream.filesize,
            seeders: stream.seeders,
            source: "Stremio",
          }));
      }
      return [];
    } catch (error) {
      logger.error("Stremio search error:", error);
      return [];
    }
  }

  createMagnet(hash, title) {
    const trackers = [
      "udp://tracker.opentrackr.org:1337",
      "udp://tracker.leechers-paradise.org:6969",
      "udp://tracker.coppersurfer.tk:6969",
    ];

    const trackersString = trackers
      .map((tracker) => `&tr=${encodeURIComponent(tracker)}`)
      .join("");

    return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(
      title
    )}${trackersString}`;
  }

  parseQuality(title) {
    const qualities = ["2160p", "1080p", "720p", "480p"];
    for (const quality of qualities) {
      if (title.includes(quality)) return quality;
    }
    return "unknown";
  }

  filterAndSortResults(results) {
    // Remove duplicates based on magnet link
    const unique = [
      ...new Map(results.map((item) => [item.magnet, item])).values(),
    ];

    // Sort by quality (higher first) and seeders
    return unique.sort((a, b) => {
      const qualityOrder = {
        "2160p": 4,
        "1080p": 3,
        "720p": 2,
        "480p": 1,
        unknown: 0,
      };
      const qualityDiff = qualityOrder[b.quality] - qualityOrder[a.quality];
      if (qualityDiff !== 0) return qualityDiff;
      return b.seeders - a.seeders;
    });
  }

  async streamTorrent(magnetLink) {
    try {
      // Check if we already have this torrent
      if (this.activeTorrents.has(magnetLink)) {
        return this.activeTorrents.get(magnetLink);
      }

      return new Promise((resolve, reject) => {
        const torrent = this.client.add(magnetLink, {
          path: config.media.tempPath,
          strategy: "sequential", // Download sequentially for streaming
          announce: [
            "wss://tracker.openwebtorrent.com",
            "wss://tracker.btorrent.xyz",
            "udp://tracker.opentrackr.org:1337",
            "udp://open.stealth.si:80/announce",
          ],
        });

        // Handle torrent events
        torrent.on("ready", () => {
          const file = torrent.files.find(
            (file) =>
              file.name.endsWith(".mp4") ||
              file.name.endsWith(".mkv") ||
              file.name.endsWith(".avi")
          );

          if (!file) {
            torrent.destroy();
            reject(new Error("No valid video file found in torrent"));
            return;
          }

          // Configure file streaming
          file.select();
          file.on("download", (bytes) => {
            const progress = ((file.downloaded / file.length) * 100).toFixed(2);
            logger.info(
              `Downloading ${file.name}: ${progress}% (${bytes} bytes)`
            );
          });

          const result = {
            stream: null,
            file,
            torrent,
            createStream: (start, end) => {
              // Create a new stream for each request
              const stream = file.createReadStream({
                start: start || 0,
                end: end || file.length - 1,
                fastSeek: true,
              });

              // Monitor stream progress
              let lastProgress = 0;
              stream.on("data", () => {
                const progress = (
                  (file.downloaded / file.length) *
                  100
                ).toFixed(0);
                if (progress !== lastProgress) {
                  lastProgress = progress;
                  logger.info(`Streaming progress: ${progress}%`);
                }
              });

              return stream;
            },
            destroy: () => {
              if (result.stream) {
                result.stream.destroy();
              }
              torrent.destroy({
                destroyStore: true,
              });
              this.activeTorrents.delete(magnetLink);
            },
          };

          this.activeTorrents.set(magnetLink, result);
          resolve(result);

          // Start pre-buffering
          const BUFFER_SIZE = 1024 * 1024 * 2; // 2MB buffer
          file.createReadStream({
            start: 0,
            end: BUFFER_SIZE,
          });
        });

        torrent.on("error", (err) => {
          logger.error("Torrent error:", err);
          reject(err);
        });

        torrent.on("warning", (err) => {
          logger.warn("Torrent warning:", err);
        });

        // Monitor download speed and peers
        const interval = setInterval(() => {
          logger.info(
            `Download speed: ${(torrent.downloadSpeed / 1024 / 1024).toFixed(
              2
            )} MB/s`
          );
          logger.info(`Connected peers: ${torrent.numPeers}`);
        }, 5000);

        torrent.on("done", () => {
          clearInterval(interval);
          logger.info("Torrent download completed");
        });
      });
    } catch (error) {
      logger.error("Error streaming torrent:", error);
      throw error;
    }
  }

  getTorrentStatus(infoHash) {
    const torrent = this.activeTorrents.get(infoHash);
    if (!torrent) {
      throw new Error("Torrent not found");
    }

    return {
      infoHash: torrent.infoHash,
      name: torrent.name,
      progress: torrent.progress,
      downloadSpeed: torrent.downloadSpeed,
      uploaded: torrent.uploaded,
      downloaded: torrent.downloaded,
      numPeers: torrent.numPeers,
      timeRemaining: torrent.timeRemaining,
      files: torrent.files.map((file) => ({
        name: file.name,
        length: file.length,
        progress: file.progress,
        path: file.path,
      })),
    };
  }

  destroyTorrent(infoHash) {
    const torrent = this.activeTorrents.get(infoHash);
    if (!torrent) {
      throw new Error("Torrent not found");
    }

    // Remove all listeners to prevent memory leaks
    torrent.removeAllListeners();

    // Destroy the torrent
    torrent.destroy();

    // Remove from active torrents map
    this.activeTorrents.delete(infoHash);
  }
}

export default new TorrentService();
