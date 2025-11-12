# Quick Reference Card

Fast command reference for Self-Streme with Docker and Cloudflare Tunnel.

---

## 🚀 Getting Started

```bash
# Clone and setup
git clone <repo-url> && cd self-streme
cp .env.docker.example .env
nano .env  # Configure your settings

# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

---

## 🐳 Docker Commands

### Basic Operations
```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs (live)
docker-compose logs -f

# View logs (last 100 lines)
docker-compose logs --tail=100

# Stop and remove everything
docker-compose down -v
```

### Build & Update
```bash
# Build image
docker-compose build

# Rebuild without cache
docker-compose build --no-cache

# Pull and update
docker-compose pull && docker-compose up -d

# Update with rebuild
docker-compose down && docker-compose build && docker-compose up -d
```

### Container Management
```bash
# List running containers
docker ps

# Enter container shell
docker-compose exec self-streme sh

# View container stats
docker stats self-streme

# Inspect container
docker inspect self-streme

# View health status
docker inspect --format='{{.State.Health.Status}}' self-streme
```

---

## 🔧 NPM Scripts

```bash
# Production start (with tunnel support)
npm start

# Development mode
npm run dev

# Direct start (bypass start.js)
npm run start:direct

# Docker operations
npm run docker:build
npm run docker:run
npm run docker:stop
npm run docker:logs
```

---

## 🌐 Cloudflare Tunnel

### Setup
```bash
# 1. Get token from https://one.dash.cloudflare.com/
# 2. Add to .env file
echo "TUNNEL_TOKEN=your_token_here" >> .env

# 3. Restart container
docker-compose restart

# 4. Verify tunnel connection
docker-compose logs | grep TUNNEL
```

### Test Tunnel
```bash
# Run test suite
./scripts/test-tunnel.sh

# Clean up test artifacts
./scripts/test-tunnel.sh --cleanup
```

### Without Tunnel
```bash
# Remove or comment out TUNNEL_TOKEN in .env
# TUNNEL_TOKEN=

# Restart
docker-compose restart
```

---

## 🔍 Monitoring & Debugging

### Check Status
```bash
# Health check
curl http://localhost:3000/health

# Container status
docker ps | grep self-streme

# Resource usage
docker stats self-streme

# Port binding
netstat -tulpn | grep 3000
```

### View Logs
```bash
# All logs
docker-compose logs -f

# Only tunnel logs
docker-compose logs -f | grep TUNNEL

# Only app logs
docker-compose logs -f | grep APP

# Error logs only
docker-compose logs -f | grep -i error

# With timestamps
docker-compose logs -f --timestamps
```

### Debugging
```bash
# Run in foreground (see all output)
docker-compose up

# Shell access
docker-compose exec self-streme sh

# Check if cloudflared exists
docker-compose exec self-streme which cloudflared

# View environment variables
docker-compose exec self-streme env

# Test health endpoint from container
docker-compose exec self-streme wget -qO- localhost:3000/health
```

---

## 📝 Configuration

### Environment Variables Priority
1. Shell environment: `export TUNNEL_TOKEN=xxx`
2. `.env` file
3. `docker-compose.yml` environment section
4. Default values in code

### Quick Edit
```bash
# Edit .env file
nano .env

# Reload configuration
docker-compose restart

# Or reload without downtime
docker-compose up -d --force-recreate --no-deps self-streme
```

### Common Configurations
```bash
# Minimal (no tunnel)
PORT=3000
NODE_ENV=production

# With tunnel
PORT=3000
NODE_ENV=production
TUNNEL_TOKEN=eyJhIjoiXXX...
BASE_URL=https://your-domain.com

# Full production
PORT=3000
NODE_ENV=production
TUNNEL_TOKEN=eyJhIjoiXXX...
BASE_URL=https://your-domain.com
CACHE_BACKEND=sqlite
CACHE_PERSISTENT=true
LOG_LEVEL=info
```

---

## 🔐 Security

### Best Practices
```bash
# Never commit .env files
echo ".env" >> .gitignore

# Use Docker secrets (production)
docker secret create tunnel_token token.txt
```

### Update Dependencies
```bash
# Update npm packages
docker-compose exec self-streme npm update

# Rebuild with latest base image
docker-compose build --pull --no-cache
```

---

## 🧹 Cleanup

### Remove Containers
```bash
# Stop and remove containers
docker-compose down

# Remove with volumes
docker-compose down -v

# Remove all (including images)
docker-compose down --rmi all -v
```

### Clean Docker System
```bash
# Remove unused containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Clean everything
docker system prune -a --volumes
```

---

## 🔄 Common Workflows

### First Time Setup
```bash
cp .env.docker.example .env
nano .env                    # Configure settings
docker-compose build
docker-compose up -d
docker-compose logs -f      # Verify startup
curl localhost:3000/health  # Test
```

### Daily Operation
```bash
docker-compose logs --tail=50  # Check recent logs
docker stats self-streme       # Monitor resources
curl localhost:3000/health     # Health check
```

### Adding Cloudflare Tunnel
```bash
# Get token from Cloudflare dashboard
nano .env                      # Add TUNNEL_TOKEN=xxx
docker-compose restart
docker-compose logs | grep TUNNEL  # Verify connection
```

### Update Deployment
```bash
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose logs -f
```

### Troubleshooting
```bash
# Check logs
docker-compose logs --tail=100

# Check container status
docker ps -a | grep self-streme

# Restart fresh
docker-compose down
docker-compose up -d

# Full reset
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

## 📊 Performance

### Monitor Resources
```bash
# Real-time stats
docker stats self-streme

# Disk usage
docker system df

# Container size
docker ps -s
```

### Optimize
```bash
# Clear cache
docker-compose exec self-streme rm -rf /tmp/self-streme/*

# Restart to free memory
docker-compose restart

# Limit resources (docker-compose.yml)
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '1'
```

---

## 🆘 Quick Fixes

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Change port in .env
PORT=3001

# Restart
docker-compose restart
```

### Container Won't Start
```bash
# Check logs
docker-compose logs

# Run in foreground
docker-compose up

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

### Tunnel Not Connecting
```bash
# Verify token
echo $TUNNEL_TOKEN

# Check cloudflared
docker-compose exec self-streme cloudflared --version

# Restart tunnel
docker-compose restart
docker-compose logs | grep TUNNEL
```

### Out of Memory
```bash
# Check memory usage
docker stats self-streme

# Add memory limit in docker-compose.yml
# Reduce cache size in .env
CACHE_MAX_SIZE=500
CACHE_MAX_DISK_MB=2000
```

---

## 📚 Files Reference

| File | Purpose |
|------|---------|
| `start.js` | Startup manager with tunnel logic |
| `Dockerfile` | Container build instructions |
| `docker-compose.yml` | Multi-container orchestration |
| `.env` | Environment configuration |
| `.dockerignore` | Files to exclude from build |
| `DOCKER_SETUP.md` | Complete setup guide |
| `DEPLOYMENT_GUIDE.md` | Deployment scenarios |
| `scripts/test-tunnel.sh` | Automated testing |

---

## 🔗 Quick Links

- **Cloudflare Dashboard**: https://one.dash.cloudflare.com/
- **Docker Docs**: https://docs.docker.com/
- **Compose Reference**: https://docs.docker.com/compose/compose-file/

---

## 💡 Tips

- Use `docker-compose logs -f --tail=50` to start with recent logs
- Set `LOG_LEVEL=debug` for troubleshooting
- Enable `CACHE_PERSISTENT=true` for better performance
- Use `./scripts/test-tunnel.sh` before deploying
- Keep `TUNNEL_TOKEN` secret and never commit it
- Monitor logs regularly with `docker-compose logs -f`
- Set resource limits to prevent system overload
- Use health checks for automatic recovery

---

**For detailed information, see [DOCKER_SETUP.md](DOCKER_SETUP.md) and [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**