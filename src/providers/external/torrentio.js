import axios from 'axios';
import logger from '../../utils/logger.js';

class TorrentioProvider {
    constructor() {
        this.baseUrl = 'https://torrentio.strem.fun';
        this.lastRequest = 0;
        this.rateLimit = 1000;
    }

    /**
     * Search Torrentio for streams
     * @param {Object} params 
     * @returns {Promise<Array>}
     */
    async search(params) {
        const { type, imdbId } = params;
        if (!imdbId) {
            logger.warn('[Torrentio] IMDb ID is required');
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
            const endpoint = `${this.baseUrl}/stream/${type}/${imdbId}.json`;
            const response = await axios.get(endpoint, { timeout: 10000 });

            if (!response.data?.streams) {
                return [];
            }

            const streams = response.data.streams.map(stream => ({
                ...stream,
                provider: 'torrentio',
                source: stream.name,
                title: `${stream.title} [Torrentio]`,
                quality: this.parseQuality(stream.title),
                type
            }));

            logger.debug(`[Torrentio] Found ${streams.length} streams for ${imdbId}`);
            return streams;

        } catch (error) {
            logger.error('[Torrentio] Search error:', error.message);
            return [];
        }
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

export default new TorrentioProvider();
