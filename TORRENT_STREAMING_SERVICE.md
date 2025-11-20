# 🎬 Torrent Streaming Service

A comprehensive self-hosted torrent streaming service built with Node.js and WebTorrent. Stream torrents directly through HTTP with full Range Request support, intelligent caching, and optimized for video playback.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Testing](#testing)
- [Performance](#performance)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

---

## 🌟 Overview

This torrent streaming service accepts magnet links or torrent info hashes, downloads content via BitTorrent protocol (DHT + trackers), and streams it over HTTP with full Range Request support (206 Partial Content). Perfect for building your own streaming platform similar to Real-Debrid or Premiumize.

### Key Capabilities

- ✅ **WebTorrent Integration** - Pure JavaScript BitTorrent client
- ✅ **HTTP Range Requests** - Full 206 Partial Content support for seeking
- ✅ **Sequential Download** - Optimized for streaming (start-to-finish)
- ✅ **Smart Caching** - LRU cache with Memory/SQLite/Redis backends
- ✅ **DHT + Trackers** - 30+ high-quality trackers + DHT bootstrap
- ✅ **60s Timeout** - Fast-fail for dead torrents
- ✅ **Retry Logic** - Exponential backoff (3 retries by default)
- ✅ **Multi-File Support** - Handle torrents with multiple files
- ✅ **iOS Optimized** - Mobile-friendly streaming
- ✅ **Progress Tracking** - Real-time download progress
- ✅ **RESTful API** - Complete CRUD operations

---

## ✨ Features

### 1. Torrent Management

**Accept Multiple Input Formats:**
- Magnet links: `magnet:?xt=urn:btih:...`
- Info hashes: `dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c`
- .torrent files (coming soon)

**Smart Download Strategy:**
- Connect to DHT and 30+ reliable trackers
- 60-second timeout for peer discovery
- Retry with exponential backoff (1s, 2s, 4s...)
- Sequential download for faster playback start
- Pre-buffer 5-10% before streaming

**Progress Monitoring:**
- Real-time download progress (0-100%)
- Peer count and connection status
- Download/upload speeds
- Time remaining estimation
- Per-file progress for multi-file torrents

### 2. Smart Cache System

**Multi-Backend Support:**

| Backend | Use Case | Persistence | Scalability |
|---------|----------|-------------|-------------|
| **Memory** | Development, testing | ❌ No | Limited |
| **SQLite** | Small deployments (1-10 users) | ✅ Yes | Medium |
| **Redis** | Production (10+ users) | ✅ Yes | High |

**Intelligent Management:**
- **LRU Eviction** - Automatically removes least recently used files
- **Disk Limits** - Configurable max disk usage (default: 5GB)
- **File Count Limits** - Max number of cached files (default: 1000)
- **Auto Cleanup** - Scheduled cleanup every 5 minutes
- **TTL Support** - Time-to-live for cached items (default: 1 hour)
- **Persistent Storage** - Optional cache persistence across restarts

**Cache Flow:**
```
1. Request arrives with infoHash
2. Check cache → Found? Stream immediately (instant playback)
3. Not found? Start torrent download
4. Stream while downloading (progressive)
5. Save to cache when complete
6. Update lastAccessed timestamp
7. If cache full → Evict oldest files
```

### 3. HTTP Streaming Server

**Full Range Request Support:**
- `Accept-Ranges: bytes` - Advertise byte-range support
- `Content-Range: bytes 0-1023/2048` - Partial content headers
- `206 Partial Content` - Proper HTTP status codes
- Multiple range support for adaptive bitrate

**Streaming Optimization:**
- **Stream While Downloading** - Don't wait for completion
- **Sequential Priority** - Download from start for faster playback
- **Adaptive Buffering** - Adjust buffer based on connection speed
- **iOS Compatible** - Proper headers for iOS/Safari
- **Seeking Support** - Jump to any position instantly
- **CORS Enabled** - Cross-origin streaming support

**Supported Formats:**
- **Video**: MP4, MKV, AVI, WebM, MOV, FLV, M4V, WMV, MPG
- **Audio**: MP3, WAV, OGG, FLAC, M4A
- **Subtitles**: SRT, VTT, ASS, SSA

### 4. REST API

Complete RESTful API with JSON responses:

**Torrent Endpoints:**
- `POST /api/torrents` - Add new torrent
- `GET /api/torrents/:infoHash` - Get torrent status
- `GET /api/torrents/:infoHash/files` - List files
- `DELETE /api/torrents/:infoHash` - Remove torrent
- `GET /api/torrents` - List all torrents

**Streaming Endpoints:**
- `GET /stream/proxy/:infoHash` - Stream with Range support
- `GET /stream/file/:infoHash/:fileIndex` - Stream specific file
- `GET /stream/info/:infoHash` - Get streamable files info

**Cache Endpoints:**
- `GET /api/cache-stats` - Cache statistics
- `GET /api/cache-config` - Cache configuration
- `POST /api/cache-config` - Force cleanup

**System Endpoints:**
- `GET /health` - Health check
- `GET /status` - System status
- `GET /` - Web interface
- `GET /docs` - API documentation

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser/App)                  │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/HTTPS
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Express Server (Port 7000)             │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Streaming API (Range Request Handler)             │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  Torrent API (CRUD Operations)                     │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  Cache API (Management & Stats)                    │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  TorrentService (WebTorrent)             │
│  • Magnet link handling                                  │
│  • DHT connectivity                                      │
│  • Tracker management                                    │
│  • Sequential download                                   │
│  • Progress tracking                                     │
│  • Retry logic                                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              ScalableCacheManager                        │
│  ┌──────────────┬──────────────┬──────────────┐        │
│  │   Memory     │    SQLite    │    Redis     │        │
│  │   Backend    │    Backend   │    Backend   │        │
│  └──────────────┴──────────────┴──────────────┘        │
│  • LRU eviction                                          │
│  • Disk usage monitoring                                │
│  • Auto cleanup                                          │
│  • Persistence                                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              File System (./temp/)                       │
│  • Downloaded torrent files                             │
│  • Cache index (SQLite)                                  │
│  • Metadata storage                                      │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

**Adding a Torrent:**
```
1. Client sends POST /api/torrents with magnet link
2. Extract infoHash from magnet URI
3. Check cache → if exists, return immediately
4. WebTorrent adds torrent with all trackers
5. Connect to DHT and trackers
6. Wait up to 60s for first peer
7. On metadata received, start sequential download
8. Return torrent info to client
9. Client can start streaming immediately
```

**Streaming a File:**
```
1. Client sends GET /stream/proxy/:infoHash
2. Check cache for file
   └─ Found → Stream from disk
   └─ Not found → Start torrent download
3. Parse Range header (if present)
4. Set appropriate headers:
   - Content-Range: bytes start-end/total
   - Accept-Ranges: bytes
   - Content-Type: video/mp4
5. Create read stream from file or torrent
6. Pipe stream to response
7. Update cache access time
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** or **yarn**
- **Open ports** 6881-6889 (BitTorrent)
- **Disk space** for cache (5GB+ recommended)

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Create environment file:**
```bash
cp example.env .env
```

3. **Configure settings (optional):**
```env
PORT=7000
CACHE_BACKEND=memory        # or sqlite, redis
CACHE_MAX_SIZE=1000         # max cached files
CACHE_MAX_DISK_MB=5000      # max 5GB disk usage
TORRENT_TIMEOUT=60000       # 60s timeout
TORRENT_MAX_RETRIES=3       # retry attempts
```

4. **Start the server:**
```bash
npm start
```

5. **Access the service:**
- Web Interface: http://localhost:7000
- Test Interface: http://localhost:7000/test-torrent-streaming
- API Docs: http://localhost:7000/docs
- Health Check: http://localhost:7000/health

### First Torrent

**Using curl:**
```bash
# Add a torrent
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'

# Stream it
curl -I http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

**Using the test interface:**
1. Open http://localhost:7000/test-torrent-streaming
2. Click "Show Examples"
3. Select "Big Buck Bunny"
4. Click "Add Torrent"
5. Wait for download to start
6. Click "Stream Video"

---

## 📚 API Reference

### Torrent Management

#### Add Torrent

**Endpoint:** `POST /api/torrents`

**Request:**
```json
{
  "magnetUri": "magnet:?xt=urn:btih:HASH",
  "infoHash": "optional_direct_hash",
  "name": "optional_torrent_name"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "infoHash": "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
    "name": "Big Buck Bunny",
    "cached": false,
    "files": [
      {
        "name": "big_buck_bunny_1080p.mp4",
        "path": "big_buck_bunny_1080p.mp4",
        "length": 725106140
      }
    ],
    "message": "Torrent added successfully"
  }
}
```

**Response (Cached):**
```json
{
  "success": true,
  "data": {
    "infoHash": "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
    "cached": true,
    "files": [...],
    "message": "Torrent found in cache"
  }
}
```

#### Get Torrent Status

**Endpoint:** `GET /api/torrents/:infoHash`

**Response:**
```json
{
  "success": true,
  "data": {
    "infoHash": "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
    "name": "Big Buck Bunny",
    "status": "downloading",
    "progress": "45.23",
    "downloadSpeed": 2097152,
    "uploadSpeed": 524288,
    "downloaded": 327680000,
    "uploaded": 102400000,
    "numPeers": 15,
    "timeRemaining": 180000,
    "files": [...]
  }
}
```

**Status Values:**
- `connecting` - Searching for peers
- `connected` - Connected to peers
- `downloading` - Actively downloading
- `complete` - Download finished

#### List Files in Torrent

**Endpoint:** `GET /api/torrents/:infoHash/files`

**Response:**
```json
{
  "success": true,
  "data": {
    "infoHash": "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
    "files": [
      {
        "index": 0,
        "name": "movie.mp4",
        "path": "folder/movie.mp4",
        "length": 725106140,
        "downloaded": 362553070,
        "progress": "50.00"
      }
    ],
    "count": 1
  }
}
```

#### Remove Torrent

**Endpoint:** `DELETE /api/torrents/:infoHash?deleteFiles=true`

**Query Parameters:**
- `deleteFiles` - Boolean, delete files from disk (default: false)

**Response:**
```json
{
  "success": true,
  "message": "Torrent removed successfully",
  "data": {
    "infoHash": "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
    "deletedFiles": true
  }
}
```

#### List All Torrents

**Endpoint:** `GET /api/torrents`

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 3,
    "downloadSpeed": 4194304,
    "uploadSpeed": 1048576,
    "torrents": [
      {
        "infoHash": "...",
        "name": "Movie 1",
        "progress": "100.00",
        "peers": 25,
        "downloadSpeed": 0,
        "uploadSpeed": 524288
      }
    ],
    "dht": {
      "enabled": true,
      "nodes": 156
    }
  }
}
```

### Streaming

#### Stream File

**Endpoint:** `GET /stream/proxy/:infoHash?fileIndex=0`

**Query Parameters:**
- `fileIndex` - Integer, file index to stream (default: 0, largest file)
- `download` - Boolean, force download instead of stream

**Request Headers:**
- `Range: bytes=0-1023` - Optional, for partial content

**Response (Full Content):**
```
HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Length: 725106140
Accept-Ranges: bytes
Cache-Control: public, max-age=3600
Access-Control-Allow-Origin: *

[video data]
```

**Response (Partial Content):**
```
HTTP/1.1 206 Partial Content
Content-Type: video/mp4
Content-Range: bytes 0-1023/725106140
Content-Length: 1024
Accept-Ranges: bytes

[partial video data]
```

#### Stream Specific File by Index

**Endpoint:** `GET /stream/file/:infoHash/:fileIndex`

**Response:** Redirects to `/stream/proxy/:infoHash?fileIndex=:fileIndex`

#### Get Stream Info

**Endpoint:** `GET /stream/info/:infoHash`

**Response:**
```json
{
  "success": true,
  "data": {
    "infoHash": "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
    "totalFiles": 5,
    "videoFiles": 1,
    "files": [
      {
        "index": 0,
        "name": "movie.mp4",
        "length": 725106140,
        "streamUrl": "/stream/file/dd8255.../0",
        "isVideo": true
      }
    ]
  }
}
```

### Cache Management

#### Get Cache Stats

**Endpoint:** `GET /api/cache-stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "backend": "memory",
    "size": 25,
    "maxSize": 1000,
    "diskUsage": 1234.56,
    "maxDiskUsage": 5000,
    "diskUsagePercent": "24.69",
    "cleanupInterval": 300,
    "scalingInfo": {
      "backend": "memory",
      "isScalable": false,
      "supportsPersistence": false,
      "recommendedForProduction": false
    }
  }
}
```

#### Get Cache Config

**Endpoint:** `GET /api/cache-config`

**Response:**
```json
{
  "success": true,
  "data": {
    "backend": "memory",
    "maxSize": 1000,
    "currentSize": 25,
    "maxDiskUsage": 5000,
    "currentDiskUsage": 1234.56,
    "diskUsagePercent": "24.69",
    "cleanupInterval": 300,
    "ttl": 3600
  }
}
```

#### Force Cache Cleanup

**Endpoint:** `POST /api/cache-config`

**Request:**
```json
{
  "forceCleanup": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cache cleaned successfully",
  "data": {
    "cleanedCount": 15,
    "freedSpaceMB": 987.65,
    "finalSize": 10,
    "finalDiskUsage": 246.91
  }
}
```

### System

#### Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "services": {
    "torrent": {
      "status": "running",
      "activeTorrents": 3,
      "downloadSpeed": 4194304,
      "uploadSpeed": 1048576,
      "dht": {
        "enabled": true,
        "nodes": 156
      }
    },
    "cache": {
      "status": "running",
      "backend": "memory",
      "size": 25,
      "maxSize": 1000,
      "diskUsage": "24.69%"
    }
  },
  "config": {
    "port": 7000,
    "timeout": 60000,
    "maxRetries": 3,
    "cacheBackend": "memory"
  }
}
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=7000                           # Server port
NODE_ENV=production                 # Environment (development/production)

# Cache Configuration
CACHE_BACKEND=memory                # Backend: memory, sqlite, redis
CACHE_TTL=3600                      # Cache TTL in seconds (1 hour)
CACHE_MAX_SIZE=1000                 # Max number of cached files
CACHE_MAX_DISK_MB=5000              # Max disk usage in MB (5GB)
CACHE_CLEANUP_INTERVAL=300          # Cleanup interval in seconds (5 min)
CACHE_PERSISTENT=false              # Enable persistent cache storage

# Torrent Configuration
TORRENT_TIMEOUT=60000               # Connection timeout in ms (60s)
TORRENT_MAX_RETRIES=3               # Max retry attempts
TORRENT_MAX_CONNECTIONS=25          # Max peer connections
TORRENT_DOWNLOAD_LIMIT=0            # Download limit (0 = unlimited)
TORRENT_UPLOAD_LIMIT=0              # Upload limit (0 = unlimited)

# Redis Configuration (if using Redis backend)
REDIS_URL=redis://localhost:6379    # Redis connection URL
REDIS_PASSWORD=                     # Redis password (optional)

# Logging
LOG_LEVEL=info                      # Log level: debug, info, warn, error
```

### Configuration Profiles

#### Development
```env
PORT=7000
CACHE_BACKEND=memory
CACHE_MAX_SIZE=100
CACHE_MAX_DISK_MB=1000
LOG_LEVEL=debug
NODE_ENV=development
```

#### Small Production (1-10 users)
```env
PORT=7000
CACHE_BACKEND=sqlite
CACHE_MAX_SIZE=1000
CACHE_MAX_DISK_MB=5000
CACHE_PERSISTENT=true
LOG_LEVEL=info
NODE_ENV=production
```

#### Large Production (10+ users)
```env
PORT=7000
CACHE_BACKEND=redis
CACHE_MAX_SIZE=10000
CACHE_MAX_DISK_MB=50000
CACHE_PERSISTENT=true
REDIS_URL=redis://localhost:6379
LOG_LEVEL=warn
NODE_ENV=production
```

### Firewall Configuration

**Required Ports:**
- **6881-6889 TCP/UDP** - BitTorrent connections
- **7000 TCP** - HTTP server (configurable)

**Linux (UFW):**
```bash
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp
sudo ufw allow 7000/tcp
```

**Linux (iptables):**
```bash
iptables -A INPUT -p tcp --dport 6881:6889 -j ACCEPT
iptables -A INPUT -p udp --dport 6881:6889 -j ACCEPT
iptables -A INPUT -p tcp --dport 7000 -j ACCEPT
```

**Docker:**
```yaml
ports:
  - "7000:7000"
  - "6881-6889:6881-6889/tcp"
  - "6881-6889:6881-6889/udp"
```

---

## 🚢 Deployment

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Expose ports
EXPOSE 7000
EXPOSE 6881-6889

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:7000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "src/torrentServer.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  torrent-streaming:
    build: .
    ports:
      - "7000:7000"
      - "6881-6889:6881-6889/tcp"
      - "6881-6889:6881-6889/udp"
    environment:
      - PORT=7000
      - CACHE_BACKEND=sqlite
      - CACHE_MAX_SIZE=1000
      - CACHE_MAX_DISK_MB=5000
      - NODE_ENV=production
    volumes:
      - ./temp:/app/temp
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - torrent-net

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - torrent-net

networks:
  torrent-net:
    driver: bridge

volumes:
  redis-data:
```

**Commands:**
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build
```

### Reverse Proxy (nginx)

```nginx
upstream torrent_backend {
    server localhost:7000;
    keepalive 64;
}

server {
    listen 80;
    server_name torrents.example.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name torrents.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Streaming optimizations
    proxy_buffering off;
    proxy_cache off;
    proxy_request_buffering off;
    
    # Timeouts for long-running requests
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;

    location / {
        proxy_pass http://torrent_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Streaming endpoint with range support
    location ~ ^/stream/ {
        proxy_pass http://torrent_backend;
        proxy_http_version 1.1;
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_cache off;
        proxy_buffering off;
    }
}
```

### Systemd Service

**/etc/systemd/system/torrent-streaming.service:**
```ini
[Unit]
Description=Torrent Streaming Service
After=network.target

[Service]
Type=simple
User=torrent
WorkingDirectory=/opt/torrent-streaming
Environment="NODE_ENV=production"
Environment="PORT=7000"
ExecStart=/usr/bin/node src/torrentServer.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/torrent-streaming/temp /opt/torrent-streaming/logs

[Install]
WantedBy=multi-user.target
```

**Commands:**
```bash
# Enable and start
sudo systemctl enable torrent-streaming
sudo systemctl start torrent-streaming

# Status
sudo systemctl status torrent-streaming

# Logs
sudo journalctl -u torrent-streaming -f

# Restart
sudo systemctl restart torrent-streaming
```

---

## 🧪 Testing

### Manual Testing

**Test Interface:**
Open http://localhost:7000/test-torrent-streaming for comprehensive testing UI.

**curl Commands:**
```bash
# Add torrent
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'

# Get status
curl http://localhost:7000/api/torrents/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c

# Stream (with range)
curl -H "Range: bytes=0-1023" \
  http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c

# Cache stats
curl http://localhost:7000/api/cache-stats

# Health check
curl http://localhost:7000/health
```

### Testing Checklist

- [ ] ✅ Torrent downloads successfully
- [ ] ✅ Cache works (second request is instant)
- [ ] ✅ Range Requests work (video seeking/scrubbing)
- [ ] ✅ Cleanup deletes old files
- [ ] ✅ DHT connects to peers
- [ ] ✅ Timeout works for dead torrents
- [ ] ✅ Multiple concurrent streams supported
- [ ] ✅ Works on mobile devices (iOS/Android)
- [ ] ✅ Progress reporting accurate
- [ ] ✅ Error handling for network failures

### Public Test Torrents

Use these legal, public domain torrents for testing:

**Big Buck Bunny (Open Source):**
```
Info Hash: dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
Size: ~700MB
Magnet: magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

**Sintel (Open Source):**
```
Info Hash: 08ada5a7a6183aae1e09d831df6748d566095a10
Size: ~900MB
Magnet: magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10
```

---

## ⚡ Performance

### Optimization Tips

**1. Use Redis for Production:**
```env
CACHE_BACKEND=redis
REDIS_URL=redis://localhost:6379
```

**2. Increase Cache Limits:**
```env
CACHE_MAX_SIZE=10000
CACHE_MAX_DISK_MB=50000
```

**3. Adjust Timeouts:**
```env
TORRENT_TIMEOUT=120000  # 2 minutes for slow networks
TORRENT_MAX_RETRIES=5    # More retries
```

**4. Enable Persistent Cache:**
```env
CACHE_PERSISTENT=true
```

**5. Use SSD for Cache:**
Mount an SSD at `./temp` for faster I/O.

### Performance Metrics

**Expected Performance:**
- **Cache Hit (instant)**: < 100ms response time
- **First Stream (uncached)**: 5-30s to first byte (depends on peers)
- **Concurrent Streams**: 50+ with Redis backend
- **Memory Usage**: ~100-500MB (depends on active torrents)
- **Disk I/O**: ~50-200 MB/s (depends on drive)

**Bottlenecks:**
1. **Peer Discovery**: Slow if torrent is unpopular
2. **Disk I/O**: Use SSD for better performance
3. **Network Bandwidth**: Ensure sufficient upload/download bandwidth
4. **CPU**: WebTorrent is CPU-intensive for multiple streams

---

## 🔒 Security

### Security Best Practices

**1. Authentication (Recommended):**
Add token-based authentication to protect your service:

```javascript
// Add to middleware
app.use((req, res, next) => {
  const token = req.headers['authorization'];
  if (token !== `Bearer ${process.env.API_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

**2. Rate Limiting:**
```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});

app.use('/api/', limiter);
```

**3. HTTPS Only:**
Always use HTTPS in production (via nginx or Cloudflare).

**4. Input Validation:**
The service validates all magnet links and info hashes.

**5. File Path Sanitization:**
All file paths are sanitized to prevent directory traversal.

**6. CORS Configuration:**
Adjust CORS settings based on your needs:

```javascript
app.use(cors({
  origin: 'https://yourdomain.com',  // Specific origin
  credentials: true,
}));
```

### Security Considerations

⚠️ **Warning:** This service allows downloading and streaming any torrent. Consider:

1. **Legal Compliance**: Ensure compliance with copyright laws
2. **Content Filtering**: Implement content filtering if needed
3. **User Quotas**: Limit per-user bandwidth/storage
4. **Monitoring**: Monitor for abuse
5. **Private Use**: Best for personal/private use

---

## 🔧 Troubleshooting

### Common Issues

#### 1. No Peers Found / Timeout

**Symptoms:**
```
Timeout: No peers found after 60 seconds
```

**Solutions:**
- Check firewall: Allow ports 6881-6889 TCP/UDP
- Verify torrent is still seeded (try on another client)
- Increase timeout: `TORRENT_TIMEOUT=120000`
- Check DHT status: `curl http://localhost:7000/status`

#### 2. Streaming Doesn't Start

**Symptoms:**
Video player shows loading indefinitely

**Solutions:**
- Check browser console for errors
- Verify CORS headers: `curl -I http://localhost:7000/stream/proxy/HASH`
- Test direct link: Open stream URL in browser
- Check if file exists in cache: `curl http://localhost:7000/api/cache-stats`

#### 3. Range Requests Not Working

**Symptoms:**
Video seeking doesn't work, can't skip forward

**Solutions:**
- Verify Accept-Ranges header:
  ```bash
  curl -I http://localhost:7000/stream/proxy/HASH
  # Should show: Accept-Ranges: bytes
  ```
- Check if nginx/proxy passes Range headers
- Test with curl:
  ```bash
  curl -H "Range: bytes=0-1023" http://localhost:7000/stream/proxy/HASH
  ```

#### 4. High Memory Usage

**Symptoms:**
Node process using too much RAM

**Solutions:**
- Reduce max connections: `TORRENT_MAX_CONNECTIONS=15`
- Limit active torrents (remove old ones)
- Use Redis backend: `CACHE_BACKEND=redis`
- Restart service periodically

#### 5. Disk Full

**Symptoms:**
```
Error: ENOSPC: no space left on device
```

**Solutions:**
- Force cleanup: `curl -X POST http://localhost:7000/api/cache-config -d '{"forceCleanup":true}'`
- Reduce cache size: `CACHE_MAX_DISK_MB=2000`
- Remove old torrents manually from `./temp/`

#### 6. DHT Not Connecting

**Symptoms:**
DHT nodes = 0 in status

**Solutions:**
- Wait 2-3 minutes for DHT bootstrap
- Check if ports are open: `sudo netstat -tulpn | grep 6881`
- Restart service
- Check logs for DHT errors

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

View detailed logs:
```bash
# Production (systemd)
sudo journalctl -u torrent-streaming -f

# Docker
docker-compose logs -f

# Development
npm start
```

### Getting Help

1. **Check health endpoint**: `curl http://localhost:7000/health`
2. **Review logs** for error messages
3. **Test with known-good torrents** (Big Buck Bunny)
4. **Verify network connectivity** (ping trackers)
5. **Check disk space**: `df -h`
6. **Monitor resources**: `htop` or `docker stats`

---

## 📊 Monitoring

### Metrics to Monitor

**System Health:**
- `/health` - Overall health status
- `/status` - Detailed system status
- `/api/cache-stats` - Cache performance

**Key Metrics:**
- Active torrents count
- DHT node count
- Download/upload speeds
- Cache hit rate
- Disk usage percentage
- Memory usage
- CPU usage

### Prometheus Integration (Optional)

Add prometheus metrics:

```bash
npm install prom-client
```

```javascript
import promClient from 'prom-client';

const register = new promClient.Registry();

const torrentsActive = new promClient.Gauge({
  name: 'torrents_active_total',
  help: 'Number of active torrents',
  registers: [register]
});

app.get('/metrics', async (req, res) => {
  torrentsActive.set(torrentService.getClientStats().activeTorrents);
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## 📝 License

This software is provided for personal use only. See LICENSE file for details.

---

## 🙏 Credits

Built with:
- [WebTorrent](https://webtorrent.io/) - Streaming torrent client for Node.js
- [Express](https://expressjs.com/) - Web framework
- [pump](https://github.com/mafintosh/pump) - Pipe streams together and close all on error

---

## 📧 Support

For issues and questions:
1. Check this documentation
2. Review troubleshooting section
3. Test with example torrents
4. Check server logs

---

**Made with ❤️ for the streaming community**