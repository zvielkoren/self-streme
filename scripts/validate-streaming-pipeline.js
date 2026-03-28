import assert from "node:assert/strict";
import { extractInfoHash } from "../src/utils/infoHash.js";
import { normalizeApiStreamResult } from "../src/utils/streamResultNormalizer.js";
import { createHybridStreamService } from "../src/services/hybridStreamService.js";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeHexToBase32(hex) {
  const buffer = Buffer.from(hex, "hex");
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

async function run() {
  const infoHash = "0123456789abcdef0123456789abcdef01234567";
  const base32 = encodeHexToBase32(infoHash);

  assert.equal(extractInfoHash(infoHash), infoHash);
  assert.equal(
    extractInfoHash(`magnet:?xt=urn:btih:${infoHash}`),
    infoHash,
  );
  assert.equal(
    extractInfoHash(`magnet:?xt=urn:btih:${base32}`),
    infoHash,
  );

  const normalizedP2P = normalizeApiStreamResult(
    {
      method: "p2p",
      success: true,
      infoHash,
      torrent: {
        destroyed: false,
        files: [{ name: "movie.mkv", length: 1111 }],
      },
      files: [{ name: "movie.mkv", length: 1111 }],
    },
    { infoHash, fileIndex: 0 },
  );
  assert.equal(normalizedP2P.filePath, null);
  assert.equal(normalizedP2P.fileName, "movie.mkv");
  assert.equal(normalizedP2P.fileSize, 1111);

  const hybridService = createHybridStreamService(
    {
      addTorrent: async () => ({
        infoHash,
        files: [{ name: "movie.mkv", length: 2222 }],
        torrent: {
          destroyed: false,
          infoHash,
          files: [{ name: "movie.mkv", length: 2222 }],
        },
        cached: false,
      }),
    },
    null,
  );

  const normalizedHybrid = await hybridService.tryP2P(infoHash, infoHash, {
    fileIndex: 0,
  });
  assert.equal(normalizedHybrid.method, "p2p");
  assert.equal(normalizedHybrid.filePath, null);
  assert.equal(normalizedHybrid.fileName, "movie.mkv");
  assert.equal(normalizedHybrid.fileSize, 2222);

  console.log("validate-streaming-pipeline: OK");
}

run().catch((error) => {
  console.error("validate-streaming-pipeline: FAILED", error);
  process.exitCode = 1;
});
