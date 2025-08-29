import axios from 'axios';
import logger from '../../utils/logger.js';
import { config } from '../../config/index.js';

class JackettProvider {
    constructor() {
        this.config = config.external?.jackett || {};
        this.baseUrl = this.config.url || 'http://localhost:9117';
        this.apiKey = this.config.apiKey;
        this.lastRequest = 0;
        this.rateLimit = 2000;

        if (!this.apiKey) {
            logger.warn('[Jackett] No API key configured');
        }
    }

    /**
     * Search Jackett indexers
     * @param {Object} params 
     * @returns {Promise<Array>}
     */
    async search(params) {
        if (!this.apiKey) {
            return [];
        }

        const { query, type } = params;
        if (!query) {
            logger.warn('[Jackett] Search query is required');
            return [];
        }

        // Respect rate limiting
        const now = Date.now();
        const waitTime = this.rateLimit - (now - this.lastRequest);
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequest = Date.now();

        try {
            const response = await axios.get(`${this.baseUrl}/api/v2.0/indexers/all/results`, {
                params: {
                    apikey: this.apiKey,
                    Query: query,
                    Category: this.getCategory(type)
                },
                timeout: 10000
            });

            if (!response.data?.Results) {
                return [];
            }

            const results = response.data.Results.map(result => ({
                name: 'Self-Streme',
                title: `${result.Title} [Jackett]`,
                infoHash: this.extractInfoHash(result.MagnetUri),
                fileIdx: 0,
                sources: [result.MagnetUri],
                seeders: result.Seeders,
                leechers: result.Peers,
                size: result.Size,
                provider: 'jackett',
                source: result.Tracker,
                type,
                quality: this.parseQuality(result.Title)
            })).filter(result => result.infoHash && result.seeders > 0);

            logger.debug(`[Jackett] Found ${results.length} results for "${query}"`);
            return results;

        } catch (error) {
            logger.error('[Jackett] Search error:', error.message);
            return [];
        }
    }

    /**
     * Get Jackett category for content type
     * @param {string} type 
     * @returns {string}
     */
    getCategory(type) {
        switch (type) {
            case 'movies':
                return '2000';
            case 'series':
                return '5000';
            default:
                return '2000,5000';
        }
    }

    /**
     * Extract info hash from magnet URI
     * @param {string} magnetUri 
     * @returns {string|null}
     */
    extractInfoHash(magnetUri) {
        if (!magnetUri) return null;
        const match = magnetUri.match(/btih:([a-fA-F0-9]+)/i);
        return match ? match[1].toLowerCase() : null;
    }

    /**
     * Parse quality from title
     * @param {string} title 
     * @returns {string}
     */
    parseQuality(title) {
        const qualityMatch = title.match(/\b(720p|1080p|2160p|4K)\b/i);
        return qualityMatch ? qualityMatch[0] : 'unknown';
    }
}

export default new JackettProvider();
