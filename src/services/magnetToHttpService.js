/**
 * Magnet to HTTP Streaming Service
 * 
 * Converts magnet links to HTTP streaming URLs using external proxy services.
 * This works on ANY server without requiring P2P connectivity, peers, or port forwarding.
 */

import logger from "../utils/logger.js";
import axios from "axios";

class MagnetToHttpService {
  constructor() {
    // External services that convert magnets to HTTP streams
    // These services handle the P2P torrent download and provide HTTP access
    this.services = [
      {
        name: "Webtor.io",
        // Webtor.io provides HTTP streaming from magnet links via their API
        generateUrl: (infoHash, magnet) => {
          // Webtor.io API endpoint for streaming
          // This provides actual video streaming without P2P on the client side
          const encodedMagnet = encodeURIComponent(magnet);
          return `https://webtor.io/api/stream?magnet=${encodedMagnet}`;
        },
        type: "stream",
        priority: 1,
        description: "HTTP streaming via Webtor.io API (no P2P required)"
      },
      {
        name: "iTorrents",
        // iTorrents provides torrent file downloads
        generateUrl: (infoHash) => {
          return `https://itorrents.org/torrent/${infoHash}.torrent`;
        },
        type: "torrent_file",
        priority: 4,
        description: "Download .torrent file directly"
      },
      {
        name: "BTCache",
        // BTCache provides torrent caching
        generateUrl: (infoHash) => {
          return `https://btcache.me/torrent/${infoHash}`;
        },
        type: "proxy",
        priority: 3,
        description: "Torrent cache proxy"
      },
      {
        name: "Instant.io",
        // WebTorrent.io provides instant streaming via web interface
        generateUrl: (infoHash) => `https://instant.io/#${infoHash}`,
        type: "redirect",
        priority: 5,
        description: "Web UI redirect for browser-based streaming"
      }
    ];
  }

  /**
   * Generate streaming URLs from a magnet link using external services
   * @param {string} magnet - The magnet link
   * @param {string} infoHash - The extracted infoHash
   * @returns {Promise<Object>} Object containing stream URLs and metadata
   */
  async generateStreamUrls(magnet, infoHash) {
    try {
      logger.info(`Generating stream URLs for infoHash: ${infoHash}`);

      const streamUrls = [];

      // Generate URLs from all available services
      for (const service of this.services) {
        try {
          const url = service.generateUrl(infoHash, magnet);
          streamUrls.push({
            name: service.name,
            url: url,
            type: service.type,
            priority: service.priority
          });
          logger.info(`Generated ${service.type} URL from ${service.name}: ${url}`);
        } catch (err) {
          logger.warn(`Failed to generate URL from ${service.name}:`, err.message);
        }
      }

      // Sort by priority (lower number = higher priority)
      streamUrls.sort((a, b) => a.priority - b.priority);

      return {
        success: true,
        infoHash: infoHash,
        magnet: magnet,
        streamUrls: streamUrls,
        primaryUrl: streamUrls[0]?.url || null,
        message: "Multiple streaming options available. Use the URLs with any video player."
      };
    } catch (error) {
      logger.error("Error generating stream URLs:", error);
      throw error;
    }
  }

  /**
   * Get metadata about available services
   * @returns {Array} List of available services
   */
  getAvailableServices() {
    return this.services.map(s => ({
      name: s.name,
      type: s.type,
      priority: s.priority
    }));
  }

  /**
   * Alternative: Use free public APIs that convert torrents to HTTP
   * This method searches for public torrent cache/proxy services
   */
  async findTorrentCacheUrl(infoHash) {
    // List of public torrent cache services
    const cacheServices = [
      `https://itorrents.org/torrent/${infoHash}.torrent`,
      `https://btcache.me/torrent/${infoHash}`,
      `https://thetorrent.org/torrent/${infoHash}.torrent`
    ];

    for (const cacheUrl of cacheServices) {
      try {
        // Check if the torrent file is available
        const response = await axios.head(cacheUrl, { 
          timeout: 5000,
          validateStatus: (status) => status < 500
        });
        
        if (response.status === 200) {
          logger.info(`Found torrent cache at: ${cacheUrl}`);
          return cacheUrl;
        }
      } catch (err) {
        logger.debug(`Cache service ${cacheUrl} not available:`, err.message);
      }
    }

    return null;
  }

  /**
   * Generate a universal magnet URI that works across different clients
   * Adds multiple trackers for better connectivity
   */
  enhanceMagnetLink(magnet, infoHash) {
    // List of reliable public trackers
    const publicTrackers = [
      'udp://tracker.opentrackr.org:1337/announce',
      'udp://open.demonii.com:1337/announce',
      'udp://tracker.openbittorrent.com:6969/announce',
      'udp://exodus.desync.com:6969/announce',
      'udp://tracker.torrent.eu.org:451/announce',
      'udp://tracker.moeking.me:6969/announce',
      'udp://explodie.org:6969/announce',
      'udp://tracker1.bt.moack.co.kr:80/announce',
      'udp://tracker.theoks.net:6969/announce',
      'udp://open.stealth.si:80/announce',
      'https://tracker.tamersunion.org:443/announce',
      'https://tracker.gbitt.info:443/announce'
    ];

    // Check if magnet already has the base structure
    if (!magnet.includes('xt=urn:btih:')) {
      magnet = `magnet:?xt=urn:btih:${infoHash}`;
    }

    // Add trackers if not present
    for (const tracker of publicTrackers) {
      const encodedTracker = encodeURIComponent(tracker);
      if (!magnet.includes(encodedTracker)) {
        magnet += `&tr=${encodedTracker}`;
      }
    }

    // Add DHT and peer exchange
    if (!magnet.includes('dht=')) {
      magnet += '&dht=1';
    }
    if (!magnet.includes('x.pe=')) {
      magnet += '&x.pe=1';
    }

    return magnet;
  }
}

export default new MagnetToHttpService();
