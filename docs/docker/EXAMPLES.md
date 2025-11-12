# Real-World Deployment Examples

Practical examples for deploying Self-Streme with Docker and Cloudflare Tunnel.

---

## Example 1: Local Development

**Scenario**: Testing the application on your local machine.

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/self-streme.git
cd self-streme

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
EOF

# Run directly with Node.js
npm run dev
```

**Access**: http://localhost:3000

**Expected Output**:
```
[nodemon] starting `node src/index.js`
Server running on port 3000
```

---

## Example 2: Docker Development with Hot Reload

**Scenario**: Developing with Docker for consistency with production environment.

### Setup

```bash
# Create development .env
cat > .env << 'EOF'
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
CACHE_BACKEND=memory
CACHE_MAX_SIZE=100
EOF

# Start with development compose file
docker-compose -f docker-compose.dev.yml up
```

**Features**:
- Hot reloading on code changes
- Source code mounted as volume
- Development-friendly logging
- Lower resource limits

**Expected Output**:
```
[INFO] Self-Streme Startup Manager
[INFO] Environment: development
[INFO] Port: 3000
[INFO] Tunnel Token: Not set ✗
[INFO] No TUNNEL_TOKEN provided, skipping Cloudflare Tunnel
[APP] Starting application...
[APP] Server running on port 3000
```

---

## Example 3: Production Deployment (No Tunnel)

**Scenario**: Deploying to a VPS with a public IP address.

### Setup

```bash
# SSH to your server
ssh user@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Clone and configure
git clone https://github.com/yourusername/self-streme.git
cd self-streme

# Create production .env
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
BASE_URL=http://your-server-ip:3000
LOG_LEVEL=info
CACHE_BACKEND=sqlite
CACHE_TTL=3600
CACHE_MAX_SIZE=1000
CACHE_PERSISTENT=true
EOF

# Deploy
docker-compose up -d

# Check status
docker-compose logs -f
```

**Access**: http://your-server-ip:3000

**Security Note**: Configure firewall to allow port 3000:
```bash
sudo ufw allow 3000/tcp
sudo ufw enable
```

---

## Example 4: Cloudflare Tunnel - Personal Homelab

**Scenario**: Running on home server, accessible from anywhere securely.

### Step 1: Get Cloudflare Tunnel Token

1. Go to https://one.dash.cloudflare.com/
2. Navigate to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Name: `homelab-streme`
5. Copy the token

### Step 2: Configure Public Hostname

In tunnel settings:
- **Subdomain**: `stream`
- **Domain**: `yourdomain.com`
- **Service Type**: `HTTP`
- **URL**: `localhost:3000`

### Step 3: Deploy

```bash
# Create .env with tunnel token
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
TUNNEL_TOKEN=eyJhIjoiMDg5YWY3ZjgtZjE2Ny00ZTgxLWIyNmEtNzg5MDEyMzQ1Njc4IiwidCI6IjEyMzQ1Njc4LTEyMzQtMTIzNC0xMjM0LTEyMzQ1Njc4OTBhYiIsInMiOiJPVE5rTXpVMk56Z3RNRFl6WWkwME1ERmhMV0kyTmpRdE56RTNOVEF4TWpNME5UWTMifQ==
BASE_URL=https://stream.yourdomain.com
LOG_LEVEL=info
CACHE_BACKEND=sqlite
CACHE_PERSISTENT=true
EOF

# Deploy
docker-compose up -d

# Verify tunnel connection
docker-compose logs | grep TUNNEL
```

**Expected Output**:
```
[INFO] Tunnel Token: Set ✓
[TUNNEL] Starting Cloudflare Tunnel...
[TUNNEL] INF Connection registered connIndex=0
[SUCCESS] Cloudflare Tunnel is ready
[APP] Server running on port 3000
[SUCCESS] All services are running
```

**Access**: https://stream.yourdomain.com

**Benefits**:
- No port forwarding needed
- No public IP required
- Automatic HTTPS
- DDoS protection
- Access from anywhere

---

## Example 5: Multiple Services with Different Tunnels

**Scenario**: Running main app and admin panel on different domains.

### docker-compose.yml

```yaml
version: '3.8'

services:
  self-streme-main:
    build: .
    container_name: self-streme-main
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - TUNNEL_TOKEN=${MAIN_TUNNEL_TOKEN}
      - BASE_URL=https://stream.yourdomain.com
      - LOG_LEVEL=info

  self-streme-admin:
    build: .
    container_name: self-streme-admin
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - TUNNEL_TOKEN=${ADMIN_TUNNEL_TOKEN}
      - BASE_URL=https://admin.yourdomain.com
      - LOG_LEVEL=info
      - ADMIN_MODE=true
```

### .env

```env
MAIN_TUNNEL_TOKEN=eyJhIjoiXXXXXXXX...token-for-stream.yourdomain.com
ADMIN_TUNNEL_TOKEN=eyJhIjoiWVlZWVlZWVl...token-for-admin.yourdomain.com
```

### Deploy

```bash
docker-compose up -d
docker-compose logs -f
```

**Access**:
- Main: https://stream.yourdomain.com
- Admin: https://admin.yourdomain.com

---

## Example 6: Behind Nginx Reverse Proxy

**Scenario**: Using Nginx for SSL termination and multiple services.

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/self-streme
upstream self-streme {
    server localhost:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name stream.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name stream.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/stream.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stream.yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://self-streme;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://self-streme/health;
        access_log off;
    }
}
```

### Docker Configuration

```yaml
# docker-compose.yml - No port mapping needed
version: '3.8'

services:
  self-streme:
    build: .
    container_name: self-streme
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - BASE_URL=https://stream.yourdomain.com
    networks:
      - nginx-network

networks:
  nginx-network:
    external: true
```

### Deploy

```bash
# Enable Nginx config
sudo ln -s /etc/nginx/sites-available/self-streme /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d stream.yourdomain.com

# Deploy container
docker-compose up -d
```

---

## Example 7: High Availability with Docker Swarm

**Scenario**: Multiple replicas across multiple servers for high availability.

### Initialize Swarm

```bash
# On manager node
docker swarm init --advertise-addr YOUR_SERVER_IP

# Get join token
docker swarm join-token worker

# On worker nodes (use the token from above)
docker swarm join --token SWMTKN-1-xxx YOUR_MANAGER_IP:2377
```

### docker-compose.swarm.yml

```yaml
version: '3.8'

services:
  self-streme:
    image: your-registry/self-streme:latest
    networks:
      - streme-network
    environment:
      - NODE_ENV=production
      - PORT=3000
      - BASE_URL=https://stream.yourdomain.com
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 5s
      restart_policy:
        condition: on-failure
        max_attempts: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  streme-network:
    driver: overlay
```

### Deploy Stack

```bash
# Build and push to registry
docker build -t your-registry/self-streme:latest .
docker push your-registry/self-streme:latest

# Deploy stack
docker stack deploy -c docker-compose.swarm.yml streme

# Scale service
docker service scale streme_self-streme=5

# View status
docker service ls
docker service ps streme_self-streme

# Update service
docker service update --image your-registry/self-streme:new-version streme_self-streme
```

---

## Example 8: With External Services (Jackett, Redis)

**Scenario**: Full production setup with external dependencies.

### docker-compose.yml

```yaml
version: '3.8'

services:
  self-streme:
    build: .
    container_name: self-streme
    restart: unless-stopped
    depends_on:
      - redis
      - jackett
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - BASE_URL=https://stream.yourdomain.com
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
      
      # Redis cache
      - CACHE_BACKEND=redis
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      
      # Jackett
      - JACKETT_URL=http://jackett:9117
      - JACKETT_API_KEY=${JACKETT_API_KEY}
      
      - LOG_LEVEL=info
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - app-network

  jackett:
    image: linuxserver/jackett:latest
    container_name: jackett
    restart: unless-stopped
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=UTC
    volumes:
      - jackett-config:/config
      - jackett-downloads:/downloads
    networks:
      - app-network

volumes:
  redis-data:
  jackett-config:
  jackett-downloads:

networks:
  app-network:
    driver: bridge
```

### .env

```env
NODE_ENV=production
TUNNEL_TOKEN=your_cloudflare_token
JACKETT_API_KEY=your_jackett_api_key
REDIS_PASSWORD=your_secure_redis_password
```

### Deploy

```bash
docker-compose up -d
docker-compose logs -f
```

---

## Example 9: CI/CD with GitHub Actions

**Scenario**: Automatic deployment on git push.

### .github/workflows/deploy.yml

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: yourusername/self-streme:latest
          cache-from: type=registry,ref=yourusername/self-streme:buildcache
          cache-to: type=registry,ref=yourusername/self-streme:buildcache,mode=max

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/self-streme
            docker-compose pull
            docker-compose up -d
            docker-compose logs --tail=50
```

### GitHub Secrets to Set

- `DOCKER_USERNAME`: Your Docker Hub username
- `DOCKER_PASSWORD`: Your Docker Hub password
- `SERVER_HOST`: Your server IP or domain
- `SERVER_USER`: SSH username
- `SERVER_SSH_KEY`: Private SSH key

---

## Example 10: Testing Before Production

**Scenario**: Validate setup before deploying to production.

### Complete Test Workflow

```bash
# 1. Clone repository
git clone https://github.com/yourusername/self-streme.git
cd self-streme

# 2. Create test environment
cp .env.docker.example .env.test
nano .env.test

# 3. Run automated tests
./scripts/test-tunnel.sh

# 4. Test without tunnel
docker run --rm \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -p 3000:3000 \
  self-streme

# 5. Test health endpoint
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}

# 6. Test with tunnel (if token available)
export TUNNEL_TOKEN="your_test_token"
docker run --rm \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e TUNNEL_TOKEN="${TUNNEL_TOKEN}" \
  self-streme

# 7. Watch logs for tunnel connection
# Should see: [TUNNEL] Connection registered

# 8. Clean up
docker stop $(docker ps -q --filter ancestor=self-streme)
./scripts/test-tunnel.sh --cleanup
```

---

## Example 11: Migration from Existing Setup

**Scenario**: Migrating from a non-Docker setup to Docker with tunnel.

### Current Setup (Before)

```
Node.js app running directly on server
- Using PM2 for process management
- Nginx reverse proxy
- Manual SSL certificates
```

### Migration Steps

```bash
# 1. Backup current setup
sudo systemctl stop self-streme
tar -czf ~/self-streme-backup-$(date +%Y%m%d).tar.gz /opt/self-streme

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. Setup Cloudflare Tunnel (replaces Nginx + SSL)
# Get token from Cloudflare dashboard

# 4. Clone and configure
cd /opt
git clone https://github.com/yourusername/self-streme.git self-streme-docker
cd self-streme-docker

# 5. Migrate configuration
cat > .env << EOF
NODE_ENV=production
PORT=3000
TUNNEL_TOKEN=your_cloudflare_token
BASE_URL=https://stream.yourdomain.com
CACHE_BACKEND=sqlite
CACHE_PERSISTENT=true
# ... copy other settings from old config ...
EOF

# 6. Migrate data
cp -r /opt/self-streme/data ./data/

# 7. Test new setup
docker-compose up

# 8. If successful, deploy
docker-compose down
docker-compose up -d

# 9. Monitor
docker-compose logs -f

# 10. Remove old setup (after confirming)
# sudo systemctl disable self-streme
# pm2 delete self-streme
# Remove Nginx config for old setup
```

---

## Example 12: Troubleshooting Scenarios

### Scenario A: Container Keeps Restarting

```bash
# Check logs
docker-compose logs --tail=100

# Common issues and solutions:

# 1. Port already in use
netstat -tulpn | grep 3000
# Solution: Change PORT in .env

# 2. Invalid TUNNEL_TOKEN
docker-compose logs | grep TUNNEL
# Solution: Verify token in Cloudflare dashboard

# 3. Missing environment variables
docker-compose exec self-streme env
# Solution: Check .env file

# 4. Out of memory
docker stats self-streme
# Solution: Increase memory limit in docker-compose.yml
```

### Scenario B: Tunnel Not Connecting

```bash
# 1. Verify cloudflared is installed
docker-compose exec self-streme which cloudflared
docker-compose exec self-streme cloudflared --version

# 2. Check token format
echo $TUNNEL_TOKEN | wc -c
# Should be >100 characters

# 3. Test token manually
docker-compose exec self-streme cloudflared tunnel run --token $TUNNEL_TOKEN

# 4. Check Cloudflare dashboard
# Ensure tunnel is active and hostname is configured

# 5. Network connectivity
docker-compose exec self-streme ping -c 3 cloudflare.com
```

### Scenario C: High Memory Usage

```bash
# Check current usage
docker stats self-streme

# Reduce cache size in .env
cat >> .env << EOF
CACHE_BACKEND=memory
CACHE_MAX_SIZE=500
CACHE_MAX_DISK_MB=2000
EOF

# Restart with new limits
docker-compose restart

# Set hard limits in docker-compose.yml
# deploy.resources.limits.memory: 1G
```

---

## Additional Resources

- [Complete Setup Guide](DOCKER_SETUP.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Quick Reference](QUICK_REFERENCE.md)
- [Docker Documentation](https://docs.docker.com/)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/)

---

**These examples cover most common deployment scenarios. Choose the one that best fits your needs!**