import logger from "../utils/logger.js";
import axios from "axios";

class MetadataService {
  constructor() {
    this.cache = new Map(); // מטמון למניעת בקשות חוזרות
  }

  /**
   * מחזיר metadata לסרט או סדרה
   * @param {string} imdbId - ה-ID הבסיסי של הסרט/סדרה
   * @param {number} [season] - מספר עונה אם מדובר בסדרה
   * @param {number} [episode] - מספר פרק אם מדובר בפרק
   * @returns {Promise<Object|null>}
   */
  async getMetadata(imdbId, season, episode) {
    const cacheKey = season && episode ? `${imdbId}:${season}:${episode}` : imdbId;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // דוגמה ל-fetch מ-OMDb API או מקור אחר
      const apiKey = process.env.OMDB_API_KEY || '';
      const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`;
      const response = await axios.get(url);
      const data = response.data;

      if (!data || data.Response === "False") {
        logger.error(`No metadata found for ${cacheKey}`);
        return null;
      }

      let metadata = {
        id: imdbId,
        title: data.Title,
        type: data.Type,
        year: data.Year,
        poster: data.Poster,
        imdbRating: data.imdbRating,
        genre: data.Genre
      };

      // אם יש עונה ופרק, מחזירים מידע ספציפי לפרק
      if (season && episode && data.Type === "series") {
        // במידה ויש API שמחזיר מידע על עונות/פרקים
        // נניח שיש endpoint שמחזיר episodes
        try {
          const epResponse = await axios.get(`https://www.omdbapi.com/?i=${imdbId}&Season=${season}&apikey=${apiKey}`);
          const epData = epResponse.data;
          const ep = epData.Episodes.find(e => parseInt(e.Episode) === parseInt(episode));
          if (ep) {
            metadata = {
              ...metadata,
              season,
              episode,
              title: ep.Title,
              released: ep.Released
            };
          } else {
            logger.warn(`Episode not found: ${imdbId} S${season}E${episode}`);
          }
        } catch (err) {
          logger.error("Error fetching episode metadata:", err.message);
        }
      }

      this.cache.set(cacheKey, metadata);
      return metadata;

    } catch (error) {
      logger.error(`Metadata error for ${imdbId}:${season || 1}:${episode || 1}:`, error.message);
      // Add to cache to prevent repeated failed requests
      const emptyMetadata = { id: imdbId, title: null, type: null, year: null };
      this.cache.set(cacheKey, emptyMetadata);
      return emptyMetadata;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

export default new MetadataService();
