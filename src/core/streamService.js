import logger from "../utils/logger.js";
import searchService from "../providers/index.js";
import torrentService from "./torrentService.js";
import streamHandler from "../services/streamHandler.js";
import subtitleService from "../services/subtitleService.js";
import debridService from "../services/debridService.js";
import { config } from "../config/index.js";
import { getMaintenanceMode } from "../utils/maintenanceMode.js";

class StreamService {
  constructor() {
    this.cache = new Map(); // cache: imdbId:season:episode -> streams
    this.handler = streamHandler; // Add handler reference
    this.setupCleanup();
  }

  /**
   * מחזיר streams לסרט או סדרה
   * @param {string} type - "movie" או "series"
   * @param {string} imdbId
   * @param {number} [season]
   * @param {number} [episode]
   * @param {string} [userAgent] - User agent for iOS detection
   * @param {string} [baseUrl] - Base URL for proxy-aware stream URLs
   */
  async getStreams(type, imdbId, season, episode, userAgent, baseUrl) {
    try {
      // Check if maintenance mode is enabled
      const maintenanceMode = getMaintenanceMode();
      if (maintenanceMode.isEnabled()) {
        logger.info(
          `[Maintenance] Returning placeholder stream for ${type}:${imdbId}`,
        );
        return this.getMaintenancePlaceholder(maintenanceMode);
      }

      // Input validation
      if (!imdbId || typeof imdbId !== "string") {
        logger.error(`Invalid imdbId: ${imdbId}`);
        return [];
      }

      if (!type || !["movie", "series"].includes(type)) {
        logger.error(`Invalid type: ${type}`);
        return [];
      }

      // Clean the IMDB ID by removing .json and any other extensions
      const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, "");

      // Validate IMDb ID format (should start with tt followed by digits)
      if (!cleanImdbId.match(/^tt\d+$/)) {
        logger.error(`Invalid IMDb ID format: ${cleanImdbId}`);
        return [];
      }

      const cacheKey = `${cleanImdbId}:${season || 0}:${episode || 0}`;
      logger.info(
        `Getting streams for ${type}:${cleanImdbId} S${season || "-"}E${episode || "-"}`,
      );

      // Detect iOS early for specific handling
      const isIOS = this.isIOSDevice(userAgent);
      if (isIOS) {
        logger.info(`iOS device detected for ${type} request: ${cacheKey}`);
      }

      // בדיקה אם יש כבר במטמון (cache raw streams, not converted ones)
      let streamsData;
      if (this.cache.has(cacheKey)) {
        logger.info(`Cache hit for ${cacheKey}`);
        streamsData = this.cache.get(cacheKey);
      } else {
        // קריאה למקור ה־streams (searchService)
        streamsData = await searchService.search(imdbId, type, season, episode);
        if (
          !streamsData ||
          !Array.isArray(streamsData) ||
          streamsData.length === 0
        ) {
          logger.warn(`No streams found from searchService for ${cacheKey}`);

          // For series on iOS, try fallback search strategies
          if (type === "series" && isIOS && season && episode) {
            logger.info(
              `Attempting fallback search for iOS series: ${cacheKey}`,
            );
            streamsData = await this.fallbackSeriesSearch(
              cleanImdbId,
              season,
              episode,
            );
          }

          if (!streamsData || streamsData.length === 0) {
            // Return a placeholder stream instead of empty array
            const placeholderStream = {
              name: "No Stream Available - Check Self-Streme Addon",
              title: "No Stream Available - Check Self-Streme Addon",
              url: "/static/placeholder.mp4",
              quality: "N/A",
              size: "0 MB",
              seeders: 0,
              source: "placeholder",
              behaviorHints: {
                notWebReady: false,
                bingeGroup: "self-streme-placeholder",
              },
            };

            const placeholderResult = [placeholderStream];
            // Cache placeholder result for a shorter time to retry sooner
            this.cache.set(cacheKey, placeholderResult, 300); // 5 minutes for placeholder results
            return placeholderResult;
          }
        }

        // Cache the raw stream data
        this.cache.set(cacheKey, streamsData);
      }

      // מיפוי ותיקון metadata מתוך מקור ה־streams
      let streams = streamsData
        .filter(
          (result) =>
            result &&
            (result.title ||
              result.name ||
              result.magnet ||
              result.url ||
              result.ytId ||
              result.infoHash),
        )
        .map((result) => this.convertToStremioStream(result, isIOS, baseUrl))
        .filter(
          (stream) =>
            stream !== null &&
            stream &&
            (stream.infoHash || stream.url || stream.ytId),
        ); // Filter out invalid streams and nulls

      logger.info(`Processed ${streams.length} valid streams for ${cacheKey}`);

      // Intercept torrent streams and resolve via debrid services if available
      if (streams.length > 0 && debridService.enabled) {
        logger.info(`[Debrid] Attempting to resolve ${streams.length} streams via debrid services`);
        streams = await this.resolveStreamsViaDebrid(streams, baseUrl);
      }

      // For series content or when directStreamOnly is enabled, add HTTP streaming options
      if (
        (type === "series" || config.torrent.directStreamOnly) &&
        streams.length > 0
      ) {
        logger.info(
          `Enhancing streams with direct HTTP options for ${type}:${cleanImdbId}`,
        );
        streams = await this.addDirectStreamOptions(
          streams,
          type,
          cleanImdbId,
          baseUrl,
        );
      }

      // If no valid streams found after filtering, provide a helpful placeholder
      if (streams.length === 0) {
        logger.warn(`No valid streams after filtering for ${cacheKey}`);
        const placeholderStream = {
          name: "No Stream Available - Check Self-Streme Addon",
          title: "No Stream Available - Check Self-Streme Addon",
          url: "/static/placeholder.mp4",
          quality: "N/A",
          size: "0 MB",
          seeders: 0,
          source: "placeholder",
          behaviorHints: {
            notWebReady: false,
            bingeGroup: "self-streme-placeholder",
          },
        };
        return [placeholderStream];
      }

      // Don't cache converted streams - we cache raw streams and convert per request
      return streams;
    } catch (error) {
      logger.error(
        `Stream service error for ${imdbId}:${season || 1}:${episode || 1}:`,
        error.message,
      );
      return [];
    }
  }

  /**
   * Fallback search for series when main search fails
   * @param {string} imdbId - Clean IMDB ID
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   * @returns {Promise<Array>} Array of stream results
   */
  async fallbackSeriesSearch(imdbId, season, episode) {
    try {
      logger.info(
        `Attempting fallback series search for ${imdbId} S${season}E${episode}`,
      );

      // Try searching without episode specificity first (season pack)
      let results = await searchService.search(imdbId, "series", season);
      if (results && results.length > 0) {
        logger.info(
          `Found ${results.length} season pack results for fallback search`,
        );
        return results;
      }

      // Try searching as movie type (sometimes series episodes are indexed as movies)
      results = await searchService.search(imdbId, "movie");
      if (results && results.length > 0) {
        logger.info(
          `Found ${results.length} movie-type results for series fallback search`,
        );
        return results;
      }

      logger.warn(`No results found in fallback series search for ${imdbId}`);
      return [];
    } catch (error) {
      logger.error(`Fallback series search error for ${imdbId}:`, error);
      return [];
    }
  }

  /**
   * מחזיר stream ספציפי מקאש לפי fileIdx
   */
  getCachedStream(imdbId, season, episode, fileIdx) {
    const cleanImdbId = imdbId.replace(/\.(json|txt|html)$/, "");
    const key = `${cleanImdbId}:${season || 0}:${episode || 0}`;
    const streams = this.cache.get(key) || [];
    return streams[fileIdx] || null;
  }

  /**
   * ממיר אובייקט מקור ל־Stremio Stream
   * @param {object} result - מקור stream
   * @param {boolean} isIOS - האם זה מכשיר iOS
   * @param {string} baseUrl - Base URL for proxy-aware stream URLs
   */
  convertToStremioStream(result, isIOS = false, baseUrl = null) {
    const stream = {
      name: result.title || result.name || "Self-Streme",
      title: result.title || result.name || "Unknown Title",
      quality: result.quality,
      size: result.size,
      seeders: result.seeders,
      source: result.source,
    };

    // Log iOS detection for debugging
    if (isIOS) {
      logger.debug(
        `Converting stream for iOS device: ${stream.name}, baseUrl: ${baseUrl}`,
      );
    }

    // Enhanced handling for infoHash - check direct property first, then extract from magnet
    let infoHash = null;

    // Check if infoHash is provided directly (common in Torrentio streams)
    if (result.infoHash && typeof result.infoHash === "string") {
      infoHash = result.infoHash.toLowerCase();
      logger.debug(`Using direct infoHash: ${infoHash}`);
    }
    // Try to extract from magnet if no direct infoHash
    else if (
      result.magnet ||
      (result.sources && result.sources.some((s) => s.startsWith("magnet:")))
    ) {
      const magnetLink =
        result.magnet || result.sources.find((s) => s.startsWith("magnet:"));
      infoHash = this.extractInfoHash(magnetLink);
      if (infoHash) {
        logger.debug(`Extracted infoHash from magnet: ${infoHash}`);
      }
    }

    // If we have a valid infoHash, set up streaming
    if (infoHash && (infoHash.length === 40 || infoHash.length === 32)) {
      // Always cache stream info for proxy serving (needed for both iOS and testing)
      this.handler.cacheStream(
        infoHash,
        result.type || "movie",
        result.title || result.name,
        result.quality || "unknown",
      );

      if (isIOS) {
        // For iOS devices, provide HTTP stream URL instead of magnet
        // Use proxy-aware base URL if provided, otherwise fall back to config
        const streamBaseUrl =
          baseUrl ||
          config.server.baseUrl ||
          `http://127.0.0.1:${config.server.port}`;
        stream.url = `${streamBaseUrl}/stream/proxy/${infoHash}`;
        logger.debug(
          `iOS stream: providing proxy-aware HTTP URL ${stream.url} for ${infoHash}`,
        );

        // Add metadata for better iOS playback
        stream.behaviorHints = {
          notWebReady: false, // iOS streams are web-ready
          bingeGroup: `self-streme-ios-${infoHash.substring(0, 8)}`,
          proxyHeaders: {
            request: {
              "User-Agent": "Stremio/iOS",
            },
          },
        };

        // CRITICAL: Don't set infoHash for iOS - only URL should be present
        // This ensures Stremio uses the HTTP stream instead of trying to download the torrent
        // Do NOT set stream.infoHash or stream.sources here!
      } else {
        // For desktop/Android, provide magnet link
        stream.infoHash = infoHash;
        stream.fileIdx = result.fileIdx || 0;

        // Create magnet link if we only have infoHash
        const magnetLink =
          result.magnet ||
          result.sources?.find((s) => s.startsWith("magnet:")) ||
          `magnet:?xt=urn:btih:${infoHash}`;
        stream.sources = [magnetLink];
        logger.debug(`Desktop stream: providing magnet link for ${infoHash}`);

        // Desktop behavior hints
        stream.behaviorHints = {
          notWebReady: true,
          bingeGroup: `self-streme-desktop-${stream.quality || "default"}`,
        };
      }
    }

    // URL ישיר
    if (result.url) {
      stream.url = result.url;
      // Set appropriate behavior hints for direct URLs
      if (!stream.behaviorHints) {
        stream.behaviorHints = {
          notWebReady: false,
          bingeGroup: `self-streme-direct-${stream.quality || "default"}`,
        };
      }
    }

    // YouTube ID
    if (result.ytId) {
      stream.ytId = result.ytId;
      // YouTube streams are always web-ready
      if (!stream.behaviorHints) {
        stream.behaviorHints = {
          notWebReady: false,
          bingeGroup: "self-streme-youtube",
        };
      }
    }

    // fallback למקרה שאין מקור תקף - החזר null כדי שהסטרים יסונן החוצה
    if (!stream.infoHash && !stream.url && !stream.ytId) {
      logger.warn(
        `Filtering out invalid stream: ${result.title || result.name || "Unknown"} from ${result.source || "unknown source"} - no valid source`,
      );
      return null;
    }

    // Default behaviorHints if not set above
    if (!stream.behaviorHints) {
      stream.behaviorHints = {
        notWebReady: !isIOS, // iOS gets web-ready streams, others don't
        bingeGroup: `self-streme-${stream.quality || "default"}`,
      };
    }

    // Add subtitle support if available in result
    if (
      result.subtitles &&
      Array.isArray(result.subtitles) &&
      result.subtitles.length > 0
    ) {
      stream.subtitles = subtitleService.formatForStremio(result.subtitles);
      logger.debug(`Added ${stream.subtitles.length} subtitles to stream`);
    }

    return stream;
  }

  /**
   * מוציא infoHash ממגנט URI - Enhanced to handle more formats
   */
  extractInfoHash(magnetUri) {
    if (!magnetUri || typeof magnetUri !== "string") return null;

    // Try multiple patterns for infoHash extraction
    const patterns = [
      /btih:([a-fA-F0-9]{40})/i, // Standard 40-char hex
      /btih:([a-fA-F0-9]{32})/i, // 32-char hex (base32 converted)
      /xt=urn:btih:([a-fA-F0-9]{40})/i, // Full urn format 40-char
      /xt=urn:btih:([a-fA-F0-9]{32})/i, // Full urn format 32-char
      /hash=([a-fA-F0-9]{40})/i, // Alternative hash parameter
      /hash=([a-fA-F0-9]{32})/i, // Alternative hash parameter 32-char
    ];

    for (const pattern of patterns) {
      const match = magnetUri.match(pattern);
      if (match && match[1]) {
        const hash = match[1].toLowerCase();
        // Validate hash length (32 or 40 characters)
        if (hash.length === 40 || hash.length === 32) {
          logger.debug(
            `Extracted infoHash: ${hash} from magnet: ${magnetUri.substring(0, 50)}...`,
          );
          return hash;
        }
      }
    }

    logger.debug(
      `Failed to extract infoHash from: ${magnetUri.substring(0, 100)}...`,
    );
    return null;
  }

  /**
   * Resolve torrent streams via debrid services
   * Intercepts magnet links and converts them to direct HTTP URLs
   * 
   * @param {Array} streams - Array of stream objects
   * @param {string} baseUrl - Base URL for fallback proxy URLs
   * @returns {Promise<Array>} Streams with debrid URLs where available
   */
  async resolveStreamsViaDebrid(streams, baseUrl) {
    if (!streams || streams.length === 0) {
      return streams;
    }

    const resolvedStreams = [];

    for (const stream of streams) {
      // Skip streams that already have direct URLs or YouTube IDs
      if (stream.url || stream.ytId) {
        resolvedStreams.push(stream);
        continue;
      }

      // Only try debrid resolution for torrent streams
      if (!stream.infoHash) {
        resolvedStreams.push(stream);
        continue;
      }

      try {
        // Try to resolve via debrid service
        const fileName = stream.title || stream.name || 'video.mp4';
        const debridUrl = await debridService.resolveToDirectUrl(stream.infoHash, fileName);

        if (debridUrl) {
          // Success! Convert to direct HTTP stream
          logger.info(`[Debrid] ✓ Resolved ${stream.infoHash} to direct URL`);
          
          const resolvedStream = {
            ...stream,
            url: debridUrl,
            name: `${stream.name || stream.title} [Debrid]`,
            title: `${stream.title || stream.name} [Debrid]`,
            // Remove torrent-specific fields since we now have direct URL
            infoHash: undefined,
            sources: undefined,
            fileIdx: undefined,
            behaviorHints: {
              notWebReady: false, // Direct URLs are web-ready
              bingeGroup: `self-streme-debrid-${stream.quality || "default"}`,
            },
          };
          
          resolvedStreams.push(resolvedStream);
        } else {
          // Debrid resolution failed, keep original torrent stream
          logger.debug(`[Debrid] Could not resolve ${stream.infoHash}, keeping original torrent stream`);
          resolvedStreams.push(stream);
        }
      } catch (error) {
        logger.warn(`[Debrid] Error resolving ${stream.infoHash}: ${error.message}`);
        // Keep original stream on error
        resolvedStreams.push(stream);
      }
    }

    const debridCount = resolvedStreams.filter(s => s.name && s.name.includes('[Debrid]')).length;
    if (debridCount > 0) {
      logger.info(`[Debrid] Successfully resolved ${debridCount}/${streams.length} streams`);
    }

    return resolvedStreams;
  }

  /**
   * בודק אם המכשיר הוא iOS
   */
  isIOSDevice(userAgent) {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return (
      ua.includes("iphone") ||
      ua.includes("ipad") ||
      ua.includes("ipod") ||
      ua.includes("ios") ||
      (ua.includes("mobile") &&
        ua.includes("safari") &&
        !ua.includes("android"))
    );
  }

  /**
   * Add direct HTTP streaming options to streams
   * This ensures series content can always be watched via HTTP without P2P
   * @param {Array} streams - Existing streams
   * @param {string} type - Content type
   * @param {string} imdbId - IMDB ID
   * @param {string} baseUrl - Base URL for streaming
   * @returns {Promise<Array>} Enhanced streams with HTTP options
   */
  async addDirectStreamOptions(streams, type, imdbId, baseUrl) {
    try {
      const enhancedStreams = [...streams];

      // For each stream with infoHash, add direct HTTP streaming option
      for (const stream of streams) {
        if (stream.infoHash) {
          // Create a direct HTTP stream URL using proxy
          const streamBaseUrl =
            baseUrl ||
            config.server.baseUrl ||
            `http://127.0.0.1:${config.server.port}`;
          const directHttpStream = {
            name: `${stream.name || stream.title} [Direct HTTP]`,
            title: `${stream.title || stream.name} - Direct Stream (No P2P)`,
            url: `${streamBaseUrl}/stream/proxy/${stream.infoHash}`,
            quality: stream.quality,
            size: stream.size,
            seeders: stream.seeders,
            source: `${stream.source || "unknown"}-direct`,
            behaviorHints: {
              notWebReady: false, // Always web-ready via HTTP
              bingeGroup: `self-streme-direct-${stream.quality || "default"}`,
            },
          };

          // Add direct stream as a separate option
          enhancedStreams.push(directHttpStream);

          logger.debug(
            `Added direct HTTP option for ${stream.title || stream.name}`,
          );
        }
      }

      // Sort streams to prioritize direct HTTP streams for series
      if (type === "series") {
        enhancedStreams.sort((a, b) => {
          // Prioritize streams with direct URLs (no P2P)
          const aIsDirect = a.url && !a.infoHash;
          const bIsDirect = b.url && !b.infoHash;

          if (aIsDirect && !bIsDirect) return -1;
          if (!aIsDirect && bIsDirect) return 1;

          // Then by quality
          const qualityOrder = { "2160p": 0, "1080p": 1, "720p": 2, "480p": 3 };
          const aQuality = qualityOrder[a.quality] ?? 999;
          const bQuality = qualityOrder[b.quality] ?? 999;

          return aQuality - bQuality;
        });
      }

      logger.info(
        `Enhanced ${streams.length} streams to ${enhancedStreams.length} total streams with direct HTTP options`,
      );
      return enhancedStreams;
    } catch (error) {
      logger.error("Error adding direct stream options:", error);
      return streams; // Return original streams on error
    }
  }

  /**
   * מנקה torrents ישנים
   */
  setupCleanup() {
    setInterval(() => {
      try {
        torrentService.cleanup();
      } catch (error) {
        logger.error("Cleanup error:", error.message);
      }
    }, config.torrent.cleanupInterval || 1800000);
    this.cleanupInterval = null;
  }

  /**
   * Generate maintenance mode placeholder stream
   * @param {Object} maintenanceMode - Maintenance mode instance
   * @returns {Array} Array with single placeholder stream
   */
  getMaintenancePlaceholder(maintenanceMode) {
    const status = maintenanceMode.getStatus();
    const timeInfo = status.estimatedEndTime
      ? `Expected completion: ${new Date(status.estimatedEndTime).toLocaleString()}`
      : "";

    return [
      {
        name: "🔧 Service Under Maintenance",
        title: `🔧 Service Under Maintenance - ${status.message}`,
        url: "/static/maintenance-placeholder.html",
        description: `Self-Streme is currently undergoing maintenance. ${timeInfo}`,
        quality: "Maintenance",
        size: "N/A",
        seeders: 0,
        source: "maintenance",
        behaviorHints: {
          notWebReady: false,
          bingeGroup: "self-streme-maintenance",
        },
      },
    ];
  }
}

export default new StreamService();
