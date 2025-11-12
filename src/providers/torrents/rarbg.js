import axios from 'axios';
import logger from '../../utils/logger.js';
import { config } from '../../config/index.js';

class RARBGProvider {
    constructor() {
        this.name = 'rarbg';
        this.baseUrl = 'https://torrentapi.org/pubapi_v2.php';
        this.token = null;
        this.lastRequest = 0;
        this.rateLimit = 2000; // RARBG requires 2 seconds between requests
    }

    /**
     * Search for content
     * @param {Object} params 
     * @returns {Promise<Array>}
     */
    async search(params) {
        const { query, type, imdbId } = params;
        const results = [];

        try {
            // Get token if needed
            if (!this.token) {
                await this.getToken();
            }

            // Respect rate limiting
            const now = Date.now();
            const waitTime = this.rateLimit - (now - this.lastRequest);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            this.lastRequest = Date.now();

            // Prepare search parameters
            const searchParams = {
                mode: 'search',
                token: this.token,
                format: 'json_extended',
                ranked: 0,
                app_id: 'self_streme',
                sort: 'seeders',
                min_seeders: 1,
                category: type === 'movies' ? 
                    'movies' : 
                    type === 'series' ? 'tv' : null
            };

            if (imdbId) {
                searchParams.search_imdb = imdbId;
            } else {
                searchParams.search_string = query;
            }

            const response = await axios.get(this.baseUrl, {
                params: searchParams,
                timeout: 10000
            });

            if (response.data?.torrent_results) {
                for (const torrent of response.data.torrent_results) {
                    // Enhance magnet URI with our trackers
                    let magnet = torrent.download;
                    
                    // Extract info hash to check if we can enhance the magnet
                    const infoHashMatch = magnet.match(/btih:([a-fA-F0-9]+)/);
                    if (infoHashMatch) {
                        // Check if magnet already has trackers
                        const existingTrackers = (magnet.match(/&tr=[^&]+/g) || []).length;
                        
                        // Add our trackers if there are few existing trackers
                        if (existingTrackers < 5) {
                            const trackerParams = config.torrent.trackers
                                .map(tracker => `&tr=${encodeURIComponent(tracker)}`)
                                .join('');
                            magnet = magnet + trackerParams;
                        }
                    }
                    
                    results.push({
                        name: torrent.title,
                        seeders: torrent.seeders,
                        leechers: torrent.leechers,
                        size: `${Math.round(torrent.size / (1024 * 1024))} MB`,
                        magnet: magnet,
                        provider: 'rarbg',
                        type,
                        quality: this.parseQuality(torrent.title),
                        imdb: imdbId,
                        episode_info: torrent.episode_info || null
                    });
                }
            }

            logger.debug(`[RARBG] Found ${results.length} results for "${query || imdbId}"`);
            return results;

        } catch (error) {
            if (error.response?.status === 401) {
                this.token = null; // Reset token on auth error
            }
            logger.error('[RARBG] Search error:', error.message);
            return results;
        }
    }

    /**
     * Get RARBG API token
     * @returns {Promise<void>}
     */
    async getToken() {
        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    get_token: 'get_token',
                    app_id: 'self_streme'
                },
                timeout: 5000
            });

            if (response.data?.token) {
                this.token = response.data.token;
                logger.debug('[RARBG] Got new token');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Required wait after getting token
            } else {
                throw new Error('Invalid token response');
            }
        } catch (error) {
            logger.error('[RARBG] Token error:', error.message);
            throw error;
        }
    }

    /**
     * Parse quality from title
     * @param {string} title 
     * @returns {string}
     */
    parseQuality(title) {
        const quality = title.match(/\b(720p|1080p|2160p|4K)\b/i)?.[0];
        if (quality) return quality;

        if (title.includes('HDTV')) return 'HDTV';
        if (title.includes('BluRay')) return 'BluRay';
        if (title.includes('WEBRip')) return 'WEBRip';
        if (title.includes('DVDRip')) return 'DVDRip';

        return 'unknown';
    }
}

export default new RARBGProvider();
