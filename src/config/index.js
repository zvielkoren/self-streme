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
    baseUrl: "http://127.0.0.1:3000",
  },
  media: {
    tempPath: "./temp",
    libraryPath: "./media",
    path: process.env.MEDIA_PATH || path.join(__dirname, "../../media"),
    supportedVideoFormats: [".mp4", ".mkv", ".avi"],
    supportedSubtitleFormats: [".srt", ".vtt", ".ass"],
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 3600,
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  addon: {
    id: "com.stremio.selfstreme",
    version: "1.0.0",
    name: "Self Streme",
    description: "Stream your media library and discover new content",
    catalogs: [
      {
        type: "movie",
        id: "top",
        name: "Popular Movies",
        extra: [
          {
            name: "search",
            isRequired: false
          }
        ]
      },
      {
        type: "series",
        id: "top",
        name: "Popular Series",
        extra: [
          {
            name: "search",
            isRequired: false
          }
        ]
      }
    ],
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt", "kitsu"],
    background: "https://www.stremio.com/website/stremio-logo-small.png"
  },
};
