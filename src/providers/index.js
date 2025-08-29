import logger from '../utils/logger.js';
import metadataService from '../core/metadataService.js';
import torrentService from '../core/torrentService.js';
import NodeCache from 'node-cache';

// Import torrent providers
import x1337Provider from './torrents/1337x.js';
import ytsProvider from './torrents/yts.js';
import rarbgProvider from './torrents/rarbg.js';
import torrentGalaxyProvider from './torrents/torrentgalaxy.js';

// Import external providers
import torrentioProvider from './external/torrentio.js';
import jackettProvider from './external/jackett.js';
import fallbackProvider from './external/fallbackProvider.js';

class SearchService {
    constructor() {
        this.torrentProviders = [
            x1337Provider,
            ytsProvider,
            rarbgProvider,
            torrentGalaxyProvider
        ];

        this.externalProviders = [
            torrentioProvider,
            jackettProvider,
            fallbackProvider,
        ];

        // Initialize cache
        this.cache = new NodeCache({
            stdTTL: 3600, // 1 hour
            checkperiod: 600 // Clean up every 10 minutes
        });
    }

    /**
     * Search all providers for content
     * @param {string} imdbId 
     * @param {string} type 
     * @returns {Promise<Array>}
     */
    async search(imdbId, type) {
        logger.info(`Searching for ${type}:${imdbId}`);

        // Check cache first
        const cacheKey = `${type}:${imdbId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            logger.debug(`Cache hit for ${cacheKey}`);
            return cached;
        }

        try {
            // Get metadata
            const metadata = await metadataService.getMetadata(imdbId);
            logger.info(`Found metadata: ${metadata.title} (${metadata.year})`);

            // Search parameters
            const params = {
                imdbId,
                type,
                query: metadata.title,
                year: metadata.year
            };

            // Search all providers in parallel
            const [localResults, externalResults] = await Promise.all([
                this.searchTorrentProviders(params),
                this.searchExternalProviders(params)
            ]);

            // Merge and filter results
            const allResults = await this.mergeResults(localResults, externalResults);
            
            // Cache results
            this.cache.set(cacheKey, allResults);
            
            return allResults;

        } catch (error) {
            logger.error(`Search error for ${imdbId}:`, error.message);
            return [];
        }
    }

    /**
     * Search torrent providers
     * @param {Object} params 
     * @returns {Promise<Array>}
     */
    async searchTorrentProviders(params) {
        logger.debug('Searching torrent providers...');
        const results = [];

        const searches = this.torrentProviders.map(async provider => {
            try {
                const providerResults = await provider.search(params);
                results.push(...providerResults);
            } catch (error) {
                logger.error(`${provider.name} search error:`, error.message);
            }
        });

        await Promise.all(searches);
        logger.debug(`Found ${results.length} results from torrent providers`);
        return results;
    }

    /**
     * Search external providers
     * @param {Object} params 
     * @returns {Promise<Array>}
     */
    async searchExternalProviders(params) {
        logger.debug('Searching external providers...');
        const results = [];

        const searches = this.externalProviders.map(async provider => {
            try {
                const providerResults = await provider.search(params);
                results.push(...providerResults);
            } catch (error) {
                logger.error(`${provider.name} search error:`, error.message);
            }
        });

        await Promise.all(searches);
        logger.debug(`Found ${results.length} results from external providers`);
        return results;
    }

    /**
     * Merge and filter results
     * @param {Array} localResults 
     * @param {Array} externalResults 
     * @returns {Promise<Array>}
     */
    async mergeResults(localResults, externalResults) {
        const allResults = [...localResults, ...externalResults];
        
        // Remove duplicates based on infoHash
        const seen = new Set();
        const uniqueResults = allResults.filter(result => {
            const key = result.infoHash || result.url;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort by seeders and quality
        const sortedResults = uniqueResults.sort((a, b) => {
            // Quality score
            const qualityScore = {
                '2160p': 4,
                '1080p': 3,
                '720p': 2,
                'unknown': 1
            };

            const aQuality = qualityScore[a.quality] || 1;
            const bQuality = qualityScore[b.quality] || 1;

            // Prioritize by quality first, then seeders
            if (bQuality !== aQuality) {
                return bQuality - aQuality;
            }
            return (b.seeders || 0) - (a.seeders || 0);
        });

        logger.debug(`Merged results: ${sortedResults.length} unique streams`);
        return sortedResults;
    }

    /**
     * Clear search cache
     */
    clearCache() {
        this.cache.flushAll();
        logger.debug('Search cache cleared');
    }
}

export default new SearchService();
