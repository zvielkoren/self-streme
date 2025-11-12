# Docker & Cloudflare Tunnel Setup

Complete Docker deployment solution for Self-Streme with automatic Cloudflare Tunnel integration.

---

## ✨ Features

- 🐳 **Production-ready Docker setup** with Node.js 20 and Alpine Linux
- 🔒 **Automatic Cloudflare Tunnel integration** - just set `TUNNEL_TOKEN`
- 🚀 **Zero-configuration startup** - tunnel starts automatically if token is provided
- 📊 **Color-coded logging** - easy to distinguish between tunnel and app logs
- 🔄 **Graceful shutdown** - proper cleanup of child processes
- 💪 **Health checks** - automatic container health monitoring
- 🛡️ **Security hardened** - runs as non-root user
- 📦 **Multi-architecture support** - works on AMD64 and ARM64

---

## 🚀 Quick Start

### 1. Configure Environment

```bash
# Copy example configuration
cp .env.docker.example .env

# Edit configuration (optional: add TUNNEL_TOKEN)
nano .env
```

### 2. Deploy

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Access

- **Without tunnel**: `http://localhost:3000`
- **With tunnel**: `https://your-domain.com` (configured in Cloudflare)

---

## 🌐 Cloudflare Tunnel Setup

### Get Your Token

1. Go to https://one.dash.cloudflare.com/
2. Navigate to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Copy the token from the installation command
5. Add to your `.env` file:

```env
TUNNEL_TOKEN=eyJhIjoiXXXXXXXXXXXXXX...
```

### Configure Public Hostname

1. In tunnel settings, add a **Public Hostname**:
   - **Subdomain**: `stream` (or your choice)
   - **Domain**: Select your domain
   - **Service Type**: `HTTP`
   - **URL**: `localhost:3000`

2. **Restart your container:**

```bash
docker-compose restart
```

3. **Access via:** `https://stream.your-domain.com`

---

## 📁 Project Structure

```
self-streme/
├── start.js                    # Startup manager with tunnel logic
├── Dockerfile                  # Container build configuration
├── docker-compose.yml          # Docker Compose orchestration
├── .env                        # Your environment configuration
├── .env.docker.example         # Example Docker configuration
├── .dockerignore               # Build optimization
├── src/
│   └── index.js               # Main application
├── scripts/
│   └── test-tunnel.sh         # Automated testing script
└── docs/docker/
    ├── SETUP.md               # Complete setup guide
    ├── DEPLOYMENT.md          # Deployment scenarios
    └── QUICK_REFERENCE.md     # Command reference
```

---

## 🔧 How It Works

### Architecture

```
┌─────────────────────────────────────┐
│         Docker Container            │
├─────────────────────────────────────┤
│  node src/index.js                  │
│    │                                 │
│    ├─► cloudflared (if token set)   │
│    │     └─► Cloudflare Tunnel      │
│    │                                 │
│    └─► Express Server :3000         │
└─────────────────────────────────────┘
```

### Startup Flow

1. **src/index.js** checks for `TUNNEL_TOKEN` environment variable
2. **If token exists**:
   - Spawns `cloudflared` process
   - Monitors tunnel connection
   - Logs tunnel status with `[TUNNEL]` prefix
3. **Always**:
   - Starts Express server
   - Handles all application routes
   - Logs with standard logger
4. **Both processes** output to stdout for Docker logs
5. **Graceful shutdown** on SIGTERM/SIGINT kills tunnel and app

### Log Output Example

```
============================================================
🌐 Cloudflare Tunnel Mode Enabled
============================================================
[TUNNEL] Starting Cloudflare Tunnel...
[TUNNEL] Connection registered
[TUNNEL] ✓ Cloudflare Tunnel is ready
✓ Cloudflare Tunnel started successfully
============================================================
🚀 Server running on port 3000
📍 Environment: production
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| **[SETUP.md](SETUP.md)** | Complete setup guide with troubleshooting |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Deployment scenarios and examples |
| **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** | Command reference card |

---

## 🎯 Common Use Cases

### Local Development (No Tunnel)

```bash
docker-compose up
# Access: http://localhost:3000
```

### Production with Cloudflare Tunnel

```bash
# Set token in .env
TUNNEL_TOKEN=your_token_here

# Deploy
docker-compose up -d

# Access: https://your-domain.com
```

### VPS Deployment

```bash
# SSH to server
ssh user@your-server

# Clone and deploy
git clone <repo-url>
cd self-streme
cp .env.docker.example .env
nano .env  # Configure
docker-compose up -d
```

### Behind Nginx Reverse Proxy

```bash
# Deploy without port mapping
# Configure Nginx to proxy to localhost:3000
docker-compose up -d
```

---

## 🧪 Testing

Run the automated test suite to verify your setup:

```bash
# Run all tests
./scripts/test-tunnel.sh

# Expected output:
# ✓ Docker is installed
# ✓ Docker Compose is available
# ✓ All required files found
# ✓ Dockerfile includes cloudflared
# ✓ Docker image built successfully
# ✓ cloudflared is installed in the image
# ✓ Container is running
# ✓ All tests passed!
```

Clean up test artifacts:

```bash
./scripts/test-tunnel.sh --cleanup
```

---

## 🔍 Troubleshooting

### Quick Diagnostics

```bash
# Check logs
docker-compose logs -f

# Check container status
docker ps | grep self-streme

# Test health endpoint
curl http://localhost:3000/health

# Verify cloudflared installation
docker-compose exec self-streme cloudflared --version
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Change `PORT` in `.env` file |
| Tunnel not connecting | Verify `TUNNEL_TOKEN` in Cloudflare dashboard |
| Container won't start | Check logs: `docker-compose logs` |
| Out of memory | Set resource limits in `docker-compose.yml` |
| App not accessible | Check firewall and port binding |

See [SETUP.md](SETUP.md#troubleshooting) for detailed troubleshooting.

---

## 📊 Monitoring

### View Logs

```bash
# All logs
docker-compose logs -f

# Filter by service
docker-compose logs -f | grep TUNNEL
docker-compose logs -f | grep APP

# Last 100 lines
docker-compose logs --tail=100
```

### Resource Usage

```bash
# Container stats
docker stats self-streme

# Disk usage
docker system df
```

### Health Check

```bash
# Health status
docker inspect --format='{{.State.Health.Status}}' self-streme

# Test endpoint
curl http://localhost:3000/health
```

---

## 🔐 Security Best Practices

- ✅ Container runs as **non-root user** (nodejs:1001)
- ✅ Never commit `.env` files with secrets
- ✅ Use **Docker secrets** for production tokens
- ✅ Keep **cloudflared** and dependencies updated
- ✅ Set **resource limits** to prevent DoS
- ✅ Enable **health checks** for automatic recovery
- ✅ Use **HTTPS** with Cloudflare Tunnel (automatic)
- ✅ Monitor **logs** for suspicious activity

---

## 🚀 Deployment Options

- **Docker Compose** (recommended) - Single server deployment
- **Docker Swarm** - Multi-node orchestration
- **Kubernetes** - Enterprise container orchestration
- **Standalone Docker** - Simple single container
- **Behind Nginx/Traefik** - With reverse proxy

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed examples.

---

## ⚙️ Configuration

### Minimal Configuration

```env
PORT=3000
NODE_ENV=production
```

### With Cloudflare Tunnel

```env
PORT=3000
NODE_ENV=production
TUNNEL_TOKEN=eyJhIjoiXXX...
BASE_URL=https://stream.yourdomain.com
```

### Full Production Setup

```env
# Server
NODE_ENV=production
PORT=3000
BASE_URL=https://stream.yourdomain.com

# Cloudflare Tunnel
TUNNEL_TOKEN=eyJhIjoiXXX...

# Cache
CACHE_BACKEND=sqlite
CACHE_TTL=7200
CACHE_PERSISTENT=true

# Logging
LOG_LEVEL=info
```

See [../../.env.docker.example](../../.env.docker.example) for all options.

---

## 🔄 Updates

### Standard Update

```bash
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### With Backup

```bash
# Backup data
docker-compose exec self-streme tar -czf /app/backup.tar.gz /app/data

# Update
git pull
docker-compose build --no-cache
docker-compose up -d
```

---

## 💡 Pro Tips

1. **Use `.env` files** - Never hardcode configuration
2. **Enable persistent cache** - Set `CACHE_PERSISTENT=true` for better performance
3. **Monitor logs regularly** - Use `docker-compose logs -f`
4. **Set resource limits** - Prevent runaway processes
5. **Test before deploying** - Run `./scripts/test-tunnel.sh`
6. **Use health checks** - Enable automatic container recovery
7. **Keep tokens secret** - Never commit `.env` files
8. **Update regularly** - Keep dependencies current
9. **Backup your data** - Before major updates
10. **Read the docs** - Check [DOCKER_SETUP.md](DOCKER_SETUP.md) for details

---

## 📚 Additional Resources

- [Complete Docker Setup Guide](SETUP.md)
- [Deployment Guide with Examples](DEPLOYMENT.md)
- [Quick Reference Card](QUICK_REFERENCE.md)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## 🆘 Support

For issues and questions:

1. **Check logs**: `docker-compose logs -f`
2. **Run tests**: `../../scripts/test-tunnel.sh`
3. **Review docs**: See [SETUP.md](SETUP.md)
4. **Cloudflare status**: Check dashboard at https://one.dash.cloudflare.com/
5. **Container health**: `docker inspect self-streme`

---

## 📝 License

Same as main project - see [LICENSE](LICENSE) file.

---

## 🙏 Credits

Built with:
- [Node.js](https://nodejs.org/) - Runtime environment
- [Express](https://expressjs.com/) - Web framework
- [cloudflared](https://github.com/cloudflare/cloudflared) - Tunnel client
- [Docker](https://www.docker.com/) - Containerization

---

**Ready to deploy? Start with [DEPLOYMENT.md](DEPLOYMENT.md)! 🚀**