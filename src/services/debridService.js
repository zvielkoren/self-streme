/**
 * Debrid Service
 * 
 * Intercepts torrent magnet links and resolves them through debrid services
 * (Real-Debrid, AllDebrid, Premiumize) for reliable HTTP streaming.
 * 
 * This service is called BEFORE returning streams to Stremio, converting
 * magnet links to direct HTTP URLs when debrid services are configured.
 */

import logger from "../utils/logger.js";
import downloadSources from "./torrentDownloadSources.js";

class DebridService {
  constructor() {
    this.enabled = this.checkEnabled();
    this.cache = new Map(); // Cache resolved URLs to avoid repeated API calls
    this.cacheTTL = 3600000; // 1 hour cache
    this.setupCleanup();
  }

  /**
   * Check if any debrid service is configured
   */
  checkEnabled() {
    const hasRealDebrid = !!process.env.REAL_DEBRID_API_KEY;
    const hasAllDebrid = !!process.env.ALLDEBRID_API_KEY;
    const hasPremiumize = !!process.env.PREMIUMIZE_API_KEY;

    const enabled = hasRealDebrid || hasAllDebrid || hasPremiumize;

    if (enabled) {
      logger.info('[Debrid] Service enabled with available providers:');
      if (hasRealDebrid) logger.info('[Debrid]   - Real-Debrid');
      if (hasAllDebrid) logger.info('[Debrid]   - AllDebrid');
      if (hasPremiumize) logger.info('[Debrid]   - Premiumize');
    } else {
      logger.info('[Debrid] Service disabled - no API keys configured');
    }

    return enabled;
  }

  /**
   * Setup periodic cache cleanup
   */
  setupCleanup() {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTTL) {
          this.cache.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logger.debug(`[Debrid] Cleaned ${cleaned} expired cache entries`);
      }
    }, 600000); // Clean every 10 minutes
  }

  /**
   * Resolve a magnet link or infoHash to a direct HTTP URL via debrid service
   * 
   * @param {string} infoHash - The torrent infoHash (40 or 32 chars)
   * @param {string} fileName - Optional file name for multi-file torrents
   * @returns {Promise<string|null>} Direct HTTP URL or null if resolution fails
   */
  async resolveToDirectUrl(infoHash, fileName = null) {
    if (!this.enabled) {
      logger.debug('[Debrid] Service not enabled, skipping resolution');
      return null;
    }

    if (!infoHash || (infoHash.length !== 40 && infoHash.length !== 32)) {
      logger.warn(`[Debrid] Invalid infoHash: ${infoHash}`);
      return null;
    }

    // Check cache first
    const cacheKey = `${infoHash}:${fileName || 'default'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.info(`[Debrid] Cache hit for ${infoHash}`);
      return cached.url;
    }

    try {
      logger.info(`[Debrid] Resolving ${infoHash}${fileName ? ` (file: ${fileName})` : ''}`);

      // Get premium sources (debrid services)
      const sources = downloadSources.getPremiumSources(infoHash, fileName || 'video.mp4');

      if (!sources || sources.length === 0) {
        logger.warn('[Debrid] No premium sources available');
        return null;
      }

      // Try each source in priority order
      for (const source of sources) {
        try {
          logger.info(`[Debrid] Trying ${source.name}...`);

          // Call the buildUrl function (it's async for debrid services)
          const url = await source.buildUrl(infoHash, fileName || 'video.mp4');

          if (url && typeof url === 'string' && url.startsWith('http')) {
            logger.info(`[Debrid] ✓ Resolved via ${source.name}`);
            
            // Cache the result
            this.cache.set(cacheKey, {
              url: url,
              timestamp: Date.now(),
              source: source.name
            });

            // Update source health
            downloadSources.updateSourceHealth(source.name, true);

            return url;
          }
        } catch (error) {
          logger.warn(`[Debrid] ${source.name} failed: ${error.message}`);
          downloadSources.updateSourceHealth(source.name, false);
          // Continue to next source
        }
      }

      logger.warn(`[Debrid] All debrid services failed for ${infoHash}`);
      return null;

    } catch (error) {
      logger.error(`[Debrid] Resolution error for ${infoHash}:`, error);
      return null;
    }
  }

  /**
   * Check if debrid resolution should be attempted for a stream
   * 
   * @param {object} stream - The stream object to check
   * @returns {boolean} True if debrid resolution should be attempted
   */
  shouldResolve(stream) {
    if (!this.enabled) {
      return false;
    }

    // Only resolve if we have an infoHash or magnet link
    if (stream.infoHash || stream.magnet || 
        (stream.sources && stream.sources.some(s => s && s.includes('btih:')))) {
      return true;
    }

    return false;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      cacheSize: this.cache.size,
      cacheTTL: this.cacheTTL,
      sources: downloadSources.getStats()
    };
  }

  /**
   * Clear the cache
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`[Debrid] Cleared cache (${size} entries)`);
  }
}

// Singleton instance
const debridService = new DebridService();

export default debridService;
