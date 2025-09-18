# Source Selection Streaming Feature

## Overview
This feature allows users to select specific sources from available streams and play them directly through the server.

## Recent Performance Improvements
- ⚡ **Faster Results**: Reduced timeout from 120s to 30s for quicker feedback
- 📅 **Better Scheduling**: Cache cleanup every 5 minutes (was 15 minutes)
- 🗂️ **Optimized Cache**: 30-minute lifetime (was 60 minutes) for more efficient memory usage
- 🔧 **API Control**: New `/api/cache-config` endpoint for monitoring and forced cleanup

## Endpoint
```
GET /play/:type/:imdbId/:fileIdx/:season?/:episode?
```

### Parameters
- `type`: Content type (`movie` or `series`)
- `imdbId`: IMDb ID (e.g., `tt0111161`)
- `fileIdx`: Index of the source to play (0, 1, 2, etc.)
- `season`: Season number (optional, for series only)
- `episode`: Episode number (optional, for series only)

## New Cache Management API

### Get Cache Configuration
```
GET /api/cache-config
```
Returns current cache status, lifetime, cleanup interval, and cached file count.

### Force Cache Cleanup
```
POST /api/cache-config
Content-Type: application/json
{"forceCleanup": true}
```
Immediately cleans all cached files and returns cleanup results.

## Examples

### Movie Source Selection
```
GET /play/movie/tt0111161/0    # Play first source
GET /play/movie/tt0111161/1    # Play second source
GET /play/movie/tt0111161/2    # Play third source
```

### Series Source Selection
```
GET /play/series/tt0903747/0/1/1    # Play first source of S1E1
GET /play/series/tt0903747/1/1/1    # Play second source of S1E1
```

## Behavior

1. **Cache Check**: First checks if the stream is already cached
2. **Stream Discovery**: If not cached, fetches available streams
3. **Source Selection**: Selects the stream at the specified `fileIdx`
4. **File Handling**: 
   - If magnet link: Downloads and caches the file, then streams it (30s timeout)
   - If direct URL: Redirects to the external URL
5. **Range Support**: Supports HTTP range requests for efficient streaming

## Testing

Visit `/test-source-selection` to see a demonstration of the source selection functionality with working examples and performance improvements.

## Implementation Details

- Files are cached in the system temp directory with automatic cleanup
- Supports range requests for video seeking
- Proper MIME type detection
- Error handling for invalid sources and timeouts
- Debug logging for troubleshooting
- Configurable scheduling with faster cleanup intervals
- Reduced timeout for quicker user feedback