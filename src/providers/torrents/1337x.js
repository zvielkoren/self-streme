import axios from "axios";
import * as cheerio from "cheerio";
import logger from "../../utils/logger.js";

async function search(metadata) {
    const query = `${metadata.title} ${metadata.year}`;
    const searchUrl = `https://1337x.to/search/${encodeURIComponent(query)}/1/`;

    logger.info(`🔍 [1337x] Searching for: ${query}`);

    try {
        const { data } = await axios.get(searchUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
            timeout: 10000
        });

        const $ = cheerio.load(data);
        const results = [];

        $("table.table-list tbody tr").each((i, el) => {
            const name = $(el).find("td.coll-1 a:nth-child(2)").text().trim();
            const link = "https://1337x.to" + $(el).find("td.coll-1 a:nth-child(2)").attr("href");
            const seeders = parseInt($(el).find("td.coll-2").text().trim(), 10) || 0;

            results.push({ name, link, seeders });
        });

        logger.info(`📥 [1337x] Found ${results.length} torrents`);

        const streams = [];
        for (const r of results) {
            try {
                const { data: page } = await axios.get(r.link, {
                    headers: { "User-Agent": "Mozilla/5.0" },
                    timeout: 10000
                });
                const $page = cheerio.load(page);
                const magnet = $page("a[href^='magnet:?xt=urn:btih']").attr("href");

                if (magnet) {
                    streams.push({
                        name: "1337x",
                        title: `${r.name} [1337x]`,
                        infoHash: magnet.match(/btih:([a-fA-F0-9]+)/)?.[1],
                        sources: [magnet],
                        seeders: r.seeders,
                        source: "1337x"
                    });
                }
            } catch {
                logger.warn(`⚠️ [1337x] Failed to fetch torrent page: ${r.link}`);
            }
        }

        logger.info(`✅ [1337x] Returning ${streams.length} streams`);
        return streams;
    } catch (error) {
        logger.error(`[1337x] Error: ${error.message}`);
        return [];
    }
}

// ✅ ייצוא אחיד
export default { search };
