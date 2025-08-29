import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../../utils/logger.js';
import proxyService from '../../core/proxyService.js';

class X1337Provider {
    constructor() {
        this.name = '1337x';
        this.baseUrls = [
            'https://1337x.to',
            'https://1337x.st',
            'https://x1337x.ws',
            'https://x1337x.se'
        ];
        this.currentUrl = this.baseUrls[0];
        this.lastRequest = 0;
        this.rateLimit = 1000; // 1 second between requests
    }

    /**
     * Search for torrents
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
            const searchPath = `/search/${encodeURIComponent(query)}/1/`;
            const html = await this.fetchPage(searchPath);
            if (!html) return results;

            const $ = cheerio.load(html);
            
            // Parse search results
            const promises = [];
            $('table.table-list tbody tr').each((i, element) => {
                promises.push(this.parseResultRow($, element, type));
            });

            const parsedResults = await Promise.all(promises);
            results.push(...parsedResults.filter(Boolean));

            logger.debug(`[1337x] Found ${results.length} results for "${query}"`);
            return results;

        } catch (error) {
            logger.error('[1337x] Search error:', error.message);
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
        const searchPaths = [
            `/cat-search-${imdbId}/Movies/1/`,
            `/sort-cat-search-${imdbId}/Movies/time/desc/1/`,
            `/search/${encodeURIComponent('imdb ' + imdbId)}/1/`
        ];

        for (const path of searchPaths) {
            try {
                const html = await this.fetchPage(path);
                if (!html) continue;

                const $ = cheerio.load(html);
                const results = [];
                const promises = [];

                $('table.table-list tbody tr').each((i, element) => {
                    promises.push(this.parseResultRow($, element, type));
                });

                const parsedResults = await Promise.all(promises);
                results.push(...parsedResults.filter(Boolean));

                if (results.length > 0) {
                    logger.debug(`[1337x] Found ${results.length} results for IMDB ${imdbId}`);
                    return results;
                }
            } catch (error) {
                logger.error(`[1337x] IMDB search error for ${path}:`, error.message);
            }
        }

        return [];
    }

    /**
     * Parse a search result row
     * @param {Object} $ - Cheerio instance
     * @param {Object} element - DOM element
     * @param {string} type - Content type
     * @returns {Promise<Object|null>}
     */
    async parseResultRow($, element, type) {
        try {
            const $row = $(element);
            const name = $row.find('td.name a:last-child').text().trim();
            const seeders = parseInt($row.find('td.seeds').text(), 10) || 0;
            const leechers = parseInt($row.find('td.leeches').text(), 10) || 0;
            const size = $row.find('td.size').text().trim();
            const torrentPath = $row.find('td.name a:last-child').attr('href');

            if (!name || !torrentPath || seeders === 0) return null;

            // Get magnet link from torrent page
            const magnetLink = await this.getMagnetLink(torrentPath);
            if (!magnetLink) return null;

            return {
                name,
                seeders,
                leechers,
                size,
                magnet: magnetLink,
                provider: '1337x',
                type,
                quality: name.match(/\b(720p|1080p|2160p|4K)\b/i)?.[0] || 'unknown'
            };

        } catch (error) {
            logger.error('[1337x] Row parsing error:', error.message);
            return null;
        }
    }

    /**
     * Get magnet link from torrent page
     * @param {string} path 
     * @returns {Promise<string|null>}
     */
    async getMagnetLink(path) {
        try {
            const html = await this.fetchPage(path);
            if (!html) return null;

            const $ = cheerio.load(html);
            return $('a[href^="magnet:"]').attr('href') || null;

        } catch (error) {
            logger.error('[1337x] Magnet fetch error:', error.message);
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
                    this.currentUrl = baseUrl; // Remember working URL
                    return response.data;
                }
            } catch (error) {
                logger.debug(`[1337x] Failed to fetch from ${baseUrl}:`, error.message);
            }
        }
        return null;
    }
}

export default new X1337Provider();
