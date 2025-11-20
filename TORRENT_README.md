# 🎬 Torrent Streaming Service

**A complete self-hosted torrent streaming platform built with Node.js and WebTorrent**

Stream torrents directly over HTTP with full Range Request support, intelligent caching, and production-ready features.

---

## 🌟 Overview

This is a comprehensive torrent streaming service similar to Real-Debrid or Premiumize, but **fully self-hosted** and under your control. Accept magnet links, download via BitTorrent (DHT + 30+ trackers), cache intelligently, and stream over HTTP with full video player support.

### ✨ Key Features

- ✅ **WebTorrent Integration** - Pure JavaScript BitTorrent client
- ✅ **HTTP Range Requests** - Full 206 Partial Content support for video seeking
- ✅ **Smart Caching** - LRU cache with Memory/SQLite/Redis backends
- ✅ **Sequential Download** - Optimized for streaming from start
- ✅ **DHT + 30+ Trackers** - Excellent peer discovery
- ✅ **60s Timeout** - Fast-fail for dead torrents
- ✅ **Retry Logic** - Exponential backoff (3 retries)
- ✅ **Multi-File Support** - Handle torrents with multiple files
- ✅ **RESTful API** - Complete CRUD operations
- ✅ **Test Interface** - Beautiful web UI for testing
- ✅ **Production Ready** - Docker, nginx, systemd configs included

---

## 🚀 Quick Start (2 Minutes)

### 1. Install & Start

```bash
# Install dependencies
npm install

# Start the server
npm run start:torrent
```

### 2. Open Test Interface

```
http://localhost:7000/test-torrent-streaming
```

### 3. Try Example Torrent

1. Click **"Show Examples"**
2. Select **"Big Buck Bunny"** (legal, open source movie)
3. Click **"Add Torrent"**
4. Wait 10-30 seconds for download to start
5. Click **"Stream Video"** to watch!

**That's it! 🎉**

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| **[TORRENT_QUICKSTART.md](./TORRENT_QUICKSTART.md)** | 5-minute quick start guide |
| **[TORRENT_STREAMING_SERVICE.md](./TORRENT_STREAMING_SERVICE.md)** | Complete technical documentation (1,284 lines) |
| **[TORRENT_IMPLEMENTATION_COMPLETE.md](./TORRENT_IMPLEMENTATION_COMPLETE.md)** | Implementation summary and architecture |

---

## 🎯 What Can You Do?

### Stream Any Torrent

```bash
# Add a torrent
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:YOUR_HASH"}'

# Stream it
open http://localhost:7000/stream/proxy/YOUR_HASH
```

### Watch on Any Device

- **Web Browser** - Direct playback in Chrome, Firefox, Safari
- **VLC Player** - Open network stream
- **Mobile** - iOS and Android supported
- **Smart TV** - Use TV's browser or media player

### Cache for Instant Playback

First request: Downloads torrent (10-30 seconds)  
Second request: **Instant playback** (< 100ms)

---

## 🌐 Access Points

Once started, access these endpoints:

| URL | Purpose |
|-----|---------|
| `http://localhost:7000/` | Home page with API overview |
| `http://localhost:7000/test-torrent-streaming` | **Interactive test interface** ⭐ |
| `http://localhost:7000/docs` | Complete API documentation |
| `http://localhost:7000/health` | Health check endpoint |
| `http://localhost:7000/api/cache-stats` | Cache statistics |

---

## 📡 API Endpoints

### Torrent Management

```bash
# Add torrent
POST /api/torrents
Content-Type: application/json
{"magnetUri": "magnet:?xt=urn:btih:..."}

# Get status
GET /api/torrents/:infoHash

# List files
GET /api/torrents/:infoHash/files

# Remove torrent
DELETE /api/torrents/:infoHash?deleteFiles=true

# List all
GET /api/torrents
```

### Streaming

```bash
# Stream file (with Range Request support)
GET /stream/proxy/:infoHash?fileIndex=0

# Stream specific file by index
GET /stream/file/:infoHash/:fileIndex

# Get streamable files info
GET /stream/info/:infoHash
```

### Cache Management

```bash
# Cache statistics
GET /api/cache-stats

# Cache configuration
GET /api/cache-config

# Force cleanup
POST /api/cache-config
{"forceCleanup": true}
```

---

## ⚙️ Configuration

### Quick Configuration

Create `.env` file:

```env
# Server
PORT=7000

# Cache (choose one)
CACHE_BACKEND=memory          # Development
# CACHE_BACKEND=sqlite        # Small production
# CACHE_BACKEND=redis         # Large production

# Limits
CACHE_MAX_SIZE=1000           # Max cached files
CACHE_MAX_DISK_MB=5000        # 5GB disk limit

# Torrent
TORRENT_TIMEOUT=60000         # 60 seconds
TORRENT_MAX_RETRIES=3         # Retry attempts
```

### Cache Backends

| Backend | Use Case | Persistence | Scalability |
|---------|----------|-------------|-------------|
| **Memory** | Development, testing | ❌ No | 1-5 users |
| **SQLite** | Small production | ✅ Yes | 5-20 users |
| **Redis** | Large production | ✅ Yes | 50+ users |

---

## 🔥 Firewall Configuration

**Required:** Open BitTorrent ports for P2P connectivity

```bash
# Linux (ufw)
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp
sudo ufw allow 7000/tcp

# Linux (iptables)
iptables -A INPUT -p tcp --dport 6881:6889 -j ACCEPT
iptables -A INPUT -p udp --dport 6881:6889 -j ACCEPT
iptables -A INPUT -p tcp --dport 7000 -j ACCEPT
```

**Without these ports open, torrents won't download!**

---

## 🧪 Testing

### Test Torrents (Legal, Public Domain)

**Big Buck Bunny** (Open Source Movie)
```
Info Hash: dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
Size: ~700MB
Quality: 1080p
```

**Sintel** (Open Source Movie)
```
Info Hash: 08ada5a7a6183aae1e09d831df6748d566095a10
Size: ~900MB
Quality: 1080p
```

### Test with curl

```bash
# Add torrent
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'

# Check progress
curl http://localhost:7000/api/torrents/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c

# Stream (Range Request test)
curl -H "Range: bytes=0-1023" \
  http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

---

## 📊 Performance

### Expected Performance

- **Cache Hit** (instant): < 100ms response time
- **First Stream** (uncached): 5-30s to start (depends on peers)
- **Seeking**: Instant (Range Request support)
- **Concurrent Streams**: 10-50 (depends on hardware)

### Optimization Tips

1. **Use Redis** for production: `CACHE_BACKEND=redis`
2. **Use SSD** for cache storage (mount at `./temp`)
3. **Increase cache**: `CACHE_MAX_SIZE=10000`
4. **Adjust timeout**: `TORRENT_TIMEOUT=120000` (slower networks)

---

## 🚢 Deployment

### Docker (Recommended)

```bash
# See TORRENT_STREAMING_SERVICE.md for complete Docker setup
docker-compose up -d
```

### Reverse Proxy (nginx)

```nginx
# See TORRENT_STREAMING_SERVICE.md for complete nginx config
location /stream/ {
    proxy_pass http://localhost:7000;
    proxy_buffering off;
    proxy_cache off;
}
```

### Systemd Service

```bash
# See TORRENT_STREAMING_SERVICE.md for systemd unit file
sudo systemctl enable torrent-streaming
sudo systemctl start torrent-streaming
```

---

## 🔒 Security

### Best Practices

1. **Authentication** - Add token-based auth (code examples in docs)
2. **HTTPS Only** - Use nginx or Cloudflare for SSL
3. **Rate Limiting** - Limit requests per IP
4. **Firewall** - Only open required ports
5. **Private Use** - Best for personal/private use

### Security Headers

Already implemented:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`

---

## 🔧 Troubleshooting

### Common Issues

#### No Peers Found
```
Error: Timeout: No peers found after 60 seconds
```
**Fix:** 
- Check firewall (allow ports 6881-6889)
- Try different torrent
- Increase timeout: `TORRENT_TIMEOUT=120000`

#### Can't Access from Other Devices
**Fix:** Use server's IP address instead of localhost:
```
http://192.168.1.100:7000
```
Find IP: `hostname -I`

#### Port Already in Use
**Fix:** Change port:
```bash
PORT=8000 npm run start:torrent
```

#### Streaming Doesn't Start
**Fix:** 
- Wait for download to reach ~5-10%
- Check browser console for errors
- Test with curl to verify headers

### Debug Commands

```bash
# Check health
curl http://localhost:7000/health

# View cache stats
curl http://localhost:7000/api/cache-stats

# Check torrent status
curl http://localhost:7000/status
```

---

## 📈 Monitoring

### Health Checks

```bash
# Overall health
GET /health

# System status
GET /status

# Cache statistics
GET /api/cache-stats
```

### Key Metrics

- Active torrents count
- DHT node count
- Cache hit rate
- Disk usage percentage
- Download/upload speeds
- Peer connections

---

## 🎓 Examples

### JavaScript/Node.js

```javascript
// Add and stream a torrent
const response = await fetch('http://localhost:7000/api/torrents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    magnetUri: 'magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c'
  })
});

const { data } = await response.json();
const streamUrl = `http://localhost:7000/stream/proxy/${data.infoHash}`;

// Open in video player
window.open(streamUrl);
```

### Python

```python
import requests

# Add torrent
response = requests.post('http://localhost:7000/api/torrents', json={
    'magnetUri': 'magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c'
})

data = response.json()['data']
stream_url = f"http://localhost:7000/stream/proxy/{data['infoHash']}"

print(f"Stream at: {stream_url}")
```

### cURL

```bash
# Complete workflow
HASH="dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"

# Add
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d "{\"magnetUri\": \"magnet:?xt=urn:btih:$HASH\"}"

# Monitor
watch -n 2 "curl -s http://localhost:7000/api/torrents/$HASH | jq .data.progress"

# Stream
open "http://localhost:7000/stream/proxy/$HASH"
```

---

## 📦 What's Included

### Core Components

- ✅ **TorrentService** - Complete torrent management (555 lines)
- ✅ **StreamingAPI** - HTTP streaming with Range support (337 lines)
- ✅ **TorrentAPI** - RESTful endpoints (309 lines)
- ✅ **CacheManager** - Multi-backend cache system
- ✅ **TorrentServer** - Integrated Express server (564 lines)

### Interfaces

- ✅ **Test UI** - Beautiful interactive interface (836 lines)
- ✅ **REST API** - Complete CRUD operations
- ✅ **Health Checks** - Monitoring endpoints

### Documentation

- ✅ **Quick Start Guide** (392 lines)
- ✅ **Technical Docs** (1,284 lines)
- ✅ **Implementation Summary** (852 lines)
- ✅ **API Reference** - Complete with examples

### Deployment

- ✅ **Docker** - Dockerfile and docker-compose
- ✅ **nginx** - Reverse proxy configuration
- ✅ **systemd** - Service unit file

**Total: 4,503+ lines of production code and documentation**

---

## 🎯 Comparison with Real-Debrid

| Feature | This Service | Real-Debrid |
|---------|--------------|-------------|
| **Cost** | Free (self-hosted) | $3-5/month |
| **Privacy** | 100% private | Shared service |
| **Control** | Full control | Limited |
| **Cache** | Your disk | Shared cloud |
| **Speed** | Depends on peers | Always fast |
| **Setup** | Requires setup | Instant |
| **Limits** | No limits | Rate limits |

---

## 🚀 Future Enhancements

### Planned Features

- [ ] User authentication system
- [ ] Web UI for management (React/Vue)
- [ ] Subtitle download (OpenSubtitles)
- [ ] FFmpeg transcoding
- [ ] Multi-user quotas
- [ ] Torrent search (Jackett integration)
- [ ] Mobile app (React Native)

---

## 📄 License

This software is provided for personal use only. See LICENSE file for details.

---

## 🙏 Credits

Built with:
- [WebTorrent](https://webtorrent.io/) - Streaming torrent client
- [Express](https://expressjs.com/) - Web framework
- [pump](https://github.com/mafintosh/pump) - Stream piping

---

## 📞 Support

### Quick Help

1. **Check health**: `curl http://localhost:7000/health`
2. **View logs**: Check console output
3. **Test connectivity**: Try example torrents
4. **Read docs**: See documentation files

### Resources

- **Quick Start**: [TORRENT_QUICKSTART.md](./TORRENT_QUICKSTART.md)
- **Full Docs**: [TORRENT_STREAMING_SERVICE.md](./TORRENT_STREAMING_SERVICE.md)
- **Test Interface**: http://localhost:7000/test-torrent-streaming

---

## 🎉 Get Started Now!

```bash
# Start the server
npm run start:torrent

# Open test interface
open http://localhost:7000/test-torrent-streaming

# Or add a torrent via API
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'
```

**Start streaming torrents in minutes!**

---

**🎬 Made with ❤️ for the self-hosting community 🍿**

Stream torrents your way, on your terms, with full control.