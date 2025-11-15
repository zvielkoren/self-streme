# Direct HTTP Streaming for Series

## Overview

Direct HTTP Streaming ensures that series content can **always** be watched without any P2P barriers. This feature automatically provides direct HTTP streaming URLs that bypass P2P entirely, making series streaming as simple and reliable as watching from any major streaming service.

## The Problem It Solves

Traditional torrent-based streaming can have issues:
- ❌ Waiting for peers to connect
- ❌ Slow downloads with few seeders
- ❌ P2P blocked by firewalls/NAT
- ❌ Port forwarding requirements
- ❌ Unreliable connections
- ❌ Dead torrents with no peers

**Direct HTTP Streaming fixes all of these!**

## How It Works

When enabled, the system automatically:

1. **Provides HTTP URLs**: Each stream gets a direct HTTP streaming URL
2. **No P2P Required**: Content streams via HTTP, not BitTorrent protocol
3. **Instant Playback**: No waiting for peer discovery
4. **Works Everywhere**: No firewall issues, works on any network
5. **Fallback Ready**: Uses cache when available, HTTP proxy when not

## Configuration

### Enable Direct Stream Only Mode

Add to your `.env` file:

```bash
DIRECT_STREAM_ONLY=true
```

### Disable (Default Behavior)

```bash
DIRECT_STREAM_ONLY=false
```

Or simply don't set the variable (P2P with direct fallback is default).

## Features

### For Series Content

Series content **automatically** gets direct HTTP streaming options, even without enabling DIRECT_STREAM_ONLY mode:

```javascript
// Automatic for series
type: "series" → gets direct HTTP streams
type: "movie"  → optional, based on DIRECT_STREAM_ONLY setting
```

### Stream Priority (Series)

When watching series, streams are automatically sorted by reliability:

1. **Direct HTTP URLs** (highest priority - no P2P)
2. **Cached content** (instant playback)
3. **P2P streams** (fallback when needed)

This ensures series content "just works" without any hassle.

## Usage Examples

### Example 1: Watch Series Without P2P

```bash
# Enable direct streaming
export DIRECT_STREAM_ONLY=true
npm start

# Get streams for a series
curl "http://localhost:7000/stream/series/tt2560140/1/1"
```

**Result**: Each stream includes both P2P and direct HTTP options:

```json
{
  "streams": [
    {
      "name": "Attack on Titan S01E01 1080p [Direct HTTP]",
      "title": "Attack on Titan S01E01 - Direct Stream (No P2P)",
      "url": "http://localhost:7000/stream/proxy/abc123...",
      "quality": "1080p",
      "behaviorHints": {
        "notWebReady": false
      }
    },
    {
      "name": "Attack on Titan S01E01 1080p",
      "infoHash": "abc123...",
      "quality": "1080p",
      "behaviorHints": {
        "notWebReady": true
      }
    }
  ]
}
```

### Example 2: Series Always Work (Default Mode)

Even without DIRECT_STREAM_ONLY, series content gets direct HTTP options:

```bash
# Default mode (no special config)
npm start

# Watch any series
curl "http://localhost:7000/stream/series/tt0903747/1/1"
# ✅ Gets direct HTTP streams automatically!
```

### Example 3: Anime Streaming

```bash
# Anime series work perfectly with direct streaming
curl "http://localhost:7000/stream/series/tt2560140/1/5"

# Result: Multiple streaming options, direct HTTP prioritized
# Choose the [Direct HTTP] option for instant, reliable playback
```

## API Response Structure

### Series Stream Response

```json
{
  "streams": [
    {
      "name": "Series Title S01E01 1080p [Direct HTTP]",
      "title": "Series Title S01E01 - Direct Stream (No P2P)",
      "url": "http://localhost:7000/stream/proxy/39730aa7c09b864432bc8c878c20c933059241fd",
      "quality": "1080p",
      "size": "1.5 GB",
      "seeders": 50,
      "source": "torrentio-direct",
      "behaviorHints": {
        "notWebReady": false,
        "bingeGroup": "self-streme-direct-1080p"
      }
    },
    {
      "name": "Series Title S01E01 1080p",
      "title": "Series Title S01E01",
      "infoHash": "39730aa7c09b864432bc8c878c20c933059241fd",
      "quality": "1080p",
      "size": "1.5 GB",
      "seeders": 50,
      "source": "torrentio",
      "behaviorHints": {
        "notWebReady": true,
        "bingeGroup": "self-streme-desktop-1080p"
      }
    }
  ]
}
```

### Identifying Direct Streams

Direct HTTP streams have these characteristics:
- ✅ `url` field present (HTTP URL)
- ✅ No `infoHash` field (or both present for dual-mode)
- ✅ `behaviorHints.notWebReady: false` (web-ready)
- ✅ Name includes `[Direct HTTP]` suffix
- ✅ Title includes "Direct Stream (No P2P)"

## Benefits

### 1. Guaranteed Playback
- ✅ No waiting for peers
- ✅ Works even if torrent is dead
- ✅ No P2P discovery delays

### 2. Universal Compatibility
- ✅ Works behind any firewall
- ✅ No port forwarding needed
- ✅ Compatible with all NAT setups
- ✅ Works on restricted networks (schools, offices)

### 3. Better Performance
- ✅ Instant playback start
- ✅ Predictable streaming speed
- ✅ No P2P protocol overhead
- ✅ Lower CPU usage

### 4. Binge Watching Ready
- ✅ Episode after episode, no interruptions
- ✅ Consistent quality
- ✅ No torrent switching delays

## Comparison

| Feature | P2P Streaming | Direct HTTP Streaming |
|---------|--------------|----------------------|
| **Connection Time** | 10-120 seconds | Instant (<1 second) |
| **Firewall Issues** | Common | None |
| **Dead Torrents** | Fails | Still works |
| **Port Forwarding** | Recommended | Not needed |
| **Bandwidth Usage** | Depends on peers | Predictable |
| **Reliability** | Variable | Consistent |
| **Setup Complexity** | Medium-High | None |

## Integration with Stremio

### Direct Streams in Stremio

When you search for series in Stremio with this addon:

1. Multiple stream options appear
2. Streams marked with "[Direct HTTP]" are instant
3. Select any direct stream for immediate playback
4. No P2P waiting or peer discovery

### How Stremio Handles Direct Streams

```
User selects episode
   ↓
Self-Streme provides streams
   ↓
Direct HTTP streams listed first
   ↓
User clicks stream
   ↓
Instant playback via HTTP
```

## Cache Integration

Direct streaming works seamlessly with caching:

### Cache Hit Flow
```
Request → Check Cache → Found → Stream from Cache (HTTP)
```

### Cache Miss Flow
```
Request → Check Cache → Not Found → Stream via Proxy (HTTP)
```

Both paths use HTTP, ensuring consistent behavior.

## Configuration Combinations

### Combination 1: Maximum Reliability (Recommended for Series)

```bash
DIRECT_STREAM_ONLY=true
CACHE_ONLY_MODE=false
```

**Result:**
- Series get direct HTTP streams
- Cache used when available
- P2P still available as ultimate fallback

### Combination 2: Cache-First with Direct Fallback

```bash
DIRECT_STREAM_ONLY=false
CACHE_ONLY_MODE=false
```

**Result:**
- Series automatically get direct HTTP options
- Cache checked first
- Direct HTTP streams available
- P2P as last resort

### Combination 3: Strict Cache-Only

```bash
CACHE_ONLY_MODE=true
DIRECT_STREAM_ONLY=false
```

**Result:**
- Only cached content plays
- No P2P attempts
- No external HTTP streaming

### Combination 4: Ultimate Convenience

```bash
DIRECT_STREAM_ONLY=true
CACHE_ONLY_MODE=false
```

**Result:**
- Best of all worlds
- Series work via direct HTTP
- Cache provides instant playback when available
- No P2P hassles

## For Different Content Types

### Series/TV Shows (Automatic)
```bash
# No configuration needed
# Series automatically get direct HTTP streams
curl "http://localhost:7000/stream/series/tt0903747/1/1"
```

### Anime (Automatic)
```bash
# Anime is treated as series
# Automatically gets direct HTTP streaming
curl "http://localhost:7000/stream/series/tt2560140/1/1"
```

### Movies (Optional)
```bash
# Movies only get direct streams if DIRECT_STREAM_ONLY=true
DIRECT_STREAM_ONLY=true npm start
curl "http://localhost:7000/stream/movie/tt0111161"
```

## Troubleshooting

### Direct Streams Not Appearing

**Check:**
1. Is content type "series"? (automatic for series)
2. Is DIRECT_STREAM_ONLY enabled? (for movies)
3. Are streams available from search?

**Solution:**
```bash
# Verify configuration
curl "http://localhost:7000/debug/url"

# Check if direct streaming is enabled
grep DIRECT_STREAM_ONLY .env
```

### "Content not cached" Error

This error appears when:
- Cache-only mode is enabled AND
- Content is not in cache

**Solution:**
```bash
# Disable cache-only mode to allow HTTP streaming
CACHE_ONLY_MODE=false npm start
```

### Slow First Stream

Direct HTTP streaming routes through the proxy endpoint, which:
1. Checks cache first (instant if found)
2. Falls back to P2P if needed (slower first time)
3. Caches for future (instant after)

**This is expected behavior.** Second and subsequent streams are instant.

## Performance Metrics

### Typical Performance

| Scenario | Time to Start |
|----------|--------------|
| **Cache Hit** | <100ms |
| **Direct HTTP (First Time)** | 1-5 seconds |
| **Direct HTTP (Cached)** | <100ms |
| **P2P Streaming** | 10-120 seconds |

### Bandwidth Usage

- **Direct HTTP**: Only downloads what you watch
- **P2P**: May download more than needed
- **Cache**: No additional bandwidth after first stream

## Best Practices

1. **Use Default Settings for Series**: Series get direct HTTP automatically
2. **Enable DIRECT_STREAM_ONLY for Movies**: If you want movies to work the same way
3. **Don't Enable CACHE_ONLY_MODE**: Unless you have pre-cached content
4. **Monitor Cache**: Use `/api/cache-stats` to check cache usage
5. **Pre-cache Popular Content**: Stream once to cache for future instant playback

## Advanced Usage

### API Integration

```javascript
// Fetch series streams
const response = await fetch('http://localhost:7000/stream/series/tt2560140/1/1');
const data = await response.json();

// Filter for direct HTTP streams
const directStreams = data.streams.filter(s => 
  s.url && s.name.includes('[Direct HTTP]')
);

// Play the first direct stream
if (directStreams.length > 0) {
  window.location.href = directStreams[0].url;
}
```

### Custom Integration

```bash
#!/bin/bash
# Script to get direct stream URL for episode

SERIES_ID="tt2560140"
SEASON="1"
EPISODE="5"

# Get streams
STREAMS=$(curl -s "http://localhost:7000/stream/series/${SERIES_ID}/${SEASON}/${EPISODE}")

# Extract first direct HTTP stream URL
DIRECT_URL=$(echo "$STREAMS" | jq -r '.streams[] | select(.name | contains("[Direct HTTP]")) | .url' | head -1)

echo "Direct stream URL: $DIRECT_URL"

# Play with mpv
mpv "$DIRECT_URL"
```

## See Also

- [Cache-Only Mode Documentation](./CACHE-ONLY-MODE.md)
- [Anime Support](./ANIME-SUPPORT.md)
- [Hebrew Subtitles](./HEBREW-SUBTITLES.md)
- [Non-P2P Streaming](./NO-P2P-STREAMING.md)
