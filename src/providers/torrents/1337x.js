import axios from "axios";
import * as cheerio from "cheerio";
import logger from "../../utils/logger.js";
import { config } from "../../config/index.js";

const MIRRORS = [
  "https://1337x.to",
  "https://1337x.so",
  "https://x1337x.ws",
  "https://1337x.se",
  "https://1337x.st"
];

async function search(metadata) {
    const query = `${metadata.title} ${metadata.year}`;
    
    // Try mirrors sequentially until one works
    for (const mirror of MIRRORS) {
        const searchUrl = `${mirror}/search/${encodeURIComponent(query)}/1/`;
        logger.info(`🔍 [1337x] Searching on mirror: ${mirror} for: ${query}`);

        try {
            const { data } = await axios.get(searchUrl, {
                headers: { 
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
                },
                timeout: 8000
            });

            const $ = cheerio.load(data);
            const results = [];

            $("table.table-list tbody tr").each((i, el) => {
                // Limit to top 5 results per mirror to speed up
                if (i >= 5) return;
                
                const name = $(el).find("td.coll-1 a:nth-child(2)").text().trim();
                const link = mirror + $(el).find("td.coll-1 a:nth-child(2)").attr("href");
                const seeders = parseInt($(el).find("td.coll-2").text().trim(), 10) || 0;

                results.push({ name, link, seeders });
            });

            if (results.length === 0) {
                logger.debug(`[1337x] No results on ${mirror}, trying next...`);
                continue;
            }

            logger.info(`📥 [1337x] Found ${results.length} torrents on ${mirror}`);

            const streams = [];
            // Process results in parallel to be faster
            const promises = results.map(async (r) => {
                try {
                    const { data: page } = await axios.get(r.link, {
                        headers: { "User-Agent": "Mozilla/5.0" },
                        timeout: 8000
                    });
                    const $page = cheerio.load(page);
                    const magnet = $page("a[href^='magnet:?xt=urn:btih']").attr("href");

                    if (magnet) {
                        const infoHashMatch = magnet.match(/btih:([a-fA-F0-9]+)/);
                        const infoHash = infoHashMatch ? infoHashMatch[1] : null;
                        
                        let enhancedMagnet = magnet;
                        if (infoHash) {
                            const existingTrackers = (magnet.match(/&tr=[^&]+/g) || []).length;
                            if (existingTrackers < 5) {
                                const trackerParams = config.torrent.trackers
                                    .map(tracker => `&tr=${encodeURIComponent(tracker)}`)
                                    .join('');
                                enhancedMagnet = magnet + trackerParams;
                            }
                        }
                        
                        return {
                            name: "1337x",
                            title: `${r.name} [1337x]`,
                            infoHash: infoHash,
                            sources: [enhancedMagnet],
                            seeders: r.seeders,
                            source: "1337x"
                        };
                    }
                } catch {
                    // Ignore page fetch errors
                }
                return null;
            });

            const resolvedStreams = await Promise.all(promises);
            const validStreams = resolvedStreams.filter(s => s !== null);

            if (validStreams.length > 0) {
                logger.info(`✅ [1337x] Returning ${validStreams.length} streams from ${mirror}`);
                return validStreams;
            }
        } catch (error) {
            logger.warn(`⚠️ [1337x] Mirror failed ${mirror}: ${error.message}`);
            // Continue to next mirror
        }
    }

    logger.warn(`[1337x] All mirrors failed or returned no results`);
    return [];
}

// ✅ ייצוא אחיד
export default { search };
