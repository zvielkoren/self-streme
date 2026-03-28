import test from "node:test";
import assert from "node:assert/strict";
import { createHybridStreamService } from "../src/services/hybridStreamService.js";

test("HybridStreamService.tryP2P returns normalized shape for metadata-only torrent", async () => {
  const infoHash = "0123456789abcdef0123456789abcdef01234567";
  const mockTorrent = {
    destroyed: false,
    infoHash,
    files: [{ name: "sample.mp4", length: 987654 }],
  };

  const service = createHybridStreamService(
    {
      addTorrent: async () => ({
        torrent: mockTorrent,
        files: [{ name: "sample.mp4", length: 987654 }],
        cached: false,
      }),
    },
    null,
  );

  const result = await service.tryP2P(infoHash, infoHash, { fileIndex: 0 });

  assert.deepEqual(Object.keys(result).sort(), [
    "cached",
    "fileName",
    "filePath",
    "fileSize",
    "files",
    "infoHash",
    "method",
    "success",
    "torrent",
  ]);
  assert.equal(result.method, "p2p");
  assert.equal(result.success, true);
  assert.equal(result.filePath, null);
  assert.equal(result.fileName, "sample.mp4");
  assert.equal(result.fileSize, 987654);
});
