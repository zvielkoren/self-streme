import WebTorrent from "webtorrent";
import logger from "../utils/logger.js";
import { config } from "../config/index.js";
import proxyManager from "../utils/proxyManager.js";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import NodeCache from "node-cache";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize variables
let client = new WebTorrent({
  maxConns: config.torrent.maxConnections,
  downloadLimit: config.torrent.downloadLimit,
  uploadLimit: config.torrent.uploadLimit,
});
let activeTorrents = new Map();
let lastRequestTime = {};
let requestDelay = 2000;
let torrentConfig = null;
let cache = null;

// פונקציות עזר
function setupCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
    for (const [infoHash, torrent] of activeTorrents.entries()) {
        if (now - torrent.lastAccessed > 3600000) {
        destroyTorrent(infoHash);
      }
      }
    }, 3600000);
  }

async function initialize() {
  try {
    const configPath = path.join(
      process.cwd(),
      "src/config/torrent-sources.json"
    );
    const configData = await fs.readFile(configPath, "utf8");
    torrentConfig = JSON.parse(configData);

    if (torrentConfig.cache.enabled) {
      cache = new NodeCache({
        stdTTL: torrentConfig.cache.duration,
        maxKeys: torrentConfig.cache.maxSize,
      });
    }

    setupCleanupInterval();
    logger.info("TorrentService initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize TorrentService:", error);
    throw error;
  }
}

// פונקציות חיפוש
async function searchTorrents(query, type) {
  try {
    const cacheKey = `${type}:${query}`;
    if (cache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.debug("Returning cached results for:", cacheKey);
        return cached;
      }
    }

    const results = [];
    const providers = getEnabledProviders(type);
    const searchPromises = [];

    for (
      let i = 0;
      i < providers.length;
      i += torrentConfig.optimization.concurrent_searches
    ) {
      const batch = providers.slice(
        i,
        i + torrentConfig.optimization.concurrent_searches
      );
      const batchPromises = batch.map((provider) =>
        searchProvider(provider, query, type).catch((err) => {
          logger.error(`Search failed for ${provider.name}:`, err);
    return [];
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());

      if (hasEnoughGoodResults(results)) {
        break;
      }
    }

    const filteredResults = filterAndSortResults(results, type);

    if (cache) {
      cache.set(cacheKey, filteredResults);
    }

    return filteredResults;
    } catch (error) {
    logger.error("Error in searchTorrents:", error);
      return [];
    }
  }

function getEnabledProviders(type) {
  return Object.entries(torrentConfig.providers)
    .filter(([, provider]) => provider.enabled && provider.type.includes(type))
    .map(([name, provider]) => ({
      name,
      ...provider,
    }))
    .sort((a, b) => a.priority - b.priority);
}

function hasEnoughGoodResults(results, minResults = 5) {
  return results.length >= minResults;
}

function filterAndSortResults(results, type) {
  return results
    .filter((result) => {
      // בדיקת איכות בסיסית
      const hasEnoughSeeders = result.seeders >= 5;
      const hasValidSize = result.size > 0;
      const hasValidTitle = result.title && result.title.length > 0;

      return hasEnoughSeeders && hasValidSize && hasValidTitle;
    })
    .sort((a, b) => b.seeders - a.seeders);
}

async function searchProvider(provider, query, type) {
  const now = Date.now();
  const lastRequest = lastRequestTime[provider.name] || 0;
  if (now - lastRequest < provider.rateLimit) {
    await new Promise((resolve) =>
      setTimeout(resolve, provider.rateLimit - (now - lastRequest))
    );
  }
  lastRequestTime[provider.name] = now;

  try {
    let results = [];
    switch (provider.name) {
      case "eztv":
        results = await searchEztv(query, type);
        break;
      case "1337x":
        results = await search1337x(query, type);
        break;
      case "kickass":
        results = await searchKickass(query, type);
        break;
      default:
        logger.warn(`Provider ${provider.name} is not implemented`);
        return [];
    }
    return results;
  } catch (error) {
    logger.error(`Search failed for ${provider.name}:`, error);
    return [];
  }
}

async function searchEztv(query, type) {
  try {
    const response = await axios.get("https://eztv.io/api/get-torrents", {
      params: {
        limit: 100,
        keywords: query,
      },
      proxy: proxyManager.getProxyConfig(),
    });

    if (!response.data || !response.data.torrents) {
      logger.warn("Eztv API returned unexpected data format");
      return [];
    }

    return response.data.torrents.map((torrent) => ({
      title: torrent.title,
      size: torrent.size_bytes,
      seeders: torrent.seeds,
      leechers: torrent.peers,
      magnet: torrent.magnet_url,
      provider: "eztv",
    }));
  } catch (error) {
    logger.error("Eztv search error:", error);
    return [];
  }
}

async function search1337x(query, type) {
  try {
    const response = await axios.get("https://www.1377x.to/search", {
      params: {
        search: query,
        category: type === "series" ? "tv" : "movies",
      },
      proxy: proxyManager.getProxyConfig(),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.status === 404) {
      logger.warn("1337x API returned 404, trying alternative domain");
      return [];
    }

    // Parse the HTML response to extract torrent information
    const results = parse1337xResults(response.data);
    return results;
  } catch (error) {
    logger.error("1337x search error:", error);
    return [];
  }
}

function parse1337xResults(html) {
  try {
    const results = [];
    const $ = cheerio.load(html);
    
    $('table.table-list tbody tr').each((i, element) => {
      const $row = $(element);
      const name = $row.find('td.name a:nth-child(2)').text().trim();
      const seeders = parseInt($row.find('td.seeds').text().trim(), 10);
      const leechers = parseInt($row.find('td.leeches').text().trim(), 10);
      const size = $row.find('td.size').text().trim();
      const uploadDate = $row.find('td.coll-date').text().trim();
      const magnetLink = $row.find('td.name a:nth-child(1)').attr('href');
      
      if (name && seeders > 0) {
        results.push({
          name,
          seeders,
          leechers,
          size,
          uploadDate,
          magnetLink,
          provider: '1337x'
        });
      }
    });
    
    return results;
  } catch (error) {
    logger.error("Error parsing 1337x results:", error);
    return [];
  }
}

async function searchKickass(query, type) {
  try {
    const response = await axios.get("https://kickasstorrents.to/search", {
      params: {
        q: query,
        category: type === "series" ? "tv" : "movies",
      },
      proxy: proxyManager.getProxyConfig(),
    });

    if (response.status === 404) {
      logger.warn("Kickass API returned 404, trying alternative domain");
      return [];
    }

    // Parse the HTML response to extract torrent information
    const results = parseKickassResults(response.data);
    return results;
  } catch (error) {
    logger.error("Kickass search error:", error);
    return [];
  }
}
function parseKickassResults(html) {
  const results = [];
  const $ = cheerio.load(html);

  $('.torrent').each((i, el) => {
    const title = $(el).find('.torrent-name a').text().trim();
    const magnet = $(el).find('a.magnet-link').attr('href');
    const seeders = parseInt($(el).find('.seeders').text(), 10);
    const leechers = parseInt($(el).find('.leechers').text(), 10);
    const size = $(el).find('.size').text().trim();

    if (title && magnet) {
      results.push({ title, magnet, seeders, leechers, size, provider: 'kickass' });
    }
  });

  return results;
}

// פונקציות סטרימינג
async function streamTorrent(magnetLink) {
    try {
      logger.debug(`Starting torrent stream for magnet: ${magnetLink}`);
    let torrent = client.get(magnetLink);

      if (!torrent) {
        logger.debug("Torrent not found in client, adding new torrent");
        await fs.mkdir(config.media.tempPath, { recursive: true });

        torrent = await new Promise((resolve, reject) => {
        const newTorrent = client.add(magnetLink, {
            path: config.media.tempPath,
            announce: config.torrent.trackers,
            maxWebConns: config.torrent.maxConnections,
          });

          let isReady = false;
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("Torrent metadata timeout"));
        }, 60000);

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
          if (isReady) return;
            isReady = true;
            cleanup();
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
    activeTorrents.set(torrent.infoHash, {
        torrent,
        lastAccessed: Date.now(),
        file,
      });

      // Create stream factory function
      const createStream = (start, end) => {
      logger.debug(`Creating stream for ${file.name} from ${start} to ${end}`);
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

async function destroyTorrent(infoHash) {
  try {
    const torrent = client.get(infoHash);
    if (torrent) {
      logger.debug(`Destroying torrent: ${infoHash}`);
      torrent.destroy();
      activeTorrents.delete(infoHash);
    }
  } catch (error) {
    logger.error(`Error destroying torrent ${infoHash}:`, error);
  }
}

function getTorrentStatus(infoHash) {
  const torrent = client.get(infoHash);
  if (!torrent) return null;

    return {
      infoHash: torrent.infoHash,
      name: torrent.name,
      progress: torrent.progress,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      numPeers: torrent.numPeers,
      timeRemaining: torrent.timeRemaining,
    ratio: torrent.ratio,
  };
}


async function getTorrentInfo(imdbId, type) {
  try {
    const cacheKey = `torrent:${imdbId}:${type}`;
    if (cache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.debug("Returning cached torrent info for:", cacheKey);
        return cached;
      }
    }

    // בקשת שם הסרט מ-OMDb (או API דומה)
    const omdbApiKey = config.apiKeys.omdb;
    const omdbResponse = await axios.get(`http://www.omdbapi.com/`, {
      params: {
        i: imdbId,
        apikey: omdbApiKey,
      },
    });

    if (!omdbResponse.data || omdbResponse.data.Response === "False") {
      logger.warn(`OMDb did not return info for ${imdbId}`);
      return null;
    }

    const titleToSearch = omdbResponse.data.Title;
    logger.debug(`Searching torrents for movie title: ${titleToSearch}`);

    const results = await searchTorrents(titleToSearch, type);

    if (results.length === 0) {
      return null;
    }

    const torrentInfo = {
      title: results[0].title,
      imdbId,
      type,
      episodes: type === "series" ? [] : undefined,
    };

    if (cache) {
      cache.set(cacheKey, torrentInfo);
    }

    return torrentInfo;
  } catch (error) {
    logger.error("Error getting torrent info:", error);
    return null;
  }
}

async function getTorrentStream(mediaId) {
  try {
    const torrent = activeTorrents.get(mediaId);
    if (!torrent) {
      return null;
    }

    const file = torrent.files.find(file => {
      const ext = path.extname(file.name).toLowerCase();
      return ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.flv'].includes(ext);
    });

    if (!file) {
      return null;
    }

    return {
      file,
      createStream: (start, end) => file.createReadStream({ start, end })
    };
  } catch (error) {
    logger.error("Error getting torrent stream:", error);
    throw error;
  }
}

const torrentService = {
  client,
  searchTorrents,
  streamTorrent,
  destroyTorrent,
  getTorrentStatus,
  getTorrentInfo,
  getTorrentStream,
  initialize
};

// Initialize the service
initialize().catch(error => {
  logger.error("Failed to initialize torrent service:", error);
});

export default torrentService;