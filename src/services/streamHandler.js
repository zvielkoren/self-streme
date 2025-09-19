import logger from '../utils/logger.js';
import NodeCache from 'node-cache';

class StreamHandler {
    constructor() {
        // Cache for storing torrent info with shorter TTL for faster results
        this.hashCache = new NodeCache({
            stdTTL: 1800, // Reduced to 30 minutes for faster results
            checkperiod: 300 // Reduced to 5 minutes for more frequent cleanup
        });
        
        // Track cache operations for summary logging
        this.cacheSessionCounter = 0;
        this.lastCacheSession = null;
    }

    /**
     * Cache the torrent info for later streaming
     */
    async cacheStream(infoHash, type, title, quality) {
        const cacheKey = `stream:${infoHash}`;
        const streamInfo = {
            infoHash,
            type,
            title,
            quality,
            timestamp: Date.now()
        };
        
        this.hashCache.set(cacheKey, streamInfo);
        logger.debug(`Cached stream info for hash: ${infoHash}`);
        
        // Track cache operations for batch processing
        const now = Date.now();
        if (!this.lastCacheSession || (now - this.lastCacheSession) > 5000) {
            // New cache session (5 second gap indicates new batch)
            this.cacheSessionCounter = 1;
            this.lastCacheSession = now;
            // Log summary after a brief delay to catch all streams in this batch
            setTimeout(() => {
                if (this.cacheSessionCounter > 1) {
                    logger.info(`Cached ${this.cacheSessionCounter} stream info entries for torrent streaming`);
                }
            }, 1000);
        } else {
            // Same session, increment counter
            this.cacheSessionCounter++;
        }
        
        return infoHash;
    }

    /**
     * Get stream info from cache
     */
    getStreamInfo(infoHash) {
        const cacheKey = `stream:${infoHash}`;
        return this.hashCache.get(cacheKey);
    }

    /**
     * Format stream object for Stremio
     */
    formatStream(streamInfo) {
        const { infoHash, title, quality, url } = streamInfo;
        
        // Always stream through our server
        const serverStreamUrl = `/stream/proxy/${infoHash}`;

        return {
            name: 'Self-Streme',
            title: `${title} (${quality})`,
            url: serverStreamUrl,
            behaviorHints: {
                notWebReady: true,
                bingeGroup: `quality-${quality}`
            }
        };
    }

    /**
     * Clear old cached streams
     */
    cleanup() {
        const keys = this.hashCache.keys();
        const now = Date.now();
        keys.forEach(key => {
            const info = this.hashCache.get(key);
            if (info && (now - info.timestamp) > 3600000) { // 1 hour
                this.hashCache.del(key);
            }
        });
    }
}

export default new StreamHandler();