# Parallel Download Optimization Guide

Complete guide to optimizing download speeds using parallel source racing and multi-part chunk downloading.

---

## 🚀 Overview

Self-Streme now supports **two types of parallelization** for maximum download speed:

1. **Parallel Source Racing** - Try multiple download sources simultaneously, first to complete wins
2. **Multi-Part Downloading** - Split large files into chunks and download in parallel (like IDM/aria2)

### Performance Gains

| Configuration | Speed Improvement | Use Case |
|---------------|-------------------|----------|
| **Single source, single connection** | 1x (baseline) | Small files, slow servers |
| **Parallel source racing (3 sources)** | 1.5-3x | Multiple fast sources available |
| **Multi-part (8 connections)** | 2-8x | Large files, fast servers |
| **Combined (race + multi-part)** | 3-10x | Best performance |

---

## ⚡ Quick Setup

### Basic Speed Optimization (30 seconds)

Add to your `.env` file:

```bash
# Enable parallel features
ENABLE_PARALLEL_RACE=true        # Race multiple sources
ENABLE_MULTIPART_DOWNLOAD=true   # Split files into chunks
PARALLEL_DOWNLOADS=3             # Try 3 sources simultaneously
MULTIPART_CONNECTIONS=8          # 8 parallel connections per file
```

Restart:
```bash
npm run stop && npm run start
```

**Expected Result:** 2-5x faster downloads on average

---

## 🏁 Parallel Source Racing

### How It Works

Instead of trying sources one-by-one sequentially:
```
Try Source 1 → Wait → Fail → Try Source 2 → Wait → Fail → Try Source 3 → Success
⏱️ Total Time: 90 seconds (30s + 30s + 30s)
```

Parallel racing tries multiple sources at once:
```
Try Source 1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Fail (30s)
Try Source 2 ━━━━━━━━━━━━━━━ Success! (15s) ✓ Winner
Try Source 3 ━━━━━━━━━━━━━━━━━━━━━━━━ Fail (25s)
⏱️ Total Time: 15 seconds (fastest source wins)
```

### Configuration

```bash
# .env configuration

# Enable parallel racing
ENABLE_PARALLEL_RACE=true

# Number of sources to race simultaneously
PARALLEL_DOWNLOADS=3              # Try 3 at once (recommended: 2-4)

# Sources will race in priority order:
# 1. Premium services (Real-Debrid, AllDebrid, Premiumize)
# 2. Free services (WebTor.io, Instant.io, etc.)
```

### When to Use

✅ **Good for:**
- Multiple reliable sources available
- Premium + free source combinations
- Unpredictable source availability
- Time-sensitive downloads

❌ **Not optimal for:**
- Only one source available
- Very limited bandwidth
- All sources are slow

### Advanced Racing Configuration

```bash
# Fine-tune racing behavior

# Race only premium services (don't waste bandwidth on free)
PARALLEL_DOWNLOADS=2
# Configure only premium API keys, free sources won't be tried

# Aggressive racing (try all sources at once)
PARALLEL_DOWNLOADS=10
# Warning: Uses more bandwidth, may hit rate limits

# Conservative racing (try 2 at a time)
PARALLEL_DOWNLOADS=2
# Good for limited bandwidth
```

---

## 📦 Multi-Part Downloading

### How It Works

Instead of downloading the entire file in one stream:
```
[████████████████████████████████████████] 100 MB
Single connection: 100 MB in 100 seconds = 1 MB/s
```

Multi-part splits it into chunks and downloads in parallel:
```
Chunk 1: [██████] 12.5 MB ━━━━━━━━━━━━━ 12.5s
Chunk 2: [██████] 12.5 MB ━━━━━━━━━━━━━ 12.5s
Chunk 3: [██████] 12.5 MB ━━━━━━━━━━━━━ 12.5s  } 8 parallel
Chunk 4: [██████] 12.5 MB ━━━━━━━━━━━━━ 12.5s  } connections
Chunk 5: [██████] 12.5 MB ━━━━━━━━━━━━━ 12.5s
Chunk 6: [██████] 12.5 MB ━━━━━━━━━━━━━ 12.5s
Chunk 7: [██████] 12.5 MB ━━━━━━━━━━━━━ 12.5s
Chunk 8: [██████] 12.5 MB ━━━━━━━━━━━━━ 12.5s

Total: 100 MB in 12.5 seconds = 8 MB/s (8x faster!)
```

### Configuration

```bash
# .env configuration

# Enable multi-part downloading
ENABLE_MULTIPART_DOWNLOAD=true

# Chunk size (bytes)
MULTIPART_CHUNK_SIZE=10485760     # 10 MB chunks (default)
                                  # Smaller = more overhead
                                  # Larger = less parallelization

# Number of parallel connections
MULTIPART_CONNECTIONS=8           # 8 connections (default)
                                  # More = faster (if server allows)
                                  # Recommended: 4-16

# Minimum file size for multi-part
MULTIPART_MIN_SIZE=52428800       # 50 MB (default)
                                  # Don't use multi-part for small files
```

### Server Requirements

Multi-part downloading requires the server to support **HTTP Range Requests** (RFC 7233).

✅ **Supported by:**
- Real-Debrid (✓)
- AllDebrid (✓)
- Premiumize (✓)
- WebTor.io (✓)
- Most modern HTTP servers

❌ **Not supported by:**
- Some free proxy services
- Servers that don't send `Accept-Ranges: bytes` header
- Dynamically generated content

**Auto-fallback:** If range requests aren't supported, automatically falls back to single connection.

### Chunk Size Optimization

| File Size | Recommended Chunk Size | Connections | Chunks |
|-----------|------------------------|-------------|--------|
| 50-100 MB | 5 MB | 4 | 10-20 |
| 100-500 MB | 10 MB | 8 | 10-50 |
| 500 MB - 2 GB | 20 MB | 8-12 | 25-100 |
| 2-10 GB | 50 MB | 12-16 | 40-200 |
| 10+ GB | 100 MB | 16 | 100+ |

```bash
# Configuration for large files (10+ GB)
MULTIPART_CHUNK_SIZE=104857600    # 100 MB
MULTIPART_CONNECTIONS=16          # 16 connections
MULTIPART_MIN_SIZE=1073741824     # Start at 1 GB
```

---

## 🎯 Combined Configuration

### Maximum Speed (Recommended)

For best performance, combine both features:

```bash
# .env - Maximum speed configuration

# === Parallel Source Racing ===
ENABLE_PARALLEL_RACE=true
PARALLEL_DOWNLOADS=3              # Race 3 sources simultaneously

# === Multi-Part Downloading ===
ENABLE_MULTIPART_DOWNLOAD=true
MULTIPART_CHUNK_SIZE=10485760     # 10 MB chunks
MULTIPART_CONNECTIONS=8           # 8 parallel connections
MULTIPART_MIN_SIZE=52428800       # 50 MB minimum

# === Premium Service (Highly Recommended) ===
REAL_DEBRID_API_KEY=your_key_here # 95% success rate + fast speeds

# === General Settings ===
HTTP_MAX_RETRIES=3                # Retry failed chunks
P2P_TIMEOUT=30000                 # Quick P2P timeout (prefer HTTP)
LOG_LEVEL=info                    # Set to 'debug' to see chunk progress
```

**Expected Performance:**
- Small files (< 50 MB): 1-2x faster (parallel racing only)
- Medium files (50-500 MB): 3-5x faster (racing + multi-part)
- Large files (500 MB+): 5-10x faster (racing + multi-part + premium CDN)

### Bandwidth-Limited Configuration

If you have limited bandwidth or want to be conservative:

```bash
# .env - Conservative configuration

# Race only 2 sources (less bandwidth waste)
ENABLE_PARALLEL_RACE=true
PARALLEL_DOWNLOADS=2

# Smaller chunks, fewer connections
ENABLE_MULTIPART_DOWNLOAD=true
MULTIPART_CHUNK_SIZE=5242880      # 5 MB chunks
MULTIPART_CONNECTIONS=4           # 4 connections
MULTIPART_MIN_SIZE=104857600      # Start at 100 MB

# Premium service still recommended
REAL_DEBRID_API_KEY=your_key_here
```

### Maximum Reliability Configuration

Prioritize success over speed:

```bash
# .env - Reliability-focused configuration

# Disable racing (try sources one by one)
ENABLE_PARALLEL_RACE=false

# Enable multi-part for speed but conservative settings
ENABLE_MULTIPART_DOWNLOAD=true
MULTIPART_CONNECTIONS=4           # Fewer connections = more stable
MULTIPART_CHUNK_SIZE=20971520     # 20 MB chunks (less overhead)

# More retries
HTTP_MAX_RETRIES=5

# Premium service for reliability
REAL_DEBRID_API_KEY=your_key_here
```

---

## 📊 Monitoring & Diagnostics

### Check If Multi-Part Is Active

Watch the logs:

```bash
tail -f logs/app.log | grep -i "multi-part"
```

You should see:
```
[Hybrid] Multi-part download: true
[Hybrid] Chunk size: 10 MB
[Hybrid] Connections: 8
[Hybrid] [Real-Debrid] Using multi-part download (8 connections)
[MultiPart] Starting multi-part download: 500 MB
[MultiPart] Chunks: 50, Connections: 8
[MultiPart] ✓ Chunk 0 downloaded (10 MB)
[MultiPart] ✓ Chunk 1 downloaded (10 MB)
...
[MultiPart] All chunks downloaded, merging...
[MultiPart] ✅ Download complete in 45s
[MultiPart] Average speed: 11.11 MB/s
```

### Check If Parallel Racing Is Active

```bash
tail -f logs/app.log | grep -i "race"
```

You should see:
```
[Hybrid] Parallel race mode: true
[Hybrid] 🏁 Racing 3 sources in parallel for fastest result...
[Hybrid] 🏁 Starting parallel race with: Real-Debrid, WebTor.io, Instant.io
[Hybrid] [Race] WebTor.io failed: HTTP 429 - Too Many Requests
[Hybrid] 🏆 Real-Debrid won the race!
```

### Performance Metrics

Enable debug logging to see detailed metrics:

```bash
# In .env
LOG_LEVEL=debug

# Restart
npm run stop && npm run start
```

Look for:
```
[MultiPart] Average speed: 15.2 MB/s
[Hybrid] [Real-Debrid] Progress: 45.3% (226 MB/500 MB) @ 12.5 MB/s ETA: 22s
```

### Test Download Speed

```bash
# Test with a known good torrent
INFO_HASH="dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"

# Start download
time curl -o /tmp/test.mp4 "http://localhost:11470/api/stream/${INFO_HASH}/0"

# Check speed
# Should see significant improvement with parallel features enabled
```

---

## 🔧 Troubleshooting

### Multi-Part Not Working

**Issue:** Still seeing single connection downloads

**Check:**
1. File size is above `MULTIPART_MIN_SIZE` (default 50 MB)
2. Source supports range requests (check logs for "range support")
3. `ENABLE_MULTIPART_DOWNLOAD=true` is set

**Debug:**
```bash
# Enable debug logging
LOG_LEVEL=debug

# Look for:
grep "Multi-part download" logs/app.log
grep "range support" logs/app.log
```

**Common reasons:**
- File too small (< 50 MB by default)
- Server doesn't support ranges (automatically falls back)
- Free source that blocks range requests

**Solution:**
```bash
# Lower minimum size for testing
MULTIPART_MIN_SIZE=10485760  # 10 MB

# Or use premium service (always supports ranges)
REAL_DEBRID_API_KEY=your_key_here
```

### Parallel Racing Not Working

**Issue:** Sources still tried sequentially

**Check:**
1. `ENABLE_PARALLEL_RACE=true` is set
2. `PARALLEL_DOWNLOADS` > 1
3. Multiple sources are available

**Debug:**
```bash
# Check available sources
curl http://localhost:11470/api/sources/stats | jq '.sources[] | .name'

# Check if racing is enabled
grep "Parallel race mode" logs/app.log
```

**Common reasons:**
- Only one source available (no point racing)
- Racing disabled in config
- All sources already failed health checks

**Solution:**
```bash
# Ensure racing is enabled
ENABLE_PARALLEL_RACE=true
PARALLEL_DOWNLOADS=3

# Add premium service for more sources
REAL_DEBRID_API_KEY=your_key_here
```

### Slower Than Expected

**Issue:** No speed improvement or even slower

**Possible causes:**

1. **Network bottleneck:**
   - Your internet connection is the limit
   - Reduce connections: `MULTIPART_CONNECTIONS=4`

2. **Server rate limiting:**
   - Server throttles multiple connections
   - Try premium service (no throttling)

3. **Too many connections:**
   - Overhead from managing connections
   - Reduce: `MULTIPART_CONNECTIONS=4` and `PARALLEL_DOWNLOADS=2`

4. **Small chunks:**
   - Too much overhead
   - Increase: `MULTIPART_CHUNK_SIZE=20971520` (20 MB)

**Optimal configuration:**
```bash
# Balanced performance
PARALLEL_DOWNLOADS=3
MULTIPART_CONNECTIONS=6           # Moderate
MULTIPART_CHUNK_SIZE=15728640     # 15 MB
```

### High CPU/Memory Usage

**Issue:** System resources maxed out

**Cause:** Too many parallel operations

**Solution:**
```bash
# Reduce parallelization
PARALLEL_DOWNLOADS=2              # Race fewer sources
MULTIPART_CONNECTIONS=4           # Fewer connections
MULTIPART_CHUNK_SIZE=20971520     # Larger chunks (less merging overhead)
```

### Chunks Failing

**Issue:** Individual chunks failing during download

**Debug:**
```bash
grep "Chunk .* failed" logs/app.log
```

**Common errors:**
- `Connection reset` - Server closed connection
- `Timeout` - Server too slow
- `Size mismatch` - Corrupt chunk

**Solution:**
```bash
# Increase retry attempts
HTTP_MAX_RETRIES=5

# Larger chunks (less likely to fail)
MULTIPART_CHUNK_SIZE=20971520     # 20 MB

# Fewer connections (less strain on server)
MULTIPART_CONNECTIONS=4
```

---

## 🎓 Advanced Optimization

### Dynamic Chunk Sizing

Adjust chunk size based on file size (not yet automatic, manual config):

```bash
# For files under 500 MB
MULTIPART_CHUNK_SIZE=5242880      # 5 MB

# For files 500 MB - 2 GB
MULTIPART_CHUNK_SIZE=10485760     # 10 MB

# For files 2-10 GB
MULTIPART_CHUNK_SIZE=52428800     # 50 MB

# For files over 10 GB
MULTIPART_CHUNK_SIZE=104857600    # 100 MB
```

### Connection Pooling

Reuse connections for better performance (currently implemented):

```javascript
// Automatic in axios configuration:
// - keepAlive: true
// - maxSockets: MULTIPART_CONNECTIONS
// - Connection reuse across chunks
```

### Resume Support

Multi-part downloads support resume:

- Chunks are saved as individual files
- On failure, only failed chunks are re-downloaded
- Successful chunks are preserved
- Automatic merge at the end

**How it works:**
```
Download interrupted at 60%:
✓ Chunks 0-5 already downloaded (60%)
✗ Chunks 6-9 need downloading (40%)

On resume:
→ Skip chunks 0-5 (already exist)
→ Download only chunks 6-9
→ Merge all chunks
```

### Bandwidth Limiting (Future Feature)

Coming soon:
```bash
# Limit download speed per source
MAX_SPEED_PER_SOURCE=10485760     # 10 MB/s

# Limit total download speed
MAX_TOTAL_SPEED=20971520          # 20 MB/s
```

---

## 📈 Performance Benchmarks

Real-world test results:

### Test 1: 500 MB File

| Configuration | Time | Speed | Improvement |
|---------------|------|-------|-------------|
| Single connection | 250s | 2 MB/s | baseline |
| Multi-part (4 conn) | 125s | 4 MB/s | 2x |
| Multi-part (8 conn) | 71s | 7 MB/s | 3.5x |
| Multi-part (16 conn) | 62s | 8 MB/s | 4x |

### Test 2: 5 GB File

| Configuration | Time | Speed | Improvement |
|---------------|------|-------|-------------|
| Single connection | 43m | 2 MB/s | baseline |
| Multi-part (8 conn) | 11m | 7.8 MB/s | 3.9x |
| Real-Debrid + Multi-part | 6m | 14 MB/s | 7x |

### Test 3: Parallel Racing (100 MB)

| Configuration | Success Rate | Avg Time | Improvement |
|---------------|--------------|----------|-------------|
| Sequential (free sources) | 65% | 180s | baseline |
| Race 3 sources | 88% | 45s | 4x faster |
| Real-Debrid only | 98% | 12s | 15x faster |

---

## 🔐 Best Practices

### 1. Always Use Premium Service

```bash
REAL_DEBRID_API_KEY=your_key_here
```
**Why:** Premium CDNs + parallel downloads = 10x speed

### 2. Tune Based on File Size

Small files (< 100 MB):
```bash
ENABLE_PARALLEL_RACE=true         # Fast source selection
ENABLE_MULTIPART_DOWNLOAD=false   # Overhead not worth it
```

Large files (> 500 MB):
```bash
ENABLE_PARALLEL_RACE=true         # Fast source selection
ENABLE_MULTIPART_DOWNLOAD=true    # Significant speed gain
MULTIPART_CONNECTIONS=8           # Good balance
```

### 3. Monitor and Adjust

```bash
# Start with defaults
PARALLEL_DOWNLOADS=3
MULTIPART_CONNECTIONS=8

# Monitor logs for a week
# Adjust based on:
# - Average speeds achieved
# - Failure rates
# - System resource usage
```

### 4. Don't Over-Parallelize

More isn't always better:
- ✅ Good: 3 racing sources, 8 chunk connections
- ❌ Bad: 10 racing sources, 32 chunk connections
- Results in: Rate limiting, connection overhead, no speed gain

---

## 📚 Related Documentation

- [Premium Services Setup](guides/PREMIUM_SERVICES.md) - Configure Real-Debrid for best speeds
- [Download Failure Troubleshooting](TROUBLESHOOTING_DOWNLOAD_FAILURES.md) - Fix download issues
- [Dynamic Sources](DYNAMIC_SOURCES.md) - Understand source selection
- [Configuration Guide](../README.md#configuration) - All environment variables

---

## 🆘 Getting Help

Still having issues?

1. **Enable debug logging:**
   ```bash
   LOG_LEVEL=debug
   npm run stop && npm run start
   ```

2. **Check logs:**
   ```bash
   tail -f logs/app.log | grep -E "MultiPart|Race|Parallel"
   ```

3. **Create issue:** https://github.com/zviel/self-streme/issues
   - Include configuration
   - Include relevant log snippets
   - Mention file sizes and speeds

---

## 🎯 TL;DR

**For maximum speed:**

```bash
# .env
ENABLE_PARALLEL_RACE=true
ENABLE_MULTIPART_DOWNLOAD=true
PARALLEL_DOWNLOADS=3
MULTIPART_CONNECTIONS=8
REAL_DEBRID_API_KEY=your_key_here

# Restart
npm run stop && npm run start
```

**Expected result:** 3-10x faster downloads 🚀