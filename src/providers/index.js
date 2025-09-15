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
import mockProvider from './test/mockProvider.js';

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
            mockProvider,
            torrentioProvider,
            jackettProvider,
            fallbackProvider
        ];

        this.cache = new NodeCache({
            stdTTL: 3600, // 1 שעה
            checkperiod: 600
        });
    }

    async search(imdbId, type) {
        // Clean the IMDB ID by removing .json and any other extensions
        const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, '');
        
        const cacheKey = `${type}:${cleanImdbId}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const metadata = await metadataService.getMetadata(cleanImdbId);
            if (!metadata || !metadata.title) {
                logger.error(`No valid metadata found for ${cleanImdbId}`);
                return [];
            }
            
            const params = {
                imdbId,
                type,
                query: metadata.title,
                year: metadata.year
            };

            // חיפוש במקביל
            const [localResults, externalResults] = await Promise.all([
                this.searchTorrentProviders(params),
                this.searchExternalProviders(params)
            ]);

            const allResults = await this.mergeResults(localResults, externalResults);
            this.cache.set(cacheKey, allResults);

            return allResults;
        } catch (err) {
            logger.error(`Search error for ${cleanImdbId}: ${err.message}`);
            return [];
        }
    }

    async searchTorrentProviders(params) {
        const results = [];
        const searches = this.torrentProviders.map(async provider => {
            try {
                const providerResults = await provider.search(params);
                results.push(...providerResults);
            } catch (err) {
                logger.error(`${provider.name || 'TorrentProvider'} search error: ${err.message}`);
            }
        });
        await Promise.all(searches);
        return results;
    }

    async searchExternalProviders(params) {
        const results = [];
        const searches = this.externalProviders.map(async provider => {
            try {
                const providerResults = await provider.search(params);
                results.push(...providerResults);
            } catch (err) {
                logger.error(`${provider.name || 'ExternalProvider'} search error: ${err.message}`);
            }
        });
        await Promise.all(searches);
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
