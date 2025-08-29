import metadataService from './metadataService.js';
import searchService from './searchService.js';
import streamMerger from './streamMerger.js';
import logger from '../../utils/logger.js';

/**
 * Handle external stream search and merging with local streams
 * @param {string} imdbId - IMDB ID
 * @param {string} type - Content type ('movie' or 'series')
 * @param {Array} localStreams - Streams from local search
 * @returns {Promise<Array>} Merged streams from both local and external sources
 */
async function handleExternalSearch(imdbId, type, localStreams = []) {
    try {
        // Log request
        logger.info(`External search requested for ${type}:${imdbId}`);
        logger.info(`Local streams found: ${localStreams.length}`);

        // Fetch metadata
        const metadata = await metadataService.fetchMetadata(imdbId);
        
        // Validate type matches
        if (metadata.type !== type) {
            logger.warn(`Type mismatch: requested ${type}, but metadata indicates ${metadata.type}`);
        }

        // Search external sources
        const externalStreams = await searchService.searchExternal(metadata);
        logger.info(`External streams found: ${externalStreams.length}`);

        // Merge streams
        const mergedStreams = streamMerger.mergeStreams(localStreams, externalStreams);
        logger.info(`Total streams after merge: ${mergedStreams.length}`);

        return mergedStreams;
    } catch (error) {
        logger.error(`Error in external search for ${imdbId}:`, error.message);
        // Return local streams as fallback
        return localStreams;
    }
}

export default {
    handleExternalSearch
};
