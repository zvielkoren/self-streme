/**
 * Request Deduplication Service
 * 
 * Prevents duplicate concurrent requests for the same resource.
 * If request is already in progress, returns the same promise.
 */

import logger from '../utils/logger.js';

class RequestDeduplicator {
  constructor() {
    this.pending = new Map(); // key -> { promise, timestamp }
    this.timeout = 120000; // 2 minutes
    
    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Execute function with deduplication
   */
  async deduplicate(key, fn) {
    // Check if already in progress
    if (this.pending.has(key)) {
      const entry = this.pending.get(key);
      logger.info(`[Dedup] Request already in progress for ${key}, reusing...`);
      return entry.promise;
    }

    // Execute new request
    logger.info(`[Dedup] New request for ${key}`);
    const promise = fn()
      .finally(() => {
        // Remove from pending after completion
        setTimeout(() => this.pending.delete(key), 5000); // Keep for 5s for late requests
      });

    this.pending.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }

  /**
   * Cleanup old entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.pending.entries()) {
      if (now - entry.timestamp > this.timeout) {
        logger.warn(`[Dedup] Cleaning up stale request: ${key}`);
        this.pending.delete(key);
      }
    }
  }

  /**
   * Clear all pending requests
   */
  clear() {
    this.pending.clear();
  }
}

// Singleton
const deduplicator = new RequestDeduplicator();

export default deduplicator;
