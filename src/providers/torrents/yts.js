import axios from 'axios';
import logger from '../../utils/logger.js';
import { config } from '../../config/index.js';

class YTSProvider {
    constructor() {
        this.name = 'yts';
        this.baseUrls = [
            'https://yts.mx/api/v2',
            'https://yts.lt/api/v2',
            'https://yts.am/api/v2'
        ];
        this.currentUrl = this.baseUrls[0];
        this.lastRequest = 0;
        this.rateLimit = 1000;
    }

    /**
     * Search for movies
     * @param {Object} params 
     * @returns {Promise<Array>}
     */
    async search(params) {
        if (params.type !== 'movies') {
            return [];
        }

        const { query, imdbId } = params;
        const results = [];

        // Respect rate limiting
        const now = Date.now();
        const waitTime = this.rateLimit - (now - this.lastRequest);
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequest = Date.now();

        try {
            const queryParams = {
                limit: 50,
                quality: '720p,1080p,2160p',
                sort_by: 'seeds',
                with_rt_ratings: true
            };

            if (imdbId) {
                queryParams.imdb_id = imdbId;
            } else {
                queryParams.query_term = query;
            }

            const data = await this.fetchApi('list_movies.json', queryParams);
            if (!data?.movies) return results;

            for (const movie of data.movies) {
                for (const torrent of movie.torrents || []) {
                    const magnetParams = new URLSearchParams({
                        dn: movie.title_long,
                        tr: config.torrent.trackers
                    });

                    results.push({
                        name: `${movie.title_long} [${torrent.quality}] [YTS]`,
                        seeders: torrent.seeds || 0,
                        leechers: torrent.peers || 0,
                        size: torrent.size,
                        magnet: `magnet:?xt=urn:btih:${torrent.hash}&${magnetParams.toString()}`,
                        quality: torrent.quality,
                        provider: 'yts',
                        type: 'movies',
                        imdb: movie.imdb_code,
                        year: movie.year,
                        rating: movie.rating,
                        language: movie.language
                    });
                }
            }

            logger.debug(`[YTS] Found ${results.length} results for "${query || imdbId}"`);
            return results.sort((a, b) => b.seeders - a.seeders);

        } catch (error) {
            logger.error('[YTS] Search error:', error.message);
            return results;
        }
    }

    /**
     * Fetch from YTS API with retry and fallback
     * @param {string} endpoint 
     * @param {Object} params 
     * @returns {Promise<Object|null>}
     */
    async fetchApi(endpoint, params = {}) {
        for (const baseUrl of this.baseUrls) {
            try {
                const response = await axios.get(`${baseUrl}/${endpoint}`, {
                    params,
                    timeout: 10000
                });

                if (response.status === 200 && response.data?.status === 'ok') {
                    this.currentUrl = baseUrl;
                    return response.data.data;
                }
            } catch (error) {
                logger.debug(`[YTS] Failed to fetch from ${baseUrl}:`, error.message);
            }
        }
        return null;
    }
}

export default new YTSProvider();
