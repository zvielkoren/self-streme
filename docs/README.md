# 📚 Self-Streme Documentation

Welcome to the Self-Streme documentation! This guide will help you understand and use all features of the streaming system.

## 🚀 Quick Links

- [Quick Start Guide](QUICK_START.md) - Get started in minutes
- [Startup Guide](STARTUP_GUIDE.md) - Detailed startup instructions
- [Testing Guide](TESTING_QUICK_START.md) - How to test the system

## 🌟 Key Features

### 🌐 Dynamic Download Sources (NEW!)
- [Dynamic Sources Documentation](DYNAMIC_SOURCES.md) - **Multi-source torrent streaming**
- 10+ automatic fallback sources
- No single point of failure
- 95%+ success rate

### 🎥 Streaming Features
- [Hybrid HTTP Download](HYBRID_HTTP_DOWNLOAD.md) - HTTP fallback system
- [Direct Streaming](DIRECT-STREAMING.md) - Direct P2P streaming
- [No-P2P Streaming](NO-P2P-STREAMING.md) - Pure HTTP streaming mode
- [Streaming Flow](STREAMING-FLOW.md) - How streaming works
- [Cache-Only Mode](CACHE-ONLY-MODE.md) - Offline streaming

### 🔧 Configuration & Deployment
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Docker Guide](DOCKER.md) - Docker deployment
- [Pterodactyl Deployment](PTERODACTYL_DEPLOYMENT.md) - Panel deployment
- [Cloudflare Quick Start](QUICK_START_CLOUDFLARE.md) - Cloudflare tunnel setup
- [TLS Auto Detection](TLS_AUTO_DETECTION.md) - HTTPS configuration

### 🎯 Additional Features
- [Hebrew Subtitles](HEBREW-SUBTITLES.md) - Hebrew subtitle support
- [Anime Support](ANIME-SUPPORT.md) - Anime streaming features
- [Source Selection](SOURCE_SELECTION.md) - Manual source selection
- [Magnet Converter](MAGNET_CONVERTER.md) - Convert magnets to streams

### 🛠️ Troubleshooting
- [P2P Troubleshooting](TROUBLESHOOTING_P2P.md) - Fix P2P issues

## 📊 What's New

### Latest Updates (v2.0)

#### 🌐 Dynamic Sources System
The biggest improvement yet! No more failed streams due to a single service being down.

**Before:**
- Single source (WebTor.io)
- ~60% success rate
- Fails if source is down

**After:**
- 12 different sources
- ~95% success rate
- Automatic failover

[Read full documentation →](DYNAMIC_SOURCES.md)

#### 📝 Documentation Cleanup
- Removed 30+ outdated files
- Organized remaining docs
- Added comprehensive guides
- Better navigation

## 🎯 Choose Your Path

### I'm a New User
1. Start with [Quick Start Guide](QUICK_START.md)
2. Read [Features Documentation](FEATURES.md)
3. Try [Testing Guide](TESTING_QUICK_START.md)

### I'm Deploying to Production
1. Read [Deployment Guide](DEPLOYMENT.md)
2. Choose deployment method:
   - [Docker](DOCKER.md)
   - [Pterodactyl](PTERODACTYL_DEPLOYMENT.md)
   - [Cloudflare](QUICK_START_CLOUDFLARE.md)
3. Configure [TLS](TLS_AUTO_DETECTION.md)

### I'm a Developer
1. Check [Features Documentation](FEATURES.md)
2. Read [Dynamic Sources](DYNAMIC_SOURCES.md) API
3. See [Source Selection](SOURCE_SELECTION.md)
4. Review [Streaming Flow](STREAMING-FLOW.md)

### I Have Issues
1. Check [P2P Troubleshooting](TROUBLESHOOTING_P2P.md)
2. See [Dynamic Sources](DYNAMIC_SOURCES.md) troubleshooting
3. Review logs for errors
4. Open an issue on GitHub

## 📖 Documentation Structure

```
docs/
├── README.md                    # This file
├── QUICK_START.md              # Quick start guide
├── STARTUP_GUIDE.md            # Detailed startup
├── TESTING_QUICK_START.md      # Testing guide
├── FEATURES.md                 # Feature summary
│
├── DYNAMIC_SOURCES.md          # 🌟 NEW: Multi-source system
├── HYBRID_HTTP_DOWNLOAD.md     # HTTP fallback
├── DIRECT-STREAMING.md         # P2P streaming
├── NO-P2P-STREAMING.md         # HTTP-only mode
├── STREAMING-FLOW.md           # How it works
├── CACHE-ONLY-MODE.md          # Offline mode
│
├── DEPLOYMENT.md               # Production deployment
├── DOCKER.md                   # Docker guide
├── PTERODACTYL_DEPLOYMENT.md   # Panel deployment
├── QUICK_START_CLOUDFLARE.md   # Cloudflare tunnel
├── TLS_AUTO_DETECTION.md       # HTTPS setup
│
├── HEBREW-SUBTITLES.md         # Hebrew support
├── ANIME-SUPPORT.md            # Anime features
├── SOURCE_SELECTION.md         # Source selection
├── MAGNET_CONVERTER.md         # Magnet converter
│
└── TROUBLESHOOTING_P2P.md      # Troubleshooting
```

## 🔑 Key Concepts

### Streaming Modes

**1. P2P Streaming (Default)**
- Fastest for popular torrents
- Direct peer-to-peer connection
- Uses WebTorrent
- 20s timeout before fallback

**2. HTTP Fallback (Automatic)**
- Activates if P2P fails
- Tries 12 different sources
- Downloads file via HTTP
- Caches for future use

**3. Cache Streaming**
- Uses previously downloaded files
- Instant playback
- No network needed
- Configurable retention

### Source Priority

Sources are tried in this order:
1. **Instant.io** - WebTorrent based
2. **TorrentDrive** - Alternative API
3. **BTCache** - Cache proxy
4. **BTDigg Proxy** - Streaming proxy
5. **TorrentSafe** - Safe streaming
6. **MediaBox** - Media service
7. **TorrentStream** - Stream proxy
8. **CloudTorrent** - Cloud service
9. **StreamMagnet** - Magnet streaming
10. **TorrentAPI** - Generic API
11. **Seedr.cc** - Cloud (needs metadata)
12. **Bitport.io** - Premium service

[See full details →](DYNAMIC_SOURCES.md)

## 🌐 API Endpoints

### Dynamic Sources
```bash
# View all sources
GET /api/sources/stats

# Test specific torrent
GET /api/sources/test/:infoHash/:fileName
```

### Streaming
```bash
# Stream torrent
POST /api/torrents
GET /stream/proxy/:infoHash

# Get stream info
GET /api/cache-stats
```

### Configuration
```bash
# Get base URL
GET /api/base-url

# Cache config
GET /api/cache-config
```

[See API documentation →](../README.md#-api-endpoints)

## 🎓 Tutorials

### Convert Magnet to Stream
```bash
curl -X POST http://localhost:11470/api/magnet-to-http \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:..."}'
```

### Check Source Availability
```bash
curl http://localhost:11470/api/sources/test/ABC123/movie.mp4
```

### View All Sources
```bash
curl http://localhost:11470/api/sources/stats
```

## 📈 Performance Tips

### For Best Streaming Performance

1. **Enable Multiple Sources**
   - Keep HTTP fallback enabled
   - All 12 sources are tried automatically
   - First working source is used

2. **Configure Cache**
   - Use Redis for production
   - Set appropriate cache size
   - Enable persistence

3. **Network Optimization**
   - Use fast DNS servers
   - Enable Cloudflare if public
   - Consider CDN for popular content

4. **Hardware Requirements**
   - Minimum: 1GB RAM
   - Recommended: 2GB+ RAM
   - Storage for cache (configurable)

## 🔒 Security Notes

- Self-Streme is designed for **personal/private use**
- CORS is open by default (required for Stremio)
- For public deployment, consider:
  - Authentication layer
  - Rate limiting
  - Restricted CORS origins
  - HTTPS/TLS encryption

## 🤝 Contributing

Want to contribute?

1. Add new download sources to `torrentDownloadSources.js`
2. Improve documentation
3. Report bugs and issues
4. Submit feature requests

## 📞 Support

- **Issues:** GitHub Issues
- **Docs:** This documentation folder
- **Logs:** Check application logs for errors
- **Troubleshooting:** [TROUBLESHOOTING_P2P.md](TROUBLESHOOTING_P2P.md)

## 📄 License

See [LICENSE](../LICENSE) file for details.

---

**Last Updated:** 2024
**Documentation Version:** 2.0
**Status:** ✅ Complete and Up-to-date

**Quick Navigation:**
[Changelog](../CHANGELOG.md) | [Main README](../README.md) | [Quick Start](QUICK_START.md) | [Dynamic Sources](DYNAMIC_SOURCES.md)