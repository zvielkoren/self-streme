// src/core/streamService.js
import logger from "../utils/logger.js";
import searchService from "../providers/index.js";
import torrentService from "../core/torrentService.js";
import { config } from "../config/index.js";

class StreamService {
    constructor() {
        this.cache = new Map(); // שמירה של streams
        this.setupCleanup();
    }

    /**
     * מחזיר streams לסרט או סדרה
     * @param {string} type - "movie" או "series"
     * @param {string} imdbId
     * @param {number} [season]
     * @param {number} [episode]
     */
    async getStreams(type, imdbId, season, episode) {
        try {
            logger.info(`Getting streams for ${type}:${imdbId} S${season || "-"}E${episode || "-"}`);

            // קריאה ל-searchService
            const streamsData = await searchService.search(imdbId, type);

            if (!streamsData || !Array.isArray(streamsData) || streamsData.length === 0) {
                logger.warn(`No streams found from searchService for ${imdbId} (${type})`);
                return [];
            }

            // יצירת metadata מינימלי מה־streams עצמם
            const safeMetadata = {
                title: streamsData[0].title || streamsData[0].name || "Unknown Title",
                type
            };

            const streams = streamsData
                .filter(r => r) // מסננים null
                .map(result => this.convertToStremioStream(result, safeMetadata));

            if (streams.length === 0) {
                logger.warn(`No valid streams after conversion for ${imdbId}`);
                return [];
            }

            // שמירת cache לפי imdbId + עונה + פרק
            const cacheKey = `${imdbId}:${season || 0}:${episode || 0}`;
            this.cache.set(cacheKey, streams);

            return streams;

        } catch (error) {
            logger.error(`Stream service error for ${imdbId}:${season || 1}:${episode || 1}:`, error.message);
            return [];
        }
    }

    getCachedStream(imdbId, season, episode, fileIdx) {
        const key = `${imdbId}:${season || 0}:${episode || 0}`;
        const streams = this.cache.get(key) || [];
        return streams[fileIdx] || null;
    }

    convertToStremioStream(result, metadata) {
        const stream = {
            name: "Self-Streme",
            title: result.title || result.name || metadata.title || "Unknown Title",
            quality: result.quality,
            size: result.size,
            seeders: result.seeders,
            source: result.source
        };

        // magnet
        if (result.magnet || (result.sources && result.sources.some(s => s.startsWith("magnet:")))) {
            const magnetLink = result.magnet || result.sources.find(s => s.startsWith("magnet:"));
            const infoHash = this.extractInfoHash(magnetLink);
            if (infoHash) {
                stream.infoHash = infoHash;
                stream.fileIdx = result.fileIdx || 0;
                stream.sources = [magnetLink];
            }
        }

        // URL ישיר
        if (result.url) stream.url = result.url;

        // YouTube ID
        if (result.ytId) stream.ytId = result.ytId;

        // fallback אם אין מקור
        if (!stream.infoHash && !stream.url && !stream.ytId) {
            stream.url = "https://example.com/placeholder.mp4";
        }

        // behaviorHints
        stream.behaviorHints = {
            notWebReady: true,
            bingeGroup: `self-streme-${stream.quality || "default"}`
        };

        return stream;
    }

    extractInfoHash(magnetUri) {
        if (!magnetUri) return null;
        const match = magnetUri.match(/btih:([a-fA-F0-9]+)/i);
        return match ? match[1].toLowerCase() : null;
    }

    setupCleanup() {
        setInterval(() => {
            try {
                torrentService.cleanup();
            } catch (error) {
                logger.error("Cleanup error:", error.message);
            }
        }, config.torrent.cleanupInterval || 1800000);
    }
}

export default new StreamService();
