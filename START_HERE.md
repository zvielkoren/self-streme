# 🎬 START HERE - Self-Streme

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║                    SELF-STREME IS READY!                       ║
║                                                                ║
║           Self-Hosted Torrent Streaming Service                ║
║              + Stremio Addon Integration                       ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

## 🚀 GET STARTED IN 10 SECONDS

### Run This ONE Command:

#### Linux / macOS:
```bash
./start.sh
```

#### Windows:
```cmd
quick-start.bat
```

### That's It! 🎉

The script will:
1. ✅ Check your Node.js (needs 18+)
2. ✅ Install dependencies automatically
3. ✅ Create configuration files
4. ✅ Start the service
5. ✅ Give you the URLs to access

**Time:** ~30 seconds

---

## 🎬 YOUR FIRST STREAM (2 Minutes)

Once the service starts:

### 1. Open the Test UI
```
http://localhost:7000/test-torrent-streaming
```

### 2. Add a Public Domain Movie
Paste this magnet link (Big Buck Bunny):
```
magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

### 3. Click "Add Torrent"

### 4. Wait ~10 seconds for peers

### 5. Click "Stream" and watch! 🍿

---

## 📱 ACCESS YOUR SERVICES

After running the start script:

| Service | URL | What For |
|---------|-----|----------|
| 🧪 **Test UI** | http://localhost:7000/test-torrent-streaming | Add & stream torrents |
| 📖 **API Docs** | http://localhost:7000/docs | REST API reference |
| ❤️ **Health** | http://localhost:7000/health | Check if running |
| 🎭 **Stremio** | http://localhost:7001/manifest.json | Stremio addon URL |

---

## 🛑 STOP THE SERVICE

Press `Ctrl+C` in the terminal

---

## ❓ DON'T HAVE NODE.JS?

### Install Node.js 18+ First:

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS (Homebrew):**
```bash
brew install node
```

**Windows / Others:**
Download from https://nodejs.org/

Then come back and run `./start.sh`

---

## 🔧 TROUBLESHOOTING

### Permission Denied?
```bash
bash start.sh
```

### Port Already Used?
Edit `.env` and change `PORT=7000` to another port

### No Peers Found?
Open firewall ports 6881-6889 (BitTorrent):
```bash
# Linux
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp

# Windows (as Admin)
netsh advfirewall firewall add rule name="BitTorrent" dir=in action=allow protocol=TCP localport=6881-6889
```

---

## 📚 MORE DOCUMENTATION

- **[ONE_COMMAND_START.md](ONE_COMMAND_START.md)** - Ultra-simple guide
- **[QUICK_START.md](QUICK_START.md)** - Detailed setup
- **[TORRENT_README.md](TORRENT_README.md)** - Full features
- **[README.md](README.md)** - Complete documentation

---

## ✨ FEATURES YOU GET

✅ **Progressive Streaming** - Watch while downloading  
✅ **HTTP Range Support** - Seek/skip in videos  
✅ **Sequential Download** - Prioritizes file start  
✅ **Smart Cache** - LRU eviction, configurable size  
✅ **Multiple Backends** - Memory, SQLite, Redis  
✅ **Stremio Integration** - Works as addon  
✅ **REST API** - Full programmatic control  
✅ **Web UI** - Easy testing interface  

---

## 🎯 WHAT YOU CAN DO

- Stream torrents directly in your browser
- Add Self-Streme as a Stremio addon
- Build apps using the REST API
- Cache downloads for instant replays
- Share streams on your local network
- Deploy to production with Docker

---

## 🚀 QUICK COMMANDS

```bash
# Start everything (auto-setup + run)
./start.sh

# Or use npm
npm run quick-start        # Linux/macOS
npm run quick-start:win    # Windows

# Manual start (after first run)
npm start

# Development mode (auto-reload)
npm run dev

# Stop
Ctrl+C
```

---

## 💡 NEXT STEPS

After your first successful stream:

1. **Try more torrents** - Add your favorite content
2. **Add to Stremio** - Use `http://localhost:7001/manifest.json`
3. **Configure cache** - Edit `.env` for Redis or larger cache
4. **Open ports** - For better P2P performance
5. **Deploy production** - Use Docker or PM2

---

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║                  READY TO START STREAMING?                     ║
║                                                                ║
║                      RUN THIS NOW:                             ║
║                                                                ║
║                       ./start.sh                               ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

**Questions?** Check [ONE_COMMAND_START.md](ONE_COMMAND_START.md) or [QUICK_START.md](QUICK_START.md)

**Happy Streaming!** 🎬🍿