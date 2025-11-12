import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../../utils/logger.js';
import proxyService from '../../core/proxyService.js';
import { config } from '../../config/index.js';

class TorrentGalaxyProvider {
    constructor() {
        this.name = 'torrentgalaxy';
        this.baseUrls = [
            'https://torrentgalaxy.to',
            'https://tgx.rs',
            'https://torrentgalaxy.mx'
        ];
        this.currentUrl = this.baseUrls[0];
        this.lastRequest = 0;
        this.rateLimit = 1000;
    }

    /**
     * Search for content
     * @param {Object} params 
     * @returns {Promise<Array>}
     */
    async search(params) {
        const { query, type, imdbId } = params;
        const results = [];

        // Respect rate limiting
        const now = Date.now();
        const waitTime = this.rateLimit - (now - this.lastRequest);
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequest = Date.now();

        try {
            // Try IMDB search first if available
            if (imdbId) {
                const imdbResults = await this.searchByImdb(imdbId, type);
                if (imdbResults.length > 0) {
                    return imdbResults;
                }
            }

            // Fall back to title search
            const searchPath = `/torrents.php?search=${encodeURIComponent(query)}`;
            const html = await this.fetchPage(searchPath);
            if (!html) return results;

            const $ = cheerio.load(html);
            
            $('.tgxtablerow').each((i, element) => {
                const result = this.parseResultRow($, element, type);
                if (result) results.push(result);
            });

            logger.debug(`[TorrentGalaxy] Found ${results.length} results for "${query}"`);
            return results;

        } catch (error) {
            logger.error('[TorrentGalaxy] Search error:', error.message);
            return results;
        }
    }

    /**
     * Search by IMDB ID
     * @param {string} imdbId 
     * @param {string} type 
     * @returns {Promise<Array>}
     */
    async searchByImdb(imdbId, type) {
        try {
            const searchPath = `/torrents.php?search=${encodeURIComponent('imdb=' + imdbId)}`;
            const html = await this.fetchPage(searchPath);
            if (!html) return [];

            const $ = cheerio.load(html);
            const results = [];

            $('.tgxtablerow').each((i, element) => {
                const result = this.parseResultRow($, element, type);
                if (result) results.push(result);
            });

            logger.debug(`[TorrentGalaxy] Found ${results.length} results for IMDB ${imdbId}`);
            return results;

        } catch (error) {
            logger.error(`[TorrentGalaxy] IMDB search error:`, error.message);
            return [];
        }
    }

    /**
     * Parse a search result row
     * @param {Object} $ - Cheerio instance
     * @param {Object} element - DOM element
     * @param {string} type - Content type
     * @returns {Object|null}
     */
    parseResultRow($, element, type) {
        try {
            const $row = $(element);
            
            // Check category
            const category = $row.find('.tgxtablecell:nth-child(1) a small').text().trim().toLowerCase();
            if (type === 'movies' && !category.includes('movies')) return null;
            if (type === 'series' && !category.includes('tv')) return null;

            const name = $row.find('.tgxtablecell:nth-child(4) div a b').text().trim();
            const seeders = parseInt($row.find('.tgxtablecell:nth-child(11) span font:nth-child(1)').text(), 10) || 0;
            const leechers = parseInt($row.find('.tgxtablecell:nth-child(11) span font:nth-child(2)').text(), 10) || 0;
            const size = $row.find('.tgxtablecell:nth-child(8)').text().trim();
            const magnet = $row.find('.tgxtablecell:nth-child(5) a[href^="magnet:"]').attr('href');

            if (!name || !magnet || seeders === 0) return null;

            // Extract info hash and enhance magnet URI with our trackers
            const infoHashMatch = magnet.match(/btih:([a-fA-F0-9]+)/);
            const infoHash = infoHashMatch ? infoHashMatch[1] : null;
            
            let enhancedMagnet = magnet;
            if (infoHash) {
                // Check if magnet already has trackers
                const existingTrackers = (magnet.match(/&tr=[^&]+/g) || []).length;
                
                // Add our trackers if there are few or no existing trackers
                if (existingTrackers < 5) {
                    const trackerParams = config.torrent.trackers
                        .map(tracker => `&tr=${encodeURIComponent(tracker)}`)
                        .join('');
                    enhancedMagnet = magnet + trackerParams;
                }
            }

            return {
                name,
                seeders,
                leechers,
                size,
                magnet: enhancedMagnet,
                infoHash: infoHash,
                provider: 'torrentgalaxy',
                type,
                quality: name.match(/\b(720p|1080p|2160p|4K)\b/i)?.[0] || 'unknown'
            };

        } catch (error) {
            logger.error('[TorrentGalaxy] Row parsing error:', error.message);
            return null;
        }
    }

    /**
     * Fetch page with retry and fallback
     * @param {string} path 
     * @returns {Promise<string|null>}
     */
    async fetchPage(path) {
        for (const baseUrl of this.baseUrls) {
            try {
                const response = await proxyService.createAxiosInstance().get(baseUrl + path, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5'
                    },
                    timeout: 10000
                });

                if (response.status === 200) {
                    this.currentUrl = baseUrl;
                    return response.data;
                }
            } catch (error) {
                logger.debug(`[TorrentGalaxy] Failed to fetch from ${baseUrl}:`, error.message);
            }
        }
        return null;
    }
}

export default new TorrentGalaxyProvider();
