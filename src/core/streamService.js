import logger from "../utils/logger.js";
import metadataService from "../core/metadataService.js";
import searchService from "../providers/index.js";
import torrentService from "../core/torrentService.js";
import { config } from "../config/index.js";

class StreamService {
    constructor() {
        this.metadataService = metadataService;
        this.setupCleanup();
    }

    async getStreams(type, imdbId) {
        try {
            logger.info(`Getting streams for ${type}:${imdbId}`);

            const metadata = await metadataService.getMetadata(imdbId);

            const results = await Promise.allSettled(
                searchService.providers.map(p => p.search(imdbId, type).catch(() => []))
            );

            const searchResults = results
                .filter(r => r.status === "fulfilled")
                .map(r => r.value)
                .flat();

            const streams = searchResults.map(result => this.convertToStremioStream(result));

            streams.forEach(stream => {
                stream.name = "Self-Streme";
                stream.behaviorHints = {
                    notWebReady: true,
                    bingeGroup: `self-streme-${stream.quality || "default"}`
                };
            });

            return streams;
        } catch (error) {
            logger.error(`Stream service error for ${imdbId}:`, error.message);
            return [];
        }
    }

    convertToStremioStream(result) {
        const stream = {
            name: "Self-Streme",
            title: result.title || `${result.name} [${result.provider}]`
        };

        if (result.magnet) {
            const infoHash = result.infoHash || this.extractInfoHash(result.magnet);
            if (infoHash) {
                stream.infoHash = infoHash;
                stream.fileIdx = result.fileIdx || 0;
                stream.sources = [result.magnet];
            }
        }

        if (result.url) {
            stream.url = result.url;
            stream.ytId = result.ytId;
        }

        if (result.seeders) stream.seeders = result.seeders;
        if (result.quality) stream.quality = result.quality;
        if (result.size) stream.size = result.size;
        if (result.source) stream.source = result.source;

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

    destroy() {
        torrentService.destroy();
        metadataService.clearCache();
        searchService.clearCache();
    }
}

export default new StreamService();
