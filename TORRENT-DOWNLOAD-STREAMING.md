# Torrent Download and Streaming Guide

This document explains how the torrent download and streaming functionality works in self-streme.

## Overview

The system automatically downloads torrents to the server and streams them to clients. This enables:
- ✅ Streaming on devices that don't support magnet links (iOS, Smart TVs)
- ✅ Better performance with progressive download
- ✅ Seeking/skipping in videos while downloading
- ✅ Reuse of downloaded files for multiple requests

## How It Works

### 1. Download Location

Torrents are downloaded to: `./temp` (configurable)

```javascript
// In src/config/index.js
torrent: {
  downloadPath: "./temp"
}
```

### 2. Streaming Flow

```
Client Request → Download Torrent → Stream Video
                      ↓
                  ./temp/Movie.mkv
```

**Smart Streaming Strategy:**
- **0-10% downloaded**: Stream directly from torrent (progressive)
- **10-100% downloaded**: Stream from file on disk (better performance)
- **100% downloaded**: Stream from file on disk (best performance)

### 3. Automatic Cleanup

Files are automatically cleaned up after:
- 30 minutes of inactivity (configurable)
- Server shutdown
- Manual cleanup via cleanup() method

## Usage

### For iOS/Smart TV (HTTP Streaming)

Access the proxy endpoint:
```
GET http://localhost:7000/stream/proxy/{infoHash}
```

Example:
```bash
curl -H "Range: bytes=0-1000000" \
  http://localhost:7000/stream/proxy/453475aec9bb4de3423649db8aa3cd2312538ca7
```

### For Desktop/Android (Magnet Links)

Stremio receives magnet links and handles download/streaming natively.

## Configuration

### Environment Variables

```env
# Download path (default: ./temp)
TORRENT_DOWNLOAD_PATH=./temp

# Cleanup interval in ms (default: 30 minutes)
TORRENT_CLEANUP_INTERVAL=1800000

# Max simultaneous torrents (default: 25)
TORRENT_MAX_CONNECTIONS=25

# Timeout for finding peers (default: 2 minutes)
TORRENT_TIMEOUT=120000

# Max retry attempts (default: 4)
TORRENT_MAX_RETRIES=4
```

### Download Path Options

**Temporary Storage (Default):**
```env
TORRENT_DOWNLOAD_PATH=./temp
```
- Files deleted after inactivity
- Good for saving disk space
- Recommended for most users

**Persistent Storage:**
```env
TORRENT_DOWNLOAD_PATH=./media/torrents
TORRENT_CLEANUP_INTERVAL=0  # Disable cleanup
```
- Files kept permanently
- Good for building a library
- Requires more disk space

**Custom Location:**
```env
TORRENT_DOWNLOAD_PATH=/mnt/external/torrents
```
- Use external drive
- Good for large libraries

## Monitoring

### Check Download Status

Watch the logs to see download progress:

```bash
# Docker
docker-compose logs -f | grep -E "torrent|download|stream"

# Direct
npm start | grep -E "torrent|download|stream"
```

### Log Messages

**When download starts:**
```
info: Starting torrent stream for hash: 453475aec9bb...
info: Adding new torrent: magnet:?xt=urn:btih:453475...
info: Valid torrent object confirmed
```

**When torrent is ready:**
```
info: Torrent ready: Movie.mkv, files: 1
info: Selected file: Movie.mkv (2147483648 bytes)
info: Hash to video conversion successful
```

**When streaming from file:**
```
info: Using file stream for 453475...: ./temp/Movie.mkv
```

**When streaming from torrent:**
```
info: Using torrent stream for 453475... (file not ready)
debug: Download progress: 15.3%, peers: 8, speed: 2458000
```

### Check Downloaded Files

```bash
# List downloaded files
ls -lh temp/

# Check disk usage
du -sh temp/

# Watch downloads in real-time
watch -n 1 'ls -lh temp/ && du -sh temp/'
```

## Features

### Range Requests (Seeking)

The system supports HTTP range requests for seeking/skipping:

```http
GET /stream/proxy/453475aec9bb...
Range: bytes=1000000-2000000

Response:
HTTP/1.1 206 Partial Content
Content-Range: bytes 1000000-2000000/2147483648
Content-Length: 1000001
```

### Progressive Download

Video starts playing before download completes:

```
Download: 10% ─────────────────────────────────── 100%
          ↑
        Can start watching here
```

### Automatic File Detection

System automatically uses downloaded files:

1. First request: Downloads and streams from torrent
2. Second request: Streams from downloaded file
3. After 30 minutes: Cleans up file

### Cleanup on Demand

Manually trigger cleanup:

```bash
# Via HTTP endpoint (if you add one)
curl http://localhost:7000/admin/cleanup

# Via code
torrentService.cleanup();
```

## Troubleshooting

### Issue: Torrents not downloading

**Check:**
1. Download path exists and is writable
2. Firewall allows torrent ports (6881-6889)
3. Torrents have peers (check logs)

```bash
# Create download directory
mkdir -p temp
chmod 755 temp

# Allow torrent ports
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp
```

### Issue: Disk space full

**Solution:**
1. Reduce cleanup interval
2. Reduce max connections
3. Use external storage

```env
# Clean up every 5 minutes instead of 30
TORRENT_CLEANUP_INTERVAL=300000

# Reduce max torrents
TORRENT_MAX_CONNECTIONS=10
```

### Issue: Streaming buffering

**Possible causes:**
1. Slow download speed (few peers)
2. High disk I/O
3. Network congestion

**Solutions:**
```env
# Increase timeout for better peer discovery
TORRENT_TIMEOUT=180000

# Use SSD for download path
TORRENT_DOWNLOAD_PATH=/mnt/ssd/torrents
```

## Advanced

### Custom Download Path per Torrent

Modify `getStream()` to accept custom paths:

```javascript
async getStream(magnetUri, fileIdx = 0, retryCount = 0, customPath = null) {
  const downloadPath = customPath || config.torrent.downloadPath;
  
  torrent = this.client.add(magnetUri, {
    path: downloadPath,
    announce: config.torrent.trackers,
  });
}
```

### Pre-download on Stream Request

Add background download:

```javascript
// In streamService.js
async getStreams(type, imdbId, season, episode, userAgent, baseUrl) {
  const streams = // ... get streams
  
  // Pre-download first stream in background
  if (streams[0]?.infoHash) {
    this.preDownloadTorrent(streams[0].infoHash);
  }
  
  return streams;
}

async preDownloadTorrent(infoHash) {
  const magnetUri = `magnet:?xt=urn:btih:${infoHash}`;
  torrentService.getStream(magnetUri).catch(err => {
    logger.debug(`Pre-download failed: ${err.message}`);
  });
}
```

### Keep Popular Torrents

Implement a popularity tracker:

```javascript
class TorrentService {
  constructor() {
    this.popularityScores = new Map();
  }
  
  cleanup() {
    // Don't clean up popular torrents
    for (const [magnetUri, stream] of this.activeTorrents.entries()) {
      const score = this.popularityScores.get(magnetUri) || 0;
      if (score < 10) { // Only cleanup if accessed < 10 times
        // cleanup logic
      }
    }
  }
}
```

## Best Practices

1. **Monitor disk usage regularly**
   ```bash
   du -sh temp/
   ```

2. **Set appropriate cleanup interval**
   - High traffic: 15-30 minutes
   - Low traffic: 60+ minutes

3. **Use SSD for better performance**
   ```env
   TORRENT_DOWNLOAD_PATH=/mnt/ssd/torrents
   ```

4. **Monitor logs for errors**
   ```bash
   docker-compose logs | grep -i error
   ```

5. **Backup important torrents**
   ```bash
   # Move popular torrents to permanent storage
   mv temp/Movie.mkv media/movies/
   ```

## Summary

| Feature | Status | Description |
|---------|--------|-------------|
| Download to server | ✅ Working | Torrents download to `./temp` |
| Progressive streaming | ✅ Working | Stream while downloading |
| File-based streaming | ✅ Working | Use downloaded files when ready |
| Range requests | ✅ Working | Seeking/skipping supported |
| Automatic cleanup | ✅ Working | Removes old files |
| Configurable paths | ✅ Working | Via environment variables |

**The torrent download and streaming system is fully functional and production-ready!**

---

For more information:
- [README.md](README.md) - General documentation
- [STREAMING-TROUBLESHOOTING.md](STREAMING-TROUBLESHOOTING.md) - Streaming issues
- [P2P-QUICK-FIX.md](P2P-QUICK-FIX.md) - Peer connectivity issues
