// src/providers/index.js
import logger from '../utils/logger.js';
import NodeCache from 'node-cache';

// Torrent providers
import x1337Provider from './torrents/1337x.js';
import ytsProvider from './torrents/yts.js';
import rarbgProvider from './torrents/rarbg.js';
import torrentGalaxyProvider from './torrents/torrentgalaxy.js';
import tpbProvider from './torrents/piratebay.js'; // הוסף את PirateBay כאן

// External providers
import torrentioProvider from './external/torrentio.js';
import jackettProvider from './external/jackett.js';
import fallbackProvider from './external/fallbackProvider.js';
import mockProvider from './external/mockProvider.js';

// Metadata service
import metadataService from '../core/metadataService.js';

class SearchService {
    constructor() {
        this.torrentProviders = [
            x1337Provider,
            ytsProvider,
            rarbgProvider,
            torrentGalaxyProvider,
            tpbProvider
        ];

        this.externalProviders = [
            torrentioProvider,
            jackettProvider,
            fallbackProvider,
            mockProvider  // Keep mock provider as last resort
        ];

        this.cache = new NodeCache({
            stdTTL: 1800, // 30 minutes cache for faster subsequent requests
            checkperiod: 300, // Check every 5 minutes
            maxKeys: 500 // Limit cache size to prevent memory issues
        });
    }

    async search(imdbId, type, season, episode) {
        // Clean the IMDB ID by removing .json and any other extensions
        const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, '');
        
        const cacheKey = `${type}:${cleanImdbId}:${season || 0}:${episode || 0}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            logger.info(`Cache hit for ${cacheKey}`);
            return cached;
        }

        try {
            const metadata = await metadataService.getMetadata(cleanImdbId, type);
            if (!metadata || !metadata.title) {
                logger.error(`No valid metadata found for ${cleanImdbId}`);
                // Cache empty result to prevent repeated failures
                this.cache.set(cacheKey, []);
                return [];
            }
            
            // Build search query based on type
            let searchQuery = metadata.title;
            if (type === 'series' && season && episode) {
                // For series, include season and episode in search
                searchQuery = `${metadata.title} S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
                logger.info(`Searching for series: ${searchQuery} (${metadata.year})`);
            } else if (type === 'series' && season) {
                // For series season pack
                searchQuery = `${metadata.title} Season ${season}`;
                logger.info(`Searching for series season: ${searchQuery} (${metadata.year})`);
            } else {
                logger.info(`Searching with metadata: ${metadata.title} (${metadata.year})`);
            }
            
            const params = {
                imdbId: cleanImdbId,
                type,
                query: searchQuery,
                originalTitle: metadata.title,
                year: metadata.year,
                season,
                episode
            };

            // Search with timeout to prevent long loading times
            const searchPromise = Promise.all([
                this.searchTorrentProviders(params),
                this.searchExternalProviders(params)
            ]);

            // Add a timeout to prevent long loading
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Search timeout')), 15000); // 15 second timeout
            });

            const [localResults, externalResults] = await Promise.race([
                searchPromise,
                timeoutPromise
            ]);

            const allResults = await this.mergeResults(localResults, externalResults);
            
            // Cache results even if empty to prevent repeated searches
            this.cache.set(cacheKey, allResults);
            
            logger.info(`Found ${allResults.length} total results for ${cleanImdbId}`);
            return allResults;
        } catch (err) {
            logger.error(`Search error for ${cleanImdbId}: ${err.message}`);
            // Cache empty result to prevent repeated failures
            this.cache.set(cacheKey, []);
            return [];
        }
    }

    async searchTorrentProviders(params) {
        const results = [];
        const timeout = 10000; // 10 second timeout per provider
        
        const searches = this.torrentProviders.map(async provider => {
            try {
                const providerPromise = provider.search(params);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Provider timeout')), timeout);
                });
                
                const providerResults = await Promise.race([providerPromise, timeoutPromise]);
                if (Array.isArray(providerResults) && providerResults.length > 0) {
                    logger.info(`${provider.name || 'TorrentProvider'} found ${providerResults.length} results`);
                    results.push(...providerResults);
                }
            } catch (err) {
                logger.warn(`${provider.name || 'TorrentProvider'} search error: ${err.message}`);
            }
        });
        
        await Promise.allSettled(searches); // Use allSettled to not fail if some providers fail
        return results;
    }

    async searchExternalProviders(params) {
        const results = [];
        const timeout = 8000; // 8 second timeout per provider
        
        const searches = this.externalProviders.map(async provider => {
            try {
                const providerPromise = provider.search(params);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Provider timeout')), timeout);
                });
                
                const providerResults = await Promise.race([providerPromise, timeoutPromise]);
                if (Array.isArray(providerResults) && providerResults.length > 0) {
                    logger.info(`${provider.name || 'ExternalProvider'} found ${providerResults.length} results`);
                    results.push(...providerResults);
                }
            } catch (err) {
                logger.warn(`${provider.name || 'ExternalProvider'} search error: ${err.message}`);
            }
        });
        
        await Promise.allSettled(searches); // Use allSettled to not fail if some providers fail
        return results;
    }

    async mergeResults(localResults, externalResults) {
        const allResults = [...localResults, ...externalResults];
        const seen = new Set();
        const unique = allResults.filter(r => {
            const key = r.infoHash || r.url || r.magnet || r.title;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // מיון לפי איכות ואז לפי seeders
        const qualityScore = { '2160p': 4, '1080p': 3, '720p': 2, 'unknown': 1 };
        return unique.sort((a, b) => {
            const aq = qualityScore[a.quality] || 1;
            const bq = qualityScore[b.quality] || 1;
            if (bq !== aq) return bq - aq;
            return (b.seeders || 0) - (a.seeders || 0);
        });
    }

    clearCache() {
        this.cache.flushAll();
        logger.debug('Search cache cleared');
    }
}

export default new SearchService();
