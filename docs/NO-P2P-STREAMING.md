# Streaming Without P2P Connectivity

## Overview

The `/stream/proxy/:infoHash` endpoint has been enhanced to work **without P2P connectivity** by leveraging cached files. This allows streaming to continue working even when:

- No peers are available for a torrent
- P2P connections are blocked by firewall/NAT
- The torrent network is unavailable
- You want to serve previously downloaded content

## How It Works

### Streaming Priority Order

When you request `/stream/proxy/:infoHash`, the system follows this priority:

1. **Cached File Check (No P2P Required)** ✅
   - Searches the download directory for files matching the infoHash
   - If found, streams directly from disk
   - **No network connectivity needed**
   - Instant playback

2. **P2P Streaming (Fallback)**
   - If no cached file exists, attempts P2P download
   - Uses WebTorrent with DHT and trackers
   - Requires peers to be available

### File Matching Requirements

For a file to be served without P2P, it must meet these criteria:

- **Location**: Must be in the configured download directory (default: `./temp`)
- **Filename**: Must contain the infoHash (case-insensitive)
- **Size**: Must be at least 1 MB
- **Extension**: Must be a valid video format (`.mp4`, `.mkv`, `.avi`, `.mov`, `.m4v`, `.webm`, `.flv`)

### Example Scenarios

#### Scenario 1: Cached File Available (No P2P)
```
Request: GET /stream/proxy/39730aa7c09b864432bc8c878c20c933059241fd

File found: ./temp/39730aa7c09b864432bc8c878c20c933059241fd-movie.mp4
Result: ✅ Streams immediately without P2P
```

#### Scenario 2: No Cache, P2P Successful
```
Request: GET /stream/proxy/abcd1234567890abcd1234567890abcd12345678

Cache: Not found
P2P: ✅ Peers available, downloads and streams
Result: ✅ Streams via P2P (file is cached for future use)
```

#### Scenario 3: No Cache, No P2P
```
Request: GET /stream/proxy/xyz9876543210xyz9876543210xyz987654321

Cache: Not found
P2P: ❌ No peers available
Result: ❌ Returns 404 error with helpful message
```

## Pre-populating Cache

To enable streaming without P2P, you can pre-populate the cache by:

### Option 1: Manual File Placement
1. Download or obtain the video file
2. Rename it to include the infoHash: `{infoHash}-filename.mp4`
3. Place it in the download directory (default: `./temp`)

Example:
```bash
cp my-movie.mp4 ./temp/39730aa7c09b864432bc8c878c20c933059241fd-my-movie.mp4
```

### Option 2: First P2P Download
1. Stream the content once via P2P
2. The file is automatically cached
3. Subsequent streams work without P2P

### Option 3: Bulk Import
```bash
# Copy multiple files at once
for file in /path/to/videos/*.mp4; do
    hash=$(calculate_infohash "$file")  # Use your preferred method
    cp "$file" "./temp/${hash}-$(basename "$file")"
done
```

## Configuration

### Download Directory

Configure the download/cache directory in `src/config/index.js`:

```javascript
torrent: {
  downloadPath: "./temp",  // Change this to your preferred location
  // ... other settings
}
```

Or via environment variable:
```bash
TORRENT_DOWNLOAD_PATH=/path/to/cache
```

### Cache Management

The cache is automatically managed:
- Old files are cleaned up based on `cleanupInterval`
- Files are retained as long as they're accessed
- No manual cleanup required

## API Response Examples

### Successful Stream (Cached)
```bash
curl -I http://localhost:7000/stream/proxy/39730aa7c09b864432bc8c878c20c933059241fd

HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Length: 2097152
Accept-Ranges: bytes
```

### Successful Stream (P2P)
```bash
# Same response as cached, but may take longer initially
HTTP/1.1 200 OK
Content-Type: video/mp4
```

### No Cache, No P2P
```bash
curl http://localhost:7000/stream/proxy/nonexistent123456789

HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "Stream not found",
  "message": "Unable to stream this content. P2P connectivity is unavailable and no cached version exists.",
  "suggestion": "This content requires P2P connectivity or needs to be downloaded first."
}
```

## Benefits

### 1. **Reliability**
- Content remains accessible even if torrent dies
- No dependency on peer availability
- Works in restricted networks

### 2. **Performance**
- Instant playback for cached files
- No P2P overhead or bandwidth usage
- Predictable streaming performance

### 3. **Offline Capability**
- Serve content without internet connection
- Perfect for LAN/home server setups
- No external dependencies once cached

### 4. **Bandwidth Savings**
- Download once, stream many times
- No repeated P2P downloads
- Reduced network traffic

## Troubleshooting

### File Not Found Despite Being in Cache

**Check:**
1. Filename contains the infoHash (case-insensitive)
2. File size is at least 1 MB
3. File extension is valid (`.mp4`, `.mkv`, etc.)
4. File is in the correct directory (`./temp` by default)

**Debug:**
```bash
# List files in cache directory
ls -lh ./temp/

# Check if file matches infoHash
ls ./temp/ | grep -i "39730aa7c09b864432bc8c878c20c933059241fd"
```

### P2P Still Being Attempted

This is expected behavior:
1. Cache is checked first
2. If no match, P2P is attempted as fallback
3. P2P errors indicate no cache was found

### Slow First Stream

- First stream via P2P may be slow (downloading)
- Subsequent streams are instant (cached)
- This is normal and expected

## Migration Guide

### From Previous Versions

No changes required! The enhancement is backward compatible:
- Existing P2P streaming continues to work
- Cache checking is transparent
- No API changes

### For Existing Deployments

1. Identify your download directory
2. Optionally pre-populate with existing files
3. Ensure filenames include infoHash
4. No code changes needed

## Technical Details

### Implementation

- **Check Order**: Cache → P2P → Error
- **File Matching**: Case-insensitive infoHash search
- **Stream Type**: HTTP range requests supported
- **Caching**: Automatic after P2P download

### Performance Impact

- Cache check: ~1-5ms (filesystem read)
- No performance degradation for P2P
- Memory efficient (streams from disk)

## See Also

- [Torrent Service Documentation](../src/core/torrentService.js)
- [Configuration Guide](../src/config/index.js)
- [API Endpoints](../README.md)
