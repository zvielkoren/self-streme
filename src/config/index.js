import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  server: {
    port: 3000,
    addonPort: 3001,
    baseUrl: "http://0.0.0.0:3000",
  },
  media: {
    tempPath: "./temp",
    libraryPath: "./media",
    path: process.env.MEDIA_PATH || path.join(__dirname, "../../media"),
    supportedVideoFormats: [".mp4", ".mkv", ".avi", ".webm", ".mov", ".flv"],
    supportedSubtitleFormats: [".srt", ".vtt", ".ass", ".ssa"],
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 3600,
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  torrent: {
    apis: {
      rarbg: {
        url: "https://torrentapi.org/pubapi_v2.php",
        token: process.env.RARBG_TOKEN,
        appId: "self_streme",
      },
      x1337: {
        url: "https://1337x.to",
      },
    },
    trackers: [
      "udp://tracker.opentrackr.org:1337",
      "udp://tracker.leechers-paradise.org:6969",
      "udp://tracker.coppersurfer.tk:6969",
      "udp://p4p.arenabg.com:1337",
      "udp://eddie4.nl:6969",
      "udp://tracker.tiny-vps.com:6969",
      "udp://open.stealth.si:80",
    ],
    maxConnections: 100,
    downloadLimit: 0, // 0 for unlimited
    uploadLimit: 0, // 0 for unlimited
    cleanupInterval: 3600000, // 1 hour
  },
  addon: {
    id: "com.stremio.selfstreme",
    version: "1.0.0",
    name: "סטרימיו שלי",
    description: "צפה בספריית המדיה שלך וגלה תוכן חדש",
    catalogs: [
      {
        type: "movie",
        id: "local",
        name: "Local Movies",
        extra: [
          {
            name: "search",
            isRequired: false,
          },
        ],
      },
      {
        type: "series",
        id: "local",
        name: "Local Series",
        extra: [
          {
            name: "search",
            isRequired: false,
          },
        ],
      },
      {
        type: "other",
        id: "local",
        name: "Other Videos",
        extra: [
          {
            name: "search",
            isRequired: false,
          },
        ],
      },
    ],
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series", "other"],
    idPrefixes: ["", "tt"], // Accept both our IDs and IMDB IDs
    background: "https://www.stremio.com/website/stremio-logo-small.png",
    behaviorHints: {
      configurable: true,
      configurationRequired: false,
    },
  },
};
