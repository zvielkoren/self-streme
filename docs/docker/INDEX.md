# Docker & Cloudflare Tunnel - Documentation Index

Complete guide to deploying Self-Streme with Docker and optional Cloudflare Tunnel integration.

---

## 🎯 Start Here

### New to Docker?
→ **[GETTING_STARTED.md](GETTING_STARTED.md)** - Quick 3-minute setup guide

### Need Quick Commands?
→ **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Command cheat sheet

### Want Complete Details?
→ **[README.md](README.md)** - Full overview and features

---

## 📚 Documentation Structure

### Essential Reading

| Document | When to Use | Contents |
|----------|-------------|----------|
| **[GETTING_STARTED.md](GETTING_STARTED.md)** | First time setup | Quick 3-minute deployment guide |
| **[README.md](README.md)** | Overview | Features, architecture, and introduction |
| **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** | Daily operations | Command cheat sheet and quick fixes |

### Detailed Guides

| Document | When to Use | Contents |
|----------|-------------|----------|
| **[DOCKER_SETUP.md](DOCKER_SETUP.md)** | Complete setup | Step-by-step guide with troubleshooting |
| **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** | Production deployment | Multiple deployment scenarios |
| **[EXAMPLES.md](EXAMPLES.md)** | Real-world cases | 12 practical deployment examples |

### Reference Files

| File | Purpose |
|------|---------|
| **[REFERENCE.txt](REFERENCE.txt)** | Quick text reference (no markdown) |
| **[../../.env.docker.example](../../.env.docker.example)** | Environment variable template |
| **[../../example.env](../../example.env)** | Application configuration template |

---

## 🚀 Quick Navigation by Task

### "I want to..."

#### Start Using Docker
1. Read [GETTING_STARTED.md](GETTING_STARTED.md)
2. Copy `.env.docker.example` to `.env`
3. Run `docker-compose up -d`

#### Setup Cloudflare Tunnel
1. See [GETTING_STARTED.md - Option 2](GETTING_STARTED.md#option-2-with-cloudflare-tunnel)
2. Or [SETUP.md - Cloudflare Tunnel Setup](SETUP.md#cloudflare-tunnel-setup)
3. Or [EXAMPLES.md - Example 4](EXAMPLES.md#example-4-cloudflare-tunnel---personal-homelab)

#### Deploy to Production
1. Choose scenario in [DEPLOYMENT.md](DEPLOYMENT.md)
2. Follow detailed steps in [SETUP.md](SETUP.md)
3. Reference [EXAMPLES.md](EXAMPLES.md) for similar setups

#### Troubleshoot Issues
1. Check [QUICK_REFERENCE.md - Quick Fixes](QUICK_REFERENCE.md#-quick-fixes)
2. See [SETUP.md - Troubleshooting](SETUP.md#troubleshooting)
3. Run `./scripts/test-tunnel.sh` for diagnostics

#### Find a Command
1. Check [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
2. Or [REFERENCE.txt](REFERENCE.txt) for plain text version

#### See Real Examples
1. Browse [EXAMPLES.md](EXAMPLES.md) - 12 practical scenarios
2. Find scenario similar to yours
3. Copy and adapt the configuration

---

## 📖 Documentation by Topic

### Docker Basics

- **Setup**: [GETTING_STARTED.md](GETTING_STARTED.md), [SETUP.md](SETUP.md)
- **Commands**: [QUICK_REFERENCE.md - Docker Commands](QUICK_REFERENCE.md#-docker-commands)
- **Configuration**: [../../.env.docker.example](../../.env.docker.example)
- **Compose Files**: [../../docker-compose.yml](../../docker-compose.yml), [../../docker-compose.dev.yml](../../docker-compose.dev.yml)

### Cloudflare Tunnel

- **Quick Setup**: [GETTING_STARTED.md - Option 2](GETTING_STARTED.md#option-2-with-cloudflare-tunnel)
- **Complete Guide**: [SETUP.md - Cloudflare Tunnel Setup](SETUP.md#cloudflare-tunnel-setup)
- **Examples**: [EXAMPLES.md - Example 4](EXAMPLES.md#example-4-cloudflare-tunnel---personal-homelab)
- **Reference**: [QUICK_REFERENCE.md - Cloudflare Tunnel](QUICK_REFERENCE.md#-cloudflare-tunnel)

### Deployment Scenarios

- **Local Development**: [DEPLOYMENT.md - Scenario 1](DEPLOYMENT.md#scenario-1-local-development-no-tunnel)
- **VPS Deployment**: [DEPLOYMENT.md - Scenario 3](DEPLOYMENT.md#scenario-3-vps-deployment-digitalocean-linode-etc)
- **Behind Nginx**: [DEPLOYMENT.md - Scenario 4](DEPLOYMENT.md#scenario-4-behind-nginx-reverse-proxy)
- **High Availability**: [DEPLOYMENT.md - Scenario 5](DEPLOYMENT.md#scenario-5-docker-swarm--multi-node)

### Troubleshooting

- **Quick Fixes**: [QUICK_REFERENCE.md - Quick Fixes](QUICK_REFERENCE.md#-quick-fixes)
- **Common Issues**: [SETUP.md - Troubleshooting](SETUP.md#troubleshooting)
- **Test Script**: Run `../../scripts/test-tunnel.sh`
- **Debug Mode**: [SETUP.md - Debug Mode](SETUP.md#debug-mode)

### Configuration

- **Environment Variables**: [../../.env.docker.example](../../.env.docker.example)
- **Docker Compose**: [../../docker-compose.yml](../../docker-compose.yml)
- **Development Setup**: [../../docker-compose.dev.yml](../../docker-compose.dev.yml)
- **All Options**: [SETUP.md - Configuration](SETUP.md#configuration)

---

## 🎓 Learning Path

### Beginner
1. Start with [GETTING_STARTED.md](GETTING_STARTED.md)
2. Try basic deployment: `docker-compose up -d`
3. Learn common commands from [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

### Intermediate
1. Read [README.md](README.md) for overview
2. Setup Cloudflare Tunnel from [SETUP.md](SETUP.md)
3. Explore [EXAMPLES.md](EXAMPLES.md) for different scenarios

### Advanced
1. Study [DEPLOYMENT.md](DEPLOYMENT.md) for production
2. Review [EXAMPLES.md](EXAMPLES.md) for complex setups
3. Customize [../../docker-compose.yml](../../docker-compose.yml) for your needs

---

## 🔧 Core Files Explained

### Application Files

```
../../src/index.js      - Main application with integrated tunnel support
                          Checks TUNNEL_TOKEN and starts cloudflared if set
                          Runs Express server with all routes
```

### Docker Files

```
../../Dockerfile              - Container build instructions
                                Installs Node.js 20, cloudflared, and deps
                                Entry point: node src/index.js
                          
../../docker-compose.yml      - Production orchestration
                                Defines services, ports, volumes
                          
../../docker-compose.dev.yml  - Development with hot-reload
                                Mounts source code as volumes
                          
../../.dockerignore           - Build optimization
                                Excludes unnecessary files from image
```

### Configuration Files

```
../../.env              - Your actual configuration (create this!)
                          Copy from .env.docker.example
                          
../../.env.docker.example     - Configuration template
                                All available options documented
                          
../../example.env       - Application-specific config
                          Legacy config file (pre-Docker)
```

### Scripts

```
../../scripts/test-tunnel.sh  - Automated test suite
                                Validates entire setup
                                Run before deploying!
```

---

## 🎯 Common Scenarios - Quick Links

### "I need to..."

| Scenario | Go To |
|----------|-------|
| Deploy for the first time | [GETTING_STARTED.md](GETTING_STARTED.md) |
| Add Cloudflare Tunnel | [SETUP.md - Cloudflare Setup](SETUP.md#cloudflare-tunnel-setup) |
| Deploy to a VPS | [EXAMPLES.md - Example 3](EXAMPLES.md#example-3-production-deployment-no-tunnel) |
| Run on my home server | [EXAMPLES.md - Example 4](EXAMPLES.md#example-4-cloudflare-tunnel---personal-homelab) |
| Setup with Nginx | [EXAMPLES.md - Example 6](EXAMPLES.md#example-6-behind-nginx-reverse-proxy) |
| Configure environment | [../../.env.docker.example](../../.env.docker.example) |
| Find a command | [QUICK_REFERENCE.md](QUICK_REFERENCE.md) |
| Fix an error | [SETUP.md - Troubleshooting](SETUP.md#troubleshooting) |
| Test my setup | Run `../../scripts/test-tunnel.sh` |
| See real examples | [EXAMPLES.md](EXAMPLES.md) |

---

## 📋 Pre-Flight Checklist

Before deploying, ensure you have:

- [ ] Docker installed (`docker --version`)
- [ ] Docker Compose available (`docker compose version`)
- [ ] Configuration file created (`.env`)
- [ ] (Optional) Cloudflare tunnel token
- [ ] Read [GETTING_STARTED.md](GETTING_STARTED.md)
- [ ] Run `./scripts/test-tunnel.sh` (optional but recommended)

---

## 🆘 Getting Help

### Step 1: Check Documentation
- Quick fix? → [QUICK_REFERENCE.md - Quick Fixes](QUICK_REFERENCE.md#-quick-fixes)
- Setup issue? → [SETUP.md - Troubleshooting](SETUP.md#troubleshooting)
- Need example? → [EXAMPLES.md](EXAMPLES.md)

### Step 2: Run Tests
```bash
../../scripts/test-tunnel.sh
```

### Step 3: Check Logs
```bash
docker-compose logs -f
```

### Step 4: Verify Configuration
```bash
# Check environment
docker-compose exec self-streme env

# Test health endpoint
curl http://localhost:3000/health
```

---

## 📦 What's Included

### Complete Docker Setup
- ✅ Production-ready Dockerfile with Node.js 20
- ✅ Docker Compose configuration
- ✅ Development environment with hot-reload
- ✅ Automatic Cloudflare Tunnel integration
- ✅ Health checks and monitoring
- ✅ Security hardened (non-root user)
- ✅ Multi-architecture support (AMD64/ARM64)

### Comprehensive Documentation
- ✅ Quick start guide (3 minutes)
- ✅ Complete setup guide
- ✅ Command reference
- ✅ 12 real-world examples
- ✅ Deployment scenarios
- ✅ Troubleshooting guide

### Testing & Validation
- ✅ Automated test suite
- ✅ Health check endpoints
- ✅ Container health monitoring
- ✅ Log validation

---

## 🚀 Ready to Deploy?

1. **Start here**: [GETTING_STARTED.md](GETTING_STARTED.md)
2. **Choose scenario**: [DEPLOYMENT.md](DEPLOYMENT.md)
3. **Get help**: Use this index to find what you need

---

## 📄 All Documentation Files

### Main Guides (Read These)
- [GETTING_STARTED.md](GETTING_STARTED.md) - 3-minute quick start
- [README.md](README.md) - Complete overview
- [SETUP.md](SETUP.md) - Detailed setup guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment scenarios
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Command reference
- [EXAMPLES.md](EXAMPLES.md) - Real-world examples

### Reference Files (As Needed)
- [REFERENCE.txt](REFERENCE.txt) - Plain text summary
- [../../.env.docker.example](../../.env.docker.example) - Configuration template
- [../../docker-compose.yml](../../docker-compose.yml) - Production setup
- [../../docker-compose.dev.yml](../../docker-compose.dev.yml) - Development setup
- [../../Dockerfile](../../Dockerfile) - Container build

### Scripts
- [../../scripts/test-tunnel.sh](../../scripts/test-tunnel.sh) - Automated tests

---

**Happy Deploying! 🎉**

*Last Updated: 2024*