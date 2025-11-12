# Docker Deployment Guide

This project includes complete Docker support with automatic Cloudflare Tunnel integration.

## 🚀 Quick Start

```bash
# 1. Configure
cp .env.docker.example .env
nano .env  # Optional: add your settings

# 2. Deploy
docker-compose up -d

# 3. View logs
docker-compose logs -f
```

**Access**: http://localhost:3000

## 🌐 With Cloudflare Tunnel

Add to your `.env` file:
```env
TUNNEL_TOKEN=your_cloudflare_token_here
```

Then restart:
```bash
docker-compose restart
```

The tunnel starts automatically! No configuration needed.

## 📚 Complete Documentation

All Docker documentation is located in `docs/docker/`:

| Document | Purpose |
|----------|---------|
| **[GETTING_STARTED.md](docker/GETTING_STARTED.md)** | Quick 3-minute setup guide |
| **[README.md](docker/README.md)** | Complete overview and features |
| **[SETUP.md](docker/SETUP.md)** | Detailed setup with troubleshooting |
| **[DEPLOYMENT.md](docker/DEPLOYMENT.md)** | Deployment scenarios |
| **[QUICK_REFERENCE.md](docker/QUICK_REFERENCE.md)** | Command reference |
| **[EXAMPLES.md](docker/EXAMPLES.md)** | 12 real-world examples |
| **[INDEX.md](docker/INDEX.md)** | Navigation hub |

## 🧪 Test Your Setup

```bash
# Run automated tests
./scripts/test-tunnel.sh

# Check health
curl http://localhost:3000/health
```

## ✨ Key Features

- ✅ **Automatic tunnel detection** - Set `TUNNEL_TOKEN` and it works
- ✅ **Dual-mode operation** - Works with or without tunnel
- ✅ **Production-ready** - Security hardened, health checks
- ✅ **Color-coded logs** - `[TUNNEL]` and `[APP]` prefixes
- ✅ **Well documented** - 6 comprehensive guides
- ✅ **Automated testing** - Validate before deploying

## 🆘 Need Help?

1. **Quick setup**: [docker/GETTING_STARTED.md](docker/GETTING_STARTED.md)
2. **Commands**: [docker/QUICK_REFERENCE.md](docker/QUICK_REFERENCE.md)
3. **Troubleshooting**: [docker/SETUP.md](docker/SETUP.md#troubleshooting)
4. **Examples**: [docker/EXAMPLES.md](docker/EXAMPLES.md)

## 📦 What's Included

```
self-streme/
├── src/
│   └── index.js                # Main app with integrated tunnel support
├── Dockerfile                  # Container build
├── docker-compose.yml          # Production setup
├── docker-compose.dev.yml      # Development setup
├── .env.docker.example         # Configuration template
├── docs/
│   ├── DOCKER.md               # This file
│   └── docker/                 # Complete documentation
└── scripts/test-tunnel.sh      # Automated tests
```

---

**Start here**: [docker/GETTING_STARTED.md](docker/GETTING_STARTED.md) 🚀