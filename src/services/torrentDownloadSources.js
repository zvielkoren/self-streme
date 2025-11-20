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
  }

  /**
   * Initialize all available download sources
   */
  initializeSources() {
    return [
      {
        name: "Instant.io",
        priority: 1,
        buildUrl: (infoHash, fileName) =>
          `https://instant.io/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: true,
        note: "WebTorrent-based, good for popular torrents",
      },
      {
        name: "TorrentDrive",
        priority: 2,
        buildUrl: (infoHash, fileName) =>
          `https://www.torrentdrive.com/api/download/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: false,
        note: "Alternative service",
      },
      {
        name: "BTCache",
        priority: 3,
        buildUrl: (infoHash, fileName) =>
          `https://btcache.me/torrent/${infoHash}`,
        needsMetadata: false,
        supportsResume: true,
        note: "Torrent cache proxy",
      },
      {
        name: "BTDigg Proxy",
        priority: 4,
        buildUrl: (infoHash, fileName) =>
          `https://api.btdig.com/download/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: false,
        note: "BTDigg streaming proxy",
      },
      {
        name: "TorrentSafe",
        priority: 5,
        buildUrl: (infoHash, fileName) =>
          `https://torrentsafe.com/download/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: true,
        note: "Safe torrent streaming",
      },
      {
        name: "MediaBox",
        priority: 6,
        buildUrl: (infoHash, fileName) =>
          `https://mediabox.io/stream/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: true,
        note: "Media streaming service",
      },
      {
        name: "TorrentStream",
        priority: 7,
        buildUrl: (infoHash, fileName) =>
          `https://stream.torrentproject.cc/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: false,
        note: "Torrent streaming proxy",
      },
      {
        name: "CloudTorrent",
        priority: 8,
        buildUrl: (infoHash, fileName) =>
          `https://cloudtorrent.io/download/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: true,
        note: "Cloud torrent service",
      },
      {
        name: "StreamMagnet",
        priority: 9,
        buildUrl: (infoHash, fileName) =>
          `https://streammagnet.com/get/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: true,
        note: "Magnet streaming service",
      },
      {
        name: "TorrentAPI",
        priority: 10,
        buildUrl: (infoHash, fileName) =>
          `https://api.torrent-streaming.net/stream/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: false,
        note: "Generic torrent API",
      },
      {
        name: "Seedr.cc",
        priority: 11,
        buildUrl: (infoHash, fileName, torrentData) => {
          if (!torrentData) return null;
          const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(torrentData.name)}`;
          return `https://www.seedr.cc/api/torrent/download?magnet=${encodeURIComponent(magnet)}&file=${encodeURIComponent(fileName)}`;
        },
        needsMetadata: true,
        supportsResume: false,
        note: "Requires magnet link",
      },
      {
        name: "Bitport.io",
        priority: 12,
        buildUrl: (infoHash, fileName) =>
          `https://bitport.io/api/torrent/download/${infoHash}/${encodeURIComponent(fileName)}`,
        needsMetadata: false,
        supportsResume: true,
        note: "Cloud torrent service",
      },
    ];
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

        const url = source.buildUrl(infoHash, fileName, torrentData);

        if (!url) {
          logger.debug(`[Sources] Skipping ${source.name} - URL build failed`);
          continue;
        }

        availableSources.push({
          ...source,
          url,
        });
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

      const response = await axios.head(source.url, {
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
   * Get source statistics
   */
  getStats() {
    return {
      totalSources: this.sources.length,
      sources: this.sources.map((s) => ({
        name: s.name,
        priority: s.priority,
        note: s.note,
      })),
    };
  }
}

// Singleton
const downloadSources = new TorrentDownloadSources();

export default downloadSources;
