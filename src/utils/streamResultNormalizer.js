import fs from "fs";
import path from "path";

export function pickTorrentFile(torrent, fileIndex) {
  if (!torrent || torrent.destroyed || !Array.isArray(torrent.files)) {
    return null;
  }
  return torrent.files[fileIndex] || torrent.files[0] || null;
}

export function normalizeApiStreamResult(result, { infoHash, fileIndex }) {
  if (!result || result.success === false) {
    throw new Error("Stream source returned an invalid result");
  }

  const normalizedIndex =
    Number.isInteger(fileIndex) && fileIndex >= 0 ? fileIndex : 0;
  const files = Array.isArray(result.files) ? result.files : [];
  const torrentFile = pickTorrentFile(result.torrent, normalizedIndex);
  const selectedFile = files[normalizedIndex] || files[0] || torrentFile;

  const filePath = result.filePath || null;
  let fileName =
    result.fileName || selectedFile?.name || (filePath ? path.basename(filePath) : null);
  let fileSize = result.fileSize ?? selectedFile?.length ?? torrentFile?.length ?? null;

  if ((fileSize == null || !fileName) && filePath && fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    fileSize = fileSize ?? stats.size;
    fileName = fileName || path.basename(filePath);
  }

  if (!fileName) {
    fileName = `stream-${infoHash}.mp4`;
  }

  if (fileSize == null) {
    throw new Error(
      "Stream metadata is incomplete: missing file size from torrent metadata and local file. Retry prepare or use a different source.",
    );
  }

  return {
    method: result.method || "unknown",
    success: result.success !== false,
    cached: Boolean(result.cached),
    infoHash: result.infoHash || infoHash,
    torrent: result.torrent || null,
    files,
    filePath,
    fileSize,
    fileName,
    fileIndex: normalizedIndex,
  };
}
