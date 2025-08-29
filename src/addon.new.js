import addonSdk from "stremio-addon-sdk";
import manifest from "./manifest.js";
import StreamService from "./core/streamService.js";
import logger from "./utils/logger.js";
import NodeCache from "node-cache";

const { addonBuilder } = addonSdk;
const builder = new addonBuilder(manifest);
const cache = new NodeCache({ stdTTL: 3600 }); // 1 שעה

// ------------------ STREAM HANDLER ------------------
builder.defineStreamHandler(async ({ type, id }) => {
    try {
        if (!id.startsWith("tt")) {
            logger.warn(`Invalid IMDb ID format: ${id}`);
            return { streams: [] };
        }

        const cacheKey = `streams:${type}:${id}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const streams = await StreamService.getStreams(type, id);
        cache.set(cacheKey, { streams });
        return { streams };
    } catch (error) {
        logger.error("Stream handler error:", error.message);
        return { streams: [] };
    }
});

// ------------------ META HANDLER ------------------
builder.defineMetaHandler(async ({ type, id }) => {
    try {
        const cacheKey = `meta:${id}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const metadata = await StreamService.metadataService.getMetadata(id);
        const meta = {
            id,
            type,
            name: metadata.title,
            description: metadata.plot || "",
            poster: metadata.poster,
            background: metadata.background,
            year: metadata.year
        };

        cache.set(cacheKey, meta);
        return meta;
    } catch (error) {
        logger.error("Meta handler error:", error.message);
        return {};
    }
});

// ------------------ CATALOG HANDLER ------------------
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    try {
        const searchQuery = extra?.find(e => e.name === "search")?.value || "";
        const cacheKey = `catalog:${type}:${searchQuery}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const results = await StreamService.metadataService.search(type, searchQuery);

        const metas = results.map(item => ({
            id: item.imdbId,
            type,
            name: item.title,
            poster: item.poster
        }));

        cache.set(cacheKey, { metas });
        return { metas };
    } catch (error) {
        logger.error("Catalog handler error:", error.message);
        return { metas: [] };
    }
});

export default builder;
