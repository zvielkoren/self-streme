import axios from 'axios';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Core metadata service for resolving IMDb IDs to metadata
 */
class MetadataService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Get metadata for IMDb ID
     * @param {string} imdbId 
     * @returns {Promise<Object>}
     */
    async getMetadata(imdbId) {
        try {
            // Check cache first
            if (this.cache.has(imdbId)) {
                logger.debug(`Cache hit for ${imdbId}`);
                return this.cache.get(imdbId);
            }

            logger.info(`Fetching metadata for ${imdbId}`);
            const response = await axios.get('http://www.omdbapi.com/', {
                params: {
                    i: imdbId,
                    apikey: config.apiKeys.omdb
                },
                timeout: 5000
            });

            if (response.data.Response === 'True') {
                const metadata = {
                    imdbId,
                    title: response.data.Title,
                    year: response.data.Year,
                    type: response.data.Type.toLowerCase(),
                    genre: response.data.Genre,
                    runtime: response.data.Runtime,
                    season: response.data.Season,
                    episode: response.data.Episode
                };

                // Cache the result
                this.cache.set(imdbId, metadata);
                logger.info(`Resolved ${imdbId}: ${metadata.title} (${metadata.year})`);
                return metadata;
            }

            throw new Error(`No metadata found for ${imdbId}`);
        } catch (error) {
            logger.error(`Metadata error for ${imdbId}:`, error.message);
            throw error;
        }
    }

    /**
     * Clear metadata cache
     */
    clearCache() {
        this.cache.clear();
        logger.debug('Metadata cache cleared');
    }
}

export default new MetadataService();
