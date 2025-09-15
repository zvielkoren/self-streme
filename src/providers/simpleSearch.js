import logger from '../utils/logger.js';
import NodeCache from 'node-cache';

/**
 * Simple Search Service for Testing
 * 
 * This is a basic implementation that provides test data
 * In a real implementation, this would integrate with actual torrent providers
 */
class SimpleSearchService {
    constructor() {
        this.cache = new NodeCache({
            stdTTL: 3600, // 1 hour
            checkperiod: 600
        });
    }

    /**
     * Search for streams - returns mock data for testing
     * @param {string} imdbId - IMDb ID
     * @param {string} type - Content type (movie/series)
     * @param {number} season - Season number (for series)
     * @param {number} episode - Episode number (for series)
     * @returns {Promise<Array>} - Array of stream objects
     */
    async search(imdbId, type, season, episode) {
        try {
            const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, '');
            const cacheKey = `${type}:${cleanImdbId}:${season || 0}:${episode || 0}`;
            
            // Check cache
            const cached = this.cache.get(cacheKey);
            if (cached) {
                logger.debug(`Returning cached results for ${cacheKey}`);
                return cached;
            }

            logger.info(`Searching for ${type} ${cleanImdbId} S${season || 'N/A'}E${episode || 'N/A'}`);

            // Generate mock test data
            const results = this.generateMockResults(cleanImdbId, type, season, episode);
            
            // Cache results
            this.cache.set(cacheKey, results);
            
            return results;

        } catch (error) {
            logger.error(`Search error for ${imdbId}: ${error.message}`);
            return [];
        }
    }

    /**
     * Generate mock results for testing
     * @param {string} imdbId - IMDb ID
     * @param {string} type - Content type
     * @param {number} season - Season number
     * @param {number} episode - Episode number
     * @returns {Array} - Mock stream results
     */
    generateMockResults(imdbId, type, season, episode) {
        // This is where you would implement real torrent provider searches
        // For now, we return mock data to demonstrate the secure streaming functionality
        
        const baseTitle = `Content ${imdbId}`;
        const episodeTitle = season && episode ? ` S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}` : '';
        
        return [
            {
                title: `${baseTitle}${episodeTitle} 1080p BluRay x264`,
                quality: '1080p',
                size: 2147483648, // 2GB in bytes
                seeders: 156,
                source: 'Mock Provider',
                magnet: 'magnet:?xt=urn:btih:' + this.generateMockInfoHash() + '&dn=' + encodeURIComponent(baseTitle) + '&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337',
                fileIdx: 0
            },
            {
                title: `${baseTitle}${episodeTitle} 720p WEB-DL x264`,
                quality: '720p',
                size: 1073741824, // 1GB in bytes
                seeders: 89,
                source: 'Mock Provider',
                magnet: 'magnet:?xt=urn:btih:' + this.generateMockInfoHash() + '&dn=' + encodeURIComponent(baseTitle) + '&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337',
                fileIdx: 0
            },
            {
                title: `${baseTitle}${episodeTitle} 480p Web`,
                quality: '480p',
                size: 536870912, // 512MB in bytes
                seeders: 34,
                source: 'Mock Provider',
                magnet: 'magnet:?xt=urn:btih:' + this.generateMockInfoHash() + '&dn=' + encodeURIComponent(baseTitle) + '&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337',
                fileIdx: 0
            }
        ];
    }

    /**
     * Generate a mock info hash for testing
     * @returns {string} - 40-character hex string
     */
    generateMockInfoHash() {
        return Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }

    /**
     * Clear the search cache
     */
    clearCache() {
        this.cache.flushAll();
        logger.debug('Search cache cleared');
    }
}

export default new SimpleSearchService();