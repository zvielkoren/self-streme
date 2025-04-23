import WebTorrent from "webtorrent";
import logger from "../utils/logger.js";
import { config } from "../config/index.js";
import axios from "axios";
import path from "path";
import fs from "fs/promises";

class TorrentService {
  constructor(client = null) {
    this.client =
      client ||
      new WebTorrent({
        maxConns: config.torrent.maxConnections,
        downloadLimit: config.torrent.downloadLimit,
        uploadLimit: config.torrent.uploadLimit,
      });
    this.activeTorrents = new Map();
    this.setupCleanupInterval();
    this.apis = {
      yts: [
        "https://yts.mx/api/v2",
        "https://yts.lt/api/v2",
        "https://yts.am/api/v2",
        "https://yts.unblockit.kim/api/v2",
      ],
      eztv: [
        { domain: "https://eztvx.to", endpoint: "/api/get-torrents" },
        { domain: "https://eztv.wf", endpoint: "/api/get-torrents" },
        { domain: "https://eztv.re", endpoint: "/api/get-torrents" },
      ],
      rarbg: "https://torrentapi.org/pubapi_v2.php",
      _1337x: [
        "https://1337x.to",
        "https://1337x.st",
        "https://x1337x.ws",
        "https://x1337x.eu",
        "https://x1337x.se",
      ],
    };
  }

  setupCleanupInterval() {
    // Cleanup inactive torrents every hour
    setInterval(() => {
      const now = Date.now();
      for (const [infoHash, torrent] of this.activeTorrents.entries()) {
        if (now - torrent.lastAccessed > 3600000) {
          // 1 hour
          this.destroyTorrent(infoHash);
        }
      }
    }, 3600000);
  }

  async searchTorrents(query, type) {
    try {
      let results = [];
      const searchPromises = [];

      if (type === "movie") {
        // Search YTS
        searchPromises.push(this.searchYTS(query));

        // Search RARBG for movies
        searchPromises.push(this.searchRARBG(query, type));

        // Search 1337x
        searchPromises.push(this.search1337x(query, type));
      } else if (type === "series") {
        // Search EZTV
        searchPromises.push(this.searchEZTV(query));

        // Search RARBG for series
        searchPromises.push(this.searchRARBG(query, type));

        // Search 1337x
        searchPromises.push(this.search1337x(query, type));
      }

      // Wait for all searches to complete
      const searchResults = await Promise.allSettled(searchPromises);

      // Combine results from successful searches
      searchResults.forEach((result) => {
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
          results = results.concat(result.value);
        }
      });

      // Remove duplicates based on infoHash
      results = [
        ...new Map(results.map((item) => [item.infoHash, item])).values(),
      ];

      // Sort by seeds and limit results
      return results.sort((a, b) => b.seeds - a.seeds).slice(0, 20);
    } catch (error) {
      logger.error("Error searching torrents:", error);
      return [];
    }
  }

  async searchYTS(query) {
    let lastError = null;

    for (const apiUrl of this.apis.yts) {
      try {
        const response = await axios.get(`${apiUrl}/list_movies.json`, {
          params: {
            query_term: query,
            limit: 20,
          },
          timeout: 10000,
        });

        if (response.data.status === "ok" && response.data.data.movies) {
          return response.data.data.movies.flatMap((movie) =>
            movie.torrents.map((torrent) => ({
              infoHash: torrent.hash,
              title: `${movie.title} ${torrent.quality}`,
              quality: torrent.quality,
              size: torrent.size_bytes,
              seeds: torrent.seeds,
              peers: torrent.peers,
              magnetLink: this.createMagnet(torrent.hash, movie.title),
              poster: movie.large_cover_image,
              year: movie.year,
            }))
          );
        }
      } catch (error) {
        lastError = error;
        logger.debug(`YTS search failed for ${apiUrl}:`, error.message);
        continue;
      }
    }

    if (lastError) {
      logger.error("YTS search failed on all domains:", lastError.message);
    }
    return [];
  }

  async searchRARBG(query, type) {
    try {
      // Get token first
      const tokenResponse = await axios.get(this.apis.rarbg, {
        params: {
          get_token: "get_token",
          app_id: "self_streme",
        },
        timeout: 10000,
      });

      if (!tokenResponse.data || !tokenResponse.data.token) {
        logger.debug("Invalid RARBG token response:", tokenResponse.data);
        return [];
      }

      // Wait 2 seconds as required by RARBG API
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Map content types to RARBG categories
      const categories =
        type === "movie"
          ? ["14;17;42;44;45;46;47;48"] // Movie categories
          : ["18;41;49"]; // TV categories

      const response = await axios.get(this.apis.rarbg, {
        params: {
          token: tokenResponse.data.token,
          mode: "search",
          search_string: query,
          category: categories.join(";"),
          format: "json_extended",
          ranked: 0,
          sort: "seeders",
          limit: 25,
          min_seeders: 1,
          app_id: "self_streme",
        },
        timeout: 10000,
      });

      if (!response.data) {
        logger.debug("Empty RARBG response");
        return [];
      }

      if (response.data.error) {
        logger.debug("RARBG API error:", response.data.error);
        return [];
      }

      if (!response.data.torrent_results) {
        logger.debug("No torrent results from RARBG");
        return [];
      }

      return response.data.torrent_results.map((torrent) => ({
        infoHash: torrent.info_hash.toLowerCase(),
        title: torrent.title,
        size: torrent.size,
        seeds: torrent.seeders,
        peers: torrent.leechers,
        magnetLink: this.createMagnet(torrent.info_hash, torrent.title),
        episode:
          type === "series" ? this.parseEpisodeInfo(torrent.title) : null,
      }));
    } catch (error) {
      logger.error("RARBG search error:", error.message);
      return [];
    }
  }

  async search1337x(query, type) {
    const results = [];
    let lastError = null;

    for (const domain of this.apis._1337x) {
      try {
        // Search endpoint varies by type
        const searchPath =
          type === "movie"
            ? `/search/${encodeURIComponent(query)}/Movies/1/`
            : `/search/${encodeURIComponent(query)}/TV/1/`;

        logger.debug(`Trying 1337x domain: ${domain}${searchPath}`);

        const response = await axios.get(`${domain}${searchPath}`, {
          timeout: 10000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        });

        // Parse HTML response and extract torrent information
        const matches = response.data.match(
          /href="\/torrent\/(\d+)\/([^"]+)"/g
        );
        if (!matches) {
          logger.debug(`No matches found on ${domain}`);
          continue;
        }

        logger.debug(`Found ${matches.length} potential torrents on ${domain}`);

        for (const match of matches.slice(0, 5)) {
          // Limit to first 5 results
          try {
            const torrentId = match.match(/\/torrent\/(\d+)\//)[1];
            const torrentResponse = await axios.get(
              `${domain}/torrent/${torrentId}/`,
              {
                timeout: 10000,
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                },
              }
            );

            // Extract magnet link and other details
            const magnetMatch = torrentResponse.data.match(
              /href="(magnet:\?[^"]+)"/
            );
            if (magnetMatch) {
              const magnetLink = magnetMatch[1];
              const infoHash = magnetLink
                .match(/btih:([^&]+)/)[1]
                .toLowerCase();

              // Extract size
              const sizeMatch = torrentResponse.data.match(
                /Size:.*?([\d.]+\s*[KMGT]iB)/
              );
              const size = sizeMatch ? sizeMatch[1] : "0";

              // Extract seeds and peers
              const seedsMatch = torrentResponse.data.match(/Seeders:.*?(\d+)/);
              const peersMatch =
                torrentResponse.data.match(/Leechers:.*?(\d+)/);

              const seeds = seedsMatch ? parseInt(seedsMatch[1]) : 0;
              const peers = peersMatch ? parseInt(peersMatch[1]) : 0;

              if (seeds > 0) {
                // Only add torrents with seeds
                const title = decodeURIComponent(
                  match.match(/\/([^"]+)"/)[1].replace(/\+/g, " ")
                );
                results.push({
                  infoHash,
                  title,
                  magnetLink,
                  seeds,
                  peers,
                  size,
                  episode:
                    type === "series" ? this.parseEpisodeInfo(title) : null,
                });
              }
            }
          } catch (error) {
            logger.debug(`Failed to fetch torrent details: ${error.message}`);
            continue;
          }
        }

        if (results.length > 0) {
          logger.debug(
            `Successfully found ${results.length} torrents on ${domain}`
          );
          break; // If successful, break the domain loop
        }
      } catch (error) {
        lastError = error;
        logger.debug(`1337x search failed for ${domain}:`, error.message);
        continue;
      }
    }

    if (lastError && results.length === 0) {
      logger.error("1337x search failed on all domains:", lastError.message);
    }

    return results;
  }

  async searchEZTV(query) {
    try {
      // Try multiple EZTV domains and endpoints
      const eztvDomains = [
        { domain: "https://eztvx.to", endpoint: "/api/get-torrents" },
        { domain: "https://eztv.wf", endpoint: "/api/get-torrents" },
        { domain: "https://eztv.re", endpoint: "/api/get-torrents" },
      ];

      let response = null;
      let error = null;

      // Extract IMDb ID and episode info from query
      const imdbMatch = query.match(/tt(\d+)/);
      const episodeMatch = query.match(/S(\d+)E(\d+)/i);

      if (!imdbMatch) {
        logger.debug("No valid IMDb ID found in query:", query);
        return [];
      }

      const imdbId = imdbMatch[0];
      const season = episodeMatch ? parseInt(episodeMatch[1]) : null;
      const episode = episodeMatch ? parseInt(episodeMatch[2]) : null;

      for (const { domain, endpoint } of eztvDomains) {
        try {
          response = await axios.get(`${domain}${endpoint}`, {
            params: {
              imdb_id: imdbId,
              limit: 100,
            },
            timeout: 5000, // 5 second timeout
          });

          if (response.data && response.data.torrents) {
            // Filter torrents for specific season/episode if provided
            let torrents = response.data.torrents;
            if (season && episode) {
              torrents = torrents.filter((t) => {
                const epInfo = this.parseEpisodeInfo(t.title);
                return (
                  epInfo &&
                  epInfo.season === season &&
                  epInfo.episode === episode
                );
              });
            }

            if (torrents.length > 0) {
              return torrents.map((torrent) => ({
                infoHash: torrent.hash,
                title: torrent.title,
                size: torrent.size_bytes,
                seeds: torrent.seeds,
                peers: torrent.peers,
                magnetLink:
                  torrent.magnet_url ||
                  this.createMagnet(torrent.hash, torrent.title),
                episode: this.parseEpisodeInfo(torrent.title),
              }));
            }
          }
        } catch (e) {
          error = e;
          logger.debug(`EZTV search failed for ${domain}:`, e.message);
          continue;
        }
      }

      if (error) {
        logger.error("EZTV search failed on all domains:", error.message);
      }
      return [];
    } catch (error) {
      logger.error("EZTV search error:", error);
      return [];
    }
  }

  parseEpisodeInfo(title) {
    const match = title.match(/S(\d{2})E(\d{2})/i);
    if (match) {
      return {
        season: parseInt(match[1]),
        episode: parseInt(match[2]),
      };
    }
    return null;
  }

  createMagnet(hash, title) {
    const trackers = config.torrent.trackers;
    const trackersString = trackers
      .map((tracker) => `&tr=${encodeURIComponent(tracker)}`)
      .join("");

    return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(
      title
    )}${trackersString}`;
  }

  async getTorrentInfo(infoHash) {
    try {
      // Check if we already have this torrent
      if (this.activeTorrents.has(infoHash)) {
        const torrentData = this.activeTorrents.get(infoHash);
        const { torrent } = torrentData;
        return {
          infoHash: torrent.infoHash,
          title: torrent.name,
          size: torrent.length,
          seeds: torrent.numPeers,
          progress: torrent.progress,
          downloadSpeed: torrent.downloadSpeed,
          uploadSpeed: torrent.uploadSpeed,
          timeRemaining: torrent.timeRemaining,
        };
      }

      // If not, try to get metadata from torrent cache/history
      // This is a placeholder - you'll need to implement torrent metadata caching
      return null;
    } catch (error) {
      logger.error("Error getting torrent info:", error);
      return null;
    }
  }

  async streamTorrent(magnetLink) {
    try {
      logger.debug(`Starting torrent stream for magnet: ${magnetLink}`);
      let torrent = this.client.get(magnetLink);

      if (!torrent) {
        logger.debug("Torrent not found in client, adding new torrent");

        // Ensure temp directory exists
        await fs.mkdir(config.media.tempPath, { recursive: true });

        // Add the torrent and wait for it to be ready
        torrent = await new Promise((resolve, reject) => {
          const newTorrent = this.client.add(magnetLink, {
            path: config.media.tempPath,
            announce: config.torrent.trackers,
            maxWebConns: config.torrent.maxConnections,
          });

          logger.debug("Torrent added to client, waiting for metadata...");

          let isReady = false;
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Torrent metadata timeout"));
          }, 60000); // 60 second timeout

          const cleanup = () => {
            clearTimeout(timeout);
            newTorrent.removeListener("error", onError);
            newTorrent.removeListener("ready", onReady);
            newTorrent.removeListener("download", onDownload);
            newTorrent.removeListener("wire", onWire);
          };

          const onError = (err) => {
            cleanup();
            reject(err);
          };

          const onReady = () => {
            if (isReady) return; // Prevent multiple resolves
            isReady = true;
            cleanup();
            logger.debug(
              `Torrent ready: ${newTorrent.name}, files: ${
                newTorrent.files ? newTorrent.files.length : 0
              }`
            );
            resolve(newTorrent);
          };

          const onDownload = () => {
            if (newTorrent.files && newTorrent.files.length > 0 && !isReady) {
              onReady();
            }
          };

          const onWire = (wire) => {
            logger.debug(`New peer connected: ${wire.remoteAddress}`);
          };

          newTorrent.on("error", onError);
          newTorrent.on("ready", onReady);
          newTorrent.on("download", onDownload);
          newTorrent.on("wire", onWire);

          // Also resolve when metadata is received
          newTorrent.once("metadata", () => {
            logger.debug("Received torrent metadata");
            if (newTorrent.files && newTorrent.files.length > 0) {
              onReady();
            }
          });
        });
      }

      // Wait for files to be available
      if (!torrent.files || torrent.files.length === 0) {
        logger.debug("Waiting for torrent files...");
        await new Promise((resolve, reject) => {
          const startTime = Date.now();
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for torrent files"));
          }, 60000);

          const checkFiles = () => {
            const elapsed = Date.now() - startTime;
            if (torrent.files && torrent.files.length > 0) {
              clearTimeout(timeout);
              resolve();
            } else if (elapsed > 55000) {
              // Log more frequently near timeout
              logger.debug(
                `Still waiting for files after ${elapsed}ms... Progress: ${(
                  torrent.progress * 100
                ).toFixed(1)}%, Peers: ${torrent.numPeers}`
              );
              setTimeout(checkFiles, 1000);
            } else {
              setTimeout(checkFiles, 2000);
            }
          };

          checkFiles();
        });
      }

      // Ensure we have files after waiting
      if (!torrent.files || torrent.files.length === 0) {
        logger.error(
          `No files found in torrent: ${torrent.infoHash}, progress: ${torrent.progress}, peers: ${torrent.numPeers}`
        );
        throw new Error("No files found in torrent");
      }

      logger.debug(`Found ${torrent.files.length} files in torrent`);
      torrent.files.forEach((f) =>
        logger.debug(`File: ${f.name}, size: ${f.length}`)
      );

      // Find the largest video file
      const videoExtensions = [
        ".mp4",
        ".mkv",
        ".avi",
        ".mov",
        ".wmv",
        ".flv",
        ".webm",
      ];
      const videoFiles = torrent.files.filter((file) => {
        const ext = path.extname(file.name).toLowerCase();
        return videoExtensions.includes(ext);
      });

      if (videoFiles.length === 0) {
        logger.error(
          "No video files found in torrent. Files:",
          torrent.files.map((f) => f.name)
        );
        throw new Error("No video files found in torrent");
      }

      logger.debug(`Found ${videoFiles.length} video files`);

      const file = videoFiles.reduce((largest, current) => {
        logger.debug(
          `Comparing files - Current: ${current.name} (${current.length}), Largest: ${largest.name} (${largest.length})`
        );
        return current.length > largest.length ? current : largest;
      }, videoFiles[0]);

      logger.debug(`Selected file: ${file.name}, size: ${file.length}`);

      // Store torrent for later cleanup
      this.activeTorrents.set(torrent.infoHash, {
        torrent,
        lastAccessed: Date.now(),
        file,
      });

      // Create stream factory function
      const createStream = (start, end) => {
        logger.debug(
          `Creating stream for ${file.name} from ${start} to ${end}`
        );
        const stream = file.createReadStream({ start, end });

        // Add error handler to the stream
        stream.on("error", (err) => {
          logger.error(`Stream error for ${file.name}:`, err);
        });

        return stream;
      };

      const result = {
        file,
        createStream,
        infoHash: torrent.infoHash,
        name: file.name,
        length: file.length,
        path: file.path,
      };

      logger.debug(`Stream setup complete:`, result);
      return result;
    } catch (error) {
      logger.error("Error streaming torrent:", error);
      throw error;
    }
  }

  getTorrentStatus(infoHash) {
    const torrentData = this.activeTorrents.get(infoHash);
    if (!torrentData) {
      throw new Error("Torrent not found");
    }

    const { torrent } = torrentData;
    return {
      infoHash: torrent.infoHash,
      name: torrent.name,
      progress: torrent.progress,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      numPeers: torrent.numPeers,
      timeRemaining: torrent.timeRemaining,
      files: torrent.files.map((file) => ({
        name: file.name,
        path: file.path,
        length: file.length,
        progress: file.progress,
      })),
    };
  }

  async destroyTorrent(infoHash) {
    const torrentData = this.activeTorrents.get(infoHash);
    if (!torrentData) {
      throw new Error("Torrent not found");
    }

    const { torrent } = torrentData;
    this.activeTorrents.delete(infoHash);

    return new Promise((resolve, reject) => {
      torrent.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export default new TorrentService();
