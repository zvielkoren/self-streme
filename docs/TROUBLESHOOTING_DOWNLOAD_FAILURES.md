# Troubleshooting Download Failures

This guide helps you diagnose and fix "Download failed from all X sources" errors in Self-Streme.

## Understanding the Error

When you see this error:
```
Download failed from all 5 sources: WebTor.io, Instant.io, TorrentGalaxy Cached, Academic Torrents, BTFS Gateway
```

It means the system tried to download your video file from multiple HTTP sources and all of them failed. This happens when:

1. 🔴 **The torrent has no seeders** (dead torrent)
2. 🔴 **Free sources are rate-limiting you**
3. 🔴 **Free sources are temporarily down**
4. 🔴 **The file is too large for free services**
5. 🔴 **Geographic restrictions** (some services block certain regions)

---

## Quick Fixes (Try These First)

### 1. ✅ Enable All Sources

The default configuration may exclude some sources. To use all available sources:

```bash
# Remove any source filtering
unset EXCLUDE_DOWNLOAD_SOURCES

# Restart the service
npm run stop
npm run start
```

If using Docker:
```bash
# Remove EXCLUDE_DOWNLOAD_SOURCES from docker-compose.yml
# Then restart
docker-compose restart
```

### 2. ✅ Increase Retry Attempts

```bash
# In .env or environment
HTTP_MAX_RETRIES=5  # Default is 2

# Restart
npm run stop && npm run start
```

### 3. ✅ Try a Different Torrent

Some torrents are dead or too rare. Try with a popular torrent first:

```bash
# Test with Ubuntu ISO (always has many seeders)
curl "http://localhost:11470/api/stream/UBUNTU_ISO_HASH/0"
```

### 4. ✅ Check if P2P Works

If P2P works, increase the timeout to give it more time:

```bash
# In .env
P2P_TIMEOUT=120000  # 2 minutes instead of default 60s

# Restart
npm run stop && npm run start
```

---

## Long-Term Solutions

### 🥇 Solution 1: Add Premium Debrid Service (HIGHLY RECOMMENDED)

**Reliability: 95-98%** vs **Free Sources: 60-70%**

Premium debrid services are designed specifically for this use case and cost only ~€0.13/day.

#### Real-Debrid (Recommended)
```bash
# 1. Sign up at https://real-debrid.com
# 2. Get API key from https://real-debrid.com/apitoken
# 3. Add to .env:
REAL_DEBRID_API_KEY=your_api_key_here

# 4. Restart
npm run stop && npm run start
```

See detailed setup: [docs/guides/PREMIUM_SERVICES.md](guides/PREMIUM_SERVICES.md)

**Why Premium Services?**
- ✅ 95%+ success rate
- ✅ Fast speeds (not rate-limited)
- ✅ Large file support (50GB+)
- ✅ Instant streaming (cached torrents)
- ✅ Resume support
- ✅ No geographic restrictions

**Cost:** ~€16 for 180 days = €0.09/day

---

### 🥈 Solution 2: Run Local WebTorrent Desktop

If you want to keep using free sources, run WebTorrent Desktop locally as a fallback:

```bash
# 1. Install WebTorrent Desktop
# Download from: https://webtorrent.io/desktop

# 2. Enable streaming server on port 9000
# In WebTorrent Desktop: Preferences → Enable Web Server

# 3. Self-Streme will automatically detect and use it
```

---

### 🥉 Solution 3: Configure a Seedbox

If you have a seedbox, integrate it:

```bash
# In .env
SEEDBOX_URL=https://your-seedbox.com
SEEDBOX_USERNAME=your_username
SEEDBOX_PASSWORD=your_password
```

See: [docs/guides/SEEDBOX_INTEGRATION.md](guides/SEEDBOX_INTEGRATION.md)

---

## Diagnostic Steps

### Step 1: Check Which Sources Are Available

```bash
curl http://localhost:11470/api/sources/stats | jq
```

Look for:
- `totalSources`: Should be 5+ 
- `premiumSources`: Should be > 0 if you configured API keys
- `sources[].health`: Check which sources are failing

Example output:
```json
{
  "totalSources": 8,
  "premiumSources": 1,
  "freeSources": 7,
  "sources": [
    {
      "name": "Real-Debrid",
      "priority": 1,
      "requiresAuth": true,
      "health": {
        "successes": 42,
        "failures": 1,
        "available": true
      }
    },
    {
      "name": "WebTor.io",
      "priority": 10,
      "requiresAuth": false,
      "health": {
        "successes": 5,
        "failures": 12,
        "available": false
      }
    }
  ]
}
```

### Step 2: Enable Debug Logging

```bash
# In .env
LOG_LEVEL=debug

# Or set temporarily
export LOG_LEVEL=debug
npm run start
```

Watch the logs to see **specific error messages** from each source:
```
[Hybrid] WebTor.io failed (attempt 1/2): HTTP 429 - Too Many Requests
[Hybrid] Instant.io failed (attempt 1/2): ECONNREFUSED
[Hybrid] BTFS Gateway failed (attempt 1/2): HTTP 404 - Not Found
```

### Step 3: Test Individual Sources

Try accessing sources directly to see what's failing:

```bash
# Test WebTor.io
INFO_HASH="your_info_hash_here"
FILE_NAME="your_file.mkv"
curl -I "https://webtor.io/api/torrent/${INFO_HASH}/stream/${FILE_NAME}"

# Test Instant.io
curl -I "https://instant.io/${INFO_HASH}/${FILE_NAME}"

# Test BTFS Gateway
curl -I "https://gateway.btfs.io/btfs/${INFO_HASH}/${FILE_NAME}"
```

Look for:
- ✅ `200 OK` - Source is working
- ❌ `404 Not Found` - Torrent not cached
- ❌ `429 Too Many Requests` - Rate limited
- ❌ `403 Forbidden` - Blocked
- ❌ `500 Server Error` - Source is down

### Step 4: Check Torrent Health

Verify the torrent has seeders:

```bash
# Use a magnet link tracker
# Example with transmission-show (if you have transmission-cli)
transmission-show your_torrent.torrent | grep "Seeders"

# Or check on torrent tracking sites
# Search for your info hash on:
# - https://torrentz2.eu
# - https://btdig.com
```

---

## Common Error Patterns

### Error: "No working sources found"

**Cause:** All free sources are down or blocking you.

**Solution:**
1. Add a premium debrid service (recommended)
2. Wait 30 minutes and try again (rate limits reset)
3. Try a different torrent
4. Run WebTorrent Desktop locally

---

### Error: "HTTP 429 - Too Many Requests"

**Cause:** You've exceeded the rate limit of free sources.

**Solution:**
```bash
# Wait 30-60 minutes, or add premium service
# Free sources have these typical limits:
# - WebTor.io: ~10 requests/hour
# - Instant.io: ~20 requests/hour
# - BTFS Gateway: ~50 requests/hour

# Premium services have much higher limits:
# - Real-Debrid: ~100 requests/minute
# - AllDebrid: ~50 requests/minute
```

---

### Error: "HTTP 404 - Not Found"

**Cause:** Torrent is not cached on that source.

**Solution:** This is normal for free services. They only cache popular content.
- Premium services will download uncached torrents (1-5 min wait)
- Free services won't download, just fail
- Try a more popular torrent

---

### Error: "HTTP 403 - Forbidden"

**Cause:** Source is blocking your IP or user agent.

**Solution:**
```bash
# Some sources block certain regions or detect automated access
# Use a VPN or premium service to bypass
```

---

### Error: "Size mismatch (expected X, got Y)"

**Cause:** Download was incomplete or corrupted.

**Solution:**
```bash
# This is auto-retried, but you can increase retries:
# In .env
HTTP_MAX_RETRIES=5

# Or clean cache and retry:
rm -rf temp/downloads/*
```

---

### Error: "ECONNREFUSED" or "ENOTFOUND"

**Cause:** Source domain is down or doesn't exist.

**Solution:** This source is dead. It will be automatically skipped in future attempts.

---

### Error: "Still no peers after 30000ms"

**Cause:** P2P connection failed (no seeders or network issues).

**Solution:**
```bash
# 1. Increase P2P timeout
P2P_TIMEOUT=120000  # 2 minutes

# 2. Or disable P2P entirely and rely on HTTP
P2P_TIMEOUT=1000  # Give up quickly on P2P

# 3. Check firewall/NAT settings for P2P
# Ensure ports are open for BitTorrent
```

---

## Configuration Reference

### Environment Variables for Download Control

```bash
# .env file

# === Timeout Settings ===
P2P_TIMEOUT=60000              # Time to wait for P2P (ms), default: 60000
HTTP_MAX_RETRIES=2             # Retries per source, default: 2
DEBRID_TIMEOUT=30000           # Timeout for premium services (ms)

# === Source Control ===
EXCLUDE_DOWNLOAD_SOURCES=""    # Comma-separated list to exclude
                               # Example: "WebTor.io,Instant.io"

ENABLE_HTTP_FALLBACK=true      # Enable HTTP download fallback

# === Premium Services (Recommended) ===
REAL_DEBRID_API_KEY=""         # Most reliable, ~95% success
ALLDEBRID_API_KEY=""           # Good alternative
PREMIUMIZE_API_KEY=""          # Privacy-focused

# === Cache Settings ===
CACHE_SIZE=50GB                # Max cache size
CACHE_TTL=86400000             # Cache time-to-live (ms)

# === Logging ===
LOG_LEVEL=info                 # Set to 'debug' for detailed logs
```

### Example: Maximum Free Source Reliability

```bash
# .env for best free source performance

# Give P2P more time
P2P_TIMEOUT=120000

# Retry sources more times
HTTP_MAX_RETRIES=5

# Don't exclude any sources
# (comment out or remove EXCLUDE_DOWNLOAD_SOURCES)

# Enable debug logging
LOG_LEVEL=debug

# Restart
npm run stop && npm run start
```

### Example: Premium Service Only

```bash
# .env for premium-only mode

# Quick P2P timeout (give up fast)
P2P_TIMEOUT=5000

# Exclude all free sources (rely only on premium)
EXCLUDE_DOWNLOAD_SOURCES="WebTor.io,Instant.io,TorrentGalaxy Cached,Academic Torrents,BTFS Gateway,WebTorrent Desktop"

# Add premium service
REAL_DEBRID_API_KEY=your_key_here

# Restart
npm run stop && npm run start
```

---

## Performance Comparison

| Configuration | Success Rate | Avg. Start Time | Cost |
|---------------|--------------|-----------------|------|
| **Free sources only** | 60-70% | 30-60s | Free |
| **Free + P2P** | 65-75% | 15-45s | Free |
| **Premium only** | 95-98% | 1-5s | ~€0.13/day |
| **Premium + Free fallback** | 96-99% | 1-10s | ~€0.13/day |
| **Local WebTorrent** | 70-85% | 10-30s | Free |

**Recommendation:** Premium service gives best value for reliability.

---

## Advanced Troubleshooting

### Clear All Caches

```bash
# Stop service
npm run stop

# Clear download cache
rm -rf temp/downloads/*

# Clear torrent cache (if using P2P)
rm -rf temp/torrents/*

# Restart
npm run start
```

### Check Network Connectivity

```bash
# Test if you can reach common sources
ping -c 4 webtor.io
ping -c 4 instant.io
ping -c 4 gateway.btfs.io

# Check DNS resolution
nslookup webtor.io
nslookup instant.io
```

### Test with Known Good Torrent

```bash
# Big Buck Bunny (always available, many seeders)
INFO_HASH="dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"

curl "http://localhost:11470/api/stream/${INFO_HASH}/0"
```

If this works, your setup is fine and the issue is with the specific torrent you're trying.

### Monitor Real-Time Logs

```bash
# Watch logs in real-time
tail -f logs/app.log | grep -E "Hybrid|Sources|Error"

# Or with Docker
docker-compose logs -f | grep -E "Hybrid|Sources|Error"
```

### Check Source Health Over Time

```bash
# Create a monitoring script
# save as monitor-sources.sh

#!/bin/bash
while true; do
  echo "=== $(date) ==="
  curl -s http://localhost:11470/api/sources/stats | \
    jq '.sources[] | select(.health != null) | {name, available: .health.available, successes: .health.successes, failures: .health.failures}'
  echo ""
  sleep 300  # Check every 5 minutes
done
```

---

## Getting Help

If you're still experiencing issues:

### 1. Gather Information

```bash
# Collect diagnostic info
echo "=== System Info ===" > diagnostic.txt
uname -a >> diagnostic.txt
node --version >> diagnostic.txt
npm --version >> diagnostic.txt

echo -e "\n=== Source Stats ===" >> diagnostic.txt
curl -s http://localhost:11470/api/sources/stats >> diagnostic.txt

echo -e "\n=== Recent Errors ===" >> diagnostic.txt
tail -n 100 logs/app.log | grep -i error >> diagnostic.txt

echo -e "\n=== Configuration ===" >> diagnostic.txt
grep -E "P2P_TIMEOUT|HTTP_MAX_RETRIES|ENABLE_HTTP_FALLBACK" .env >> diagnostic.txt 2>/dev/null || echo "No .env file"
```

### 2. Create GitHub Issue

Visit: https://github.com/zviel/self-streme/issues

Include:
- The `diagnostic.txt` content
- Specific error message
- Steps to reproduce
- What you've already tried

### 3. Check Existing Issues

Search for similar issues:
- [Common download failures](https://github.com/zviel/self-streme/labels/download-failure)
- [Premium service issues](https://github.com/zviel/self-streme/labels/premium-service)

---

## Prevention Tips

### 1. Use Premium Service for Production

Free sources are fine for testing, but for reliable production use:
```bash
REAL_DEBRID_API_KEY=your_key_here
```

### 2. Implement Caching

The system automatically caches downloads, but ensure you have enough space:
```bash
# Check cache size
du -sh temp/downloads/

# Adjust cache size in .env
CACHE_SIZE=100GB
```

### 3. Monitor Source Health

Set up automated monitoring:
```bash
# Add to crontab
*/15 * * * * curl -s http://localhost:11470/api/sources/stats | jq '.sources[] | select(.health.available == false)' | mail -s "Source Down Alert" admin@example.com
```

### 4. Keep System Updated

```bash
# Update regularly
git pull origin main
npm install
npm run stop && npm run start
```

---

## Summary

**Quick Checklist:**

- [ ] Tried enabling all sources (remove `EXCLUDE_DOWNLOAD_SOURCES`)
- [ ] Increased retry attempts (`HTTP_MAX_RETRIES=5`)
- [ ] Tested with a known good torrent
- [ ] Checked source health stats
- [ ] Enabled debug logging (`LOG_LEVEL=debug`)
- [ ] Considered adding premium service (Real-Debrid)

**Best Solution:** Add Real-Debrid API key for 95%+ reliability

---

## Related Documentation

- [Premium Services Setup](guides/PREMIUM_SERVICES.md)
- [Dynamic Sources Configuration](DYNAMIC_SOURCES.md)
- [General Troubleshooting](TROUBLESHOOTING_P2P.md)
- [Docker Deployment](docker/DEPLOYMENT.md)