import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Scalable Cache Manager with multiple backend support
 * Supports memory, SQLite, and Redis backends for different scaling needs
 */
class ScalableCacheManager {
    constructor(options = {}) {
        this.backend = options.backend || config.cache.backend;
        this.maxSize = options.maxSize || config.cache.maxSize;
        this.maxDiskUsage = options.maxDiskUsage || config.cache.maxDiskUsage;
        this.cleanupInterval = options.cleanupInterval || config.cache.cleanupInterval;
        this.tempDir = options.tempDir;
        
        // Initialize the appropriate backend
        this.initializeBackend();
        
        // Track disk usage
        this.currentDiskUsage = 0;
        this.updateDiskUsage();
        
        // Start monitoring and cleanup
        this.startCleanupSchedule();
        
        logger.info(`Scalable cache initialized: backend=${this.backend}, maxSize=${this.maxSize}, maxDisk=${this.maxDiskUsage}MB`);
    }

    initializeBackend() {
        switch (this.backend) {
            case 'memory':
                this.cache = new Map();
                break;
            case 'sqlite':
                this.initializeSQLite();
                break;
            case 'redis':
                this.initializeRedis();
                break;
            default:
                logger.warn(`Unknown cache backend: ${this.backend}, falling back to memory`);
                this.cache = new Map();
        }
    }

    initializeSQLite() {
        // For now, use memory with persistence simulation
        // In production, you'd use sqlite3 package
        this.cache = new Map();
        this.persistentFile = path.join(this.tempDir, '.cache-index.json');
        this.loadPersistentCache();
    }

    initializeRedis() {
        // Redis implementation would go here
        // For now, fallback to memory
        logger.warn('Redis backend not implemented yet, using memory');
        this.cache = new Map();
    }

    loadPersistentCache() {
        if (config.cache.persistent && fs.existsSync(this.persistentFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.persistentFile, 'utf8'));
                for (const [key, value] of Object.entries(data)) {
                    this.cache.set(key, value);
                }
                logger.info(`Loaded ${this.cache.size} entries from persistent cache`);
            } catch (error) {
                logger.error('Failed to load persistent cache:', error);
            }
        }
    }

    savePersistentCache() {
        if (config.cache.persistent) {
            try {
                const data = Object.fromEntries(this.cache);
                fs.writeFileSync(this.persistentFile, JSON.stringify(data, null, 2));
            } catch (error) {
                logger.error('Failed to save persistent cache:', error);
            }
        }
    }

    async set(key, value) {
        // Check size limits before adding
        if (this.cache.size >= this.maxSize) {
            await this.evictOldest();
        }

        // Check disk usage limits
        if (value.filePath && fs.existsSync(value.filePath)) {
            const fileSize = fs.statSync(value.filePath).size;
            const fileSizeMB = fileSize / (1024 * 1024);
            
            if (this.currentDiskUsage + fileSizeMB > this.maxDiskUsage) {
                await this.evictByDiskUsage();
            }
        }

        value.lastAccessed = Date.now();
        this.cache.set(key, value);
        
        // Update disk usage
        this.updateDiskUsage();
        
        logger.debug(`Cache set: ${key} (size: ${this.cache.size}/${this.maxSize})`);
        return true;
    }

    get(key) {
        const value = this.cache.get(key);
        if (value) {
            value.lastAccessed = Date.now();
            this.cache.set(key, value); // Update access time
            return value;
        }
        return null;
    }

    delete(key) {
        const value = this.cache.get(key);
        if (value && value.filePath && fs.existsSync(value.filePath)) {
            try {
                fs.unlinkSync(value.filePath);
                logger.debug(`Deleted file: ${value.filePath}`);
            } catch (error) {
                logger.error(`Failed to delete file ${value.filePath}:`, error);
            }
        }
        
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.updateDiskUsage();
            logger.debug(`Cache delete: ${key} (size: ${this.cache.size}/${this.maxSize})`);
        }
        return deleted;
    }

    has(key) {
        return this.cache.has(key);
    }

    size() {
        return this.cache.size;
    }

    async evictOldest() {
        if (this.cache.size === 0) return;

        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, value] of this.cache.entries()) {
            if (value.lastAccessed < oldestTime) {
                oldestTime = value.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.delete(oldestKey);
            logger.info(`Evicted oldest cache entry: ${oldestKey}`);
        }
    }

    async evictByDiskUsage() {
        const entries = Array.from(this.cache.entries());
        
        // Sort by last accessed time (oldest first)
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        let freedSpace = 0;
        const targetFree = this.maxDiskUsage * 0.2; // Free 20% of max space
        
        for (const [key, value] of entries) {
            if (freedSpace >= targetFree) break;
            
            if (value.filePath && fs.existsSync(value.filePath)) {
                const fileSize = fs.statSync(value.filePath).size / (1024 * 1024);
                freedSpace += fileSize;
            }
            
            this.delete(key);
        }
        
        logger.info(`Evicted ${freedSpace.toFixed(2)}MB from cache`);
    }

    updateDiskUsage() {
        let totalSize = 0;
        
        for (const [key, value] of this.cache.entries()) {
            if (value.filePath && fs.existsSync(value.filePath)) {
                try {
                    const fileSize = fs.statSync(value.filePath).size;
                    totalSize += fileSize;
                } catch (error) {
                    // File might have been deleted
                    logger.debug(`File not found during disk usage calculation: ${value.filePath}`);
                }
            }
        }
        
        this.currentDiskUsage = totalSize / (1024 * 1024); // Convert to MB
    }

    startCleanupSchedule() {
        this.cleanupTimer = setInterval(() => {
            this.performCleanup();
        }, this.cleanupInterval * 1000);
        
        logger.info(`Started cleanup schedule: every ${this.cleanupInterval} seconds`);
    }

    performCleanup() {
        const now = Date.now();
        const cacheLifetime = config.cache.ttl * 1000;
        let cleanedCount = 0;
        
        for (const [key, value] of this.cache.entries()) {
            if (now - value.lastAccessed > cacheLifetime) {
                this.delete(key);
                cleanedCount++;
            }
        }
        
        // Update disk usage after cleanup
        this.updateDiskUsage();
        
        // Save persistent cache if enabled
        this.savePersistentCache();
        
        if (cleanedCount > 0) {
            logger.info(`Scheduled cleanup: removed ${cleanedCount} entries, disk usage: ${this.currentDiskUsage.toFixed(2)}MB/${this.maxDiskUsage}MB`);
        }
    }

    getStats() {
        return {
            backend: this.backend,
            size: this.cache.size,
            maxSize: this.maxSize,
            diskUsage: this.currentDiskUsage,
            maxDiskUsage: this.maxDiskUsage,
            diskUsagePercent: ((this.currentDiskUsage / this.maxDiskUsage) * 100).toFixed(2),
            cleanupInterval: this.cleanupInterval,
            lastCleanup: new Date().toISOString()
        };
    }

    async forceCleanup() {
        const initialSize = this.cache.size;
        const initialDiskUsage = this.currentDiskUsage;
        
        // Clear all entries
        for (const [key] of this.cache.entries()) {
            this.delete(key);
        }
        
        this.updateDiskUsage();
        this.savePersistentCache();
        
        const cleanedCount = initialSize - this.cache.size;
        const freedSpace = initialDiskUsage - this.currentDiskUsage;
        
        logger.info(`Force cleanup completed: removed ${cleanedCount} entries, freed ${freedSpace.toFixed(2)}MB`);
        
        return {
            cleanedCount,
            freedSpaceMB: freedSpace,
            finalSize: this.cache.size,
            finalDiskUsage: this.currentDiskUsage
        };
    }

    stop() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        
        this.savePersistentCache();
        logger.info('Scalable cache manager stopped');
    }
}

export default ScalableCacheManager;