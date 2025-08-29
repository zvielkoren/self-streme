import { webSearch } from "../providers/fallback/webSearch.js";

export async function fallbackSearch(metadata) {
    let results = [];

    // ... (APIs + Scrapers קודם)

    // 3. Web Search – last resort
    if (results.length === 0) {
        logger.info("🌍 Last resort: Searching open web...");
        const webResults = await webSearch(metadata);
        results.push(...webResults);
    }

    return results;
}
