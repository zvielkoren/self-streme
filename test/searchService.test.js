import test from "node:test";
import assert from "node:assert/strict";
import searchService from "../src/providers/index.js";
import metadataService from "../src/core/metadataService.js";

test("search falls back to provider query when metadata lookup fails", async () => {
  const originalMetadata = metadataService.getMetadata;
  const originalTorrentProviders = searchService.torrentProviders;
  const originalExternalProviders = searchService.externalProviders;

  try {
    metadataService.getMetadata = async () => {
      throw new Error("metadata unavailable");
    };

    searchService.torrentProviders = [
      {
        name: "fallbackProvider",
        search: async (params) => [
          {
            title: params.query,
            infoHash: "0123456789abcdef0123456789abcdef01234567",
            seeders: 10,
            quality: "1080p",
          },
        ],
      },
    ];
    searchService.externalProviders = [];
    searchService.clearCache();

    const results = await searchService.search("tt1234567", "movie");
    assert.equal(results.length, 1);
    assert.equal(results[0].infoHash.length, 40);
  } finally {
    metadataService.getMetadata = originalMetadata;
    searchService.torrentProviders = originalTorrentProviders;
    searchService.externalProviders = originalExternalProviders;
    searchService.clearCache();
  }
});

test("search caches empty/error results with short ttl", async () => {
  const originalMetadata = metadataService.getMetadata;
  const originalTorrentProviders = searchService.torrentProviders;
  const originalExternalProviders = searchService.externalProviders;

  try {
    metadataService.getMetadata = async () => ({ title: "Example", year: 2024 });
    searchService.torrentProviders = [
      { name: "timeoutProvider", search: async () => new Promise(() => {}) },
    ];
    searchService.externalProviders = [];
    searchService.providerTimeoutMs = 25;
    searchService.clearCache();

    const cacheKey = "movie:tt7654321:0:0";
    const results = await searchService.search("tt7654321", "movie");
    assert.deepEqual(results, []);

    const ttl = searchService.cache.getTtl(cacheKey);
    assert.ok(ttl && ttl > Date.now(), "cache TTL should be set");
    assert.ok(
      ttl - Date.now() < 1000 * 10,
      "error/empty cache TTL should be short",
    );
  } finally {
    metadataService.getMetadata = originalMetadata;
    searchService.torrentProviders = originalTorrentProviders;
    searchService.externalProviders = originalExternalProviders;
    searchService.providerTimeoutMs = 10000;
    searchService.clearCache();
  }
});
