import torrentioProvider from "./torrentio.js";
import jackettProvider from "./jackett.js";
import fallbackProvider from "../external/fallbackProvider.js";

export async function getTorrentStreams(metadata) {
  let streams = [];

  // 🟢 מקורות רגילים
  streams.push(...await torrentioProvider(metadata));
  streams.push(...await jackettProvider(metadata));

  // 🔴 אם אין תוצאות → fallback
  if (streams.length === 0) {
    streams.push(...await fallbackProvider(metadata));
  }

  return streams;
}
