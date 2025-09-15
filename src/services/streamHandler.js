import logger from '../utils/logger.js';
import NodeCache from 'node-cache';

class StreamHandler {
    constructor() {
        // Cache for storing torrent info
        this.hashCache = new NodeCache({
            stdTTL: 3600, // 1 hour cache
            checkperiod: 600
        });
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
        logger.info(`Cached stream info for hash: ${infoHash}`);
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