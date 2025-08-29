import axios from 'axios';
import { config } from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Fetch metadata for a given IMDB ID using OMDB/TMDB
 * @param {string} imdbId - IMDB ID (e.g., tt17023012)
 * @returns {Promise<Object>} Movie/Series metadata
 */
async function fetchMetadata(imdbId) {
    try {
        logger.info(`Fetching metadata for IMDB ID: ${imdbId}`);
        
        const omdbResponse = await axios.get('http://www.omdbapi.com/', {
            params: {
                i: imdbId,
                apikey: config.apiKeys.omdb
            },
            timeout: 5000
        });

        if (omdbResponse.data.Response === 'True') {
            const metadata = {
                imdbId,
                title: omdbResponse.data.Title,
                year: omdbResponse.data.Year,
                type: omdbResponse.data.Type.toLowerCase(),
                originalTitle: omdbResponse.data.Title // Keep original title for exact matching
            };
            
            logger.info(`Resolved ${imdbId} to: ${metadata.title} (${metadata.year})`);
            return metadata;
        }

        throw new Error(`No metadata found for IMDB ID: ${imdbId}`);
    } catch (error) {
        logger.error(`Error fetching metadata for ${imdbId}:`, error.message);
        throw error;
    }
}

export default {
    fetchMetadata
};
