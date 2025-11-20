# 📚 Quick Documentation Navigation

**Find what you need fast!**

---

## 🆘 Emergency Fixes (Start Here)

| Problem | Document | Location |
|---------|----------|----------|
| **HTTP 403 - Forbidden** | [RATE_LIMITS_QUICK_FIX.md](RATE_LIMITS_QUICK_FIX.md) | Root |
| **Download failures** | [TROUBLESHOOTING_DOWNLOAD_FAILURES.md](docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md) | docs/ |
| **P2P not working** | [TROUBLESHOOTING_P2P.md](docs/TROUBLESHOOTING_P2P.md) | docs/ |
| **Can't stream** | [STREAMING-TROUBLESHOOTING.md](STREAMING-TROUBLESHOOTING.md) | Root |

---

## 🎯 By User Type

### 👤 End User
```
1. README.md (root) - Start here
2. RATE_LIMITS_QUICK_FIX.md (root) - If you get 403 errors
3. docs/summaries/RATE_LIMIT_FIX_SUMMARY.md - Detailed overview
```

### 🔧 Power User
```
1. README.md (root)
2. example.env (root) - Configuration
3. docs/guides/PREMIUM_SERVICES.md - Best reliability
4. docs/guides/RATE_LIMIT_SOLUTIONS.md - Complete guide
```

### 👨‍💻 Developer
```
1. docs/PROJECT_ORGANIZATION.md - Project structure
2. docs/updates/CHANGES_RATE_LIMIT_FIX.md - Recent changes
3. src/services/torrentDownloadSources.js - Source code
4. docs/API_DOCUMENTATION.md - API reference
```

### 🚀 System Admin
```
1. docs/guides/DEPLOYMENT_GUIDE.md - Deployment
2. docs/guides/PREMIUM_SERVICES.md - Production reliability
3. docs/docker/SETUP.md - Docker setup
4. example.env - Configuration reference
```

---

## 📂 By Location

### Root Directory (Quick Access)
- [README.md](README.md) - Main documentation
- [START_HERE.md](START_HERE.md) - Getting started
- [RATE_LIMITS_QUICK_FIX.md](RATE_LIMITS_QUICK_FIX.md) - Emergency 403 fixes
- [example.env](example.env) - Configuration template

### docs/ (Main Documentation)
- [DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md) - Complete doc index
- [PROJECT_ORGANIZATION.md](docs/PROJECT_ORGANIZATION.md) - Project structure
- [TROUBLESHOOTING_DOWNLOAD_FAILURES.md](docs/TROUBLESHOOTING_DOWNLOAD_FAILURES.md)
- [TROUBLESHOOTING_P2P.md](docs/TROUBLESHOOTING_P2P.md)

### docs/summaries/ (Quick Overviews)
- [RATE_LIMIT_FIX_SUMMARY.md](docs/summaries/RATE_LIMIT_FIX_SUMMARY.md) - Rate limit fixes
- [DOWNLOAD_FAILURE_FIX.md](docs/summaries/DOWNLOAD_FAILURE_FIX.md) - Download issues
- [SPEED_OPTIMIZATION_SUMMARY.md](docs/summaries/SPEED_OPTIMIZATION_SUMMARY.md) - Speed tips

### docs/guides/ (Comprehensive Guides)
- [PREMIUM_SERVICES.md](docs/guides/PREMIUM_SERVICES.md) - Premium setup (95%+ reliability)
- [RATE_LIMIT_SOLUTIONS.md](docs/guides/RATE_LIMIT_SOLUTIONS.md) - Complete rate limit guide
- [DEPLOYMENT_GUIDE.md](docs/guides/DEPLOYMENT_GUIDE.md) - Deployment strategies

### docs/updates/ (Technical Changes)
- [CHANGES_RATE_LIMIT_FIX.md](docs/updates/CHANGES_RATE_LIMIT_FIX.md) - Rate limit fix details

---

## ⚡ Quick Commands

```bash
# Setup
./scripts/quick-start.sh

# Check source health
curl http://localhost:7000/api/sources/stats | jq

# Test streaming
curl "http://localhost:7000/api/stream/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c/0"

# View logs
tail -f logs/app.log

# Debug mode
export LOG_LEVEL=debug && npm start
```

---

## 🎓 Learning Paths

### Path 1: Get Running (10 min)
```
README.md → ./scripts/quick-start.sh → Done!
```

### Path 2: Fix 403 Errors (5 min)
```
RATE_LIMITS_QUICK_FIX.md → Add Real-Debrid key → Fixed!
```

### Path 3: Production Setup (1 hour)
```
docs/guides/DEPLOYMENT_GUIDE.md 
→ docs/guides/PREMIUM_SERVICES.md 
→ Configure .env 
→ Deploy!
```

### Path 4: Deep Understanding (2 hours)
```
docs/PROJECT_ORGANIZATION.md
→ docs/DOCUMENTATION_INDEX.md
→ Read all guides
→ Review source code
→ Expert level!
```

---

## 💡 Most Important

**For Reliability:** Add Real-Debrid API key (€0.09/day, 95%+ success)
- Sign up: https://real-debrid.com
- Get key: https://real-debrid.com/apitoken
- Add to .env: `REAL_DEBRID_API_KEY=your_key`

**For Navigation:** 
- [DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md) - Complete guide
- [PROJECT_ORGANIZATION.md](docs/PROJECT_ORGANIZATION.md) - File structure

**For Support:**
- GitHub Issues: https://github.com/zviel/self-streme/issues
- Check existing docs first
- Enable debug logging: `LOG_LEVEL=debug`

---

## 📊 File Organization Map

```
self-streme/
├── 📄 Quick Access (Root)
│   ├── README.md
│   ├── RATE_LIMITS_QUICK_FIX.md ⭐
│   └── example.env
│
├── 📖 Documentation (docs/)
│   ├── DOCUMENTATION_INDEX.md ⭐
│   ├── PROJECT_ORGANIZATION.md ⭐
│   ├── TROUBLESHOOTING_*.md
│   │
│   ├── summaries/ (5 min reads)
│   │   └── RATE_LIMIT_FIX_SUMMARY.md ⭐
│   │
│   ├── guides/ (15-30 min reads)
│   │   ├── PREMIUM_SERVICES.md
│   │   └── RATE_LIMIT_SOLUTIONS.md ⭐
│   │
│   └── updates/ (Technical)
│       └── CHANGES_RATE_LIMIT_FIX.md ⭐
│
└── 💻 Source Code (src/)
    └── services/
        ├── torrentDownloadSources.js ⚙️
        └── hybridStreamService.js ⚙️

⭐ = New rate limit documentation
⚙️ = Modified for rate limit fixes
```

---

**Everything you need is documented and organized! 🎉**

**Start here based on your need:**
- 🆘 Have errors? → [RATE_LIMITS_QUICK_FIX.md](RATE_LIMITS_QUICK_FIX.md)
- 📚 Need navigation? → [docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)
- 🏗️ Want structure? → [docs/PROJECT_ORGANIZATION.md](docs/PROJECT_ORGANIZATION.md)
- 🚀 Ready to deploy? → [docs/guides/DEPLOYMENT_GUIDE.md](docs/guides/DEPLOYMENT_GUIDE.md)