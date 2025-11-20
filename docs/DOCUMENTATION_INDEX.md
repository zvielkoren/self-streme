# 📚 Documentation Index - Self-Streme

**Quick Navigation:** Find exactly what you need in seconds

---

## 🆘 Emergency Fixes (Start Here if You Have Errors)

| Error Type | Quick Fix Document | Time to Fix |
|------------|-------------------|-------------|
| **HTTP 403 Forbidden** | [`FIX_SUMMARY.md`](FIX_SUMMARY.md) | 2 minutes |
| **Rate Limited** | [`RATE_LIMITS_QUICK_FIX.md`](RATE_LIMITS_QUICK_FIX.md) | 5 minutes |
| **Download Failed** | [`docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md`](docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md) | 10 minutes |
| **P2P Not Working** | [`docs/TROUBLESHOOTING_P2P.md`](docs/TROUBLESHOOTING_P2P.md) | 10 minutes |
| **Can't Stream** | [`STREAMING-TROUBLESHOOTING.md`](STREAMING-TROUBLESHOOTING.md) | 5 minutes |

**Most Common Issue:** HTTP 403 errors → Add [Real-Debrid](https://real-debrid.com) API key (€0.09/day)

---

## 🎯 Documentation by Purpose

### 📖 I'm New - Getting Started

```
Step 1: README.md (5 min)
   ↓
Step 2: Run ./scripts/quick-start.sh (1 min)
   ↓
Step 3: Open http://localhost:7000/test-torrent-streaming
   ↓
✅ Done!
```

**Documents:**
- [`README.md`](README.md) - Project overview & quick start
- [`START_HERE.md`](START_HERE.md) - First-time setup guide
- [`docs/QUICK_START.md`](docs/QUICK_START.md) - Detailed setup
- [`docs/STARTUP_GUIDE.md`](docs/STARTUP_GUIDE.md) - Complete guide

---

### ⚙️ I Need to Configure

| What to Configure | Document | Location |
|-------------------|----------|----------|
| **Environment variables** | [`example.env`](example.env) | Root |
| **Premium services** | [`docs/guides/PREMIUM_SERVICES.md`](docs/guides/PREMIUM_SERVICES.md) | docs/guides/ |
| **Rate limit handling** | [`docs/guides/RATE_LIMIT_SOLUTIONS.md`](docs/guides/RATE_LIMIT_SOLUTIONS.md) | docs/guides/ |
| **Download sources** | [`docs/DYNAMIC_SOURCES.md`](docs/DYNAMIC_SOURCES.md) | docs/ |
| **Speed optimization** | [`docs/PARALLEL_DOWNLOAD_OPTIMIZATION.md`](docs/PARALLEL_DOWNLOAD_OPTIMIZATION.md) | docs/ |
| **Google Drive cache** | [`docs/GOOGLE_DRIVE_INTEGRATION.md`](docs/GOOGLE_DRIVE_INTEGRATION.md) | docs/ |
| **Docker setup** | [`docker-compose.yml`](docker-compose.yml) | Root |

**Quick Configuration Example:**
```bash
# Copy and edit
cp example.env .env

# Add premium service (recommended)
echo "REAL_DEBRID_API_KEY=your_key" >> .env

# Restart
npm run stop && npm run start
```

---

### 🔧 I'm Troubleshooting

#### Rate Limit & HTTP Errors

```
Problem: HTTP 403 - Forbidden
   ↓
Read: FIX_SUMMARY.md (2 min)
   ↓
Solution: Add Real-Debrid key
   ↓
✅ Fixed! 95% success rate
```

**Documents:**
1. **[FIX_SUMMARY.md](FIX_SUMMARY.md)** ⭐ **START HERE** - User-friendly fix
2. **[RATE_LIMITS_QUICK_FIX.md](RATE_LIMITS_QUICK_FIX.md)** - Quick reference
3. **[docs/guides/RATE_LIMIT_SOLUTIONS.md](docs/guides/RATE_LIMIT_SOLUTIONS.md)** - Comprehensive guide (500+ lines)
4. **[CHANGES_RATE_LIMIT_FIX.md](CHANGES_RATE_LIMIT_FIX.md)** - Technical details

#### Download Issues

**Documents:**
- [`docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md`](docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md) - Complete guide
- [`docs/DYNAMIC_SOURCES.md`](docs/DYNAMIC_SOURCES.md) - Source configuration
- [`docs/guides/PREMIUM_SERVICES.md`](docs/guides/PREMIUM_SERVICES.md) - Best solution

#### P2P & Torrent Issues

**Documents:**
- [`docs/TROUBLESHOOTING_P2P.md`](docs/TROUBLESHOOTING_P2P.md) - P2P troubleshooting
- [`P2P-QUICK-FIX.md`](P2P-QUICK-FIX.md) - Quick P2P fixes
- [`TORRENT_FIX_VERIFICATION.md`](TORRENT_FIX_VERIFICATION.md) - Timeout fixes

**Scripts:**
- `./scripts/diagnose-p2p.sh` - Automated P2P diagnostics
- `./scripts/diagnose-torrent.sh` - Torrent diagnostics
- `./scripts/apply-p2p-fixes.sh` - Auto-fix P2P issues

---

### 🚀 I'm Deploying to Production

#### Deployment Guides

| Platform | Document | Difficulty |
|----------|----------|-----------|
| **Docker** | [`docs/docker/SETUP.md`](docs/docker/SETUP.md) | Easy |
| **Render.com** | [`deployment/render/README.md`](deployment/render/README.md) | Easy |
| **Railway** | [`deployment/railway/README.md`](deployment/railway/README.md) | Easy |
| **Heroku** | [`deployment/heroku/README.md`](deployment/heroku/README.md) | Medium |
| **Pterodactyl** | [`deployment/pterodactyl/README.md`](deployment/pterodactyl/README.md) | Medium |
| **VPS/Cloud** | [`docs/guides/DEPLOYMENT_GUIDE.md`](docs/guides/DEPLOYMENT_GUIDE.md) | Advanced |

#### Production Checklist
```
☐ Add premium service (Real-Debrid recommended)
☐ Configure BASE_URL in .env
☐ Set up proper logging (LOG_LEVEL=info)
☐ Configure cache size (CACHE_SIZE=50GB+)
☐ Enable persistent cache (CACHE_PERSISTENT=true)
☐ Set up monitoring
☐ Configure firewall rules
☐ Test from multiple devices
```

**Key Documents:**
- [`docs/guides/DEPLOYMENT_GUIDE.md`](docs/guides/DEPLOYMENT_GUIDE.md) - Complete deployment guide
- [`docs/guides/PREMIUM_SERVICES.md`](docs/guides/PREMIUM_SERVICES.md) - Production reliability
- [`example.env`](example.env) - Production configuration

---

### 👨‍💻 I'm a Developer

#### Architecture & Code

| Topic | Document | Description |
|-------|----------|-------------|
| **Project structure** | [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) | Architecture overview |
| **API reference** | [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) | Complete API docs |
| **Recent changes** | [`CHANGES_RATE_LIMIT_FIX.md`](CHANGES_RATE_LIMIT_FIX.md) | Latest updates |
| **Organization** | [`PROJECT_ORGANIZATION.md`](PROJECT_ORGANIZATION.md) | File structure |
| **Contributing** | [`CONTRIBUTORS.md`](CONTRIBUTORS.md) | How to contribute |

#### Key Source Files

```
src/
├── services/
│   ├── torrentDownloadSources.js    # 🔥 Source configuration
│   ├── hybridStreamService.js        # 🔥 Main streaming logic
│   ├── multipartDownloader.js        # Parallel downloads
│   └── streamingDownloader.js        # Instant streaming
├── api/
│   ├── streamingApi.js               # REST API
│   └── stremioAddon.js               # Stremio integration
└── config/
    └── index.js                       # Configuration loader
```

**Development Workflow:**
```bash
# 1. Read architecture
cat docs/PROJECT_STRUCTURE.md

# 2. Review recent changes
cat CHANGES_RATE_LIMIT_FIX.md

# 3. Check API docs
cat docs/API_DOCUMENTATION.md

# 4. Start coding
npm run dev
```

---

### 🎓 Learning Paths

#### Path 1: End User (10 minutes)
```
1. README.md (5 min) - Overview
2. ./scripts/quick-start.sh (1 min) - Setup
3. FIX_SUMMARY.md (2 min) - If errors
4. Add Real-Debrid key (2 min) - Best reliability
✅ Done!
```

#### Path 2: Power User (30 minutes)
```
1. README.md (5 min)
2. docs/STARTUP_GUIDE.md (10 min)
3. docs/guides/PREMIUM_SERVICES.md (10 min)
4. docs/guides/RATE_LIMIT_SOLUTIONS.md (15 min)
✅ Optimized setup!
```

#### Path 3: Developer (2 hours)
```
1. README.md (5 min)
2. docs/PROJECT_STRUCTURE.md (15 min)
3. docs/API_DOCUMENTATION.md (30 min)
4. Review src/ code (60 min)
5. CHANGES_RATE_LIMIT_FIX.md (10 min)
✅ Ready to contribute!
```

#### Path 4: System Admin (1 hour)
```
1. README.md (5 min)
2. docs/guides/DEPLOYMENT_GUIDE.md (20 min)
3. docs/docker/SETUP.md (15 min)
4. docs/guides/PREMIUM_SERVICES.md (10 min)
5. Configure monitoring (10 min)
✅ Production ready!
```

---

## 📁 Complete File Listing

### Root Directory
```
📄 Core Documentation
├── README.md                          # Main documentation
├── START_HERE.md                      # Getting started
├── FIX_SUMMARY.md                     # ⭐ Rate limit fixes
├── RATE_LIMITS_QUICK_FIX.md          # ⭐ Quick 403 fixes
├── CHANGES_RATE_LIMIT_FIX.md         # ⭐ Technical changes
├── PROJECT_ORGANIZATION.md            # Project structure
├── DOCUMENTATION_INDEX.md             # This file
├── CHANGELOG.md                       # Version history
└── LICENSE                            # License

🔧 Configuration
├── example.env                        # Configuration template
├── docker-compose.yml                 # Docker config
└── package.json                       # Node.js config

🚀 Scripts
└── scripts/
    ├── quick-start.sh                 # One-command setup
    ├── diagnose-p2p.sh                # P2P diagnostics
    └── monitor-sources.sh             # Monitor sources
```

### Documentation Directory (docs/)
```
📖 Main Guides
├── README.md                          # Docs index
├── QUICK_START.md                     # Quick start
├── STARTUP_GUIDE.md                   # Detailed setup
├── PROJECT_STRUCTURE.md               # Architecture
├── API_DOCUMENTATION.md               # API reference
├── TROUBLESHOOTING_DOWNLOAD_FAILURES.md
├── TROUBLESHOOTING_P2P.md
├── DYNAMIC_SOURCES.md
├── PARALLEL_DOWNLOAD_OPTIMIZATION.md
└── GOOGLE_DRIVE_INTEGRATION.md

📘 Guides (docs/guides/)
├── PREMIUM_SERVICES.md                # Premium setup
├── RATE_LIMIT_SOLUTIONS.md           # ⭐ Comprehensive guide
├── DEPLOYMENT_GUIDE.md                # Deployment
└── SEEDBOX_INTEGRATION.md

🐳 Docker (docs/docker/)
├── README.md
├── SETUP.md
├── DEPLOYMENT.md
└── QUICK_REFERENCE.md
```

### Source Code (src/)
```
💻 Source Code
├── index.js                           # Main entry
├── config/                            # Configuration
├── api/                               # REST API & Stremio
├── services/                          # Core services
│   ├── torrentDownloadSources.js     # 🔥 Updated
│   └── hybridStreamService.js         # 🔥 Updated
├── utils/                             # Utilities
└── middleware/                        # Express middleware
```

---

## 🔍 Search Guide

### Finding Information

**By keyword:**
```bash
# Search all markdown files
grep -r "your keyword" *.md docs/

# Search for rate limit info
grep -r "rate limit" *.md docs/

# Search for 403 errors
grep -r "403" *.md docs/
```

**By file type:**
- **Configuration?** → Root directory (.env files)
- **Documentation?** → `docs/` directory
- **Guides?** → `docs/guides/` directory
- **Code?** → `src/` directory
- **Scripts?** → `scripts/` directory
- **Deployment?** → `deployment/` or `docs/docker/`

**By problem:**
- **403 errors?** → `FIX_SUMMARY.md`
- **Rate limits?** → `RATE_LIMITS_QUICK_FIX.md`
- **Downloads failing?** → `docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md`
- **P2P issues?** → `docs/TROUBLESHOOTING_P2P.md`

---

## 🌟 Most Important Documents

### Top 5 Must-Read
1. **[README.md](README.md)** - Start here, always
2. **[FIX_SUMMARY.md](FIX_SUMMARY.md)** - For 403 errors (very common)
3. **[example.env](example.env)** - Configuration reference
4. **[docs/guides/PREMIUM_SERVICES.md](docs/guides/PREMIUM_SERVICES.md)** - Best reliability (95%+)
5. **[PROJECT_ORGANIZATION.md](PROJECT_ORGANIZATION.md)** - Navigation guide

### Quick Reference Cards
- **[RATE_LIMITS_QUICK_FIX.md](RATE_LIMITS_QUICK_FIX.md)** - 403 error quick fixes
- **[docs/docker/QUICK_REFERENCE.md](docs/docker/QUICK_REFERENCE.md)** - Docker commands
- **[P2P-QUICK-FIX.md](P2P-QUICK-FIX.md)** - P2P quick fixes

### Comprehensive Guides
- **[docs/guides/RATE_LIMIT_SOLUTIONS.md](docs/guides/RATE_LIMIT_SOLUTIONS.md)** - 500+ lines on rate limits
- **[docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md](docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md)** - Complete troubleshooting
- **[docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)** - Full API reference

---

## 🎯 Quick Actions

### Common Tasks
```bash
# Start service
npm start

# Check if working
curl http://localhost:7000/health

# View source health
curl http://localhost:7000/api/sources/stats | jq

# Test with Big Buck Bunny
curl "http://localhost:7000/api/stream/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c/0"

# View logs
tail -f logs/app.log

# Enable debug mode
export LOG_LEVEL=debug && npm start
```

### Emergency Fixes
```bash
# Fix 403 errors - Add Real-Debrid
echo "REAL_DEBRID_API_KEY=your_key" >> .env
npm run stop && npm run start

# Or wait for rate limit reset (60 min)
# Or exclude blocked sources temporarily
echo "EXCLUDE_DOWNLOAD_SOURCES=WebTor.io,Instant.io" >> .env
```

---

## 📊 Documentation Stats

- **Total Documents:** 60+
- **New Rate Limit Docs:** 5
- **Updated Files:** 4
- **Code Files Modified:** 2
- **Lines of New Documentation:** 2000+

---

## 🆕 What's New (November 2025)

### Rate Limit Fix Update

**New Documentation:**
1. ✅ `FIX_SUMMARY.md` - User-friendly summary
2. ✅ `RATE_LIMITS_QUICK_FIX.md` - Quick reference
3. ✅ `CHANGES_RATE_LIMIT_FIX.md` - Technical details
4. ✅ `docs/guides/RATE_LIMIT_SOLUTIONS.md` - Comprehensive guide
5. ✅ `PROJECT_ORGANIZATION.md` - Project structure

**Updated Files:**
1. ⚙️ `src/services/torrentDownloadSources.js` - Fixed endpoints
2. ⚙️ `src/services/hybridStreamService.js` - Better errors
3. ⚙️ `example.env` - Premium services config
4. ⚙️ `README.md` - Troubleshooting section

**Impact:**
- ✅ Fixed HTTP 403 rate limit errors
- ✅ Added 5 comprehensive guides
- ✅ 95%+ success rate with premium services
- ✅ Better error messages
- ✅ Multiple solution strategies

---

## 📞 Getting Help

### Self-Service
1. **Check this index** - Find the right document
2. **Search documentation** - `grep -r "keyword" docs/`
3. **Read error messages** - They now include solutions
4. **Enable debug logging** - `LOG_LEVEL=debug`

### Community Support
- **GitHub Issues:** https://github.com/zviel/self-streme/issues
- **Search existing issues** before creating new ones
- **Provide diagnostic info** (see `FIX_SUMMARY.md`)

### Creating Issues
Include:
1. What document you read
2. What you tried
3. Error messages
4. System info (`uname -a`, `node --version`)
5. Configuration (sanitized .env)

---

## 🎉 Summary

**Everything you need is documented and organized!**

**Start here:**
- New user? → `README.md`
- Have 403 errors? → `FIX_SUMMARY.md`
- Want best reliability? → `docs/guides/PREMIUM_SERVICES.md`
- Deploying? → `docs/guides/DEPLOYMENT_GUIDE.md`
- Developing? → `docs/PROJECT_STRUCTURE.md`

**Most important tip:** Add Real-Debrid API key for 95%+ success rate (€0.09/day)

**Get started:** https://real-debrid.com

---

**Last Updated:** November 20, 2025  
**Version:** 3.x with Rate Limit Fixes  
**Status:** ✅ Complete & Organized