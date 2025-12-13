# 🚀 START HERE

## Welcome to Self-Streme v2.0!

This is your quick reference guide to get started.

## ⚡ Instant Start

```bash
# Quick setup (Linux/Mac)
./scripts/quick-start.sh

# Quick setup (Windows)
scripts\quick-start.bat

# Or with Docker
docker-compose up -d
```

## 📚 Documentation

**Essential Reading:**
1. [README.md](README.md) - Main documentation
2. [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Where everything is
3. [docs/QUICK_START.md](docs/QUICK_START.md) - Step-by-step setup
4. [docs/DYNAMIC_SOURCES.md](docs/DYNAMIC_SOURCES.md) - Multi-source system

**Quick References:**
- [CHANGELOG.md](CHANGELOG.md) - What's new
- [UPDATES.md](UPDATES.md) - Recent updates
- [SUMMARY-HE.md](SUMMARY-HE.md) - Hebrew summary
- [FINAL_SUMMARY.txt](FINAL_SUMMARY.txt) - Quick overview

## 🗂️ Project Structure

```
self-streme/
├── src/          → Source code
├── docs/         → All documentation
├── scripts/      → Utility scripts
├── docker/       → Docker configs
├── deployment/   → Platform configs
└── test/         → Test files
```

**Each directory has a README.md explaining its contents.**

## 🌟 Key Features

### Dynamic Sources System (NEW!)
- 12 torrent streaming sources
- Automatic failover
- 95% success rate
- No single point of failure

```bash
# View all sources
curl http://localhost:11470/api/sources/stats

# Test a source
curl http://localhost:11470/api/sources/test/HASH/file.mp4
```

## 🎯 Common Tasks

### Run Application
```bash
npm start                    # Standard start
npm run dev                  # Development mode
docker-compose up -d         # Docker
```

### Scripts
```bash
./scripts/quick-start.sh     # Quick setup
./scripts/diagnose-p2p.sh    # Diagnose issues
./scripts/fix-streaming.sh   # Fix problems
```

### Documentation
```bash
cat docs/README.md           # Doc index
cat docs/DYNAMIC_SOURCES.md  # Sources guide
cat docs/QUICK_START.md      # Getting started
```

## 🔍 Find Things Quickly

**Need to...**
- **Setup?** → [docs/QUICK_START.md](docs/QUICK_START.md)
- **Deploy?** → [deployment/README.md](deployment/README.md)
- **Use Docker?** → [docker/README.md](docker/README.md)
- **Run tests?** → [test/README.md](test/README.md)
- **Fix issues?** → [docs/TROUBLESHOOTING_P2P.md](docs/TROUBLESHOOTING_P2P.md)
- **Understand structure?** → [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
- **See all docs?** → [docs/README.md](docs/README.md)
- **Check scripts?** → [scripts/README.md](scripts/README.md)

## 💡 Quick Tips

1. **Everything is documented** - Check the README in each directory
2. **Scripts are in /scripts** - All utility scripts centralized
3. **Docs are in /docs** - All guides organized by topic
4. **Use dynamic sources** - Automatic failover to 12 sources
5. **Check logs** - `tail -f logs/combined.log`

## 🎬 Test It Out

```bash
# 1. Start server
npm start

# 2. View sources
curl http://localhost:11470/api/sources/stats

# 3. Test with Big Buck Bunny
curl -X POST http://localhost:11470/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri":"magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'

# 4. Stream it
curl -I http://localhost:11470/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

## 📊 What's New in v2.0

- ✅ 12 dynamic download sources
- ✅ Automatic failover system
- ✅ Organized project structure
- ✅ Comprehensive documentation
- ✅ 95% streaming success rate
- ✅ No WebTor.io dependency

## 🆘 Need Help?

1. Read [docs/QUICK_START.md](docs/QUICK_START.md)
2. Check [docs/TROUBLESHOOTING_P2P.md](docs/TROUBLESHOOTING_P2P.md)
3. Review [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
4. See specific directory README.md
5. Open GitHub issue

## ⏭️ Next Steps

1. **Setup:** Run `./scripts/quick-start.sh`
2. **Learn:** Read `docs/QUICK_START.md`
3. **Explore:** Check `docs/DYNAMIC_SOURCES.md`
4. **Deploy:** See `deployment/README.md`

---

**Version:** 2.0
**Status:** Production Ready ✅
**Updated:** November 2024

**Happy Streaming! 🎬**
