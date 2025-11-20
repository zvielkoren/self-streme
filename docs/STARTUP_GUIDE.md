# 🚀 Self-Streme Startup Guide

Welcome to Self-Streme! This guide explains how to start and use both services included in this project.

---

## 📦 What's Included

Self-Streme now includes **TWO powerful services**:

### 1. 🎭 Stremio Addon Service (Port 7000 & 7001)
The original Stremio addon that integrates with Stremio apps to provide streaming sources.

### 2. 🎬 Torrent Streaming Service (Port 7000)
A standalone torrent streaming platform with REST API, similar to Real-Debrid.

**Both services can run together!** They share the same cache system and complement each other.

---

## 🚀 Quick Start Options

### Option 1: Full Service (Recommended) ⭐

**Run both Stremio addon + Torrent streaming together:**

```bash
# Start the complete service
npm start

# Or for development with auto-reload
npm run dev
```

**Access:**
- **Stremio Addon**: http://localhost:7001/manifest.json
- **Torrent API**: http://localhost:7000/api/torrents
- **Test UI**: http://localhost:7000/test-torrent-streaming
- **Main Page**: http://localhost:7000/

This is the **recommended** option as it gives you everything!

---

### Option 2: Torrent Streaming Only

**Run just the torrent streaming service:**

```bash
# Start torrent server only
npm run start:torrent

# Or for development
npm run dev:torrent
```

**Access:**
- **Home**: http://localhost:7000/
- **Test UI**: http://localhost:7000/test-torrent-streaming
- **API Docs**: http://localhost:7000/docs
- **Health Check**: http://localhost:7000/health

Use this if you only need the torrent streaming API.

---

## 🌐 Access Points

### After Starting (Option 1 - Full Service)

| URL | Service | Purpose |
|-----|---------|---------|
| `http://localhost:7000/` | Both | Installation page |
| `http://localhost:7001/manifest.json` | Stremio | Addon manifest for Stremio app |
| `http://localhost:7000/test-torrent-streaming` | Torrent | Interactive test interface |
| `http://localhost:7000/api/torrents` | Torrent | REST API endpoint |
| `http://localhost:7000/docs` | Both | API documentation |
| `http://localhost:7000/health` | Both | Health check |

---

## 🎯 Usage Examples

### Using with Stremio App

1. **Start the service:**
   ```bash
   npm start
   ```

2. **Open Stremio** on your device

3. **Add the addon:**
   - Go to Addons → Community Addons
   - Click "Install from URL"
   - Enter: `http://localhost:7001/manifest.json`
   - Or from LAN: `http://YOUR_IP:7001/manifest.json`

4. **Watch content** - Search for movies/series in Stremio!

---

### Using Torrent Streaming API

#### Web Interface (Easiest)

1. **Start the service:**
   ```bash
   npm start
   ```

2. **Open test interface:**
   ```
   http://localhost:7000/test-torrent-streaming
   ```

3. **Try example torrent:**
   - Click "Show Examples"
   - Select "Big Buck Bunny"
   - Click "Add Torrent"
   - Click "Stream Video"

#### API (curl)

```bash
# Add a torrent
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'

# Get status
curl http://localhost:7000/api/torrents/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c

# Stream it
open http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Server Ports
PORT=7000                     # Main server port
ADDON_PORT=7001               # Stremio addon port

# Cache Configuration
CACHE_BACKEND=memory          # memory, sqlite, redis
CACHE_MAX_SIZE=1000           # max cached files
CACHE_MAX_DISK_MB=5000        # 5GB limit
CACHE_CLEANUP_INTERVAL=300    # cleanup every 5 minutes

# Torrent Configuration
TORRENT_TIMEOUT=60000         # 60 seconds
TORRENT_MAX_RETRIES=3         # retry attempts
TORRENT_MAX_CONNECTIONS=25    # max peer connections

# Logging
LOG_LEVEL=info                # debug, info, warn, error
```

### Cache Backends

Choose based on your needs:

| Backend | Best For | Persistence | Scalability |
|---------|----------|-------------|-------------|
| `memory` | Development, testing | ❌ No | 1-5 users |
| `sqlite` | Small production | ✅ Yes | 5-20 users |
| `redis` | Large production | ✅ Yes | 50+ users |

---

## 🔥 Firewall Configuration (Important!)

**Required for torrent streaming to work:**

```bash
# Linux (ufw)
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp
sudo ufw allow 7000/tcp
sudo ufw allow 7001/tcp

# Linux (iptables)
iptables -A INPUT -p tcp --dport 6881:6889 -j ACCEPT
iptables -A INPUT -p udp --dport 6881:6889 -j ACCEPT
iptables -A INPUT -p tcp --dport 7000 -j ACCEPT
iptables -A INPUT -p tcp --dport 7001 -j ACCEPT
```

**Without ports 6881-6889 open, torrents won't download!**

---

## 📊 Service Comparison

### When to Use Each Service

#### Use Stremio Addon When:
- ✅ You want to watch content in Stremio app
- ✅ You prefer browsing content in Stremio's interface
- ✅ You want automatic source discovery
- ✅ You need subtitle support
- ✅ You want a TV-friendly interface

#### Use Torrent Streaming API When:
- ✅ You want direct torrent-to-HTTP streaming
- ✅ You need a REST API for automation
- ✅ You want to build custom apps
- ✅ You prefer programmatic control
- ✅ You need to stream from any video player (VLC, MPV, etc.)

#### Use Both Together When:
- ✅ You want maximum flexibility
- ✅ You want to cache torrents for Stremio
- ✅ You need both UI and API access
- ✅ You want the best of both worlds

---

## 🧪 Testing

### Test Stremio Addon

1. Start service: `npm start`
2. Open Stremio app
3. Add addon: `http://localhost:7001/manifest.json`
4. Search for "Big Buck Bunny" or any movie
5. Click play and select "Self-Streme" source

### Test Torrent Streaming

1. Start service: `npm start`
2. Open: http://localhost:7000/test-torrent-streaming
3. Click "Show Examples"
4. Select "Big Buck Bunny"
5. Click "Add Torrent"
6. Wait 10-30 seconds
7. Click "Stream Video"

### Test with VLC Player

```bash
# Start service
npm start

# In another terminal, add torrent
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'

# Stream with VLC
vlc http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

---

## 🔧 Troubleshooting

### Service Won't Start

**Error: Port already in use**
```bash
# Change ports in .env
PORT=8000
ADDON_PORT=8001
```

**Error: Cannot find module**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Torrents Not Downloading

**No peers found**
- Check firewall (ports 6881-6889 must be open)
- Try different torrent
- Increase timeout: `TORRENT_TIMEOUT=120000`

**Connection timeout**
- Verify internet connectivity
- Check if DHT is working: `curl http://localhost:7000/status`
- Try example torrents first (Big Buck Bunny)

### Can't Access from Other Devices

**Use server's IP address:**
```bash
# Find your IP
hostname -I  # Linux/Mac
ipconfig     # Windows

# Access from other device
http://192.168.1.100:7000
http://192.168.1.100:7001/manifest.json
```

### Stremio Addon Not Working

**Addon not appearing in Stremio:**
1. Check if service is running: `curl http://localhost:7001/manifest.json`
2. Try re-adding the addon
3. Restart Stremio app
4. Check Stremio logs

**No streams found:**
1. Check if content is available
2. Try different sources
3. Check server logs
4. Verify torrent providers are working

---

## 📚 Documentation

### Complete Documentation

- **[README.md](./README.md)** - Main project documentation
- **[TORRENT_README.md](./TORRENT_README.md)** - Torrent streaming overview
- **[TORRENT_QUICKSTART.md](./TORRENT_QUICKSTART.md)** - 5-minute quick start
- **[TORRENT_STREAMING_SERVICE.md](./TORRENT_STREAMING_SERVICE.md)** - Complete technical docs
- **[TORRENT_IMPLEMENTATION_COMPLETE.md](./TORRENT_IMPLEMENTATION_COMPLETE.md)** - Implementation details

### Quick Links

- **Health Check**: http://localhost:7000/health
- **API Docs**: http://localhost:7000/docs
- **Test Interface**: http://localhost:7000/test-torrent-streaming

---

## 🚢 Deployment

### Development

```bash
npm run dev
```

### Production

```bash
NODE_ENV=production npm start
```

### Docker

```bash
docker-compose up -d
```

See [TORRENT_STREAMING_SERVICE.md](./TORRENT_STREAMING_SERVICE.md) for complete Docker setup.

---

## 💡 Pro Tips

### 1. Use Both Services Together
Start with `npm start` to get both Stremio addon and torrent API. They share the same cache!

### 2. Cache Hits are Instant
Once a torrent is cached, streaming is instant (< 100ms). First request: 10-30s, second request: instant!

### 3. Monitor with Health Check
```bash
# Auto-refresh every 5 seconds
watch -n 5 curl -s http://localhost:7000/health | jq
```

### 4. Use Redis for Production
```env
CACHE_BACKEND=redis
REDIS_URL=redis://localhost:6379
```

### 5. Access from Multiple Devices
Use your server's local IP to access from phones, tablets, Smart TVs, etc.

---

## 🎬 Example Workflows

### Workflow 1: Watch in Stremio

```bash
# 1. Start service
npm start

# 2. Add to Stremio
# Open Stremio → Addons → Install from URL
# http://localhost:7001/manifest.json

# 3. Watch
# Search for any movie/series in Stremio
# Select "Self-Streme" source
```

### Workflow 2: API Automation

```bash
# 1. Start service
npm start

# 2. Add torrent
curl -X POST http://localhost:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:HASH"}'

# 3. Monitor progress
watch -n 2 "curl -s http://localhost:7000/api/torrents/HASH | jq .data.progress"

# 4. Stream when ready
open http://localhost:7000/stream/proxy/HASH
```

### Workflow 3: Multi-Device Streaming

```bash
# 1. Start service on server
npm start

# 2. Add torrent (from any device)
curl -X POST http://192.168.1.100:7000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:HASH"}'

# 3. Stream from any device
# TV: Open http://192.168.1.100:7000/stream/proxy/HASH
# Phone: Same URL
# Tablet: Same URL
# All devices stream the same cached file!
```

---

## 🎉 You're All Set!

### Start Now:

```bash
# Install dependencies (first time only)
npm install

# Start everything
npm start
```

### Access Points:
- **Stremio**: http://localhost:7001/manifest.json
- **Test UI**: http://localhost:7000/test-torrent-streaming
- **API**: http://localhost:7000/api/torrents
- **Health**: http://localhost:7000/health

### Need Help?
- Check logs in the console
- Run health check: `curl http://localhost:7000/health`
- Review documentation files
- Test with example torrents

---

**Happy Streaming! 🍿**

Built with ❤️ for the self-hosting community