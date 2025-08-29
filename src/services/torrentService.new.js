import WebTorrent from "webtorrent";
import logger from "../utils/logger.js";
import { config } from "../config/index.js";
import proxyManager from "../utils/proxyManager.js";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import NodeCache from "node-cache";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize variables
let client = new WebTorrent({
  maxConns: config.torrent.maxConnections,
  downloadLimit: config.torrent.downloadLimit,
  uploadLimit: config.torrent.uploadLimit,
});

let activeTorrents = new Map();
let lastRequestTime = {};
let torrentConfig = null;
let cache = null;

// Helper function for the actly pattern
async function act(promise) {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error, null];
  }
}

// Helper function to generate search variations
async function generateSearchQueries(query) {
  try {
    const queries = new Set([query]); // Start with original query
    
    // Remove special characters and extra spaces
    const cleanQuery = query.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanQuery !== query) queries.add(cleanQuery);
    
    // If it's an IMDB ID, add variations
    if (query.startsWith('tt')) {
      queries.add(query.slice(2));
      queries.add(`imdb ${query}`);
    }

    // Add OMDB title if available
    if (config.apiKeys.omdb) {
      const [error, response] = await act(axios.get('http://www.omdbapi.com/', {
        params: { 
          i: query.startsWith('tt') ? query : undefined,
          t: !query.startsWith('tt') ? query : undefined,
          apikey: config.apiKeys.omdb 
        },
        timeout: 5000
      }));

      if (!error && response?.data?.Title) {
        const title = response.data.Title;
        const year = response.data.Year;
        queries.add(title);
        if (year) {
          queries.add(`${title} ${year}`);
          queries.add(`${title.replace(/\s+/g, '.')}${year}`);
        }
      }
    }
    
    return [null, Array.from(queries)];
  } catch (error) {
    return [error, []];
  }
}

async function searchTorrents(query, type) {
  const cacheKey = `${type}:${query}`;
  if (cache?.get(cacheKey)) {
    logger.debug(`Cache hit for ${cacheKey}`);
    return [null, cache.get(cacheKey)];
  }

  logger.debug(`Starting search for ${type}: ${query}`);
  const [queryError, queries] = await generateSearchQueries(query);
  if (queryError) {
    logger.error("Error generating search queries:", queryError);
    return [queryError, []];
  }

  logger.debug(`Generated search queries: ${JSON.stringify(queries)}`);
  const results = [];
  const providers = getEnabledProviders(type);
  logger.debug(`Using providers: ${providers.map(p => p.name).join(', ')}`);
  
  for (const searchQuery of queries) {
    logger.debug(`Trying search query: "${searchQuery}"`);
    
    // First try IMDB-specific search if it's an IMDB ID
    if (searchQuery.startsWith('tt')) {
      logger.debug('Using IMDB-specific search paths first');
      for (const provider of providers) {
        const [error, imdbResults] = await act(searchProvider(provider, searchQuery, type, true));
        if (!error && imdbResults?.length > 0) {
          logger.debug(`Found ${imdbResults.length} results from ${provider.name} using IMDB search`);
          results.push(...imdbResults.map(item => ({
            ...item,
            provider: provider.name
          })));
          break;
        }
      }
    }

    // If no results from IMDB-specific search, try regular search
    if (results.length === 0) {
      const searchPromises = providers.map(provider => 
        act(searchProvider(provider, searchQuery, type, false))
      );

      const providerResults = await Promise.all(searchPromises);
      
      providerResults.forEach(([error, value], index) => {
        if (error) {
          logger.warn(`Provider ${providers[index].name} failed:`, error);
        } else if (value?.length > 0) {
          logger.debug(`Found ${value.length} results from ${providers[index].name}`);
          results.push(...value.map(item => ({
            ...item,
            provider: providers[index].name
          })));
        }
      });
    }

    if (results.length > 0) {
      logger.debug(`Found ${results.length} total results for query "${searchQuery}"`);
      break;
    } else {
      logger.debug(`No results found for query "${searchQuery}"`);
    }
  }

  // Try OMDB fallback if no results found
  if (results.length === 0 && query.startsWith('tt') && config.apiKeys.omdb) {
    logger.debug('Attempting OMDB fallback search');
    const [omdbError, omdbResponse] = await act(axios.get('http://www.omdbapi.com/', {
      params: { i: query, apikey: config.apiKeys.omdb },
      timeout: 5000
    }));

    if (!omdbError && omdbResponse?.data?.Title) {
      const searchQuery = `${omdbResponse.data.Title} ${omdbResponse.data.Year || ''}`.trim();
      logger.debug(`Using OMDB title: "${searchQuery}"`);
      
      const titleSearchPromises = providers.map(provider => 
        act(searchProvider(provider, searchQuery, type, false))
      );

      const titleResults = await Promise.all(titleSearchPromises);
      titleResults.forEach(([error, value], index) => {
        if (error) {
          logger.warn(`Provider ${providers[index].name} failed OMDB search:`, error);
        } else if (value?.length > 0) {
          logger.debug(`Found ${value.length} results from ${providers[index].name} using OMDB title`);
          results.push(...value.map(item => ({
            ...item,
            provider: providers[index].name,
            fromOmdb: true
          })));
        }
      });
    }
  }

  const [filterError, filteredResults] = filterAndSortResults(results);
  if (filterError) {
    logger.error('Error filtering results:', filterError);
    return [filterError, []];
  }

  logger.debug(`After filtering: ${filteredResults.length} results remain`);
  
  if (filteredResults.length > 0) {
    if (cache) {
      cache.set(cacheKey, filteredResults);
      logger.debug(`Cached ${filteredResults.length} results for key ${cacheKey}`);
    }
    return [null, filteredResults];
  } else {
    logger.warn(`No results found after all search attempts for ${query}`);
    return [null, []];
  }
}

function filterAndSortResults(results) {
  try {
    const minSeeders = torrentConfig.optimization?.min_seeders || 5;
    const maxResults = torrentConfig.optimization?.max_results || 20;
    const preferredQualities = torrentConfig.quality_filters?.preferred || ['1080p', '720p'];
    const blockedQualities = torrentConfig.quality_filters?.blocked || ['CAM', 'HDCAM', 'TELESYNC'];

    // Score calculation function
    const calculateScore = (result) => {
      let score = result.seeders;

      // Quality scoring
      const quality = result.quality || result.name.toUpperCase();
      for (let i = 0; i < preferredQualities.length; i++) {
        if (quality.includes(preferredQualities[i].toUpperCase())) {
          score += (preferredQualities.length - i) * 100;
          break;
        }
      }

      // Provider priority scoring
      const provider = torrentConfig.providers[result.provider];
      if (provider) {
        score += (10 - (provider.priority || 5)) * 10;
      }

      return score;
    };

    const filteredResults = results
      .filter(result => {
        if (result.seeders < minSeeders) return false;
        const name = result.name.toUpperCase();
        if (blockedQualities.some(q => name.includes(q.toUpperCase()))) return false;
        return true;
      })
      .sort((a, b) => calculateScore(b) - calculateScore(a))
      .slice(0, maxResults);

    return [null, filteredResults];
  } catch (error) {
    return [error, []];
  }
}

async function searchProvider(provider, query, type, isImdbSearch = false) {
  const now = Date.now();
  const lastRequest = lastRequestTime[provider.name] || 0;
  const waitTime = provider.rateLimit - (now - lastRequest);
  
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime[provider.name] = Date.now();

  // Try proxy if available
  const proxyUrl = await proxyManager.getProxy();
  const axiosConfig = proxyUrl ? { proxy: proxyUrl } : {};

  const searchMethods = {
    '1337x': async (q, t, p) => search1337x(q, t, p, isImdbSearch, axiosConfig),
    'yts': async (q, t, p) => searchYTS(q, t, p, axiosConfig),
    'rarbg': async (q, t, p) => searchRARBG(q, t, p, axiosConfig),
    'torrentgalaxy': async (q, t, p) => searchTorrentGalaxy(q, t, p, isImdbSearch, axiosConfig)
  };

  if (searchMethods[provider.name]) {
    return await act(searchMethods[provider.name](query, type, provider));
  }
  
  return [null, []];
}

async function search1337x(query, type, provider, isImdbSearch = false, axiosConfig = {}) {
  for (const domain of provider.domains) {
    // For IMDB searches, try multiple search strategies
    const searchPaths = [];
    
    if (isImdbSearch && query.startsWith('tt')) {
      searchPaths.push(
        `/cat-search-${encodeURIComponent(query)}/Movies/1/`,
        `/sort-cat-search-${encodeURIComponent(query)}/Movies/time/desc/1/`,
        `/search/${encodeURIComponent(`imdb ${query}`)}/1/`
      );
    } else {
      searchPaths.push(`/search/${encodeURIComponent(query)}/1/`);
    }

    for (const searchPath of searchPaths) {
      const [responseError, response] = await act(axios.get(domain + searchPath, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'DNT': '1'
        },
        timeout: provider.timeout || 5000,
        ...axiosConfig
      }));

      if (!responseError && response?.status === 200) {
        const $ = cheerio.load(response.data);
        const results = [];

        $('table.table-list tbody tr').each(async (i, element) => {
          const $row = $(element);
          const name = $row.find('td.name a:last-child').text().trim();
          const seeders = parseInt($row.find('td.seeds').text(), 10) || 0;
          const leechers = parseInt($row.find('td.leeches').text(), 10) || 0;
          const size = $row.find('td.size').text().trim();
          const torrentPath = $row.find('td.name a:last-child').attr('href');
          
          if (name && seeders > 0 && torrentPath) {
            const [detailsError, detailsResponse] = await act(axios.get(domain + torrentPath, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: provider.timeout || 5000
            }));

            if (!detailsError) {
              const $details = cheerio.load(detailsResponse.data);
              const magnetLink = $details('a[href^="magnet:"]').attr('href');

              if (magnetLink) {
                results.push({ 
                  name, 
                  seeders, 
                  leechers, 
                  size, 
                  magnet: magnetLink,
                  provider: '1337x',
                  type,
                  quality: name.match(/\b(720p|1080p|2160p|4K)\b/i)?.[0] || 'unknown'
                });
              }
            }
          }
        });

        if (results.length > 0) {
          return [null, results];
        }
      }
    }
  }
  return [null, []];
}

async function searchYTS(query, type, provider) {
  if (type !== 'movies') return [null, []];

  for (const domain of provider.domains) {
    const [error, response] = await act(axios.get(`${domain}/list_movies.json`, {
      params: { query_term: query },
      timeout: provider.timeout || 5000
    }));

    if (!error && response?.data?.data?.movies) {
      const results = [];
      for (const movie of response.data.data.movies) {
        for (const torrent of movie.torrents || []) {
          const magnetParams = new URLSearchParams({
            dn: movie.title_long,
            tr: torrentConfig.trackers
          });

          results.push({
            name: `${movie.title_long} [${torrent.quality}] [YTS]`,
            seeders: torrent.seeds || 0,
            leechers: torrent.peers || 0,
            size: torrent.size,
            magnet: `magnet:?xt=urn:btih:${torrent.hash}&${magnetParams.toString()}`,
            quality: torrent.quality,
            provider: 'yts',
            type: 'movies',
            imdb: movie.imdb_code,
            year: movie.year
          });
        }
      }
      return [null, results];
    }
  }
  return [null, []];
}

async function searchTorrentGalaxy(query, type, provider, isImdbSearch = false, axiosConfig = {}) {
  for (const domain of provider.domains) {
    const searchPaths = [];
    
    if (isImdbSearch && query.startsWith('tt')) {
      searchPaths.push(`/torrents.php?search=tt${query.slice(2)}`);
    } else {
      searchPaths.push(`/torrents.php?search=${encodeURIComponent(query)}`);
    }

    for (const searchPath of searchPaths) {
      const [responseError, response] = await act(axios.get(domain + searchPath, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: provider.timeout || 5000,
        ...axiosConfig
      }));

      if (!responseError && response?.status === 200) {
        const $ = cheerio.load(response.data);
        const results = [];

        $('.tgxtablerow').each((i, element) => {
          const $row = $(element);
          
          // Skip non-movie/series entries based on type
          const category = $row.find('.tgxtablecell:nth-child(1) a small').text().trim().toLowerCase();
          if (type === 'movies' && !category.includes('movies')) return;
          if (type === 'series' && !category.includes('tv')) return;

          const name = $row.find('.tgxtablecell:nth-child(4) div a b').text().trim();
          const seeders = parseInt($row.find('.tgxtablecell:nth-child(11) span font:nth-child(1)').text(), 10) || 0;
          const leechers = parseInt($row.find('.tgxtablecell:nth-child(11) span font:nth-child(2)').text(), 10) || 0;
          const size = $row.find('.tgxtablecell:nth-child(8)').text().trim();
          const magnet = $row.find('.tgxtablecell:nth-child(5) a[href^="magnet:"]').attr('href');

          if (name && seeders > 0 && magnet) {
            const quality = name.match(/\b(720p|1080p|2160p|4K)\b/i)?.[0] || 'unknown';
            results.push({
              name,
              seeders,
              leechers,
              size,
              magnet,
              provider: 'torrentgalaxy',
              type,
              quality
            });
          }
        });

        if (results.length > 0) {
          return [null, results];
        }
      }
    }
  }
  return [null, []];
}

function getEnabledProviders(type) {
  if (!torrentConfig?.providers) return [];
  
  return Object.entries(torrentConfig.providers)
    .filter(([, provider]) => provider.enabled && provider.type.includes(type))
    .map(([name, provider]) => ({
      name,
      ...provider
    }))
    .sort((a, b) => a.priority - b.priority);
}

async function initialize() {
  const configPath = path.join(process.cwd(), "src/config/torrent-sources.json");
  const [configError, configData] = await act(fs.readFile(configPath, "utf8"));
  
  if (configError) {
    logger.error("Failed to initialize TorrentService:", configError);
    return [configError, null];
  }

  try {
    torrentConfig = JSON.parse(configData);

    if (torrentConfig.cache?.enabled) {
      cache = new NodeCache({
        stdTTL: torrentConfig.cache.duration,
        maxKeys: torrentConfig.cache.maxSize
      });
    }

    logger.info("TorrentService initialized successfully");
    return [null, true];
  } catch (error) {
    logger.error("Failed to initialize TorrentService:", error);
    return [error, null];
  }
}

async function searchRARBG(query, type, provider, axiosConfig = {}) {
  if (!provider.token) {
    // Get token first
    const [tokenError, tokenResponse] = await act(axios.get(`${provider.domains[0]}/pubapi_v2.php?get_token=get_token`, {
      timeout: provider.timeout || 5000,
      ...axiosConfig
    }));

    if (tokenError || !tokenResponse?.data?.token) {
      logger.warn('Failed to get RARBG token:', tokenError?.message || 'No token received');
      return [null, []];
    }

    provider.token = tokenResponse.data.token;
    await new Promise(resolve => setTimeout(resolve, 2000)); // Required wait after getting token
  }

  // Search parameters
  const searchParams = {
    mode: 'search',
    token: provider.token,
    format: 'json_extended',
    ranked: 0,
    app_id: 'self_streme'
  };

  if (query.startsWith('tt')) {
    searchParams.search_imdb = query;
  } else {
    searchParams.search_string = query;
  }

  // Add category based on type
  if (type === 'movies') {
    searchParams.category = 'movies';
  } else if (type === 'series') {
    searchParams.category = 'tv';
  }

  const [error, response] = await act(axios.get(`${provider.domains[0]}/pubapi_v2.php`, {
    params: searchParams,
    timeout: provider.timeout || 5000,
    ...axiosConfig
  }));

  if (!error && response?.data?.torrent_results) {
    return [null, response.data.torrent_results.map(torrent => ({
      name: torrent.title,
      seeders: torrent.seeders,
      leechers: torrent.leechers,
      size: `${Math.round(torrent.size / (1024 * 1024))} MB`,
      magnet: torrent.download,
      provider: 'rarbg',
      type,
      quality: torrent.quality || 'unknown',
      imdb: query.startsWith('tt') ? query : undefined
    }))];
  }

  return [null, []];
}

async function getTorrentInfo(imdbId, type) {
  const cacheKey = `torrent:${imdbId}:${type}`;
  if (cache?.get(cacheKey)) {
    logger.debug(`Cache hit for torrent info: ${imdbId}`);
    return [null, cache.get(cacheKey)];
  }

  logger.debug(`Searching for torrent info with IMDB ID: ${imdbId}`);
  const [searchError, results] = await searchTorrents(imdbId, type);
  
  if (searchError) {
    logger.error(`Error searching for torrent: ${imdbId}`, searchError);
    return [searchError, null];
  }

  if (results.length === 0) {
    logger.warn(`No torrent information found for: ${imdbId}`);
    return [null, null];
  }

  const bestResult = results[0];
  const torrentInfo = {
    title: bestResult.name,
    seeders: bestResult.seeders,
    leechers: bestResult.leechers,
    size: bestResult.size,
    provider: bestResult.provider,
    magnet: bestResult.magnet,
    imdbId,
    type
  };

  if (cache) {
    cache.set(cacheKey, torrentInfo);
  }

  return [null, torrentInfo];
}

const torrentService = {
  client,
  searchTorrents,
  getTorrentInfo,
  initialize
};

// Initialize with error handling
(async () => {
  const [error] = await initialize();
  if (error) {
    logger.error("Failed to initialize torrent service:", error);
    process.exit(1);
  }
})();

export default torrentService;
