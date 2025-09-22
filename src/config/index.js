import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

const config = {
  server: {
    port: process.env.PORT || 7000,
    addonPort: process.env.ADDON_PORT || 7001,
    baseUrl: process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 7000}`,
  },
  external: {
    jackett: {
      url: process.env.JACKETT_URL || 'http://localhost:9117',
      apiKey: process.env.JACKETT_API_KEY || ''
    }
  },
  media: {
    tempPath: "./temp",
    libraryPath: "./media",
    localPath: process.env.MEDIA_PATH || path.join(__dirname, "../../media"),
    path: process.env.MEDIA_PATH || path.join(__dirname, "../../media"),
    supportedVideoFormats: [".mp4", ".mkv", ".avi", ".webm", ".mov", ".flv"],
    supportedSubtitleFormats: [".srt", ".vtt", ".ass", ".ssa"],
  },
  apiKeys: {
    omdb: process.env.OMDB_API_KEY,
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 3600,
    maxSize: parseInt(process.env.CACHE_MAX_SIZE, 10) || 1000, // Max number of cached files
    maxDiskUsage: parseInt(process.env.CACHE_MAX_DISK_MB, 10) || 5000, // Max disk usage in MB
    cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL, 10) || 300, // 5 minutes
    backend: process.env.CACHE_BACKEND || 'memory', // memory, sqlite, redis
    persistent: process.env.CACHE_PERSISTENT === 'true',
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  torrent: {
    enabled: true,
    downloadPath: "./temp", // Add download path
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
      // High-reliability public trackers
      "udp://tracker.opentrackr.org:1337",
      "udp://tracker.openbittorrent.com:6969",
      "udp://open.demonii.com:1337",
      "udp://tracker.torrent.eu.org:451",
      "udp://exodus.desync.com:6969",
      "udp://tracker.moeking.me:6969",
      "udp://open.stealth.si:80",
      "udp://tracker.tiny-vps.com:6969",
      "udp://bt2.archive.org:6969",
      
      // Additional reliable trackers for better connectivity
      "udp://tracker.zer0day.to:1337",
      "udp://tracker.leechers-paradise.org:6969",
      "udp://tracker.coppersurfer.tk:6969",
      "udp://tracker.pirateparty.gr:6969",
      "udp://tracker.cyberia.is:6969",
      "udp://retracker.lanta-net.ru:2710",
      "udp://tracker.dler.org:6969",
      "udp://tracker.internetwarriors.net:1337",
      
      // HTTP trackers as fallback
      "http://tracker.openbittorrent.com:80/announce",
      "http://tracker.opentrackr.org:1337/announce",
      
      // DHT bootstrap nodes are handled by WebTorrent automatically
    ],
    maxConnections: 25, // Reduced from 100 to prevent port exhaustion
    downloadLimit: 0, // 0 for unlimited
    uploadLimit: 0, // 0 for unlimited
    cleanupInterval: 1800000, // Reduced to 30 minutes for better cleanup
    timeout: parseInt(process.env.TORRENT_TIMEOUT, 10) || 120000, // Increased to 2 minutes for better connectivity
    maxRetries: parseInt(process.env.TORRENT_MAX_RETRIES, 10) || 4, // Increased retries for better resilience
    // Progressive timeout strategy - each retry gets longer timeout
    timeoutProgression: [120000, 180000, 240000, 300000], // 2, 3, 4, 5 minutes
    // Minimum peers required before timeout
    minPeersBeforeTimeout: 1,
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
    },
  },
};

export { config };