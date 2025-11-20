import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import TorrentService from './services/torrentService.js';
import ScalableCacheManager from './services/scalableCacheManager.js';
import { createTorrentRouter } from './api/torrentApi.js';
import { createStreamingRouter } from './api/streamingApi.js';
import logger from './utils/logger.js';
import { config } from './config/index.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure temp directory exists
const TEMP_DIR = config.torrent.downloadPath || './temp';
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Torrent Streaming Server
 * Full-featured torrent streaming service with HTTP Range Request support
 */
class TorrentStreamingServer {
  constructor(options = {}) {
    this.port = options.port || config.server.port || 7000;
    this.app = express();

    // Initialize services
    this.cacheManager = new ScalableCacheManager({
      backend: config.cache.backend,
      maxSize: config.cache.maxSize,
      maxDiskUsage: config.cache.maxDiskUsage,
      cleanupInterval: config.cache.cleanupInterval,
      tempDir: TEMP_DIR,
    });

    this.torrentService = new TorrentService(this.cacheManager);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // CORS configuration
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Range', 'Accept', 'Authorization'],
      exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
      credentials: false,
      maxAge: 86400,
    }));

    // Body parsers
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });

    // Security headers
    this.app.use((req, res, next) => {
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      });
      next();
    });
  }

  setupRoutes() {
    // Home page
    this.app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Torrent Streaming Service</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #fff;
              padding: 20px;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .container {
              max-width: 800px;
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
            }
            h1 {
              font-size: 3em;
              margin-bottom: 20px;
              text-align: center;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .subtitle {
              text-align: center;
              font-size: 1.2em;
              margin-bottom: 40px;
              opacity: 0.9;
            }
            .api-section {
              background: rgba(255, 255, 255, 0.1);
              border-radius: 10px;
              padding: 20px;
              margin: 20px 0;
            }
            h2 {
              font-size: 1.8em;
              margin-bottom: 15px;
              color: #fff;
            }
            .endpoint {
              background: rgba(0, 0, 0, 0.2);
              border-left: 4px solid #4CAF50;
              padding: 15px;
              margin: 10px 0;
              border-radius: 5px;
              font-family: 'Courier New', monospace;
            }
            .method {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-weight: bold;
              margin-right: 10px;
              font-size: 0.9em;
            }
            .get { background: #4CAF50; }
            .post { background: #2196F3; }
            .delete { background: #f44336; }
            .path {
              color: #fff;
              font-size: 1.1em;
            }
            .description {
              margin-top: 8px;
              opacity: 0.8;
              font-family: sans-serif;
            }
            .stats {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
              gap: 15px;
              margin-top: 20px;
            }
            .stat-box {
              background: rgba(255, 255, 255, 0.1);
              padding: 15px;
              border-radius: 10px;
              text-align: center;
            }
            .stat-value {
              font-size: 2em;
              font-weight: bold;
              margin-top: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              opacity: 0.7;
            }
            a {
              color: #fff;
              text-decoration: none;
              border-bottom: 2px solid rgba(255,255,255,0.3);
              transition: border-color 0.3s;
            }
            a:hover {
              border-color: #fff;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎬 Torrent Streaming Service</h1>
            <div class="subtitle">Self-hosted streaming with WebTorrent</div>

            <div class="api-section">
              <h2>📡 Torrent Management API</h2>

              <div class="endpoint">
                <span class="method post">POST</span>
                <span class="path">/api/torrents</span>
                <div class="description">Add new torrent by magnet link or info hash</div>
              </div>

              <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/torrents/:infoHash</span>
                <div class="description">Get torrent status and progress</div>
              </div>

              <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/torrents/:infoHash/files</span>
                <div class="description">List all files in torrent</div>
              </div>

              <div class="endpoint">
                <span class="method delete">DELETE</span>
                <span class="path">/api/torrents/:infoHash</span>
                <div class="description">Remove torrent</div>
              </div>

              <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/torrents</span>
                <div class="description">List all active torrents</div>
              </div>
            </div>

            <div class="api-section">
              <h2>🎥 Streaming API</h2>

              <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/stream/proxy/:infoHash</span>
                <div class="description">Stream file with Range Request support (206 Partial Content)</div>
              </div>

              <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/stream/file/:infoHash/:fileIndex</span>
                <div class="description">Stream specific file by index</div>
              </div>

              <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/stream/info/:infoHash</span>
                <div class="description">Get streamable files information</div>
              </div>
            </div>

            <div class="api-section">
              <h2>💾 Cache Management API</h2>

              <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/cache-stats</span>
                <div class="description">Get cache statistics and scaling info</div>
              </div>

              <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/cache-config</span>
                <div class="description">Get cache configuration</div>
              </div>

              <div class="endpoint">
                <span class="method post">POST</span>
                <span class="path">/api/cache-config</span>
                <div class="description">Force cache cleanup</div>
              </div>
            </div>

            <div class="api-section">
              <h2>📊 Server Status</h2>
              <div class="stats">
                <div class="stat-box">
                  <div>Status</div>
                  <div class="stat-value">✅</div>
                </div>
                <div class="stat-box">
                  <div>Cache Backend</div>
                  <div class="stat-value">${config.cache.backend}</div>
                </div>
                <div class="stat-box">
                  <div>DHT</div>
                  <div class="stat-value">Enabled</div>
                </div>
                <div class="stat-box">
                  <div>Port</div>
                  <div class="stat-value">${this.port}</div>
                </div>
              </div>
            </div>

            <div class="footer">
              <p><a href="/api/health">Health Check</a> | <a href="/docs">API Documentation</a></p>
              <p style="margin-top: 10px;">Built with WebTorrent & Express</p>
            </div>
          </div>
        </body>
        </html>
      `);
    });

    // API Documentation
    this.app.get('/docs', (req, res) => {
      res.json({
        name: 'Torrent Streaming Service API',
        version: '1.0.0',
        description: 'Self-hosted torrent streaming with Range Request support',
        endpoints: {
          torrents: {
            'POST /api/torrents': {
              description: 'Add new torrent',
              body: { magnetUri: 'string', infoHash: 'string (optional)', name: 'string (optional)' },
              response: { success: true, data: { infoHash: 'string', name: 'string', cached: 'boolean', files: 'array' } },
            },
            'GET /api/torrents/:infoHash': {
              description: 'Get torrent status',
              response: { success: true, data: { infoHash: 'string', name: 'string', status: 'string', progress: 'number', peers: 'number' } },
            },
            'GET /api/torrents/:infoHash/files': {
              description: 'List files in torrent',
              response: { success: true, data: { infoHash: 'string', files: 'array', count: 'number' } },
            },
            'DELETE /api/torrents/:infoHash': {
              description: 'Remove torrent',
              query: { deleteFiles: 'true|false' },
              response: { success: true, message: 'string' },
            },
            'GET /api/torrents': {
              description: 'List all active torrents',
              response: { success: true, data: { total: 'number', torrents: 'array' } },
            },
          },
          streaming: {
            'GET /stream/proxy/:infoHash': {
              description: 'Stream file with Range Request support',
              query: { fileIndex: 'number', download: 'true|false' },
              headers: { Range: 'bytes=start-end' },
              response: 'Video stream (206 Partial Content or 200 OK)',
            },
            'GET /stream/file/:infoHash/:fileIndex': {
              description: 'Stream specific file by index',
              response: 'Redirects to /stream/proxy/:infoHash?fileIndex=:fileIndex',
            },
            'GET /stream/info/:infoHash': {
              description: 'Get streamable files info',
              response: { success: true, data: { infoHash: 'string', files: 'array' } },
            },
          },
          cache: {
            'GET /api/cache-stats': {
              description: 'Get cache statistics',
              response: { success: true, data: { backend: 'string', size: 'number', diskUsage: 'number', scalingInfo: 'object' } },
            },
            'GET /api/cache-config': {
              description: 'Get cache configuration',
              response: { success: true, data: { backend: 'string', maxSize: 'number', currentSize: 'number' } },
            },
            'POST /api/cache-config': {
              description: 'Force cache cleanup',
              body: { forceCleanup: true },
              response: { success: true, message: 'string', data: 'object' },
            },
          },
        },
        features: [
          'WebTorrent integration',
          'HTTP Range Request support (206 Partial Content)',
          'Sequential download for faster streaming',
          'LRU cache with multiple backends (Memory/SQLite/Redis)',
          'DHT and tracker connectivity',
          '60-second timeout with retry logic',
          'Multi-file torrent support',
          'iOS and mobile optimization',
        ],
      });
    });

    // Mount API routers
    const torrentRouter = createTorrentRouter(this.torrentService, this.cacheManager);
    const streamingRouter = createStreamingRouter(this.torrentService, this.cacheManager);

    this.app.use('/api', torrentRouter);
    this.app.use('/', streamingRouter);

    // Health check
    this.app.get('/health', (req, res) => {
      try {
        const torrentStats = this.torrentService.getClientStats();
        const cacheStats = this.cacheManager.getStats();

        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          services: {
            torrent: {
              status: 'running',
              activeTorrents: torrentStats.activeTorrents,
              downloadSpeed: torrentStats.downloadSpeed,
              uploadSpeed: torrentStats.uploadSpeed,
              dht: {
                enabled: torrentStats.dhtEnabled,
                nodes: torrentStats.dhtNodes,
              },
            },
            cache: {
              status: 'running',
              backend: cacheStats.backend,
              size: cacheStats.size,
              maxSize: cacheStats.maxSize,
              diskUsage: cacheStats.diskUsage,
              diskUsagePercent: cacheStats.diskUsagePercent,
            },
          },
          config: {
            port: this.port,
            timeout: config.torrent.timeout,
            maxRetries: config.torrent.maxRetries,
            cacheBackend: config.cache.backend,
          },
        });
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: error.message,
        });
      }
    });

    // Status endpoint
    this.app.get('/status', (req, res) => {
      const stats = this.torrentService.getClientStats();
      res.json({
        success: true,
        status: 'online',
        torrents: {
          active: stats.activeTorrents,
          details: stats.torrents,
        },
        dht: {
          enabled: stats.dhtEnabled,
          nodes: stats.dhtNodes,
        },
        cache: this.cacheManager.getStats(),
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        message: 'The requested endpoint does not exist',
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);

      if (res.headersSent) {
        return next(err);
      }

      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
    });

    // Process error handlers
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      this.shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, '0.0.0.0', () => {
          logger.info(`🚀 Torrent Streaming Server started on port ${this.port}`);
          logger.info(`📺 Home: http://localhost:${this.port}`);
          logger.info(`📡 API: http://localhost:${this.port}/api`);
          logger.info(`🎥 Stream: http://localhost:${this.port}/stream/proxy/:infoHash`);
          logger.info(`💾 Cache Backend: ${config.cache.backend}`);
          logger.info(`📊 Health Check: http://localhost:${this.port}/health`);
          resolve();
        });

        this.server.on('error', (err) => {
          logger.error('Server error:', err);
          reject(err);
        });
      } catch (error) {
        logger.error('Failed to start server:', error);
        reject(error);
      }
    });
  }

  async shutdown() {
    logger.info('Shutting down server...');

    // Stop accepting new connections
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }

    // Cleanup services
    if (this.torrentService) {
      await this.torrentService.shutdown();
    }

    if (this.cacheManager) {
      this.cacheManager.stop();
    }

    logger.info('Server shutdown complete');
    process.exit(0);
  }
}

// Start server if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new TorrentStreamingServer({
    port: process.env.PORT || 7000,
  });

  server.start().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default TorrentStreamingServer;
