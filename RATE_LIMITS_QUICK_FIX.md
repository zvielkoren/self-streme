# Quick Fix: HTTP 403 Errors from Free Sources

**Problem:** Getting errors like:
```
[Hybrid] WebTor.io failed: HTTP 403 - Forbidden
[Hybrid] Instant.io failed: HTTP 403 - Forbidden
```

## What's Happening?

Free streaming services (WebTor.io, Instant.io) have **strict rate limits**:
- **~10-20 requests per hour**
- After that, you get blocked for 30-60 minutes

## Solutions (Pick One)

### ✅ Solution 1: Add Premium Service (Best - 95% Success Rate)

**Takes 2 minutes, costs €0.09/day:**

1. Sign up at [Real-Debrid](https://real-debrid.com)
2. Get API key from [here](https://real-debrid.com/apitoken)
3. Add to `.env` file:
   ```bash
   REAL_DEBRID_API_KEY=your_api_key_here
   ```
4. Restart:
   ```bash
   npm run stop && npm run start
   # or with Docker:
   docker-compose restart
   ```

**Why?** Premium services have 100x higher rate limits and 95%+ reliability.

---

### ⏳ Solution 2: Wait for Rate Limit Reset

**If you're just testing or using occasionally:**

```bash
# Wait 60 minutes, then try again
# Rate limits typically reset after 1 hour
```

Check if reset:
```bash
INFO_HASH="dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"  # Test torrent
curl -I "https://webtor.io/api/torrent/${INFO_HASH}/stream/video.mp4"
# HTTP 200 = Reset ✅
# HTTP 403 = Still blocked ⏳
```

---

### 🚫 Solution 3: Disable Rate-Limited Sources (Temporary)

**Immediate workaround while waiting:**

Add to `.env`:
```bash
EXCLUDE_DOWNLOAD_SOURCES="WebTor.io,Instant.io"
```

Restart:
```bash
npm run stop && npm run start
```

**Note:** This might reduce success rate if you don't have other sources configured.

---

### 🆓 Solution 4: Use Local WebTorrent Desktop (Free Alternative)

**No rate limits, but requires seeders:**

1. Download [WebTorrent Desktop](https://webtorrent.io/desktop)
2. Install and open it
3. Enable streaming server:
   - Open Preferences
   - Advanced → Enable Web Server (Port 9000)
4. Self-Streme will automatically detect it!

**Success Rate:** 70-85% (depends on torrent popularity)  
**Cost:** Free

---

## Configuration Comparison

| Setup | Success Rate | Rate Limits | Cost |
|-------|--------------|-------------|------|
| Free sources only | 60-70% | ❌ ~10/hour | Free |
| **Premium (Real-Debrid)** | **95-98%** | ✅ **1000+/hour** | **€0.09/day** |
| Local WebTorrent | 70-85% | ✅ None | Free |
| Premium + Free fallback | 96-99% | ✅ 1000+/hour | €0.09/day |

---

## Recommended Setup (Best Value)

```bash
# .env configuration

# Add premium service (95%+ success)
REAL_DEBRID_API_KEY=your_key_here

# Quick P2P timeout (fail fast to premium)
P2P_TIMEOUT=10000

# Keep free sources as backup (don't exclude)
# Premium will be tried first automatically

# Result: 96-99% success rate, <5s start time
```

---

## Still Having Issues?

### Check Source Health
```bash
curl http://localhost:7000/api/sources/stats | jq
```

Look for sources with `"available": false` or high `"failures"` count.

### Enable Debug Logging
```bash
# In .env
LOG_LEVEL=debug

# Restart and watch logs
npm run stop && npm run start
tail -f logs/app.log
```

### Get More Help

- **Full Guide:** [docs/guides/RATE_LIMIT_SOLUTIONS.md](docs/guides/RATE_LIMIT_SOLUTIONS.md)
- **Troubleshooting:** [docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md](docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md)
- **GitHub Issues:** https://github.com/zviel/self-streme/issues

---

## Why Premium is Worth It

**Time saved in 1 month:**
- Debugging rate limits: ~2 hours × $50/hour = $100
- Real-Debrid cost: €2.70/month = $3

**You save $97 and get better reliability. It's a no-brainer for production use.**

---

**Quick Action:** If you're reading this because of errors, just add Real-Debrid API key. It will solve 95% of your issues immediately.

**Get started:** https://real-debrid.com (€16 for 180 days)
