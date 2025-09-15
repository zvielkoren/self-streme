import logger from "../utils/logger.js";
import simpleSearchService from "../providers/simpleSearch.js";
import SecureStreamingServer from "./secureStreamingServer.js";
import { config } from "../config/index.js";

/**
 * Enhanced Stream Service with Secure Torrent Streaming
 * 
 * This service ensures that:
 * 1. Magnet links are never exposed directly to Stremio
 * 2. All torrent streaming goes through the secure server
 * 3. Temporary signed URLs are generated for each stream
 * 4. Proper metadata is provided to Stremio
 */
class SecureStreamService {
    constructor() {
        this.cache = new Map(); // cache: imdbId:season:episode -> streams
        this.streamingServer = new SecureStreamingServer();
        this.setupCleanup();
        
        logger.info('SecureStreamService initialized');
    }

    /**
     * Get streams for a movie or series - returns secure URLs only
     * @param {string} type - "movie" or "series"
     * @param {string} imdbId - IMDb ID
     * @param {number} [season] - Season number for series
     * @param {number} [episode] - Episode number for series
     * @returns {Promise<Array>} - Array of secure stream objects
     */
    async getStreams(type, imdbId, season, episode) {
        try {
            // Clean the IMDB ID
            const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, '');
            const cacheKey = `${cleanImdbId}:${season || 0}:${episode || 0}`;
            
            logger.info(`Getting secure streams for ${type}:${cleanImdbId} S${season || "-"}E${episode || "-"}`);

            // Check cache first
            if (this.cache.has(cacheKey)) {
                const cachedStreams = this.cache.get(cacheKey);
                // Verify that cached streams are still valid (not expired)
                const validStreams = cachedStreams.filter(stream => {
                    if (stream.expiresAt) {
                        return new Date(stream.expiresAt) > new Date();
                    }
                    return true; // Non-torrent streams don't expire
                });
                
                if (validStreams.length > 0) {
                    return validStreams;
                }
            }

            // Get stream data from search service
            const streamsData = await simpleSearchService.search(imdbId, type, season, episode);
            if (!streamsData || !Array.isArray(streamsData) || streamsData.length === 0) {
                logger.warn(`No streams found from searchService for ${cacheKey}`);
                return [];
            }

            // Process streams and convert magnet links to secure URLs
            const secureStreams = await this.processStreamsSecurely(streamsData, cleanImdbId, season, episode);

            // Cache the results
            this.cache.set(cacheKey, secureStreams);
            
            logger.info(`Generated ${secureStreams.length} secure streams for ${cacheKey}`);
            return secureStreams;

        } catch (error) {
            logger.error(`SecureStreamService error for ${imdbId}:${season || 1}:${episode || 1}:`, error.message);
            return [];
        }
    }

    /**
     * Process stream data and convert magnet links to secure URLs
     * @param {Array} streamsData - Raw stream data from providers
     * @param {string} imdbId - IMDb ID for metadata
     * @param {number} season - Season number
     * @param {number} episode - Episode number
     * @returns {Promise<Array>} - Processed secure streams
     */
    async processStreamsSecurely(streamsData, imdbId, season, episode) {
        const secureStreams = [];

        for (const rawStream of streamsData) {
            try {
                if (!rawStream || (!rawStream.title && !rawStream.name && !rawStream.magnet && !rawStream.url && !rawStream.ytId)) {
                    continue;
                }

                const stream = await this.convertToSecureStremioStream(rawStream, imdbId, season, episode);
                if (stream) {
                    secureStreams.push(stream);
                }
            } catch (error) {
                logger.error(`Error processing stream:`, error.message);
                // Continue with other streams
            }
        }

        return secureStreams;
    }

    /**
     * Convert raw stream data to secure Stremio stream format
     * @param {Object} rawStream - Raw stream data
     * @param {string} imdbId - IMDb ID
     * @param {number} season - Season number  
     * @param {number} episode - Episode number
     * @returns {Promise<Object|null>} - Secure Stremio stream or null
     */
    async convertToSecureStremioStream(rawStream, imdbId, season, episode) {
        const stream = {
            name: rawStream.title || rawStream.name || "Self-Streme",
            title: rawStream.title || rawStream.name || "Unknown Title",
            quality: rawStream.quality,
            size: rawStream.size,
            seeders: rawStream.seeders,
            source: rawStream.source || "Self-Streme"
        };

        // Handle magnet links - convert to secure URLs
        if (rawStream.magnet || (rawStream.sources && rawStream.sources.some(s => s.startsWith("magnet:")))) {
            const magnetLink = rawStream.magnet || rawStream.sources.find(s => s.startsWith("magnet:"));
            
            try {
                // Generate secure signed URL for the magnet link
                const secureUrlData = await this.streamingServer.generateSignedUrl(
                    magnetLink, 
                    rawStream.fileIdx || 0,
                    24 // 24 hours validity
                );

                stream.url = secureUrlData.url;
                stream.expiresAt = secureUrlData.expiresAt;
                stream.infoHash = secureUrlData.infoHash;
                
                // Add torrent metadata if available
                if (secureUrlData.torrentInfo) {
                    stream.torrentInfo = {
                        name: secureUrlData.torrentInfo.name,
                        files: secureUrlData.torrentInfo.videoFiles,
                        size: secureUrlData.torrentInfo.length
                    };
                }

                // Update stream title with quality and source info
                stream.title = this.generateStreamTitle(stream, secureUrlData.torrentInfo);

            } catch (error) {
                logger.error(`Error generating secure URL for magnet:`, error.message);
                return null; // Skip this stream if we can't secure it
            }
        }
        // Handle direct URLs
        else if (rawStream.url) {
            stream.url = rawStream.url;
        }
        // Handle YouTube IDs  
        else if (rawStream.ytId) {
            stream.ytId = rawStream.ytId;
        }
        // Skip streams without valid sources
        else {
            logger.warn(`Stream has no valid source: ${JSON.stringify(rawStream)}`);
            return null;
        }

        // Add behavior hints for Stremio
        stream.behaviorHints = {
            notWebReady: !!stream.infoHash, // Torrent streams are not web ready
            bingeGroup: `self-streme-${stream.quality || "default"}`,
            countryWhitelist: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'LU', 'IS', 'MT', 'CY', 'GR', 'BG', 'RO', 'HR', 'SI', 'SK', 'CZ', 'HU', 'PL', 'LT', 'LV', 'EE']
        };

        return stream;
    }

    /**
     * Generate a descriptive title for the stream
     * @param {Object} stream - Stream object
     * @param {Object} torrentInfo - Torrent metadata
     * @returns {string} - Generated title
     */
    generateStreamTitle(stream, torrentInfo) {
        let title = stream.title || stream.name || "Unknown";
        
        // Add quality if available
        if (stream.quality) {
            title += ` [${stream.quality}]`;
        }
        
        // Add size if available
        if (stream.size) {
            title += ` (${this.formatFileSize(stream.size)})`;
        }
        
        // Add seeders if available
        if (stream.seeders && stream.seeders > 0) {
            title += ` 👥${stream.seeders}`;
        }
        
        // Add file count for torrents
        if (torrentInfo && torrentInfo.files > 1) {
            title += ` [${torrentInfo.files} files]`;
        }
        
        // Add source indicator
        title += ` - ${stream.source}`;
        
        return title;
    }

    /**
     * Format file size in human readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} - Formatted size
     */
    formatFileSize(bytes) {
        if (!bytes) return '';
        
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }

    /**
     * Get metadata for a title
     * @param {string} type - Content type
     * @param {string} imdbId - IMDb ID
     * @returns {Promise<Object|null>} - Metadata object or null
     */
    async getMetadata(type, imdbId) {
        try {
            // This would typically fetch from OMDB, TMDb, or other metadata sources
            // For now, return basic metadata structure
            return {
                id: imdbId,
                type: type,
                name: `Content ${imdbId}`,
                poster: `https://via.placeholder.com/300x450/000000/FFFFFF/?text=${imdbId}`,
                background: `https://via.placeholder.com/1920x1080/333333/FFFFFF/?text=${imdbId}`,
                description: `Streaming content for ${imdbId}`,
                genres: ['Unknown'],
                runtime: '0 min',
                year: new Date().getFullYear(),
                imdbRating: 0,
                director: ['Unknown'],
                cast: ['Unknown'],
                country: 'Unknown',
                language: 'en'
            };
        } catch (error) {
            logger.error(`Error getting metadata for ${imdbId}:`, error.message);
            return null;
        }
    }

    /**
     * Get cached stream by specific parameters
     * @param {string} imdbId - IMDb ID
     * @param {number} season - Season number
     * @param {number} episode - Episode number
     * @param {number} fileIdx - File index
     * @returns {Object|null} - Cached stream or null
     */
    getCachedStream(imdbId, season, episode, fileIdx) {
        const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, '');
        const key = `${cleanImdbId}:${season || 0}:${episode || 0}`;
        const streams = this.cache.get(key) || [];
        return streams[fileIdx] || null;
    }

    /**
     * Get server statistics
     * @returns {Object} - Service and server statistics
     */
    getStats() {
        return {
            service: {
                cachedStreams: this.cache.size,
                cacheKeys: Array.from(this.cache.keys())
            },
            streamingServer: this.streamingServer.getStats()
        };
    }

    /**
     * Setup cleanup for cache and expired streams
     */
    setupCleanup() {
        // Clean up expired cached streams every 10 minutes
        setInterval(() => {
            const now = new Date();
            let cleanedCount = 0;
            
            for (const [key, streams] of this.cache.entries()) {
                const validStreams = streams.filter(stream => {
                    if (stream.expiresAt) {
                        return new Date(stream.expiresAt) > now;
                    }
                    return true; // Keep non-expiring streams
                });
                
                if (validStreams.length !== streams.length) {
                    if (validStreams.length === 0) {
                        this.cache.delete(key);
                    } else {
                        this.cache.set(key, validStreams);
                    }
                    cleanedCount++;
                }
            }
            
            if (cleanedCount > 0) {
                logger.info(`Cleaned up ${cleanedCount} expired stream cache entries`);
            }
        }, 10 * 60 * 1000);
    }

    /**
     * Shutdown the service gracefully
     */
    destroy() {
        logger.info('Shutting down SecureStreamService...');
        this.cache.clear();
        this.streamingServer.destroy();
    }
}

export default new SecureStreamService();