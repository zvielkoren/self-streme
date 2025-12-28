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
              │      ┌──────────┐   ┌───────────────────────────────┐
              │      │ Validate │   │ STEP 2: Try P2P               │
              │      │ File     │   │ (Enhanced with Hole Punching) │
              │      └────┬─────┘   └────────┬──────────────────────┘
              │           │                  │
              │       Valid│                 ▼
              │           │          ┌────────────────┐
              │           │          │ 1. Start       │
              │           │          │ P2P Coordinator│
              │           │          └──────┬─────────┘
              │           │                 │
              │           │                 ▼
              │           │          ┌────────────────┐
              │           │          │ 2. Detect NAT  │
              │           │          │ & Punch Holes  │
              │           │          └──────┬─────────┘
              │           │                 │
              │           │                 ▼
              │           │          ┌────────────────┐
              │           │          │ 3. Start       │
              │           │          │ WebTorrent     │
              │           │          └──────┬─────────┘
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
                            Success │  Failure (Fallback)
                                   │    │
                                   ▼    ▼
                              ┌──────────┐
                              │ Response │
                              └──────────┘

```

## Key Decision Points

### 1. Mock Hash Detection
- **Purpose**: Provide test content without real files.
- **Condition**: Hash matches known test patterns.
- **Result**: Returns mock MP4 video.

### 2. Cache Check (NO P2P REQUIRED)
- **Location**: `./temp/` directory.
- **Search**: Files containing infoHash (case-insensitive).
- **Validation**:
  - ✅ Size >= 1 MB
  - ✅ Valid video extension
  - ✅ File exists and readable
- **Result**: Stream directly from disk.

### 3. Enhanced P2P Flow (Hole Punching)
- **Trigger**: No cached file found.
- **Process**:
  1. **P2P Coordinator**: Initializes the hole punching service.
  2. **NAT Detection**: Analyzes your network (Symmetric, Full Cone, etc.).
  3. **STUN/TURN**: Uses STUN servers to discover public IP/Port and TURN (optional) for relay.
  4. **WebTorrent**: Starts with prioritized uTP and optimized port binding.
  5. **Streaming**: Begins as soon as the "Head" of the file is buffered.
- **Caching**: Downloaded file saved for future use.

## Performance Characteristics

| Scenario | Response Time | Network Usage | P2P Required |
|----------|--------------|---------------|--------------|
| **Cached File** | <100ms | None | ❌ No |
| **First P2P Download** | 5-60s | High | ✅ Yes |
| **P2P + Hole Punching** | 10-90s | High | ✅ Yes |
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
         ▼ P2P + Hole Punching
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

## Configuration

```javascript
// src/config/index.js
torrent: {
  torrentPort: 6881,        // Port for incoming traffic
  trackers: [...],          // Redundant public trackers
  dhtBootstrap: [...],      // DHT entry points
}
```

## See Also

- [P2P_SETUP_GUIDE.md](./P2P_SETUP_GUIDE.md) - Detailed network configuration.
- [TROUBLESHOOTING_P2P.md](./TROUBLESHOOTING_P2P.md) - Connectivity fixes.
- [DOCKER.md](./DOCKER.md) - Docker deployment guide.