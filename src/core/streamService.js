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
   */
  async getStreams(type, imdbId, season, episode, userAgent) {
    try {
      logger.info(`getStreams called with: type=${type}, imdbId=${imdbId}, season=${season}, episode=${episode}, userAgent=${userAgent ? userAgent.substring(0, 30) + '...' : 'undefined'}`);
      
      // Clean the IMDB ID by removing .json and any other extensions
      const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, '');
      const cacheKey = `${cleanImdbId}:${season || 0}:${episode || 0}`;
      logger.info(`Getting streams for ${type}:${cleanImdbId} S${season || "-"}E${episode || "-"}`);

      // בדיקה אם יש כבר במטמון
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // קריאה למקור ה־streams (searchService)
      const streamsData = await searchService.search(imdbId, type, season, episode);
      if (!streamsData || !Array.isArray(streamsData) || streamsData.length === 0) {
        logger.warn(`No streams found from searchService for ${cacheKey}`);
        return [];
      }

      // מיפוי ותיקון metadata מתוך מקור ה־streams
      const isIOS = this.isIOSDevice(userAgent);
      logger.info(`iOS detection result: ${isIOS} from UA: ${userAgent}`);
      logger.info(`Stream data before conversion: ${JSON.stringify(streamsData.slice(0, 2))}`); // Log first 2 results
      
      const streams = streamsData
        .filter(result => result && (result.title || result.name || result.magnet || result.url || result.ytId))
        .map(result => this.convertToStremioStream(result, isIOS));
        
      logger.info(`Converted streams: ${JSON.stringify(streams.slice(0, 2))}`); // Log first 2 converted streams

      // שמירה במטמון
      this.cache.set(cacheKey, streams);
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

    // magnet
    if (result.magnet || (result.sources && result.sources.some(s => s.startsWith("magnet:")))) {
      const magnetLink = result.magnet || result.sources.find(s => s.startsWith("magnet:"));
      const infoHash = this.extractInfoHash(magnetLink);
      if (infoHash) {
        if (isIOS) {
          // For iOS devices, provide HTTP stream URL instead of magnet
          stream.url = `/stream/proxy/${infoHash}`;
          // Cache the stream info for proxy serving
          this.handler.cacheStream(infoHash, 'movie', result.title || result.name, result.quality || 'unknown');
        } else {
          // For desktop/Android, provide magnet link
          stream.infoHash = infoHash;
          stream.fileIdx = result.fileIdx || 0;
          stream.sources = [magnetLink];
        }
      }
    }

    // URL ישיר
    if (result.url) stream.url = result.url;

    // YouTube ID
    if (result.ytId) stream.ytId = result.ytId;

    // fallback אם אין מקור
    if (!stream.infoHash && !stream.url && !stream.ytId) {
      stream.url = "https://example.com/placeholder.mp4";
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
