# Self-Streme Documentation

Welcome to the Self-Streme documentation hub.

---

## 📚 Documentation Overview

### 🐳 Docker & Deployment
**[DOCKER.md](DOCKER.md)** - Docker deployment with Cloudflare Tunnel support

Complete Docker setup with automatic tunnel integration:
- Quick start guide
- Cloudflare Tunnel configuration
- Production deployment
- Comprehensive documentation in `docker/` directory

**Quick Start:**
```bash
cp .env.docker.example .env
docker-compose up -d
```

---

### 📖 Detailed Docker Documentation

All Docker-related documentation is organized in the `docker/` subdirectory:

| Document | Description |
|----------|-------------|
| **[docker/GETTING_STARTED.md](docker/GETTING_STARTED.md)** | Quick 3-minute setup guide |
| **[docker/README.md](docker/README.md)** | Complete overview and features |
| **[docker/SETUP.md](docker/SETUP.md)** | Detailed setup with troubleshooting |
| **[docker/DEPLOYMENT.md](docker/DEPLOYMENT.md)** | Deployment scenarios and examples |
| **[docker/QUICK_REFERENCE.md](docker/QUICK_REFERENCE.md)** | Command reference card |
| **[docker/EXAMPLES.md](docker/EXAMPLES.md)** | 12 real-world deployment examples |
| **[docker/INDEX.md](docker/INDEX.md)** | Complete navigation hub |
| **[docker/REFERENCE.txt](docker/REFERENCE.txt)** | Plain text quick reference |

---

### 🔧 Development & Maintenance

**[MERGE_SUMMARY.md](MERGE_SUMMARY.md)** - Technical details about the architecture merge
- Details about integrating tunnel support into main app
- Code structure and organization
- Developer notes and implementation details

---

## 🚀 Quick Navigation

### I want to...

| Goal | Document |
|------|----------|
| **Deploy with Docker** | [DOCKER.md](DOCKER.md) → [docker/GETTING_STARTED.md](docker/GETTING_STARTED.md) |
| **Setup Cloudflare Tunnel** | [docker/GETTING_STARTED.md](docker/GETTING_STARTED.md#option-2-with-cloudflare-tunnel) |
| **Find Docker commands** | [docker/QUICK_REFERENCE.md](docker/QUICK_REFERENCE.md) |
| **See deployment examples** | [docker/EXAMPLES.md](docker/EXAMPLES.md) |
| **Troubleshoot issues** | [docker/SETUP.md](docker/SETUP.md#troubleshooting) |
| **Understand the architecture** | [MERGE_SUMMARY.md](MERGE_SUMMARY.md) |

---

## 📁 Documentation Structure

```
docs/
├── README.md                    # This file - documentation index
├── DOCKER.md                    # Docker quick start
├── MERGE_SUMMARY.md             # Technical architecture details
│
└── docker/                      # Complete Docker documentation
    ├── GETTING_STARTED.md       # Quick setup guide
    ├── INDEX.md                 # Docker docs navigation hub
    ├── README.md                # Docker overview
    ├── SETUP.md                 # Detailed setup guide
    ├── DEPLOYMENT.md            # Deployment scenarios
    ├── QUICK_REFERENCE.md       # Command reference
    ├── EXAMPLES.md              # Real-world examples
    └── REFERENCE.txt            # Plain text reference
```

---

## 🎯 Getting Started

### New Users
1. Read [DOCKER.md](DOCKER.md) for quick overview
2. Follow [docker/GETTING_STARTED.md](docker/GETTING_STARTED.md) for setup
3. Check [docker/QUICK_REFERENCE.md](docker/QUICK_REFERENCE.md) for commands

### Developers
1. Review [MERGE_SUMMARY.md](MERGE_SUMMARY.md) for architecture
2. Check [docker/SETUP.md](docker/SETUP.md) for detailed setup
3. See [docker/EXAMPLES.md](docker/EXAMPLES.md) for deployment patterns

### Operations
1. Use [docker/DEPLOYMENT.md](docker/DEPLOYMENT.md) for scenarios
2. Keep [docker/QUICK_REFERENCE.md](docker/QUICK_REFERENCE.md) handy
3. Check [docker/SETUP.md](docker/SETUP.md#troubleshooting) for issues

---

## 🔍 Key Features

### Docker Integration
- ✅ Production-ready Dockerfile with Node.js 20
- ✅ Docker Compose for easy orchestration
- ✅ Development setup with hot-reload
- ✅ Health checks and monitoring
- ✅ Security hardened (non-root user)

### Cloudflare Tunnel
- ✅ Automatic tunnel detection via `TUNNEL_TOKEN`
- ✅ Zero-configuration startup
- ✅ Works with or without tunnel
- ✅ Color-coded logging with `[TUNNEL]` prefix
- ✅ Graceful shutdown handling

### Documentation
- ✅ Quick start guides
- ✅ Detailed setup instructions
- ✅ 12 real-world examples
- ✅ Command reference cards
- ✅ Troubleshooting guides
- ✅ Multiple deployment scenarios

---

## 💡 Common Tasks

### Deploy for First Time
```bash
# See: docker/GETTING_STARTED.md
cp .env.docker.example .env
docker-compose up -d
```

### Add Cloudflare Tunnel
```bash
# See: docker/GETTING_STARTED.md#option-2-with-cloudflare-tunnel
echo "TUNNEL_TOKEN=your_token" >> .env
docker-compose restart
```

### Troubleshoot Issues
```bash
# See: docker/QUICK_REFERENCE.md#-quick-fixes
docker-compose logs -f
./scripts/test-tunnel.sh
```

### Update Deployment
```bash
# See: docker/DEPLOYMENT.md
git pull
docker-compose build --no-cache
docker-compose up -d
```

---

## 🆘 Getting Help

1. **Check documentation** - Start with [docker/INDEX.md](docker/INDEX.md)
2. **Run diagnostics** - Use `./scripts/test-tunnel.sh`
3. **View logs** - Run `docker-compose logs -f`
4. **Check health** - Visit `http://localhost:3000/health`

---

## 📝 Documentation Maintenance

This documentation is organized for easy navigation and maintenance:
- **Root docs/** - Main index and quick starts
- **docs/docker/** - Complete Docker documentation
- All paths are relative for easy portability
- Cross-references between documents for easy navigation

---

## 🔗 External Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Need help?** Start with [docker/INDEX.md](docker/INDEX.md) for complete navigation.

**Ready to deploy?** Jump to [DOCKER.md](DOCKER.md) or [docker/GETTING_STARTED.md](docker/GETTING_STARTED.md).

---

*Last Updated: 2024*