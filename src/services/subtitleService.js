import logger from '../utils/logger.js';
import axios from 'axios';

/**
 * Subtitle Service - Provides subtitle support for content
 * Includes Hebrew subtitle provider integration
 */
class SubtitleService {
    constructor() {
        this.providers = {
            // OpenSubtitles-compatible API endpoints
            opensubtitles: 'https://api.opensubtitles.com/api/v1',
            // Hebrew subtitle providers
            ktuvit: 'https://www.ktuvit.me', // Israeli Hebrew subtitles
            subscene: 'https://subscene.com'
        };
        
        // Cache for subtitle results
        this.cache = new Map();
        this.cacheTimeout = 3600000; // 1 hour
    }

    /**
     * Get subtitles for content
     * @param {string} imdbId - IMDB ID (tt1234567)
     * @param {string} type - Content type ('movie' or 'series')
     * @param {number} [season] - Season number for series
     * @param {number} [episode] - Episode number for series
     * @param {string} [language='heb'] - Language code (heb for Hebrew, eng for English)
     * @returns {Promise<Array>} Array of subtitle objects
     */
    async getSubtitles(imdbId, type, season, episode, language = 'heb') {
        try {
            const cacheKey = `${imdbId}:${season || 0}:${episode || 0}:${language}`;
            
            // Check cache first
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                logger.debug(`Subtitle cache hit for ${cacheKey}`);
                return cached.subtitles;
            }

            logger.info(`Fetching ${language} subtitles for ${imdbId} (${type})`);

            const subtitles = [];

            // Try to get Hebrew subtitles from multiple sources
            if (language === 'heb' || language === 'he' || language === 'hebrew') {
                // Add Hebrew subtitle sources
                subtitles.push({
                    id: `${imdbId}-heb-ktuvit`,
                    url: this.getKtuvitSearchUrl(imdbId, type, season, episode),
                    lang: 'heb',
                    label: 'עברית (Ktuvit)',
                    provider: 'ktuvit'
                });

                subtitles.push({
                    id: `${imdbId}-heb-subscene`,
                    url: this.getSubsceneSearchUrl(imdbId, type, season, episode),
                    lang: 'heb',
                    label: 'עברית (Subscene)',
                    provider: 'subscene'
                });
            }

            // Try to get English subtitles
            if (language === 'eng' || language === 'en' || language === 'english') {
                subtitles.push({
                    id: `${imdbId}-eng-subscene`,
                    url: this.getSubsceneSearchUrl(imdbId, type, season, episode, 'eng'),
                    lang: 'eng',
                    label: 'English (Subscene)',
                    provider: 'subscene'
                });
            }

            // Cache the results
            this.cache.set(cacheKey, {
                subtitles,
                timestamp: Date.now()
            });

            logger.info(`Found ${subtitles.length} subtitle sources for ${imdbId}`);
            return subtitles;

        } catch (error) {
            logger.error(`Error fetching subtitles for ${imdbId}:`, error.message);
            return [];
        }
    }

    /**
     * Generate Ktuvit search URL for Hebrew subtitles
     * @param {string} imdbId - IMDB ID
     * @param {string} type - Content type
     * @param {number} [season] - Season number
     * @param {number} [episode] - Episode number
     * @returns {string} Search URL
     */
    getKtuvitSearchUrl(imdbId, type, season, episode) {
        // Ktuvit uses IMDB ID for search
        const baseUrl = `${this.providers.ktuvit}/Services/GetModuleAjax.ashx`;
        
        if (type === 'series' && season && episode) {
            return `${baseUrl}?request=1&imdb=${imdbId}&season=${season}&episode=${episode}`;
        }
        
        return `${baseUrl}?request=1&imdb=${imdbId}`;
    }

    /**
     * Generate Subscene search URL
     * @param {string} imdbId - IMDB ID
     * @param {string} type - Content type
     * @param {number} [season] - Season number
     * @param {number} [episode] - Episode number
     * @param {string} [lang='heb'] - Language
     * @returns {string} Search URL
     */
    getSubsceneSearchUrl(imdbId, type, season, episode, lang = 'heb') {
        // Subscene search by IMDB ID
        return `${this.providers.subscene}/subtitles/title?q=${imdbId}&l=${lang}`;
    }

    /**
     * Get subtitle URLs in Stremio format
     * @param {string} imdbId - IMDB ID
     * @param {string} type - Content type
     * @param {number} [season] - Season number
     * @param {number} [episode] - Episode number
     * @returns {Promise<Array>} Array of subtitle objects in Stremio format
     */
    async getStremioSubtitles(imdbId, type, season, episode) {
        try {
            const subtitles = [];

            // Get Hebrew subtitles
            const hebrewSubs = await this.getSubtitles(imdbId, type, season, episode, 'heb');
            subtitles.push(...hebrewSubs);

            // Get English subtitles
            const englishSubs = await this.getSubtitles(imdbId, type, season, episode, 'eng');
            subtitles.push(...englishSubs);

            return subtitles;
        } catch (error) {
            logger.error(`Error getting Stremio subtitles for ${imdbId}:`, error.message);
            return [];
        }
    }

    /**
     * Format subtitles for Stremio stream response
     * @param {Array} subtitles - Array of subtitle objects
     * @returns {Array} Formatted subtitles for Stremio
     */
    formatForStremio(subtitles) {
        return subtitles.map(sub => ({
            id: sub.id,
            url: sub.url,
            lang: sub.lang,
            label: sub.label
        }));
    }

    /**
     * Clear subtitle cache
     */
    clearCache() {
        this.cache.clear();
        logger.info('Subtitle cache cleared');
    }
}

export default new SubtitleService();
