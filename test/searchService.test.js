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
      ttl - Date.now() < 1000 * 90,
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

test("search normalizes provider locator fields (magnet/link/sources)", async () => {
  const originalMetadata = metadataService.getMetadata;
  const originalTorrentProviders = searchService.torrentProviders;
  const originalExternalProviders = searchService.externalProviders;

  try {
    metadataService.getMetadata = async () => ({ title: "Example", year: 2024 });
    searchService.torrentProviders = [
      {
        name: "mixedProvider",
        search: async () => [
          {
            title: "Magnet only",
            magnetUri:
              "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Example",
            seeders: 10,
          },
          {
            title: "Link only",
            link: "https://example.com/stream.mp4",
            seeders: 8,
          },
          {
            title: "Sources list",
            sources: ["https://example.com/alt-stream.mp4"],
            seeders: 3,
          },
        ],
      },
    ];
    searchService.externalProviders = [];
    searchService.clearCache();

    const results = await searchService.search("tt1234567", "movie");
    assert.equal(results.length, 3);

    const magnetResult = results.find((item) => item.title === "Magnet only");
    assert.ok(magnetResult, "magnet result should be kept");
    assert.equal(
      magnetResult.infoHash,
      "0123456789abcdef0123456789abcdef01234567",
    );
    assert.ok(
      magnetResult.magnet?.startsWith("magnet:?xt=urn:btih:"),
      "magnet should be normalized",
    );

    const linkResult = results.find((item) => item.title === "Link only");
    assert.equal(linkResult.url, "https://example.com/stream.mp4");

    const sourcesResult = results.find((item) => item.title === "Sources list");
    assert.equal(sourcesResult.url, "https://example.com/alt-stream.mp4");
  } finally {
    metadataService.getMetadata = originalMetadata;
    searchService.torrentProviders = originalTorrentProviders;
    searchService.externalProviders = originalExternalProviders;
    searchService.clearCache();
  }
});
