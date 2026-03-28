import logger from "../utils/logger.js";
import NodeCache from "node-cache";

import x1337Provider from "./torrents/1337x.js";
import ytsProvider from "./torrents/yts.js";
import torrentGalaxyProvider from "./torrents/torrentgalaxy.js";
import tpbProvider from "./torrents/piratebay.js";

import torrentioProvider from "./external/torrentio.js";
import jackettProvider from "./external/jackett.js";
import fallbackProvider from "./external/fallbackProvider.js";
import mockProvider from "./external/mockProvider.js";

import metadataService from "../core/metadataService.js";

class SearchService {
  constructor() {
    this.torrentProviders = [
      tpbProvider,
      x1337Provider,
      torrentGalaxyProvider,
      ytsProvider,
    ];

    this.externalProviders = [
      torrentioProvider,
      jackettProvider,
      fallbackProvider,
      mockProvider,
    ];

    this.cache = new NodeCache({
      stdTTL: 1800,
      checkperiod: 300,
      maxKeys: 500,
    });

    this.successTTL = 1800;
    this.emptyTTL = 120;
    this.errorTTL = 60;
    this.providerTimeoutMs = 10000;
  }

  async search(imdbId, type, season, episode) {
    const cleanImdbId = String(imdbId || "").replace(/\.(json|txt|html)$/, "");
    const cacheKey = `${type}:${cleanImdbId}:${season || 0}:${episode || 0}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.info(`Cache hit for ${cacheKey} (${cached.length} results)`);
      return cached;
    }

    const diagnostics = {
      cacheKey,
      metadataFailed: false,
      providers: [],
      totalResults: 0,
    };

    let metadata = null;
    try {
      metadata = await metadataService.getMetadata(cleanImdbId, type);
      if (!metadata?.title) {
        diagnostics.metadataFailed = true;
        logger.warn(
          `[Search] Metadata incomplete for ${cleanImdbId}; using fallback provider query`,
        );
      }
    } catch (error) {
      diagnostics.metadataFailed = true;
      logger.warn(
        `[Search] Metadata lookup failed for ${cleanImdbId}: ${error.message}`,
      );
    }

    const params = this.buildSearchParams(
      cleanImdbId,
      type,
      season,
      episode,
      metadata,
    );

    try {
      const [local, external] = await Promise.all([
        this.searchProviders(this.torrentProviders, params, "torrent"),
        this.searchProviders(this.externalProviders, params, "external"),
      ]);

      diagnostics.providers = [...local.providerLogs, ...external.providerLogs];

      const allResults = this.mergeResults(local.results, external.results);
      diagnostics.totalResults = allResults.length;

      if (allResults.length > 0) {
        this.cache.set(cacheKey, allResults, this.successTTL);
      } else {
        const hadFailures = diagnostics.providers.some(
          (entry) => entry.status === "timeout" || entry.status === "error",
        );
        this.cache.set(cacheKey, allResults, hadFailures ? this.errorTTL : this.emptyTTL);
      }

      logger.info(
        `[Search] ${cacheKey} -> ${allResults.length} results (metadataFallback=${diagnostics.metadataFailed})`,
      );
      return allResults;
    } catch (error) {
      logger.error(`[Search] Fatal search error for ${cacheKey}: ${error.message}`);
      this.cache.set(cacheKey, [], this.errorTTL);
      return [];
    }
  }

  buildSearchParams(cleanImdbId, type, season, episode, metadata) {
    const hasMetadata = Boolean(metadata?.title);
    let searchQuery = hasMetadata ? metadata.title : cleanImdbId;

    if (type === "series" && season && episode) {
      const prefix = hasMetadata ? metadata.title : cleanImdbId;
      searchQuery = `${prefix} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
    } else if (type === "series" && season) {
      const prefix = hasMetadata ? metadata.title : cleanImdbId;
      searchQuery = `${prefix} Season ${season}`;
    }

    return {
      imdbId: cleanImdbId,
      type,
      query: searchQuery,
      originalTitle: metadata?.title || null,
      year: metadata?.year || null,
      season,
      episode,
      metadataAvailable: hasMetadata,
    };
  }

  async searchProviders(providers, params, sourceKind) {
    const results = [];
    const providerLogs = [];

    const searches = providers.map(async (provider) => {
      const providerName = provider.name || `${sourceKind}Provider`;
      const startedAt = Date.now();
      logger.info(`[Search] ${providerName} started (${sourceKind})`);

      try {
        const providerResults = await Promise.race([
          provider.search(params),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(`Provider timeout after ${this.providerTimeoutMs}ms`),
                ),
              this.providerTimeoutMs,
            ),
          ),
        ]);

        const count = Array.isArray(providerResults) ? providerResults.length : 0;
        if (count > 0) {
          results.push(...providerResults);
        }

        providerLogs.push({
          provider: providerName,
          source: sourceKind,
          status: "success",
          count,
          durationMs: Date.now() - startedAt,
        });
        logger.info(`[Search] ${providerName} finished with ${count} results`);
      } catch (error) {
        const isTimeout = /timeout/i.test(error.message);
        providerLogs.push({
          provider: providerName,
          source: sourceKind,
          status: isTimeout ? "timeout" : "error",
          count: 0,
          durationMs: Date.now() - startedAt,
          error: error.message,
        });
        logger.warn(
          `[Search] ${providerName} ${isTimeout ? "timed out" : "failed"}: ${error.message}`,
        );
      }
    });

    await Promise.allSettled(searches);
    return { results, providerLogs };
  }

  mergeResults(localResults, externalResults) {
    const allResults = [...localResults, ...externalResults];
    const seen = new Set();
    const unique = allResults.filter((r) => {
      const key = r.infoHash || r.url || r.magnet || r.title;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const qualityScore = { "2160p": 4, "1080p": 3, "720p": 2, unknown: 1 };
    return unique.sort((a, b) => {
      const aq = qualityScore[a.quality] || 1;
      const bq = qualityScore[b.quality] || 1;
      if (bq !== aq) return bq - aq;
      return (b.seeders || 0) - (a.seeders || 0);
    });
  }

  clearCache() {
    this.cache.flushAll();
    logger.debug("Search cache cleared");
  }
}

export default new SearchService();
