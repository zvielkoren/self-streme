# Source Selection Streaming Feature

## Overview
This feature allows users to select specific sources from available streams and play them directly through the server with scalable caching capabilities.

## Scalable Architecture Features
- 🗂️ **Multiple Cache Backends**: Support for memory, SQLite, and Redis backends
- 📊 **Smart Resource Limits**: Configurable cache size and disk usage limits
- ⚙️ **Environment Configuration**: All scaling parameters configurable via environment variables
- 🔄 **Persistent Storage**: Optional cache persistence across server restarts
- 📈 **Production Ready**: Designed for horizontal scaling and high-load scenarios

## Configuration

### Environment Variables
```bash
# Cache backend: memory (default), sqlite, redis
CACHE_BACKEND=memory

# Cache TTL in seconds (default: 3600 = 1 hour)
CACHE_TTL=3600

# Maximum number of cached files (default: 1000)
CACHE_MAX_SIZE=1000

# Maximum disk usage in MB (default: 5000 = 5GB)
CACHE_MAX_DISK_MB=5000

# Cleanup interval in seconds (default: 300 = 5 minutes)
CACHE_CLEANUP_INTERVAL=300

# Enable persistent cache storage (default: false)
CACHE_PERSISTENT=false
```

### Scaling Recommendations
- **Development**: Use `memory` backend with small limits
- **Small Production**: Use `sqlite` backend with persistence enabled
- **Large Production**: Use `redis` backend for distributed caching

## Performance Optimizations
- ⚡ **Faster Results**: Reduced timeout from 120s to 30s for quicker feedback
- 📅 **Better Scheduling**: Configurable cache cleanup intervals
- 🗂️ **Optimized Cache**: Intelligent eviction policies based on LRU and disk usage
- 🔧 **API Control**: Real-time monitoring and management endpoints

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

## Scalable Cache Management API

### Get Cache Configuration and Stats
```
GET /api/cache-config
GET /api/cache-stats
```
Returns cache status, backend info, disk usage, scaling information, and production readiness.

### Force Cache Cleanup
```
POST /api/cache-config
Content-Type: application/json
{"forceCleanup": true}
```
Immediately cleans all cached files and returns cleanup results with freed space information.

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
2. **Resource Limits**: Validates cache size and disk usage limits
3. **Stream Discovery**: If not cached, fetches available streams
4. **Source Selection**: Selects the stream at the specified `fileIdx`
5. **Intelligent Caching**: Downloads and caches with LRU eviction
6. **File Handling**: 
   - If magnet link: Downloads and caches the file, then streams it (30s timeout)
   - If direct URL: Redirects to the external URL
7. **Range Support**: Supports HTTP range requests for efficient streaming

## Testing

Visit `/test-source-selection` to see a demonstration of the scalable source selection functionality with:
- Real-time cache status monitoring
- Scaling backend information
- Performance metrics and limits
- Working examples with both magnet and direct URL sources

## Implementation Details

- **Scalable Architecture**: Pluggable cache backends for different deployment scenarios
- **Resource Management**: Automatic cleanup based on time, size, and disk usage limits
- **Production Ready**: Proper error handling, logging, and graceful shutdown
- **Memory Efficient**: LRU eviction and intelligent disk usage management
- **Configurable**: All scaling parameters controlled via environment variables
- **Persistent Storage**: Optional cache persistence for stateful deployments
- **API Monitoring**: Real-time cache statistics and management endpoints