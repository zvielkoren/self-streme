#!/usr/bin/env node

/**
 * Quick Start Script for Torrent Streaming Server
 * This script starts the torrent streaming server with proper initialization
 */

import TorrentStreamingServer from '../src/torrentServer.js';
import logger from '../src/utils/logger.js';
import { config } from '../src/config/index.js';
import fs from 'fs';
import path from 'path';

// ASCII Art Banner
const banner = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        🎬  TORRENT STREAMING SERVICE  🎬                     ║
║                                                               ║
║        Self-hosted torrent streaming with WebTorrent          ║
║        Stream torrents over HTTP with Range Request support   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`;

console.log('\x1b[36m%s\x1b[0m', banner);

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('\x1b[31m%s\x1b[0m', `❌ Error: Node.js 18 or higher is required (current: ${nodeVersion})`);
  console.error('   Please upgrade Node.js: https://nodejs.org/');
  process.exit(1);
}

console.log('\x1b[32m%s\x1b[0m', `✅ Node.js version: ${nodeVersion}`);

// Ensure required directories exist
const requiredDirs = [
  config.torrent.downloadPath || './temp',
  './logs',
  './data'
];

console.log('\n📁 Checking directories...');
for (const dir of requiredDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`   ✅ Created: ${dir}`);
  } else {
    console.log(`   ✓ Exists: ${dir}`);
  }
}

// Display configuration
console.log('\n⚙️  Configuration:');
console.log(`   Port: ${config.server.port}`);
console.log(`   Cache Backend: ${config.cache.backend}`);
console.log(`   Cache Size: ${config.cache.maxSize} files`);
console.log(`   Cache Disk: ${config.cache.maxDiskUsage} MB`);
console.log(`   Torrent Timeout: ${config.torrent.timeout / 1000}s`);
console.log(`   Max Retries: ${config.torrent.maxRetries}`);
console.log(`   Max Connections: ${config.torrent.maxConnections}`);
console.log(`   DHT Enabled: Yes`);
console.log(`   Trackers: ${config.torrent.trackers.length}`);

// Firewall reminder
console.log('\n🔥 Firewall Requirements:');
console.log(`   • Port ${config.server.port} (TCP) - HTTP Server`);
console.log('   • Ports 6881-6889 (TCP/UDP) - BitTorrent');
console.log('\n   Linux: sudo ufw allow 6881:6889/tcp && sudo ufw allow 6881:6889/udp');
console.log(`   Linux: sudo ufw allow ${config.server.port}/tcp`);

// Storage check
const checkDiskSpace = () => {
  try {
    const tempPath = config.torrent.downloadPath || './temp';
    if (fs.existsSync(tempPath)) {
      const stats = fs.statSync(tempPath);
      console.log(`\n💾 Storage Path: ${path.resolve(tempPath)}`);
    }
  } catch (error) {
    console.warn('   ⚠️  Could not check storage path');
  }
};

checkDiskSpace();

// Start server
console.log('\n🚀 Starting Torrent Streaming Server...\n');

const server = new TorrentStreamingServer({
  port: config.server.port,
});

// Handle startup errors
process.on('uncaughtException', (error) => {
  console.error('\x1b[31m%s\x1b[0m', '❌ Fatal Error:', error.message);
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\x1b[31m%s\x1b[0m', '❌ Unhandled Rejection:', reason);
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the server
server.start()
  .then(() => {
    console.log('\x1b[32m%s\x1b[0m', '\n✅ Server started successfully!\n');

    console.log('📍 Access Points:');
    console.log(`   Home Page:     http://localhost:${config.server.port}/`);
    console.log(`   Test UI:       http://localhost:${config.server.port}/test-torrent-streaming`);
    console.log(`   API Docs:      http://localhost:${config.server.port}/docs`);
    console.log(`   Health Check:  http://localhost:${config.server.port}/health`);
    console.log(`   Cache Stats:   http://localhost:${config.server.port}/api/cache-stats`);

    console.log('\n📡 API Endpoints:');
    console.log(`   POST   /api/torrents                - Add torrent`);
    console.log(`   GET    /api/torrents/:hash          - Get status`);
    console.log(`   GET    /api/torrents/:hash/files    - List files`);
    console.log(`   DELETE /api/torrents/:hash          - Remove torrent`);
    console.log(`   GET    /stream/proxy/:hash          - Stream file`);

    console.log('\n💡 Quick Start:');
    console.log('   1. Open test interface in your browser');
    console.log(`   2. Or use curl to add a torrent:`);
    console.log(`\n      curl -X POST http://localhost:${config.server.port}/api/torrents \\`);
    console.log(`        -H "Content-Type: application/json" \\`);
    console.log(`        -d '{"magnetUri": "magnet:?xt=urn:btih:YOUR_HASH"}'`);

    console.log('\n📊 Monitoring:');
    console.log(`   curl http://localhost:${config.server.port}/health`);
    console.log(`   curl http://localhost:${config.server.port}/status`);
    console.log(`   curl http://localhost:${config.server.port}/api/cache-stats`);

    console.log('\n🛑 Stop Server:');
    console.log('   Press Ctrl+C to stop the server\n');

    // Show example torrents
    console.log('🎬 Test with Public Domain Torrents:');
    console.log('   Big Buck Bunny: dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c');
    console.log('   Sintel:         08ada5a7a6183aae1e09d831df6748d566095a10');
    console.log('');
  })
  .catch((error) => {
    console.error('\x1b[31m%s\x1b[0m', '\n❌ Failed to start server:', error.message);
    logger.error('Server startup failed:', error);
    process.exit(1);
  });

// Graceful shutdown handler
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('\n⚠️  Force shutdown...');
    process.exit(1);
  }

  isShuttingDown = true;
  console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...`);

  try {
    await server.shutdown();
    console.log('✅ Server stopped successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Display help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node start-torrent-server.js [options]

Options:
  --help, -h     Show this help message
  --version, -v  Show version information

Environment Variables:
  PORT                    Server port (default: 7000)
  CACHE_BACKEND           Cache backend: memory, sqlite, redis (default: memory)
  CACHE_MAX_SIZE          Max cached files (default: 1000)
  CACHE_MAX_DISK_MB       Max disk usage in MB (default: 5000)
  TORRENT_TIMEOUT         Timeout in ms (default: 60000)
  TORRENT_MAX_RETRIES     Max retry attempts (default: 3)
  LOG_LEVEL               Log level: debug, info, warn, error (default: info)

Examples:
  # Start with default settings
  node start-torrent-server.js

  # Start with custom port
  PORT=8000 node start-torrent-server.js

  # Start with Redis cache
  CACHE_BACKEND=redis REDIS_URL=redis://localhost:6379 node start-torrent-server.js

  # Start with debug logging
  LOG_LEVEL=debug node start-torrent-server.js

Documentation:
  See TORRENT_STREAMING_SERVICE.md for complete documentation

Support:
  For issues, check the troubleshooting section in the documentation
  `);
  process.exit(0);
}

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  console.log('Torrent Streaming Service v1.0.0');
  console.log('Node.js:', process.version);
  console.log('Platform:', process.platform);
  process.exit(0);
}
