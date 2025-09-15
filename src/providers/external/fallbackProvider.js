import axios from "axios";
import { load } from "cheerio";
import logger from "../../utils/logger.js";

/**
 * 🔎 Scraper ל־YTS (סרטים בלבד)
 */
async function scrapeYTS(query) {
  try {
    const url = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, { timeout: 8000 });

    if (data?.data?.movies?.length) {
      return data.data.movies.flatMap(movie =>
        movie.torrents.map(t => ({
          title: `${movie.title} ${t.quality} [YTS]`,
          infoHash: null,
          sources: [t.url],
          seeders: t.seeds || 0,
          source: "yts"
        }))
      );
    }
    return [];
  } catch (err) {
    logger.warn(`[YTS] scrape failed: ${err.message}`);
    return [];
  }
}

/**
 * 🔎 Scraper מ־1337x
 */
async function scrape1337x(query) {
  try {
    const url = `https://1337x.to/search/${encodeURIComponent(query)}/1/`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const $ = load(data);

    const results = [];

    $("table.table-list tr").each((_, el) => {
      const name = $(el).find("td.name a").last().text().trim();
      const link = "https://1337x.to" + $(el).find("td.name a").last().attr("href");

      if (name) {
        results.push({
          title: `${name} [1337x]`,
          infoHash: null,
          sources: [link],
          seeders: parseInt($(el).find("td.seeds").text()) || 0,
          source: "1337x"
        });
      }
    });

    return results;
  } catch (err) {
    logger.warn(`[1337x] scrape failed: ${err.message}`);
    return [];
  }
}

/**
 * 🔎 חיפוש מגנטים כללי דרך DuckDuckGo
 */
async function scrapeWebSearch(query) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query + " magnet download")}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const $ = load(data);

    const results = [];
    $("a.result__a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.includes("magnet:?xt=")) {
        results.push({
          title: `WebSearch result [DuckDuckGo]`,
          infoHash: href.match(/btih:([a-zA-Z0-9]+)/)?.[1] || null,
          sources: [href],
          seeders: null,
          source: "websearch"
        });
      }
    });

    return results;
  } catch (err) {
    logger.warn(`[WebSearch] failed: ${err.message}`);
    return [];
  }
}

/**
 * 🌍 ספק fallback שמריץ את כולם
 */
const fallbackProvider = {
  name: 'FallbackProvider',
  
  async search(params) {
    const { query, year } = params;
    logger.info(`[Fallback] Searching for: ${query} (${year})`);

    const searchQuery = `${query} ${year}`;
    const results = [];

    // Scrapers
    const [yts, x1337] = await Promise.all([
      scrapeYTS(searchQuery),
      scrape1337x(searchQuery)
    ]);
    results.push(...yts, ...x1337);

    // Web Search as last resort
    if (results.length === 0) {
      const webResults = await scrapeWebSearch(searchQuery);
      results.push(...webResults);
    }

    logger.info(`[Fallback] Found ${results.length} results`);
    return results;
  }
};

export default fallbackProvider;
