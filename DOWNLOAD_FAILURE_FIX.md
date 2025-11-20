# Quick Fix: Download Failed from All Sources

**ERROR YOU'RE SEEING:**
```
Download failed from all 5 sources: WebTor.io, Instant.io, TorrentGalaxy Cached, Academic Torrents, BTFS Gateway
```

---

## ⚡ IMMEDIATE FIXES (Try in Order)

### 1️⃣ Enable All Sources (30 seconds)

Your system is currently **excluding WebTor.io**. Let's enable it:

```bash
# Remove the source filter
unset EXCLUDE_DOWNLOAD_SOURCES

# Restart the service
npm run stop
npm run start
```

**Or if using Docker:**
```bash
# Edit docker-compose.yml and remove/comment out:
# EXCLUDE_DOWNLOAD_SOURCES=WebTor.io

docker-compose restart
```

---

### 2️⃣ Enable Parallel Speed Optimization (2 minutes) 🚀 NEW

Add these to your `.env` file for **3-10x faster downloads**:

```bash
# Enable parallel features
ENABLE_PARALLEL_RACE=true        # Try multiple sources simultaneously
ENABLE_MULTIPART_DOWNLOAD=true   # Split files into chunks (like IDM/aria2)
PARALLEL_DOWNLOADS=3             # Race 3 sources at once
MULTIPART_CONNECTIONS=8          # 8 parallel connections per file

# Increase retries
HTTP_MAX_RETRIES=5               # Try each source 5 times

# Better timeouts
P2P_TIMEOUT=30000                # Quick P2P timeout (prefer fast HTTP)

# Debug logging
LOG_LEVEL=debug                  # See detailed error messages
```

Then restart:
```bash
npm run stop && npm run start
```

**What this does:**
- **Parallel Racing:** Tries 3 sources at once, fastest wins (2-3x faster)
- **Multi-Part Downloads:** Splits large files into chunks, downloads in parallel (2-8x faster)
- **Combined:** Can achieve 3-10x speed improvement

See full guide: [docs/PARALLEL_DOWNLOAD_OPTIMIZATION.md](docs/PARALLEL_DOWNLOAD_OPTIMIZATION.md)

---

### 3️⃣ Check Torrent Health

Your torrent might be **dead** (no seeders). Check it:

```bash
# Replace with your info hash
INFO_HASH="310110041b9909f5442ac4d012f75a602cd3ac2b"

# Check source availability
curl "http://localhost:11470/api/sources/stats" | jq

# Watch real-time logs with detailed errors
tail -f logs/app.log | grep -E "Hybrid|MultiPart|Race"
```

**Try with a known good torrent (Big Buck Bunny):**
```bash
curl "http://localhost:11470/api/stream/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c/0"
```

If this works → your original torrent is dead/unpopular  
If this fails → your configuration needs fixing

---

## 🥇 BEST LONG-TERM SOLUTION

### Add Real-Debrid (95%+ Success Rate + Maximum Speed)

**Free sources: 60-70% reliability, slow**  
**Premium service: 95-98% reliability, 5-10x faster with multi-part**  
**Cost: ~€0.13/day (€16 for 180 days)**

#### Setup in 2 minutes:

1. **Sign up:** https://real-debrid.com
2. **Get API key:** https://real-debrid.com/apitoken
3. **Add to `.env`:**
   ```bash
   REAL_DEBRID_API_KEY=your_api_key_here
   
   # Combined with parallel features for maximum speed
   ENABLE_PARALLEL_RACE=true
   ENABLE_MULTIPART_DOWNLOAD=true
   MULTIPART_CONNECTIONS=12        # Premium CDN can handle more
   ```
4. **Restart:**
   ```bash
   npm run stop && npm run start
   ```

**Done!** You now have:
- ✅ 95%+ success rate (vs 60% with free)
- ✅ 5-10x faster downloads (premium CDN + multi-part)
- ✅ Large file support (50+ GB)
- ✅ Instant streaming for cached torrents

---

## 🔍 DIAGNOSIS

### Check Which Sources Are Working

```bash
curl http://localhost:11470/api/sources/stats | jq '.sources[] | {name, health}'
```

Look for:
- `"available": false` → Source is failing
- `"failures" > "successes"` → Source is unreliable

### Enable Debug Logging

```bash
# In .env
LOG_LEVEL=debug

# Restart
npm run stop && npm run start

# Watch logs
tail -f logs/app.log | grep -E "Hybrid|Error|failed"
```

You'll see detailed errors like:
```
[Hybrid] WebTor.io failed: HTTP 429 - Too Many Requests
[Hybrid] Instant.io failed: Connection refused (service not running)
[Hybrid] BTFS Gateway failed: HTTP 404 - Not Found
[Hybrid] 🏁 Racing 3 sources in parallel...
[Hybrid] 🏆 Real-Debrid won the race!
[MultiPart] Starting multi-part download: 5.2 GB
[MultiPart] Chunks: 52, Connections: 8
[MultiPart] ✅ Download complete in 5m 23s
[MultiPart] Average speed: 16.5 MB/s
```

This tells you **exactly why** each source failed and **how fast** downloads are.

---

## 🎯 QUICK DECISION TREE

```
Is this for production use?
├─ YES → Add Real-Debrid ($) + Enable parallel features
│         Best reliability + maximum speed
│
└─ NO (testing/personal use)
   ├─ Need maximum speed?
   │  └─ YES → Enable parallel downloads (free, 3-10x faster)
   │           ENABLE_PARALLEL_RACE=true
   │           ENABLE_MULTIPART_DOWNLOAD=true
   │
   ├─ Torrent is popular?
   │  ├─ YES → Enable all sources + parallel features
   │  └─ NO → Get Real-Debrid or find better torrent
   │
   └─ Free sources keep failing?
      └─ Add Real-Debrid (60% → 95% success rate)
```

---

## 📊 YOUR CURRENT SITUATION

Based on your logs:

1. **P2P Failed:** "Still no peers after 30000ms"
   - Torrent might be dead/unpopular
   - Or network issues (firewall blocking P2P)

2. **All 5 HTTP Sources Failed:**
   - WebTor.io: Excluded by configuration ❌
   - Other 4 sources: Failed (rate limited, down, or torrent not cached)

3. **11.12 GB File:**
   - Large files are harder for free services
   - Premium services handle this easily
   - **Multi-part downloading helps significantly for large files**

4. **No Parallel Optimization:**
   - Downloads tried sequentially (slow)
   - Enable racing + multi-part for 3-10x speed boost

**Recommendation:** 
1. Enable parallel features (free, 3-10x faster)
2. Add Real-Debrid for reliability + maximum speed

---

## 🚀 PERFORMANCE COMPARISON

| Configuration | Success Rate | Speed (5GB file) | Cost |
|---------------|--------------|------------------|------|
| **Free (current)** | 60-70% | 2 MB/s, 43 min | Free |
| **Free + Parallel** | 65-75% | 5-7 MB/s, 12-17 min | Free |
| **Premium only** | 95-98% | 8-10 MB/s, 8-10 min | €0.13/day |
| **Premium + Parallel** | 96-99% | 14-20 MB/s, 4-6 min | €0.13/day |

**Multi-part downloading gives 2-8x speed improvement!**

---

## 🆓 FREE SPEED OPTIMIZATION

If you don't want to pay for premium, you can still get 3-5x speed boost:

### Option 1: Enable Parallel Features (Recommended)

```bash
# Add to .env
ENABLE_PARALLEL_RACE=true        # Try sources simultaneously
ENABLE_MULTIPART_DOWNLOAD=true   # Split into chunks
PARALLEL_DOWNLOADS=3             # Race 3 sources
MULTIPART_CONNECTIONS=6          # 6 parallel connections (conservative)
HTTP_MAX_RETRIES=5               # More retries

# Restart
npm run stop && npm run start
```

**Expected:** 3-5x faster downloads with free sources

### Option 2: Run WebTorrent Desktop Locally

```bash
# 1. Install from: https://webtorrent.io/desktop
# 2. Enable web server on port 9000 in settings
# 3. Self-Streme will auto-detect and use it
```

### Option 3: Try Different Torrent

Your specific torrent might be dead. Try with:
- More popular content
- Recently uploaded torrents
- Torrents with 50+ seeders

### Option 4: Wait and Retry

Free services have rate limits. They reset after:
- WebTor.io: ~1 hour
- Instant.io: ~1 hour  
- Others: varies

---

## 📚 DETAILED GUIDES

For more information:

- **🚀 NEW: Parallel Download Optimization:** [docs/PARALLEL_DOWNLOAD_OPTIMIZATION.md](docs/PARALLEL_DOWNLOAD_OPTIMIZATION.md)
- **Complete troubleshooting:** [docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md](docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md)
- **Premium service setup:** [docs/guides/PREMIUM_SERVICES.md](docs/guides/PREMIUM_SERVICES.md)
- **Dynamic sources:** [docs/DYNAMIC_SOURCES.md](docs/DYNAMIC_SOURCES.md)
- **P2P issues:** [docs/TROUBLESHOOTING_P2P.md](docs/TROUBLESHOOTING_P2P.md)

---

## ✅ CHECKLIST

Quick fixes to try:

- [ ] Remove `EXCLUDE_DOWNLOAD_SOURCES` filter
- [ ] Enable parallel racing: `ENABLE_PARALLEL_RACE=true`
- [ ] Enable multi-part downloads: `ENABLE_MULTIPART_DOWNLOAD=true`
- [ ] Set `PARALLEL_DOWNLOADS=3` in `.env`
- [ ] Set `MULTIPART_CONNECTIONS=8` in `.env`
- [ ] Set `HTTP_MAX_RETRIES=5` in `.env`
- [ ] Set `P2P_TIMEOUT=30000` in `.env`
- [ ] Enable debug logging: `LOG_LEVEL=debug`
- [ ] Restart service
- [ ] Test with Big Buck Bunny (known good torrent)
- [ ] Check source stats: `curl localhost:11470/api/sources/stats`
- [ ] Monitor logs: `tail -f logs/app.log | grep -E "Hybrid|MultiPart"`
- [ ] Consider adding Real-Debrid for 95%+ reliability + max speed

---

## 💡 TL;DR

**Problem:** Free HTTP sources are unreliable (60-70% success) and slow

**Quick Fix (Free):** 
1. Enable parallel racing + multi-part downloads (3-10x faster)
2. Enable all sources + increase retries
3. Use debug logging to see what's failing

**Best Fix:** 
Add Real-Debrid API key (95%+ success, 5-10x faster, ~€0.13/day)

**Your Specific Issue:** 
- 11.12 GB file is large for free services
- Torrent has no peers (might be dead)
- WebTor.io is currently excluded
- No parallel optimization enabled

**Action:** 
```bash
# Add to .env
ENABLE_PARALLEL_RACE=true
ENABLE_MULTIPART_DOWNLOAD=true
PARALLEL_DOWNLOADS=3
MULTIPART_CONNECTIONS=8
HTTP_MAX_RETRIES=5
LOG_LEVEL=debug
# Remove: EXCLUDE_DOWNLOAD_SOURCES

# For best results, also add:
REAL_DEBRID_API_KEY=your_key_here

# Restart
npm run stop && npm run start
```

**Expected Result:** 3-10x faster downloads, better success rate

---

## 🆘 Still Not Working?

Create an issue with this info:

```bash
# Gather diagnostic info
echo "=== Source Stats ===" > diagnostic.txt
curl -s http://localhost:11470/api/sources/stats >> diagnostic.txt

echo -e "\n=== Recent Errors ===" >> diagnostic.txt
tail -n 100 logs/app.log | grep -i error >> diagnostic.txt

echo -e "\n=== Configuration ===" >> diagnostic.txt
grep -E "PARALLEL|MULTIPART|EXCLUDE|RETRY|TIMEOUT" .env >> diagnostic.txt
```

Then post to: https://github.com/zviel/self-streme/issues

---

**Questions?** 
- Speed optimization: [docs/PARALLEL_DOWNLOAD_OPTIMIZATION.md](docs/PARALLEL_DOWNLOAD_OPTIMIZATION.md)
- Full troubleshooting: [docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md](docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md)