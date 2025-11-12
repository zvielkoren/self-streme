# Quick Deployment Guide

This guide provides quick deployment examples for Self-Streme with optional Cloudflare Tunnel integration.

---

## 🚀 Quick Start (3 Steps)

### 1. Clone and Configure

```bash
git clone <your-repo-url>
cd self-streme
cp example.env .env
```

Edit `.env` and set your configuration (at minimum, set `PORT` and optionally `TUNNEL_TOKEN`).

### 2. Build and Run

```bash
# Using Docker Compose (recommended)
docker-compose up -d

# Or using npm scripts
npm run docker:build
npm run docker:run
```

### 3. Verify

```bash
# Check logs
docker-compose logs -f

# Check health
curl http://localhost:3000/health
```

---

## 📦 Deployment Scenarios

### Scenario 1: Local Development (No Tunnel)

Perfect for local testing and development.

```bash
# Option A: Direct Node.js
npm install
npm run dev

# Option B: Docker without tunnel
docker-compose up
```

**Access**: `http://localhost:3000`

---

### Scenario 2: Production with Cloudflare Tunnel

Best for production deployments without exposing ports.

#### Step 1: Get Cloudflare Tunnel Token

1. Go to https://one.dash.cloudflare.com/
2. Navigate to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Name it (e.g., `self-streme-production`)
5. Copy the token from the installation command

#### Step 2: Configure Environment

```bash
# Create .env file
cat > .env << EOF
NODE_ENV=production
PORT=3000
TUNNEL_TOKEN=eyJhIjoiXXXXXXXX...your-actual-token-here
BASE_URL=https://your-domain.com
LOG_LEVEL=info
EOF
```

#### Step 3: Configure Public Hostname in Cloudflare

1. In your tunnel settings, go to **Public Hostname**
2. Add a hostname:
   - **Subdomain**: `stream` (or your choice)
   - **Domain**: Select your domain
   - **Service Type**: `HTTP`
   - **URL**: `localhost:3000`

#### Step 4: Deploy

```bash
docker-compose up -d
```

#### Step 5: Verify

```bash
# Check logs for tunnel connection
docker-compose logs -f | grep TUNNEL

# Should see:
# [TUNNEL] Registered tunnel connection
# [SUCCESS] Cloudflare Tunnel is ready
```

**Access**: `https://stream.your-domain.com`

---

### Scenario 3: VPS Deployment (DigitalOcean, Linode, etc.)

Deploy on a VPS with public IP, optionally with Cloudflare Tunnel.

```bash
# SSH into your VPS
ssh user@your-server-ip

# Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Clone your repository
git clone <your-repo-url>
cd self-streme

# Configure environment
nano .env  # Edit your settings

# Deploy
docker-compose up -d

# Setup auto-start on reboot
docker update --restart=unless-stopped self-streme
```

**Without Tunnel**: Access via `http://your-server-ip:3000`  
**With Tunnel**: Access via your Cloudflare domain

---

### Scenario 4: Behind Nginx Reverse Proxy

Use when you already have Nginx managing your domains.

#### Nginx Configuration

```nginx
# /etc/nginx/sites-available/self-streme
server {
    listen 80;
    server_name stream.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/self-streme /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d stream.yourdomain.com
```

#### Docker Compose (No Port Exposure)

```yaml
services:
  self-streme:
    build: .
    restart: unless-stopped
    # No ports section - Nginx will proxy to internal network
    environment:
      - NODE_ENV=production
      - PORT=3000
      - BASE_URL=https://stream.yourdomain.com
```

---

### Scenario 5: Docker Swarm / Multi-Node

For high availability deployments.

```yaml
# docker-compose.swarm.yml
version: '3.8'

services:
  self-streme:
    image: self-streme:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: '1'
          memory: 1G
    environment:
      - NODE_ENV=production
      - PORT=3000
    networks:
      - app-network

networks:
  app-network:
    driver: overlay
```

Deploy:

```bash
# Initialize swarm (if not already)
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.swarm.yml self-streme

# Scale
docker service scale self-streme_self-streme=5
```

---

## 🔧 Configuration Examples

### Minimal Configuration

```env
# .env
PORT=3000
NODE_ENV=production
```

### With Cloudflare Tunnel

```env
# .env
PORT=3000
NODE_ENV=production
TUNNEL_TOKEN=eyJhIjoiXXXXXXXX...
BASE_URL=https://stream.yourdomain.com
```

### Full Production Configuration

```env
# .env
# Server
NODE_ENV=production
PORT=3000
BASE_URL=https://stream.yourdomain.com

# Cloudflare Tunnel
TUNNEL_TOKEN=eyJhIjoiXXXXXXXX...

# Cache
CACHE_BACKEND=sqlite
CACHE_TTL=7200
CACHE_MAX_SIZE=2000
CACHE_MAX_DISK_MB=10000
CACHE_PERSISTENT=true

# Jackett Integration
JACKETT_URL=http://jackett:9117
JACKETT_API_KEY=your_api_key

# External APIs
OMDB_API_KEY=your_omdb_key

# Logging
LOG_LEVEL=info
```

---

## 🐳 Docker Commands Cheat Sheet

### Build and Deploy

```bash
# Build image
docker build -t self-streme .

# Run container
docker run -d --name self-streme -p 3000:3000 self-streme

# Using docker-compose
docker-compose up -d
```

### Management

```bash
# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Update and restart
docker-compose pull
docker-compose up -d
```

### Debugging

```bash
# Execute commands in container
docker-compose exec self-streme sh

# View real-time resource usage
docker stats self-streme

# Inspect container
docker inspect self-streme

# View health status
docker inspect --format='{{.State.Health.Status}}' self-streme
```

---

## 🧪 Testing Your Setup

### Run Automated Tests

```bash
# Run the test suite
./scripts/test-tunnel.sh

# Clean up test artifacts
./scripts/test-tunnel.sh --cleanup
```

### Manual Testing

```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}

# Test with tunnel token
export TUNNEL_TOKEN="your_token_here"
docker run --rm -e TUNNEL_TOKEN self-streme

# Watch logs for:
# [TUNNEL] Registered tunnel connection
# [APP] Server running on port 3000
```

---

## 🔍 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Common issues:
# 1. Port already in use → Change PORT in .env
# 2. Invalid TUNNEL_TOKEN → Check token in Cloudflare
# 3. Missing environment variables → Review .env file
```

### Tunnel Not Connecting

```bash
# Verify cloudflared is installed
docker run --rm self-streme which cloudflared

# Check tunnel logs
docker-compose logs | grep TUNNEL

# Verify token is valid
# Check Cloudflare dashboard → Tunnels → Your Tunnel
```

### App Not Accessible

```bash
# Check if container is running
docker ps | grep self-streme

# Check port binding
netstat -tulpn | grep 3000

# Test health endpoint
curl http://localhost:3000/health

# If using tunnel, check public hostname in Cloudflare
```

---

## 🔐 Security Checklist

- [ ] Never commit `.env` files to version control
- [ ] Use strong, unique tunnel tokens
- [ ] Run containers as non-root user (default in our setup)
- [ ] Set resource limits in docker-compose.yml
- [ ] Enable HTTPS (automatic with Cloudflare Tunnel)
- [ ] Keep Docker and cloudflared updated
- [ ] Use Docker secrets for sensitive data in production
- [ ] Monitor logs for suspicious activity

---

## 📊 Monitoring

### Basic Monitoring

```bash
# View resource usage
docker stats self-streme

# Monitor logs
docker-compose logs -f --tail=100

# Check health
watch -n 5 'curl -s http://localhost:3000/health | jq'
```

### Production Monitoring

Consider integrating:

- **Prometheus** for metrics
- **Grafana** for dashboards
- **Loki** for log aggregation
- **Cloudflare Analytics** (included with tunnel)

---

## 🔄 Update Procedure

### Standard Update

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verify
docker-compose logs -f
```

### Zero-Downtime Update (with multiple replicas)

```bash
# Update one container at a time
docker-compose up -d --no-deps --scale self-streme=2 --no-recreate
docker-compose up -d --no-deps --force-recreate --scale self-streme=1
```

---

## 💡 Tips and Best Practices

1. **Use `.env` files** for configuration management
2. **Enable health checks** for automatic recovery
3. **Set resource limits** to prevent resource exhaustion
4. **Use volumes** for persistent data
5. **Monitor logs** regularly
6. **Backup your data** before updates
7. **Test changes** in development before production
8. **Use Cloudflare Tunnel** for secure, easy external access
9. **Keep dependencies updated** for security
10. **Document your setup** for team members

---

## 📚 Additional Resources

- [Complete Docker Setup Guide](DOCKER_SETUP.md) - Detailed documentation
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Docker Best Practices](https://github.com/goldbergyoni/nodebestpractices#6-docker-best-practices)

---

## 🆘 Getting Help

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Run the test suite: `./scripts/test-tunnel.sh`
3. Review [DOCKER_SETUP.md](DOCKER_SETUP.md) troubleshooting section
4. Check Cloudflare dashboard for tunnel status
5. Verify environment variables are set correctly

---

**Happy Deploying! 🚀**