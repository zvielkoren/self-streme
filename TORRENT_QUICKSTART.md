# 🚀 Torrent Streaming Service - Quick Start Guide

Get up and running with the torrent streaming service in 5 minutes!

---

## ⚡ Super Quick Start

```bash
# 1. Start the server
npm run start:torrent

# 2. Open in browser
open http://localhost:7000/test-torrent-streaming

# 3. Try a test torrent
# Click "Show Examples" and select "Big Buck Bunny"
# Click "Add Torrent" → "Stream Video"
```

That's it! 🎉

---

## 📦 Installation

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- npm (comes with Node.js)

### Install Dependencies
```bash
npm install
```

---

## 🎬 Usage

### Method 1: Web Interface (Easiest)

1. **Start the server:**
   ```bash
   npm run start:torrent
   ```

2. **Open test interface:**
   ```
   http://localhost:7000/test-torrent-streaming
   ```

3. **Add a torrent:**
   - Click "Show Examples"
   - Select "Big Buck Bunny" (legal, open source movie)
   - Click "Add Torrent"
   - Wait for download to start
   - Click "Stream Video"

### Method 2: API (curl)

```bash
# 1. Start server
npm run start:torrent

# 2. Add torrent (in new terminal)
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'

# 3. Get status
curl http://localhost:7000/api/torrents/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c

# 4. Stream (open in browser or VLC)
open http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

### Method 3: Video Player (VLC, MPV, etc.)

```bash
# VLC
vlc http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c

# MPV
mpv http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c

# ffplay (ffmpeg)
ffplay http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

---

## 🌐 Access Points

Once started, the server provides:

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:7000/` | Home page with API overview |
| `http://localhost:7000/test-torrent-streaming` | **Interactive test interface** |
| `http://localhost:7000/docs` | Complete API documentation |
| `http://localhost:7000/health` | Health check endpoint |
| `http://localhost:7000/api/cache-stats` | Cache statistics |

---

## 📡 API Endpoints

### Add Torrent
```bash
POST /api/torrents
Content-Type: application/json

{
  "magnetUri": "magnet:?xt=urn:btih:INFOHASH"
}
```

### Get Status
```bash
GET /api/torrents/:infoHash
```

### Stream Video
```bash
GET /stream/proxy/:infoHash
```

### List Files
```bash
GET /api/torrents/:infoHash/files
```

### Remove Torrent
```bash
DELETE /api/torrents/:infoHash?deleteFiles=true
```

---

## 🧪 Test Torrents

Use these legal, public domain torrents for testing:

### Big Buck Bunny (Open Source Movie)
```
Info Hash: dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
Size: ~700MB
Quality: 1080p
```

**Add it:**
```bash
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'
```

**Stream it:**
```
http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

### Sintel (Open Source Movie)
```
Info Hash: 08ada5a7a6183aae1e09d831df6748d566095a10
Size: ~900MB
Quality: 1080p
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file (optional):

```env
# Server
PORT=7000

# Cache
CACHE_BACKEND=memory          # memory, sqlite, redis
CACHE_MAX_SIZE=1000           # max files
CACHE_MAX_DISK_MB=5000        # 5GB limit

# Torrent
TORRENT_TIMEOUT=60000         # 60 seconds
TORRENT_MAX_RETRIES=3         # retry attempts
```

### Quick Configs

**Development (fast, no persistence):**
```env
CACHE_BACKEND=memory
CACHE_MAX_SIZE=100
CACHE_MAX_DISK_MB=1000
```

**Production (persistent, scalable):**
```env
CACHE_BACKEND=redis
CACHE_MAX_SIZE=10000
CACHE_MAX_DISK_MB=50000
REDIS_URL=redis://localhost:6379
```

---

## 🔥 Firewall Setup

The service needs these ports open:

```bash
# BitTorrent ports (required for P2P)
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp

# HTTP server
sudo ufw allow 7000/tcp
```

**Without these ports, torrents won't download!**

---

## 💡 Tips & Tricks

### Instant Playback (Cache)
Once a torrent is downloaded, it's cached. Next time you request it, playback is instant!

```bash
# First time: 10-30 seconds to start
GET /stream/proxy/HASH

# Second time: < 1 second (instant!)
GET /stream/proxy/HASH
```

### Monitor Progress
```bash
# Auto-refresh every 5 seconds
watch -n 5 curl -s http://localhost:7000/api/torrents/HASH | jq
```

### Check Cache Status
```bash
curl http://localhost:7000/api/cache-stats | jq
```

### Force Cache Cleanup
```bash
curl -X POST http://localhost:7000/api/cache-config \
  -H "Content-Type: application/json" \
  -d '{"forceCleanup": true}'
```

---

## 🎯 Common Use Cases

### 1. Personal Media Server
Stream your torrent library to any device on your network.

### 2. Preview Before Download
Check torrent quality before committing to full download.

### 3. Mobile Streaming
Stream to iPhone/Android with full seeking support.

### 4. Multi-Device Access
Access from TV, tablet, phone, computer simultaneously.

### 5. Smart TV Streaming
Use TV's browser or media player to stream torrents.

---

## 🔧 Troubleshooting

### No Peers Found
```
Error: Timeout: No peers found after 60 seconds
```
**Fix:** Check firewall, increase timeout, try different torrent

### Can't Access from Other Devices
**Fix:** Use your server's IP instead of localhost:
```
http://192.168.1.100:7000
```
Find your IP: `hostname -I`

### Streaming Doesn't Start
**Fix:** Wait for download to reach ~5-10% first

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::7000
```
**Fix:** Change port: `PORT=8000 npm run start:torrent`

### Out of Disk Space
**Fix:** Reduce cache size or cleanup:
```env
CACHE_MAX_DISK_MB=2000
```
Or force cleanup via API

---

## 📊 Performance

### Expected Performance
- **Cache Hit**: < 100ms (instant)
- **First Stream**: 5-30s to start (depends on peers)
- **Seeking**: Instant (Range Request support)
- **Concurrent Streams**: 10-50 (depends on hardware)

### Optimize for Speed
1. Use Redis: `CACHE_BACKEND=redis`
2. Use SSD for cache storage
3. Increase cache size: `CACHE_MAX_SIZE=10000`
4. Lower timeout for faster fails: `TORRENT_TIMEOUT=30000`

---

## 🎓 Next Steps

### Learn More
- **Full Documentation**: [TORRENT_STREAMING_SERVICE.md](./TORRENT_STREAMING_SERVICE.md)
- **API Reference**: http://localhost:7000/docs
- **Health Check**: http://localhost:7000/health

### Advanced Topics
- Docker deployment
- Reverse proxy setup (nginx)
- Redis cache backend
- Production security
- Rate limiting
- User authentication

---

## 🆘 Need Help?

1. **Check health**: `curl http://localhost:7000/health`
2. **View logs**: Check console output
3. **Test connectivity**: Try example torrents first
4. **Read docs**: [TORRENT_STREAMING_SERVICE.md](./TORRENT_STREAMING_SERVICE.md)
5. **Check firewall**: Ensure ports 6881-6889 are open

---

## 📝 Example Workflow

```bash
# Terminal 1: Start server
npm run start:torrent

# Terminal 2: Add torrent
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}' | jq

# Terminal 2: Check progress
curl http://localhost:7000/api/torrents/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c | jq .data.progress

# Terminal 2: Open in browser when ready
open http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

---

## 🎉 You're Ready!

Start streaming torrents with:
```bash
npm run start:torrent
```

Open the test interface:
```
http://localhost:7000/test-torrent-streaming
```

Happy streaming! 🍿

---

**Made with ❤️ for the streaming community**