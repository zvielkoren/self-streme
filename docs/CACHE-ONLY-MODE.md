# Cache-Only Mode

## Overview

Cache-Only Mode allows you to disable P2P streaming entirely, restricting the server to only stream content that is already cached locally. This is perfect for scenarios where:

- You want to avoid P2P connectivity entirely
- You have pre-downloaded/cached content you want to serve
- You're operating in a restricted network environment
- You want to save bandwidth by not downloading via P2P
- You want predictable streaming performance without P2P overhead

## How It Works

When Cache-Only Mode is enabled:

1. **Cache Check First**: The system checks if the requested content exists in the local cache (./temp directory)
2. **P2P Disabled**: If content is not found in cache, streaming fails immediately without attempting P2P
3. **Clear Error Messages**: Users receive informative error messages indicating the content is not cached
4. **Manifest Update**: The Stremio manifest's `behaviorHints.p2p` is automatically set to `false`

## Configuration

### Enable Cache-Only Mode

Add to your `.env` file or set as environment variable:

```bash
CACHE_ONLY_MODE=true
```

### Disable Cache-Only Mode (Default)

```bash
CACHE_ONLY_MODE=false
```

Or simply don't set the variable (P2P fallback is enabled by default).

## Usage Examples

### Example 1: Pre-populated Cache

```bash
# Enable cache-only mode
echo "CACHE_ONLY_MODE=true" >> .env

# Pre-populate cache with video files
# Files must contain the infoHash in the filename
cp my-video.mp4 ./temp/39730aa7c09b864432bc8c878c20c933059241fd-my-video.mp4

# Start the server
npm start

# Stream will work instantly from cache without P2P
curl http://localhost:7000/stream/proxy/39730aa7c09b864432bc8c878c20c933059241fd
# ✅ Streams from cache immediately
```

### Example 2: Cache-Only with Error

```bash
# Enable cache-only mode
export CACHE_ONLY_MODE=true
npm start

# Try to stream content not in cache
curl http://localhost:7000/stream/proxy/nonexistent1234567890abcd1234567890
# ❌ Returns error: "Content not cached"
```

### Example 3: Offline Streaming

```bash
# Pre-download content while connected to internet with P2P enabled
CACHE_ONLY_MODE=false npm start
# Let users stream content - files get cached to ./temp

# Later, enable cache-only mode for offline operation
CACHE_ONLY_MODE=true npm start
# Now streams only from cache, no internet/P2P required
```

## API Responses

### Successful Stream (Cached Content)

```bash
curl -I http://localhost:7000/stream/proxy/39730aa7c09b864432bc8c878c20c933059241fd

HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Length: 2097152
Accept-Ranges: bytes
```

### Failed Stream (Not Cached, Cache-Only Mode)

```bash
curl http://localhost:7000/stream/proxy/nonexistent123

{
  "error": "Content not cached",
  "message": "This content is not available in cache. P2P streaming is disabled in cache-only mode.",
  "suggestion": "Enable P2P mode by setting CACHE_ONLY_MODE=false, or pre-download this content to cache.",
  "mode": "cache-only"
}
```

## Manifest Behavior

The Stremio addon manifest automatically reflects the cache-only setting:

### Cache-Only Mode Enabled
```json
{
  "behaviorHints": {
    "p2p": false,
    "adult": false
  }
}
```

### Cache-Only Mode Disabled (Default)
```json
{
  "behaviorHints": {
    "p2p": true,
    "adult": false
  }
}
```

## Cache Management

### File Naming Requirements

For a file to be recognized in cache-only mode:

- **Location**: Must be in `./temp` directory (configured via `TORRENT_DOWNLOAD_PATH`)
- **Filename**: Must contain the infoHash (case-insensitive)
- **Size**: Must be at least 1 MB
- **Extension**: Must be a valid video format (`.mp4`, `.mkv`, `.avi`, `.mov`, `.m4v`, `.webm`, `.flv`)

### Example Valid Filenames

```
./temp/39730aa7c09b864432bc8c878c20c933059241fd-movie.mp4
./temp/movie-39730aa7c09b864432bc8c878c20c933059241fd.mkv
./temp/39730AA7C09B864432BC8C878C20C933059241FD.avi (case-insensitive)
```

## Use Cases

### 1. Offline Media Server
- Pre-download content while connected
- Enable cache-only mode for offline streaming
- Perfect for remote locations or travel

### 2. Bandwidth Conservation
- Download content during off-peak hours
- Enable cache-only mode to prevent additional P2P traffic
- Ideal for metered connections

### 3. Network Restricted Environments
- Corporate networks blocking P2P
- Firewalled environments
- NAT/VPN setups where P2P doesn't work well

### 4. Predictable Performance
- Eliminate P2P download time variability
- Guarantee instant playback from cache
- Suitable for professional/commercial use

## Switching Between Modes

You can switch between modes at runtime by restarting the server:

```bash
# Start with P2P enabled to build cache
CACHE_ONLY_MODE=false npm start
# ... users stream content, cache builds up ...
# Stop server (Ctrl+C)

# Restart with cache-only mode
CACHE_ONLY_MODE=true npm start
# Now only cached content is available
```

## Troubleshooting

### Content Not Streaming in Cache-Only Mode

**Check:**
1. Is the file in the `./temp` directory?
   ```bash
   ls -lh ./temp/
   ```

2. Does the filename contain the infoHash?
   ```bash
   ls ./temp/ | grep -i "39730aa7c09b864432bc8c878c20c933059241fd"
   ```

3. Is the file size valid (> 1MB)?
   ```bash
   find ./temp -size +1M -name "*39730aa7*"
   ```

4. Is the file extension valid?
   ```bash
   file ./temp/39730aa7c09b864432bc8c878c20c933059241fd-movie.mp4
   ```

### How to Get infoHash

The infoHash is extracted from magnet links or torrent files. Common format:
- Magnet: `magnet:?xt=urn:btih:39730aa7c09b864432bc8c878c20c933059241fd`
- InfoHash: `39730aa7c09b864432bc8c878c20c933059241fd` (40 hex characters)

## Performance Benefits

### With Cache-Only Mode:
- ✅ **Instant Playback**: No P2P connection/discovery time
- ✅ **Zero P2P Overhead**: No peer discovery, DHT lookups, or tracker queries
- ✅ **Predictable Bandwidth**: Only serves cached content
- ✅ **Lower CPU Usage**: No torrent protocol overhead
- ✅ **Works Offline**: No internet connection required

### Without Cache-Only Mode (P2P Enabled):
- ⏳ First stream: 10-120s download time (depends on peers)
- ⏳ Subsequent streams: Instant (cached)
- 🌐 Requires internet connection
- 🔄 DHT/tracker overhead

## See Also

- [Non-P2P Streaming Documentation](./NO-P2P-STREAMING.md)
- [Configuration Guide](../src/config/index.js)
- [Deployment Guide](./DEPLOYMENT.md)
