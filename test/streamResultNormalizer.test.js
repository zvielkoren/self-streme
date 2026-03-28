import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  normalizeApiStreamResult,
  pickTorrentFile,
} from "../src/utils/streamResultNormalizer.js";

test("normalizeApiStreamResult handles P2P metadata-only result", () => {
  const torrent = {
    destroyed: false,
    files: [{ name: "movie.mkv", length: 123456 }],
  };

  const normalized = normalizeApiStreamResult(
    {
      method: "p2p",
      success: true,
      infoHash: "a".repeat(40),
      torrent,
      files: [{ name: "movie.mkv", length: 123456 }],
    },
    { infoHash: "a".repeat(40), fileIndex: 0 },
  );

  assert.equal(normalized.filePath, null);
  assert.equal(normalized.fileName, "movie.mkv");
  assert.equal(normalized.fileSize, 123456);
  assert.equal(normalized.method, "p2p");
});

test("normalizeApiStreamResult derives file metadata from local path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "self-streme-test-"));
  const filePath = path.join(dir, "video.mp4");
  fs.writeFileSync(filePath, Buffer.alloc(32));

  const normalized = normalizeApiStreamResult(
    {
      method: "cache",
      success: true,
      filePath,
    },
    { infoHash: "b".repeat(40), fileIndex: 0 },
  );

  assert.equal(normalized.fileName, "video.mp4");
  assert.equal(normalized.fileSize, 32);
  assert.equal(normalized.filePath, filePath);
});

test("pickTorrentFile safely selects indexed or first file", () => {
  const torrent = {
    destroyed: false,
    files: [{ name: "a.mp4", length: 1 }, { name: "b.mp4", length: 2 }],
  };
  assert.equal(pickTorrentFile(torrent, 1).name, "b.mp4");
  assert.equal(pickTorrentFile(torrent, 99).name, "a.mp4");
  assert.equal(pickTorrentFile({ destroyed: true, files: torrent.files }, 0), null);
});
