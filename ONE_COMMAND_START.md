# 🎯 ONE COMMAND START

## The Absolute Fastest Way to Get Self-Streme Running

No configuration. No setup. No hassle. Just **one command**.

---

## 🚀 Run This Now

### Linux / macOS

```bash
./start.sh
```

That's literally it. If you get a permission error, run:

```bash
bash start.sh
```

### Windows

```cmd
quick-start.bat
```

---

## ✨ What Happens Automatically

When you run that one command, the script will:

1. ✅ **Check Node.js** - Verifies you have Node.js 18+
2. ✅ **Install Dependencies** - Runs `npm install` automatically
3. ✅ **Create Configuration** - Generates `.env` with smart defaults
4. ✅ **Check Ports** - Ensures 7000 and 7001 are available
5. ✅ **Create Directories** - Sets up cache folders
6. ✅ **Start Everything** - Launches both services
   - Torrent Streaming API (port 7000)
   - Stremio Addon (port 7001)

**Total time:** ~30 seconds (depending on your internet speed)

---

## 🎬 Your Services Are Now Running

Open these URLs in your browser:

| What | URL | Use For |
|------|-----|---------|
| 🧪 **Test UI** | http://localhost:7000/test-torrent-streaming | Add torrents, start streaming |
| 📖 **API Docs** | http://localhost:7000/docs | See all API endpoints |
| ❤️ **Health Check** | http://localhost:7000/health | Verify service is running |
| 🎭 **Stremio** | http://localhost:7001/manifest.json | Add to Stremio app |

---

## 🎥 Stream Your First Movie (2 Minutes)

1. **Open the Test UI:**
   ```
   http://localhost:7000/test-torrent-streaming
   ```

2. **Paste this magnet link** (Big Buck Bunny - Public Domain):
   ```
   magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
   ```

3. **Click "Add Torrent"**

4. **Wait 10-30 seconds** for peers to connect

5. **Click "Stream"** and watch in your browser!

---

## 🛑 Stop the Service

Press `Ctrl+C` in the terminal where it's running.

---

## 🔧 No Node.js? Install It First

### Ubuntu / Debian
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### macOS (with Homebrew)
```bash
brew install node
```

### Windows / Other Systems
Download from: https://nodejs.org/

---

## 📁 Project Structure Created

After running the script, you'll have:

```
self-streme/
├── .env                    # Your configuration (auto-generated)
├── node_modules/           # Dependencies (auto-installed)
├── data/
│   └── cache/             # Torrent cache directory
├── src/                   # Application source code
├── start.sh               # The magic one-command script
└── quick-start.sh         # The actual setup script
```

---

## ⚙️ Default Configuration

The script creates these defaults in `.env`:

```env
# Ports
PORT=7000              # Main API & streaming
ADDON_PORT=7001        # Stremio addon

# Cache
CACHE_BACKEND=memory   # In-memory cache (fast, but temporary)
CACHE_MAX_DISK_MB=10000  # 10GB max cache size
CACHE_TTL=86400        # Keep files for 24 hours

# Torrents
TORRENT_TIMEOUT=60000  # 60 seconds to find peers
TORRENT_MAX_RETRIES=3  # Retry 3 times on failure
```

**Want to change these?** Edit `.env` and restart with `./start.sh`

---

## 🔥 Advanced: Production Deployment

For production, you'll want:

1. **Redis for caching:**
   ```bash
   # Install Redis
   sudo apt install redis-server
   
   # Edit .env
   CACHE_BACKEND=redis
   REDIS_URL=redis://localhost:6379
   ```

2. **HTTPS with reverse proxy** (nginx/Caddy)
   
3. **Firewall ports open:**
   ```bash
   sudo ufw allow 6881:6889/tcp  # BitTorrent
   sudo ufw allow 6881:6889/udp  # BitTorrent
   sudo ufw allow 7000/tcp       # API
   sudo ufw allow 7001/tcp       # Addon
   ```

4. **Process manager** (pm2):
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name self-streme
   pm2 save
   pm2 startup
   ```

📖 See [QUICK_START.md](QUICK_START.md) for full production guide.

---

## 🆘 Troubleshooting

### "Command not found: ./start.sh"

**Fix:**
```bash
bash start.sh
```

### "Port 7000 already in use"

**Fix:** Change the port in `.env`:
```bash
echo "PORT=8000" >> .env
./start.sh
```

### "Node.js version too old"

**Fix:** Upgrade to Node.js 18+:
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew upgrade node

# Windows
# Download latest from nodejs.org
```

### Torrents won't start / No peers found

**Fix:** Open firewall ports:
```bash
# Linux
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp

# Windows (as Administrator)
netsh advfirewall firewall add rule name="BitTorrent" dir=in action=allow protocol=TCP localport=6881-6889
netsh advfirewall firewall add rule name="BitTorrent UDP" dir=in action=allow protocol=UDP localport=6881-6889
```

---

## 📚 More Documentation

- [QUICK_START.md](QUICK_START.md) - Detailed setup guide
- [TORRENT_README.md](TORRENT_README.md) - Full feature documentation
- [API Documentation](http://localhost:7000/docs) - REST API reference
- [STARTUP_GUIDE.md](STARTUP_GUIDE.md) - Advanced configuration

---

## 🎉 That's It!

You now have:
- ✅ A fully functional torrent streaming server
- ✅ HTTP Range support for seeking
- ✅ Progressive streaming (watch while downloading)
- ✅ A Stremio addon
- ✅ A REST API
- ✅ A web interface for testing

**Just run `./start.sh` and you're streaming!**

---

## 💡 Quick Commands Reference

```bash
# Start everything (recommended)
./start.sh

# Or use npm scripts
npm run quick-start        # Linux/macOS
npm run quick-start:win    # Windows

# Start manually
npm start

# Development mode (auto-restart on changes)
npm run dev

# Start only torrent service
npm run start:torrent

# Stop
Ctrl+C
```

---

**Ready? Copy and paste this now:**

```bash
./start.sh
```

🎬 **Happy Streaming!**