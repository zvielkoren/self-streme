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
import { tryExtractInfoHash } from "../utils/infoHash.js";

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

        const rawCount = Array.isArray(providerResults) ? providerResults.length : 0;
        const normalizedResults = this.normalizeProviderResults(
          providerResults,
          providerName,
          params,
        );
        const count = normalizedResults.length;
        if (count > 0) {
          results.push(...normalizedResults);
        }

        if (rawCount > 0) {
          const sample = providerResults[0];
          logger.debug(`[Search] ${providerName} raw sample`, {
            provider: providerName,
            source: sourceKind,
            rawCount,
            sample: this.toSafeSample(sample),
          });
        }

        providerLogs.push({
          provider: providerName,
          source: sourceKind,
          status: "success",
          rawCount,
          count,
          rejected: Math.max(0, rawCount - count),
          durationMs: Date.now() - startedAt,
        });
        logger.info(
          `[Search] ${providerName} finished with ${count}/${rawCount} normalized results`,
        );
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

  normalizeProviderResults(providerResults, providerName, params) {
    if (!Array.isArray(providerResults)) return [];

    const normalized = [];
    for (const item of providerResults) {
      if (!item || typeof item !== "object") continue;

      const sources = Array.isArray(item.sources)
        ? item.sources.filter((entry) => typeof entry === "string" && entry.trim())
        : [];

      const directUrl =
        this.pickFirstString([
          item.url,
          item.streamUrl,
          item.link,
          item.src,
          item.download,
          item.file,
          sources.find((entry) => /^https?:\/\//i.test(entry)),
        ]) || null;

      const magnet =
        this.pickFirstString([
          item.magnet,
          item.magnetUri,
          item.magnetURL,
          sources.find((entry) => /^magnet:\?/i.test(entry)),
        ]) || null;

      const infoHash =
        this.pickFirstString([item.infoHash]) ||
        tryExtractInfoHash(magnet) ||
        null;

      if (!directUrl && !magnet && !infoHash) {
        logger.debug("[Search] Dropping malformed provider source", {
          provider: providerName,
          title: item.title || item.name || "unknown",
          reason: "missing-locator",
        });
        continue;
      }

      normalized.push({
        ...item,
        infoHash: typeof infoHash === "string" ? infoHash.toLowerCase() : undefined,
        url: directUrl || undefined,
        magnet: magnet || undefined,
        provider: item.provider || providerName,
        source: item.source || item.provider || providerName,
        type: item.type || params.type,
      });
    }

    return normalized;
  }

  pickFirstString(values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  toSafeSample(sample) {
    if (!sample || typeof sample !== "object") return sample;
    return {
      title: sample.title || sample.name || null,
      quality: sample.quality || null,
      hasUrl: Boolean(sample.url || sample.streamUrl || sample.link),
      hasMagnet: Boolean(
        sample.magnet ||
          sample.magnetUri ||
          (Array.isArray(sample.sources) &&
            sample.sources.some((s) => typeof s === "string" && s.startsWith("magnet:"))),
      ),
      hasInfoHash: Boolean(sample.infoHash),
      provider: sample.provider || sample.source || null,
      type: sample.type || null,
    };
  }

  clearCache() {
    this.cache.flushAll();
    logger.debug("Search cache cleared");
  }
}

export default new SearchService();
