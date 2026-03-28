import dotenv from "dotenv";
import path from "path";
import { publicTrackers, dhtBootstrap } from "./trackers.js";

dotenv.config();

function getEnvInt(name, defaultValue, options = {}) {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return defaultValue;

  if (typeof options.min === "number" && parsed < options.min) {
    return options.min;
  }
  if (typeof options.max === "number" && parsed > options.max) {
    return options.max;
  }
  return parsed;
}

function getEnvBool(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  const normalized = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function getEnvIntList(name, fallbackValues = []) {
  const raw = process.env[name];
  if (!raw || !String(raw).trim()) return fallbackValues;
  const parsed = String(raw)
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
  return parsed.length > 0 ? parsed : fallbackValues;
}

function resolvePathValue(value, fallbackAbsolute) {
  const candidate = value && String(value).trim() ? String(value).trim() : fallbackAbsolute;
  return path.isAbsolute(candidate)
    ? path.normalize(candidate)
    : path.resolve(process.cwd(), candidate);
}

function normalizeBaseUrl(rawBaseUrl, port, env) {
  if (rawBaseUrl && String(rawBaseUrl).trim()) {
    try {
      const parsed = new URL(String(rawBaseUrl).trim());
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return {
          baseUrl: parsed.toString().replace(/\/$/, ""),
          source: "env",
        };
      }
    } catch {
      // Invalid BASE_URL, fall through to safe fallback
    }
  }

  if (env === "production") {
    // In production, prefer proxy-aware runtime detection over localhost fallback.
    return { baseUrl: null, source: "auto-detect" };
  }

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    source: "localhost-fallback",
  };
}

const nodeEnv = process.env.NODE_ENV || "development";
const serverPort = getEnvInt("SERVER_PORT", getEnvInt("PORT", 7000, { min: 1 }), {
  min: 1,
  max: 65535,
});
const addonPort = getEnvInt("ADDON_PORT", 7001, { min: 1, max: 65535 });

const paths = {
  root: process.cwd(),
  data: resolvePathValue(process.env.DATA_PATH, path.join(process.cwd(), "data")),
  logs: resolvePathValue(process.env.LOGS_PATH, path.join(process.cwd(), "logs")),
  temp: resolvePathValue(process.env.TEMP_PATH, path.join(process.cwd(), "temp")),
  media: resolvePathValue(process.env.MEDIA_PATH, path.join(process.cwd(), "media")),
};

const { baseUrl, source: baseUrlSource } = normalizeBaseUrl(
  process.env.BASE_URL,
  serverPort,
  nodeEnv,
);

const torrentTimeout = getEnvInt("TORRENT_TIMEOUT", 120000, { min: 1000 });
const torrentMaxRetries = getEnvInt("TORRENT_MAX_RETRIES", 5, { min: 0, max: 10 });
const timeoutProgressionFallback = [
  getEnvInt("TORRENT_TIMEOUT_STEP_1", 60000, { min: 1000 }),
  getEnvInt("TORRENT_TIMEOUT_STEP_2", 120000, { min: 1000 }),
  getEnvInt("TORRENT_TIMEOUT_STEP_3", 180000, { min: 1000 }),
  getEnvInt("TORRENT_TIMEOUT_STEP_4", 240000, { min: 1000 }),
  getEnvInt("TORRENT_TIMEOUT_STEP_5", 300000, { min: 1000 }),
];
const timeoutProgression = getEnvIntList(
  "TORRENT_TIMEOUT_PROGRESSION",
  timeoutProgressionFallback,
);

const config = {
  server: {
    port: serverPort,
    addonPort,
    baseUrl,
    baseUrlSource,
  },
  external: {
    jackett: {
      url: process.env.JACKETT_URL || "http://localhost:9117",
      apiKey: process.env.JACKETT_API_KEY || "",
    },
  },
  media: {
    tempPath: paths.temp,
    libraryPath: paths.media,
    localPath: paths.media,
    path: paths.media,
    supportedVideoFormats: [".mp4", ".mkv", ".avi", ".webm", ".mov", ".flv"],
    supportedSubtitleFormats: [".srt", ".vtt", ".ass", ".ssa"],
  },
  apiKeys: {
    omdb: process.env.OMDB_API_KEY || "",
  },
  cache: {
    ttl: getEnvInt("CACHE_TTL", 3600, { min: 1 }),
    maxSize: getEnvInt("CACHE_MAX_SIZE", 1000, { min: 1 }),
    maxDiskUsage: getEnvInt("CACHE_MAX_DISK_MB", 5000, { min: 100 }),
    cleanupInterval: getEnvInt("CACHE_CLEANUP_INTERVAL", 300, { min: 10 }),
    backend: process.env.CACHE_BACKEND || "memory",
    persistent: getEnvBool("CACHE_PERSISTENT", false),
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  paths,
  torrent: {
    enabled: true,
    cacheOnlyMode: getEnvBool("CACHE_ONLY_MODE", false),
    directStreamOnly: getEnvBool("DIRECT_STREAM_ONLY", false),
    downloadPath: paths.temp,
    apis: {
      rarbg: {
        url: "https://torrentapi.org/pubapi_v2.php",
        token: process.env.RARBG_TOKEN || "",
        appId: "self_streme",
      },
      x1337: {
        url: "https://1337x.to",
      },
    },
    trackers: publicTrackers,
    dhtBootstrap,
    maxConnections: getEnvInt("TORRENT_MAX_CONNECTIONS", 25, { min: 1, max: 500 }),
    downloadLimit: getEnvInt("TORRENT_DOWNLOAD_LIMIT", 0, { min: 0 }),
    uploadLimit: getEnvInt("TORRENT_UPLOAD_LIMIT", 0, { min: 0 }),
    cleanupInterval: getEnvInt("TORRENT_CLEANUP_INTERVAL", 1800000, { min: 10000 }),
    timeout: torrentTimeout,
    maxRetries: torrentMaxRetries,
    timeoutProgression,
    minPeersBeforeTimeout: getEnvInt("TORRENT_MIN_PEERS_BEFORE_TIMEOUT", 1, { min: 0, max: 1000 }),
    peerDiscoveryTimeout: getEnvInt("TORRENT_PEER_DISCOVERY_TIMEOUT", 60000, { min: 1000 }),
    aggressivePeerDiscovery: getEnvBool("TORRENT_AGGRESSIVE_PEER_DISCOVERY", true),
  },
  addon: {
    id: "com.stremio.selfstreme",
    version: "1.0.0",
    name: "×¡×˜×¨×™×ž×™×• ×©×œ×™",
    description: "×¦×¤×” ×‘×¡×¤×¨×™×™×ª ×”×ž×“×™×” ×©×œ×š ×•×’×œ×” ×ª×•×›×Ÿ ×—×“×©",
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
        name: "Local Series & Anime",
        extra: [
          {
            name: "search",
            isRequired: false,
          },
          {
            name: "genre",
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
    resources: ["catalog", "meta", "stream", "subtitles"],
    types: ["movie", "series", "other"],
    idPrefixes: ["", "tt"],
    background: "https://www.stremio.com/website/stremio-logo-small.png",
    behaviorHints: {
      configurable: true,
    },
  },
};

config.runtimeSummary = {
  env: nodeEnv,
  server: {
    port: config.server.port,
    addonPort: config.server.addonPort,
    baseUrlSource: config.server.baseUrlSource,
  },
  paths: {
    data: config.paths.data,
    logs: config.paths.logs,
    temp: config.paths.temp,
    media: config.paths.media,
  },
  cache: {
    backend: config.cache.backend,
    ttl: config.cache.ttl,
    maxSize: config.cache.maxSize,
    maxDiskUsage: config.cache.maxDiskUsage,
  },
  torrent: {
    maxConnections: config.torrent.maxConnections,
    timeout: config.torrent.timeout,
    maxRetries: config.torrent.maxRetries,
    peerDiscoveryTimeout: config.torrent.peerDiscoveryTimeout,
    minPeersBeforeTimeout: config.torrent.minPeersBeforeTimeout,
  },
};

export {
  config,
  getEnvInt,
  getEnvBool,
  getEnvIntList,
  resolvePathValue,
  normalizeBaseUrl,
};
