/**
 * Dynamic Torrent Download Sources
 *
 * Multiple sources to download video files from torrents via HTTP.
 * Automatically tries all sources until one works.
 */

import logger from "../utils/logger.js";
import axios from "axios";

class TorrentDownloadSources {
  constructor() {
    this.sources = this.initializeSources();
    this.sourceHealth = new Map(); // Track source health
    this.lastHealthCheck = null;
  }

  /**
   * Initialize all available download sources
   * Premium services (with API keys) have highest priority
   */
  initializeSources() {
    const sources = [];

    // Premium/Debrid Services (highest reliability, requires API keys)
    if (process.env.REAL_DEBRID_API_KEY) {
      sources.push({
        name: "Real-Debrid",
        priority: 1,
        buildUrl: async (infoHash, fileName) => {
          return await this.getRealDebridUrl(infoHash, fileName);
        },
        needsMetadata: false,
        supportsResume: true,
        requiresAuth: true,
        isAsync: true,
        note: "Premium debrid service - most reliable",
      });
    }

    if (process.env.ALLDEBRID_API_KEY) {
      sources.push({
        name: "AllDebrid",
        priority: 2,
        buildUrl: async (infoHash, fileName) => {
          return await this.getAllDebridUrl(infoHash, fileName);
        },
        needsMetadata: false,
        supportsResume: true,
        requiresAuth: true,
        isAsync: true,
        note: "Premium debrid service",
      });
    }

    if (process.env.PREMIUMIZE_API_KEY) {
      sources.push({
        name: "Premiumize",
        priority: 3,
        buildUrl: async (infoHash, fileName) => {
          return await this.getPremiumizeUrl(infoHash, fileName);
        },
        needsMetadata: false,
        supportsResume: true,
        requiresAuth: true,
        isAsync: true,
        note: "Premium debrid service",
      });
    }

    // Free/Public Services (lower reliability but no cost)
    // NOTE: Many free services are unreliable. For 98%+ reliability, use premium services.
    // Add REAL_DEBRID_API_KEY or ALLDEBRID_API_KEY environment variable.
    sources.push(
      {
        name: "WebTor.io",
        priority: 10,
        buildUrl: (infoHash, fileName) =>
          `https://webtor.io/api/torrent/${infoHash}/stream/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: true,
        note: "Original fallback service, moderate reliability",
      },
      {
        name: "Instant.io",
        priority: 11,
        buildUrl: (infoHash, fileName) =>
          `https://instant.io/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: true,
        note: "WebTorrent-based, good for popular torrents",
      },
      // Removed BTCache - returns 403 Forbidden
      // Removed BTDigg Proxy - rate limited (429)
      // Removed TorrentSafe - returns 404
      // Removed MediaBox - SSL certificate expired
      // Removed TorrentStream - domain doesn't exist (ENOTFOUND)
      // Removed CloudTorrent - domain doesn't exist (ENOTFOUND)
      // Removed StreamMagnet - unreliable
      // Removed TorrentAPI - domain doesn't exist
      // Removed Seedr.cc - requires account
      // Removed Bitport.io - returns 404

      // Add alternative working sources
      {
        name: "TorrentGalaxy Cached",
        priority: 12,
        buildUrl: (infoHash, fileName) =>
          `https://tgx.rs/torrent/${infoHash}.torrent`,
        needsMetadata: false,
        supportsResume: true,
        note: "TorrentGalaxy cached torrents",
      },
      {
        name: "Academic Torrents",
        priority: 13,
        buildUrl: (infoHash, fileName) =>
          `http://academictorrents.com/download/${infoHash}`,
        needsMetadata: false,
        supportsResume: true,
        note: "Academic content, public domain",
      },
      {
        name: "BTFS Gateway",
        priority: 14,
        buildUrl: (infoHash, fileName) =>
          `https://gateway.btfs.io/btfs/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: true,
        note: "BitTorrent File System gateway",
      },
      {
        name: "WebTorrent Desktop",
        priority: 15,
        buildUrl: (infoHash, fileName) =>
          `http://localhost:9000/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: true,
        note: "Local WebTorrent Desktop if running",
      },
    );

    // Note: Free sources have ~60% reliability due to:
    // - Server downtime
    // - Rate limiting
    // - Anti-bot protections
    // - Domain changes
    // For production use, add premium service (98% reliability):
    // export REAL_DEBRID_API_KEY=your_key_here

    return sources;
  }

  /**
   * Get all available sources sorted by priority
   */
  getAllSources(infoHash, fileName, torrentData = null) {
    const availableSources = [];

    for (const source of this.sources) {
      try {
        // Skip if needs metadata but we don't have it
        if (source.needsMetadata && !torrentData) {
          logger.debug(`[Sources] Skipping ${source.name} - needs metadata`);
          continue;
        }

        // For async sources, store the buildUrl function
        if (source.isAsync) {
          availableSources.push({
            ...source,
            url: null, // Will be built async later
          });
        } else {
          const url = source.buildUrl(infoHash, fileName, torrentData);

          if (!url) {
            logger.debug(
              `[Sources] Skipping ${source.name} - URL build failed`,
            );
            continue;
          }

          availableSources.push({
            ...source,
            url,
          });
        }
      } catch (error) {
        logger.warn(
          `[Sources] Error building URL for ${source.name}: ${error.message}`,
        );
      }
    }

    // Sort by priority
    return availableSources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Test if a source is available
   */
  async testSource(source, timeout = 5000) {
    try {
      logger.debug(`[Sources] Testing ${source.name}...`);

      // Build async URL if needed
      let url = source.url;
      if (source.isAsync && !url) {
        logger.debug(`[Sources] Building async URL for ${source.name}...`);
        url = await source.buildUrl();
      }

      const response = await axios.head(url, {
        timeout,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 500,
      });

      if (response.status === 200) {
        logger.info(`[Sources] ✓ ${source.name} is available`);
        return true;
      }

      logger.debug(
        `[Sources] ${source.name} returned status ${response.status}`,
      );
      return false;
    } catch (error) {
      logger.debug(`[Sources] ${source.name} test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Find working source (tests all and returns first working)
   */
  async findWorkingSource(infoHash, fileName, torrentData = null) {
    const sources = this.getAllSources(infoHash, fileName, torrentData);

    logger.info(`[Sources] Testing ${sources.length} sources for ${fileName}`);

    // Try sources sequentially (faster to get first working one)
    for (const source of sources) {
      try {
        logger.debug(`[Sources] Testing ${source.name}...`);
        const isWorking = await this.testSource(source);
        if (isWorking) {
          logger.info(`[Sources] ✓ Found working source: ${source.name}`);
          return source;
        }
      } catch (error) {
        logger.debug(`[Sources] ${source.name} failed: ${error.message}`);
      }
    }

    logger.warn(`[Sources] No working sources found for ${fileName}`);
    return null;
  }

  /**
   * Get multiple working sources (for redundancy)
   */
  async findMultipleWorkingSources(
    infoHash,
    fileName,
    torrentData = null,
    maxSources = 3,
  ) {
    const sources = this.getAllSources(infoHash, fileName, torrentData);

    logger.info(
      `[Sources] Testing ${sources.length} sources, looking for ${maxSources} working ones`,
    );

    const workingSources = [];

    for (const source of sources) {
      if (workingSources.length >= maxSources) break;

      try {
        const isWorking = await this.testSource(source);
        if (isWorking) {
          logger.info(`[Sources] ✓ ${source.name} is working`);
          workingSources.push(source);
        }
      } catch (error) {
        logger.debug(`[Sources] ${source.name} failed: ${error.message}`);
      }
    }

    logger.info(`[Sources] Found ${workingSources.length} working sources`);
    return workingSources;
  }

  /**
   * Add custom source dynamically
   */
  addCustomSource(sourceConfig) {
    this.sources.push({
      priority: this.sources.length + 1,
      supportsResume: false,
      needsMetadata: false,
      ...sourceConfig,
    });

    logger.info(`[Sources] Added custom source: ${sourceConfig.name}`);
  }

  /**
   * Real-Debrid API integration
   */
  async getRealDebridUrl(infoHash, fileName) {
    try {
      const apiKey = process.env.REAL_DEBRID_API_KEY;
      const magnetLink = `magnet:?xt=urn:btih:${infoHash}`;

      // Add magnet to Real-Debrid
      const addResponse = await axios.post(
        "https://api.real-debrid.com/rest/1.0/torrents/addMagnet",
        `magnet=${encodeURIComponent(magnetLink)}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      const torrentId = addResponse.data.id;

      // Select all files
      await axios.post(
        `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
        "files=all",
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      // Get torrent info
      const infoResponse = await axios.get(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );

      // Find the matching file
      const file = infoResponse.data.links.find(
        (link) =>
          link.includes(fileName) ||
          infoResponse.data.files.find((f) => f.path.includes(fileName)),
      );

      if (file) {
        // Unrestrict the link to get direct download URL
        const unrestrictResponse = await axios.post(
          "https://api.real-debrid.com/rest/1.0/unrestrict/link",
          `link=${encodeURIComponent(file)}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        );

        logger.info(`[Real-Debrid] Got download URL for ${fileName}`);
        return unrestrictResponse.data.download;
      }

      throw new Error("File not found in torrent");
    } catch (error) {
      logger.error(`[Real-Debrid] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * AllDebrid API integration
   */
  async getAllDebridUrl(infoHash, fileName) {
    try {
      const apiKey = process.env.ALLDEBRID_API_KEY;
      const magnetLink = `magnet:?xt=urn:btih:${infoHash}`;

      // Upload magnet to AllDebrid
      const uploadResponse = await axios.get(
        "https://api.alldebrid.com/v4/magnet/upload",
        {
          params: {
            agent: "self-streme",
            apikey: apiKey,
            magnets: magnetLink,
          },
        },
      );

      const magnetId = uploadResponse.data.data.magnets[0].id;

      // Get magnet status
      const statusResponse = await axios.get(
        "https://api.alldebrid.com/v4/magnet/status",
        {
          params: {
            agent: "self-streme",
            apikey: apiKey,
            id: magnetId,
          },
        },
      );

      // Find the matching file
      const file = statusResponse.data.data.magnets.links.find((link) =>
        link.filename.includes(fileName),
      );

      if (file) {
        logger.info(`[AllDebrid] Got download URL for ${fileName}`);
        return file.link;
      }

      throw new Error("File not found in torrent");
    } catch (error) {
      logger.error(`[AllDebrid] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Premiumize API integration
   */
  async getPremiumizeUrl(infoHash, fileName) {
    try {
      const apiKey = process.env.PREMIUMIZE_API_KEY;
      const magnetLink = `magnet:?xt=urn:btih:${infoHash}`;

      // Add magnet to Premiumize
      const addResponse = await axios.post(
        "https://www.premiumize.me/api/transfer/create",
        {
          src: magnetLink,
          folder_id: 0,
        },
        {
          params: { apikey: apiKey },
        },
      );

      const transferId = addResponse.data.id;

      // Wait for transfer to complete (poll status)
      let attempts = 0;
      while (attempts < 30) {
        const statusResponse = await axios.get(
          "https://www.premiumize.me/api/transfer/list",
          {
            params: { apikey: apiKey },
          },
        );

        const transfer = statusResponse.data.transfers.find(
          (t) => t.id === transferId,
        );

        if (transfer && transfer.status === "finished") {
          // Get folder contents
          const folderResponse = await axios.get(
            "https://www.premiumize.me/api/folder/list",
            {
              params: {
                apikey: apiKey,
                id: transfer.folder_id,
              },
            },
          );

          // Find the matching file
          const file = folderResponse.data.content.find(
            (f) => f.name.includes(fileName) && f.type === "file",
          );

          if (file) {
            logger.info(`[Premiumize] Got download URL for ${fileName}`);
            return file.link;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }

      throw new Error("Transfer timeout");
    } catch (error) {
      logger.error(`[Premiumize] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update source health status
   */
  updateSourceHealth(sourceName, success) {
    if (!this.sourceHealth.has(sourceName)) {
      this.sourceHealth.set(sourceName, {
        successes: 0,
        failures: 0,
        lastCheck: null,
        available: true,
      });
    }

    const health = this.sourceHealth.get(sourceName);
    if (success) {
      health.successes++;
    } else {
      health.failures++;
    }
    health.lastCheck = new Date();
    health.available = health.successes > health.failures * 2; // 2:1 ratio threshold

    logger.debug(
      `[Sources] ${sourceName} health: ${health.successes}/${health.failures + health.successes}`,
    );
  }

  /**
   * Get source statistics
   */
  getStats() {
    const stats = {
      totalSources: this.sources.length,
      premiumSources: this.sources.filter((s) => s.requiresAuth).length,
      freeSources: this.sources.filter((s) => !s.requiresAuth).length,
      sources: this.sources.map((s) => {
        const health = this.sourceHealth.get(s.name);
        return {
          name: s.name,
          priority: s.priority,
          note: s.note,
          requiresAuth: s.requiresAuth || false,
          health: health
            ? {
                successes: health.successes,
                failures: health.failures,
                available: health.available,
                lastCheck: health.lastCheck,
              }
            : null,
        };
      }),
    };

    return stats;
  }
}

// Singleton
const downloadSources = new TorrentDownloadSources();

export default downloadSources;
