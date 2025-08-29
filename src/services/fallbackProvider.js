import logger from "../utils/logger.js";
import external from "../providers/external/index.js";
import { search1337x } from "../providers/torrents/1337x.js";
import { searchEZTV } from "../providers/torrents/eztv.js";

export async function fallbackSearch(metadata) {
    logger.info(`🔎 Fallback search started for ${metadata.title} (${metadata.year})`);

    const results = [];

    // 1. External APIs
    try {
        const ext = await external.searchExternal(metadata);
        if (ext.length > 0) {
            logger.info(`✅ Found ${ext.length} results via external APIs`);
            results.push(...ext);
        }
    } catch (e) {
        logger.warn("⚠️ External API search failed:", e.message);
    }

    // 2. Scrapers
    if (results.length === 0) {
        logger.info("⚠️ No results from APIs, trying scrapers...");

        try {
            const torrents1337x = await search1337x(metadata);
            results.push(...torrents1337x);
        } catch {}

        try {
            const torrentsEZTV = await searchEZTV(metadata);
            results.push(...torrentsEZTV);
        } catch {}
    }

    // 3. Last Resort – Web Search
    if (results.length === 0) {
        logger.info("🌍 Last resort: Searching open web...");
        // כאן אפשר להוסיף Google / DuckDuckGo dorks
        // למשל חיפוש: `${metadata.title} ${metadata.year} magnet:?xt=urn:btih`
    }

    logger.info(`🏁 Fallback search returning ${results.length} streams`);
    return results;
}
