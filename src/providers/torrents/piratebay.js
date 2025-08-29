import axios from "axios";
import { load } from "cheerio";
import logger from "../../utils/logger.js";

async function searchTPB({ query }) {
  logger.info(`🔍 [TPB] Searching for: ${query}`);
  const results = [];

  try {
    // חיפוש ב־The Pirate Bay
    const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=0`;
    const { data } = await axios.get(url, { timeout: 8000 });

    if (Array.isArray(data)) {
      for (const item of data) {
        // item: { name, info_hash, seeders, leechers, ... }
        results.push({
          title: `${item.name} [TPB]`,
          infoHash: item.info_hash,
          sources: [`magnet:?xt=urn:btih:${item.info_hash}`],
          seeders: parseInt(item.seeders, 10),
          source: "tpb"
        });
      }
    }

    logger.info(`[TPB] Found ${results.length} results`);
    return results;
  } catch (err) {
    logger.warn(`[TPB] Search failed: ${err.message}`);
    return [];
  }
}

export default { search: searchTPB };
