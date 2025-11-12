import axios from "axios";
import { load } from "cheerio";
import logger from "../../utils/logger.js";
import { config } from "../../config/index.js";

async function searchTPB({ query }) {
  logger.info(`🔍 [TPB] Searching for: ${query}`);
  const results = [];

  try {
    // חיפוש ב־The Pirate Bay
    const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=0`;
    const { data } = await axios.get(url, { timeout: 8000 });

    if (Array.isArray(data)) {
      for (const item of data) {
        // Build magnet URI with trackers
        const trackerParams = config.torrent.trackers
          .map(tracker => `&tr=${encodeURIComponent(tracker)}`)
          .join('');
        const magnet = `magnet:?xt=urn:btih:${item.info_hash}${trackerParams}`;
        
        // item: { name, info_hash, seeders, leechers, ... }
        results.push({
          title: `${item.name} [TPB]`,
          infoHash: item.info_hash,
          sources: [magnet],
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
