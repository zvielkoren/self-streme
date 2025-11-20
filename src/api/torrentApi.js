import express from 'express';
import TorrentService from '../services/torrentService.js';
import logger from '../utils/logger.js';

/**
 * Torrent API Router
 * Provides REST endpoints for torrent management and streaming
 */
export function createTorrentRouter(torrentService, cacheManager) {
  const router = express.Router();

  /**
   * POST /api/torrents
   * Add a new torrent by magnet link or info hash
   * Body: { magnetUri: string, infoHash?: string, name?: string }
   */
  router.post('/torrents', async (req, res) => {
    try {
      const { magnetUri, infoHash, name } = req.body;

      if (!magnetUri && !infoHash) {
        return res.status(400).json({
          error: 'magnetUri or infoHash is required',
        });
      }

      const identifier = magnetUri || infoHash;
      logger.info(`Adding torrent: ${identifier}`);

      const result = await torrentService.addTorrent(identifier, { name });

      res.json({
        success: true,
        data: {
          infoHash: result.infoHash,
          name: result.name,
          cached: result.cached,
          files: result.files,
          message: result.cached
            ? 'Torrent found in cache'
            : 'Torrent added successfully',
        },
      });
    } catch (error) {
      logger.error('Error adding torrent:', error);
      res.status(500).json({
        error: 'Failed to add torrent',
        message: error.message,
        details: error.stack,
      });
    }
  });

  /**
   * GET /api/torrents/:infoHash
   * Get status and progress of a specific torrent
   */
  router.get('/torrents/:infoHash', async (req, res) => {
    try {
      const { infoHash } = req.params;

      const status = torrentService.getTorrentStatus(infoHash);

      if (!status) {
        return res.status(404).json({
          error: 'Torrent not found',
          infoHash,
        });
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Error getting torrent status:', error);
      res.status(500).json({
        error: 'Failed to get torrent status',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/torrents/:infoHash/files
   * List all files in a torrent
   */
  router.get('/torrents/:infoHash/files', async (req, res) => {
    try {
      const { infoHash } = req.params;

      const files = await torrentService.getTorrentFiles(infoHash);

      res.json({
        success: true,
        data: {
          infoHash,
          files,
          count: files.length,
        },
      });
    } catch (error) {
      logger.error('Error getting torrent files:', error);
      res.status(500).json({
        error: 'Failed to get torrent files',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/torrents/:infoHash
   * Remove a torrent
   * Query params: ?deleteFiles=true|false
   */
  router.delete('/torrents/:infoHash', async (req, res) => {
    try {
      const { infoHash } = req.params;
      const deleteFiles = req.query.deleteFiles === 'true';

      const removed = await torrentService.removeTorrent(infoHash, deleteFiles);

      if (!removed) {
        return res.status(404).json({
          error: 'Torrent not found',
          infoHash,
        });
      }

      res.json({
        success: true,
        message: 'Torrent removed successfully',
        data: {
          infoHash,
          deletedFiles: deleteFiles,
        },
      });
    } catch (error) {
      logger.error('Error removing torrent:', error);
      res.status(500).json({
        error: 'Failed to remove torrent',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/torrents
   * List all active torrents
   */
  router.get('/torrents', (req, res) => {
    try {
      const stats = torrentService.getClientStats();

      res.json({
        success: true,
        data: {
          total: stats.activeTorrents,
          downloadSpeed: stats.downloadSpeed,
          uploadSpeed: stats.uploadSpeed,
          torrents: stats.torrents,
          dht: {
            enabled: stats.dhtEnabled,
            nodes: stats.dhtNodes,
          },
        },
      });
    } catch (error) {
      logger.error('Error listing torrents:', error);
      res.status(500).json({
        error: 'Failed to list torrents',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/cache-stats
   * Get cache statistics and status
   */
  router.get('/cache-stats', (req, res) => {
    try {
      const stats = cacheManager.getStats();

      res.json({
        success: true,
        data: {
          ...stats,
          scalingInfo: {
            backend: stats.backend,
            isScalable: stats.backend !== 'memory',
            supportsPersistence: stats.backend === 'sqlite' || stats.backend === 'redis',
            recommendedForProduction: stats.backend === 'redis',
          },
        },
      });
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      res.status(500).json({
        error: 'Failed to get cache stats',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/cache-config
   * Get cache configuration
   */
  router.get('/cache-config', (req, res) => {
    try {
      const stats = cacheManager.getStats();

      res.json({
        success: true,
        data: {
          backend: stats.backend,
          maxSize: stats.maxSize,
          currentSize: stats.size,
          maxDiskUsage: stats.maxDiskUsage,
          currentDiskUsage: stats.diskUsage,
          diskUsagePercent: stats.diskUsagePercent,
          cleanupInterval: stats.cleanupInterval,
          ttl: stats.ttl || 'N/A',
        },
      });
    } catch (error) {
      logger.error('Error getting cache config:', error);
      res.status(500).json({
        error: 'Failed to get cache config',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/cache-config
   * Manage cache (force cleanup)
   * Body: { forceCleanup: true }
   */
  router.post('/cache-config', async (req, res) => {
    try {
      const { forceCleanup } = req.body;

      if (forceCleanup) {
        const result = await cacheManager.forceCleanup();

        res.json({
          success: true,
          message: 'Cache cleaned successfully',
          data: result,
        });
      } else {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Specify forceCleanup: true to clean cache',
        });
      }
    } catch (error) {
      logger.error('Error managing cache:', error);
      res.status(500).json({
        error: 'Failed to manage cache',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/health
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    try {
      const torrentStats = torrentService.getClientStats();
      const cacheStats = cacheManager.getStats();

      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          torrent: {
            status: 'running',
            activeTorrents: torrentStats.activeTorrents,
            dhtEnabled: torrentStats.dhtEnabled,
            dhtNodes: torrentStats.dhtNodes,
          },
          cache: {
            status: 'running',
            backend: cacheStats.backend,
            size: cacheStats.size,
            diskUsage: `${cacheStats.diskUsagePercent}%`,
          },
        },
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: error.message,
      });
    }
  });

  return router;
}

export default createTorrentRouter;
