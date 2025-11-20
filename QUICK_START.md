# 🚀 Quick Start Guide

Get Self-Streme up and running in **one command**!

## One-Line Installation & Start

### Linux / macOS

```bash
./quick-start.sh
```

### Windows

```cmd
quick-start.bat
```

That's it! The script will:
1. ✅ Check Node.js installation (18+ required)
2. ✅ Install all dependencies
3. ✅ Create default `.env` configuration
4. ✅ Check port availability
5. ✅ Start the service

## What You Get

After running the quick start, you'll have access to:

| Service | URL | Description |
|---------|-----|-------------|
| **Torrent Test UI** | http://localhost:7000/test-torrent-streaming | Interactive web interface for testing |
| **API Docs** | http://localhost:7000/docs | Complete API documentation |
| **Health Check** | http://localhost:7000/health | Service status |
| **Stremio Addon** | http://localhost:7001/manifest.json | Stremio integration |

## First Test

Try streaming a public domain movie:

1. Open http://localhost:7000/test-torrent-streaming
2. Paste this magnet link:
   ```
   magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
   ```
3. Click **Add Torrent**
4. Wait for peers to connect
5. Click **Stream** when ready!

### More Test Torrents

- **Big Buck Bunny** (recommended for testing):
  ```
  magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
  ```

- **Sintel**:
  ```
  magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10
  ```

## Requirements

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **10GB+ free disk space** (for cache)
- **Open ports** for optimal performance:
  - `6881-6889` TCP/UDP (BitTorrent)
  - `7000` TCP (API & Streaming)
  - `7001` TCP (Stremio Addon)

## Port Forwarding (Optional but Recommended)

For better torrent performance, open ports on your firewall:

### Linux (ufw)
```bash
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp
sudo ufw allow 7000/tcp
sudo ufw allow 7001/tcp
```

### Windows (Administrator PowerShell)
```powershell
netsh advfirewall firewall add rule name="Self-Streme Torrent" dir=in action=allow protocol=TCP localport=6881-6889
netsh advfirewall firewall add rule name="Self-Streme Torrent UDP" dir=in action=allow protocol=UDP localport=6881-6889
netsh advfirewall firewall add rule name="Self-Streme API" dir=in action=allow protocol=TCP localport=7000
netsh advfirewall firewall add rule name="Self-Streme Addon" dir=in action=allow protocol=TCP localport=7001
```

### macOS
```bash
# macOS firewall typically allows outgoing connections by default
# If you have a firewall enabled, allow the app in System Preferences > Security & Privacy
```

## Configuration

The quick start creates a default `.env` file. Edit it to customize:

```bash
# Server ports
PORT=7000              # Main API & streaming port
ADDON_PORT=7001        # Stremio addon port

# Cache settings
CACHE_BACKEND=memory   # Options: memory, sqlite, redis
CACHE_MAX_DISK_MB=10000  # Max cache size (10GB)
CACHE_TTL=86400        # Cache retention (24 hours)

# Torrent settings
TORRENT_TIMEOUT=60000  # Peer discovery timeout (60 seconds)
TORRENT_MAX_RETRIES=3  # Retry attempts
TORRENT_RETRY_DELAY=5000  # Delay between retries (5 seconds)
```

## Troubleshooting

### Port Already in Use

If ports 7000 or 7001 are already in use:

1. Edit `.env`
2. Change `PORT` and/or `ADDON_PORT` to different values
3. Restart the service

### Node.js Not Found

**Error:** `node: command not found`

**Solution:** Install Node.js 18+ from https://nodejs.org/

### Permission Denied (Linux/macOS)

**Error:** `Permission denied: ./quick-start.sh`

**Solution:** Make the script executable:
```bash
chmod +x quick-start.sh
./quick-start.sh
```

### Slow Peer Discovery

**Issue:** Torrents take a long time to find peers

**Solutions:**
- Open firewall ports (see above)
- Check your router's port forwarding settings
- Use popular torrents with many seeders
- Wait longer (can take 30-60 seconds initially)

### Can't Access from Other Devices

**Issue:** Can't stream from phone/tablet on same network

**Solution:** Replace `localhost` with your server's local IP:
```bash
# Find your IP
ip addr show  # Linux
ipconfig      # Windows
ifconfig      # macOS

# Access from other devices
http://192.168.1.100:7000/test-torrent-streaming
```

## Manual Setup (Alternative)

If you prefer manual setup:

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env  # Edit as needed

# 3. Start the service
npm start
```

## What's Next?

- 📖 Read [TORRENT_README.md](TORRENT_README.md) for detailed documentation
- 🔧 See [API Documentation](http://localhost:7000/docs) for integration
- 🎬 Try the [Stremio Integration](STREMIO_INTEGRATION.md)
- 🐳 Deploy with [Docker](README.md#docker-deployment)

## Quick Commands

```bash
# Start the combined service (recommended)
npm start

# Start torrent-only server
npm run start:torrent

# Development mode (auto-restart)
npm run dev

# Docker deployment
npm run docker:build
npm run docker:run

# Stop service
Ctrl+C  # or Cmd+C on macOS
```

## Getting Help

- 📁 Check the [docs](TORRENT_README.md)
- 🐛 Report issues on GitHub
- 💬 See [STARTUP_GUIDE.md](STARTUP_GUIDE.md) for advanced setup

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Self-Streme                    │
│                                                 │
│  ┌─────────────────┐    ┌──────────────────┐  │
│  │  Stremio Addon  │    │  Torrent Service │  │
│  │   (Port 7001)   │    │   (Port 7000)    │  │
│  └─────────────────┘    └──────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │       WebTorrent Engine                 │  │
│  │  • DHT Peer Discovery                   │  │
│  │  • Sequential Download                  │  │
│  │  • HTTP Range Streaming                 │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │       Cache Manager (LRU)               │  │
│  │  • Memory / SQLite / Redis              │  │
│  │  • Automatic Eviction                   │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
           ↕                    ↕
    [BitTorrent P2P]      [HTTP Clients]
```

## Features

✅ **Progressive Streaming** - Watch while downloading  
✅ **HTTP Range Requests** - Seek support in video players  
✅ **Sequential Download** - Prioritizes beginning of files  
✅ **Smart Cache** - LRU eviction with configurable limits  
✅ **Multi-backend** - Memory, SQLite, or Redis cache  
✅ **Stremio Integration** - Works as a Stremio addon  
✅ **REST API** - Full programmatic control  
✅ **Web UI** - Easy testing and management  

---

**Ready to stream? Run `./quick-start.sh` now!** 🎉