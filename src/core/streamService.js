import logger from "../utils/logger.js";
import searchService from "../providers/index.js";
import torrentService from "./torrentService.js";
import streamHandler from "../services/streamHandler.js";
import { config } from "../config/index.js";

class StreamService {
  constructor() {
    this.cache = new Map(); // cache: imdbId:season:episode -> streams
    this.handler = streamHandler; // Add handler reference
    this.setupCleanup();
  }

  /**
   * מחזיר streams לסרט או סדרה
   * @param {string} type - "movie" או "series"
   * @param {string} imdbId
   * @param {number} [season]
   * @param {number} [episode]
   * @param {string} [userAgent] - User agent for iOS detection
   * @param {string} [baseUrl] - Base URL for proxy-aware stream URLs
   */
  async getStreams(type, imdbId, season, episode, userAgent, baseUrl) {
    try {
      // Input validation
      if (!imdbId || typeof imdbId !== 'string') {
        logger.error(`Invalid imdbId: ${imdbId}`);
        return [];
      }

      if (!type || !['movie', 'series'].includes(type)) {
        logger.error(`Invalid type: ${type}`);
        return [];
      }

      // Clean the IMDB ID by removing .json and any other extensions
      const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, '');
      
      // Validate IMDb ID format (should start with tt followed by digits)
      if (!cleanImdbId.match(/^tt\d+$/)) {
        logger.error(`Invalid IMDb ID format: ${cleanImdbId}`);
        return [];
      }

      const cacheKey = `${cleanImdbId}:${season || 0}:${episode || 0}`;
      logger.info(`Getting streams for ${type}:${cleanImdbId} S${season || "-"}E${episode || "-"}`);

      // בדיקה אם יש כבר במטמון (cache raw streams, not converted ones)
      let streamsData;
      if (this.cache.has(cacheKey)) {
        logger.info(`Cache hit for ${cacheKey}`);
        streamsData = this.cache.get(cacheKey);
      } else {
        // קריאה למקור ה־streams (searchService)
        streamsData = await searchService.search(imdbId, type, season, episode);
        if (!streamsData || !Array.isArray(streamsData) || streamsData.length === 0) {
          logger.warn(`No streams found from searchService for ${cacheKey}`);
          
          // Return a placeholder stream instead of empty array
          const placeholderStream = {
            name: "No Stream Available - Check Self-Streme Addon",
            title: "No Stream Available - Check Self-Streme Addon", 
            url: "/static/placeholder.mp4",
            quality: "N/A",
            size: "0 MB",
            seeders: 0,
            source: "placeholder",
            behaviorHints: {
              notWebReady: false,
              bingeGroup: "self-streme-placeholder"
            }
          };
          
          const placeholderResult = [placeholderStream];
          // Cache placeholder result for a shorter time to retry sooner
          this.cache.set(cacheKey, placeholderResult, 300); // 5 minutes for placeholder results
          return placeholderResult;
        }
        
        // Cache the raw stream data
        this.cache.set(cacheKey, streamsData);
      }

      // מיפוי ותיקון metadata מתוך מקור ה־streams
      const isIOS = this.isIOSDevice(userAgent);
      const streams = streamsData
        .filter(result => result && (result.title || result.name || result.magnet || result.url || result.ytId))
        .map(result => this.convertToStremioStream(result, isIOS))
        .filter(stream => stream !== null && stream && (stream.infoHash || stream.url || stream.ytId)); // Filter out invalid streams and nulls

      logger.info(`Processed ${streams.length} valid streams for ${cacheKey}`);

      // If no valid streams found after filtering, provide a helpful placeholder
      if (streams.length === 0) {
        logger.warn(`No valid streams after filtering for ${cacheKey}`);
        const placeholderStream = {
          name: "No Stream Available - Check Self-Streme Addon",
          title: "No Stream Available - Check Self-Streme Addon", 
          url: "/static/placeholder.mp4",
          quality: "N/A",
          size: "0 MB",
          seeders: 0,
          source: "placeholder",
          behaviorHints: {
            notWebReady: false,
            bingeGroup: "self-streme-placeholder"
          }
        };
        return [placeholderStream];
      }

      // Don't cache converted streams - we cache raw streams and convert per request
      return streams;

    } catch (error) {
      logger.error(`Stream service error for ${imdbId}:${season || 1}:${episode || 1}:`, error.message);
      return [];
    }
  }

  /**
   * מחזיר stream ספציפי מקאש לפי fileIdx
   */
  getCachedStream(imdbId, season, episode, fileIdx) {
    const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, '');
    const key = `${cleanImdbId}:${season || 0}:${episode || 0}`;
    const streams = this.cache.get(key) || [];
    return streams[fileIdx] || null;
  }

  /**
   * ממיר אובייקט מקור ל־Stremio Stream
   * @param {object} result - מקור stream
   * @param {boolean} isIOS - האם זה מכשיר iOS
   */
  convertToStremioStream(result, isIOS = false) {
    const stream = {
      name: result.title || result.name || "Self-Streme",
      title: result.title || result.name || "Unknown Title",
      quality: result.quality,
      size: result.size,
      seeders: result.seeders,
      source: result.source
    };

    // Log iOS detection for debugging
    if (isIOS) {
      logger.debug(`Converting stream for iOS device: ${stream.name}`);
    }

    // magnet
    if (result.magnet || (result.sources && result.sources.some(s => s.startsWith("magnet:")))) {
      const magnetLink = result.magnet || result.sources.find(s => s.startsWith("magnet:"));
      const infoHash = this.extractInfoHash(magnetLink);
      if (infoHash) {
        // Always cache stream info for proxy serving (needed for both iOS and testing)
        this.handler.cacheStream(infoHash, result.type || 'movie', result.title || result.name, result.quality || 'unknown');
        
        if (isIOS) {
          // For iOS devices, provide HTTP stream URL instead of magnet
          // Use proxy-aware base URL if provided, otherwise fall back to config
          const streamBaseUrl = baseUrl || config.server.baseUrl || `http://127.0.0.1:${config.server.port}`;
          stream.url = `${streamBaseUrl}/stream/proxy/${infoHash}`;
          logger.debug(`iOS stream: providing proxy-aware HTTP URL ${stream.url} for ${infoHash}`);
          // Don't set infoHash for iOS to ensure Stremio uses HTTP URL
        } else {
          // For desktop/Android, provide magnet link
          stream.infoHash = infoHash;
          stream.fileIdx = result.fileIdx || 0;
          stream.sources = [magnetLink];
          logger.debug(`Desktop stream: providing magnet link for ${infoHash}`);
        }
      }
    }

    // URL ישיר
    if (result.url) stream.url = result.url;

    // YouTube ID
    if (result.ytId) stream.ytId = result.ytId;

    // fallback למקרה שאין מקור תקף - החזר null כדי שהסטרים יסונן החוצה
    if (!stream.infoHash && !stream.url && !stream.ytId) {
      logger.warn(`Filtering out invalid stream: ${result.title || result.name || 'Unknown'} from ${result.source || 'unknown source'} - no valid source`);
      return null;
    }

    // behaviorHints
    stream.behaviorHints = {
      notWebReady: true,
      bingeGroup: `self-streme-${stream.quality || "default"}`
    };

    return stream;
  }

  /**
   * מוציא infoHash ממגנט URI
   */
  extractInfoHash(magnetUri) {
    if (!magnetUri) return null;
    const match = magnetUri.match(/btih:([a-fA-F0-9]+)/i);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * בודק אם המכשיר הוא iOS
   */
  isIOSDevice(userAgent) {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || 
           ua.includes('ios') || (ua.includes('mobile') && ua.includes('safari') && !ua.includes('android'));
  }

  /**
   * מנקה torrents ישנים
   */
  setupCleanup() {
    setInterval(() => {
      try {
        torrentService.cleanup();
      } catch (error) {
        logger.error("Cleanup error:", error.message);
      }
    }, config.torrent.cleanupInterval || 1800000);
  }
}

export default new StreamService();
