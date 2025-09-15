import logger from "../utils/logger.js";
import searchService from "../providers/index.js";
import torrentService from "./torrentService.js";
import { config } from "../config/index.js";

class StreamService {
  constructor() {
    this.cache = new Map(); // cache: imdbId:season:episode -> streams
    this.setupCleanup();
  }

  /**
   * מחזיר streams לסרט או סדרה
   * @param {string} type - "movie" או "series"
   * @param {string} imdbId
   * @param {number} [season]
   * @param {number} [episode]
   */
  async getStreams(type, imdbId, season, episode) {
    try {
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
      const streams = streamsData
        .filter(result => result && (result.title || result.name || result.magnet || result.url || result.ytId))
        .map(result => this.convertToStremioStream(result));

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
   */
  convertToStremioStream(result) {
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
        stream.infoHash = infoHash;
        stream.fileIdx = result.fileIdx || 0;
        stream.sources = [magnetLink];
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
