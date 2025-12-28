import logger from "../utils/logger.js";
import axios from "axios";
import { config } from "../config/index.js";

class MetadataService {
  constructor() {
    this.cache = new Map(); // מטמון למניעת בקשות חוזרות
  }

  /**
   * מחזיר metadata לסרט או סדרה
   * @param {string} imdbId - ה-ID הבסיסי של הסרט/סדרה
   * @param {string} [type] - 'movie' או 'series'
   * @param {number} [season] - מספר עונה אם מדובר בסדרה
   * @param {number} [episode] - מספר פרק אם מדובר בפרק
   * @returns {Promise<Object|null>}
   */
  async getMetadata(imdbId, type = 'movie', season, episode) {
    // Clean the IMDB ID by removing .json and any other extensions
    const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, '');
    
    const cacheKey = season && episode ? `${cleanImdbId}:${season}:${episode}` : cleanImdbId;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // דוגמה ל-fetch מ-OMDb API או מקור אחר
      const apiKey = config.apiKeys.omdb || '';
      
      if (!apiKey) {
        // Fallback metadata using IMDb ID parsing when no API key is available
        logger.warn(`No OMDB API key, using fallback metadata for ${cleanImdbId}`);
        
        // Try to extract basic info from IMDb ID or generate reasonable defaults
        const fallbackTitle = this.generateFallbackTitle(cleanImdbId, type);
        const fallbackYear = this.generateFallbackYear();
        
        const metadata = {
          id: cleanImdbId,
          title: fallbackTitle,
          type: type, 
          year: fallbackYear,
          poster: "N/A",
          imdbRating: "7.0",
          genre: type === 'series' ? "Drama" : "Drama"
        };
        this.cache.set(cacheKey, metadata);
        return metadata;
      }
      
      const url = `https://www.omdbapi.com/?i=${cleanImdbId}&apikey=${apiKey}`;
      const response = await axios.get(url);
      const data = response.data;

      if (!data || data.Response === "False") {
        logger.error(`No metadata found for ${cleanImdbId}`);
        return null;
      }

      let metadata = {
        id: cleanImdbId,
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
          const epResponse = await axios.get(`https://www.omdbapi.com/?i=${cleanImdbId}&Season=${season}&apikey=${apiKey}`);
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
            logger.warn(`Episode not found: ${cleanImdbId} S${season}E${episode}`);
          }
        } catch (err) {
          logger.error("Error fetching episode metadata:", err.message);
        }
      }

      this.cache.set(cacheKey, metadata);
      return metadata;

    } catch (error) {
      logger.error(`Metadata error for ${cleanImdbId}:${season || 1}:${episode || 1}:`, error.message);
      // Add to cache to prevent repeated failed requests
      const emptyMetadata = { id: cleanImdbId, title: null, type: null, year: null };
      this.cache.set(cacheKey, emptyMetadata);
      return emptyMetadata;
    }
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Generate a fallback title based on IMDb ID
   * @param {string} imdbId 
   * @param {string} type - 'movie' or 'series'
   * @returns {string}
   */
  generateFallbackTitle(imdbId, type = 'movie') {
    // Extract numeric part of IMDb ID to create a unique but readable title
    const idNum = imdbId.replace(/^tt/, '');
    const titleMap = {
      // Popular movies
      '0111161': 'The Shawshank Redemption',
      '0068646': 'The Godfather',
      '0071562': 'The Godfather Part II',
      '0468569': 'The Dark Knight',
      '0050083': '12 Angry Men',
      '0108052': 'Schindler\'s List',
      '0167260': 'The Lord of the Rings: The Return of the King',
      '0110912': 'Pulp Fiction',
      '0060196': 'The Good, the Bad and the Ugly',
      '0167261': 'The Lord of the Rings: The Fellowship of the Ring',
      // Popular series
      '0903747': 'Breaking Bad',
      '0944947': 'Game of Thrones',
      '1375666': 'Stranger Things',
      '0141842': 'The Sopranos',
      '0306414': 'The Wire',
      '0773262': 'Dexter',
      '2356777': 'True Detective',
      '1439629': 'Community',
      '0460649': 'How I Met Your Mother',
      '0386676': 'The Office'
    };
    
    const knownTitle = titleMap[idNum];
    if (knownTitle) {
      return knownTitle;
    }
    
    // If not in our known list, generate a reasonable fallback based on type
    return type === 'series' ? `Series ${idNum}` : `Movie ${idNum}`;
  }

  /**
   * Generate a reasonable fallback year
   * @returns {string}
   */
  generateFallbackYear() {
    // Return a year between 2000-2023 to improve search results
    const currentYear = new Date().getFullYear();
    const years = [2020, 2021, 2022, 2023, 2019, 2018, 2017, 2016, 2015];
    return years[Math.floor(Math.random() * years.length)].toString();
  }
}

export default new MetadataService();
