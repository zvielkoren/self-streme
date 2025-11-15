# Streaming Flow Diagram

## /stream/proxy/:infoHash - Enhanced Flow

```
┌─────────────────────────────────────────────────────────┐
│  Client Request: /stream/proxy/:infoHash                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
           ┌─────────────────┐
           │  Is Mock Hash?  │
           └────┬────────┬───┘
                │        │
            Yes │        │ No
                │        │
                ▼        ▼
         ┌──────────┐  ┌──────────────────────┐
         │  Mock    │  │  STEP 1: Check Cache │
         │  Content │  └──────────┬───────────┘
         └────┬─────┘             │
              │                   ▼
              │         ┌──────────────────┐
              │         │  Search ./temp/  │
              │         │  for infoHash    │
              │         └────┬─────────┬───┘
              │              │         │
              │          Found│         │Not Found
              │              │         │
              │              ▼         ▼
              │      ┌──────────┐   ┌────────────────┐
              │      │ Validate │   │ STEP 2: Try P2P│
              │      │ File     │   └────────┬───────┘
              │      └────┬─────┘            │
              │           │                  │
              │       Valid│                 ▼
              │           │          ┌──────────────┐
              │           │          │ Create       │
              │           │          │ Magnet URI   │
              │           │          └──────┬───────┘
              │           │                 │
              │           │                 ▼
              │           │          ┌──────────────┐
              │           │          │ Start        │
              │           │          │ WebTorrent   │
              │           │          └──────┬───────┘
              │           │                 │
              │           │          Success│  Failure
              │           │                 │    │
              │           ▼                 ▼    ▼
              │      ┌─────────────────────────────┐
              │      │                             │
              └──────►    HTTP 200: Stream Video   │
                     │    (with range support)     │
                     └─────────────────────────────┘
                                   │
                            Success │  Failure
                                   │    │
                                   ▼    ▼
                              ┌──────────┐
                              │ Response │
                              └──────────┘

```

## Key Decision Points

### 1. Mock Hash Detection
- **Purpose**: Provide test content without real files
- **Condition**: Hash matches known test patterns
- **Result**: Returns mock MP4 video

### 2. Cache Check (NO P2P REQUIRED)
- **Location**: `./temp/` directory
- **Search**: Files containing infoHash (case-insensitive)
- **Validation**:
  - ✅ Size >= 1 MB
  - ✅ Valid video extension
  - ✅ File exists and readable
- **Result**: Stream directly from disk

### 3. P2P Fallback
- **Trigger**: No cached file found
- **Process**:
  1. Convert infoHash to magnet URI
  2. Add trackers for better connectivity
  3. Start WebTorrent download
  4. Wait for peers (with timeout)
  5. Stream as download progresses
- **Caching**: Downloaded file saved for future use

## Performance Characteristics

| Scenario | Response Time | Network Usage | P2P Required |
|----------|--------------|---------------|--------------|
| **Cached File** | <100ms | None | ❌ No |
| **First P2P Download** | 10-120s | High | ✅ Yes |
| **Cached After P2P** | <100ms | None | ❌ No |

## File Flow

```
New Content Request
        │
        ▼
    ┌─────────┐
    │   No    │
    │  Cache  │
    └────┬────┘
         │
         ▼ P2P Download
    ┌──────────┐
    │ Download │──────────┐
    │   to     │          │
    │ ./temp/  │          │ Concurrent
    └────┬─────┘          │ Streaming
         │                │
         │                ▼
         │         ┌─────────────┐
         │         │   Stream    │
         │         │  to Client  │
         │         └─────────────┘
         │
         ▼ File Persists
    ┌──────────┐
    │  Cached  │
    │  File    │
    └────┬─────┘
         │
         ▼ Future Requests
    ┌───────────┐
    │  Instant  │
    │  Stream   │ ◄── No P2P Needed!
    └───────────┘
```

## Cache Directory Structure

```
./temp/
├── abcd1234567890abcd1234567890abcd12345678-movie.mp4
├── xyz9876543210xyz9876543210xyz987654321-series-s01e01.mkv
├── fedcba0987654321fedcba0987654321fedcba09-video.avi
└── {infoHash}-{optional-name}.{extension}
    └─────┬─────┘  └──────┬──────┘   └────┬────┘
          │                │                │
      Required          Optional         Required
    (must match)      (any text)     (valid video)
```

## Usage Examples

### Example 1: Pre-populated Cache
```bash
# Place file in cache BEFORE request
cp video.mp4 ./temp/abc123...-video.mp4

# Request streams immediately (no P2P)
curl http://localhost:7000/stream/proxy/abc123...
# Response: instant, no peer search
```

### Example 2: First-time P2P
```bash
# No cache exists
curl http://localhost:7000/stream/proxy/xyz789...
# P2P download starts (10-120s)
# Stream begins as download progresses
# File saved to cache
```

### Example 3: Subsequent Access
```bash
# Cache now exists from Example 2
curl http://localhost:7000/stream/proxy/xyz789...
# Response: instant from cache
# No P2P needed!
```

## Error Scenarios

```
Request
   │
   ▼
Cache Check ────► Not Found
   │
   ▼
P2P Attempt ────► No Peers
   │
   ▼
┌──────────────────┐
│  HTTP 404        │
│  Error Response  │
│  + Helpful Msg   │
└──────────────────┘
```

## Optimization Tips

1. **Pre-populate Cache**: Place files in `./temp/` with infoHash in filename
2. **Maintain Cache**: Keep frequently accessed content cached
3. **Monitor Size**: Watch disk usage in cache directory
4. **Naming Convention**: Include descriptive names: `{hash}-{title}.mp4`

## Configuration

```javascript
// src/config/index.js
torrent: {
  downloadPath: "./temp",  // Cache location
  cleanupInterval: 1800000, // 30 min cleanup
  // ... other settings
}
```

## See Also

- [NO-P2P-STREAMING.md](./NO-P2P-STREAMING.md) - Detailed documentation
- [README.md](../README.md) - Main documentation
- [torrentService.js](../src/core/torrentService.js) - Implementation
