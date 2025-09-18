import axios from 'axios';
import logger from '../../utils/logger.js';

class TorrentioProvider {
    constructor() {
        this.name = 'Torrentio';
        this.baseUrl = 'https://torrentio.strem.fun';
        this.lastRequest = 0;
        this.rateLimit = 500; // Reduced rate limit for faster requests
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
            const response = await axios.get(endpoint, { 
                timeout: 5000,  // Reduced timeout to 5 seconds for faster response
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.data?.streams) {
                return [];
            }

            const streams = response.data.streams.map(stream => {
                const mappedStream = {
                    ...stream,
                    provider: 'torrentio',
                    source: stream.name || 'Torrentio',
                    title: stream.title ? `${stream.title} [Torrentio]` : `${stream.name || 'Unknown'} [Torrentio]`,
                    quality: this.parseQuality(stream.title || stream.name || ''),
                    type
                };
                
                // Log streams that might be problematic
                if (!mappedStream.infoHash && !mappedStream.url && !mappedStream.ytId) {
                    logger.warn(`[Torrentio] Stream without valid source: ${JSON.stringify(stream)}`);
                }
                
                return mappedStream;
            });

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
