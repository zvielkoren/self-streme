# Deployment Configuration Files

This directory contains deployment-specific configuration files for various platforms and hosting services.

## Files Overview

### `pterodactyl-egg.json`
Pterodactyl Panel egg configuration for Self-Streme deployment.

**Platform:** Pterodactyl Game Panel
**Format:** JSON egg specification

**Features:**
- Pre-configured startup commands
- Environment variable definitions
- Port mappings
- Resource allocations
- Docker image specifications

**Usage:**
1. Import egg in Pterodactyl Panel
2. Create new server using imported egg
3. Configure environment variables
4. Start server

**Import Instructions:**
```bash
# In Pterodactyl Panel:
# Admin → Nests → Import Egg
# Upload: pterodactyl-egg.json
```

### `render.yaml`
Render.com deployment configuration.

**Platform:** Render Cloud
**Format:** Blueprint YAML

**Features:**
- Service definitions
- Build commands
- Start commands
- Environment groups
- Health checks
- Auto-deploy settings

**Usage:**
1. Connect GitHub repository to Render
2. Render auto-detects `render.yaml`
3. Configure secrets/environment variables
4. Deploy automatically

**Manual Deploy:**
```bash
# Push to connected repository
git push origin main

# Or use Render CLI
render deploy
```

## Platform-Specific Guides

### Pterodactyl Panel Deployment

#### Prerequisites
- Pterodactyl Panel installed
- Docker support enabled
- Sufficient server resources (2GB+ RAM)

#### Step-by-Step

1. **Import Egg**
   - Navigate to: Admin → Nests
   - Click "Import Egg"
   - Select `pterodactyl-egg.json`

2. **Create Server**
   - Go to: Admin → Servers → Create New
   - Select Self-Streme egg
   - Allocate resources:
     - RAM: 2048MB minimum
     - Disk: 10GB minimum
     - CPU: 100% minimum

3. **Configure Environment**
   ```
   NODE_ENV=production
   PORT=11470
   P2P_TIMEOUT=20000
   ENABLE_HTTP_FALLBACK=true
   ```

4. **Setup Ports**
   - Primary: 11470 (HTTP)
   - Allocate in panel port management

5. **Start Server**
   - Click "Start" in panel
   - Monitor console for startup logs
   - Access via allocated IP:PORT

6. **Optional: Cloudflare Tunnel**
   ```
   TUNNEL_TOKEN=your_token_here
   ```

#### Troubleshooting Pterodactyl

**Server won't start:**
```bash
# Check console logs in panel
# Verify Docker image pull succeeded
# Ensure ports are allocated
```

**Port conflicts:**
```bash
# Allocate different port in panel
# Update PORT environment variable
```

**Out of memory:**
```bash
# Increase RAM allocation
# Enable swap if available
# Reduce CACHE_MAX_SIZE
```

### Render.com Deployment

#### Prerequisites
- Render.com account
- GitHub repository connected
- Payment method (for production tier)

#### Step-by-Step

1. **Connect Repository**
   - Login to Render dashboard
   - Click "New +"
   - Select "Blueprint"
   - Connect GitHub account
   - Select Self-Streme repository

2. **Configure Blueprint**
   - Render detects `render.yaml`
   - Review service configuration
   - Confirm settings

3. **Set Environment Variables**
   ```bash
   # In Render dashboard:
   NODE_ENV=production
   ENABLE_HTTP_FALLBACK=true
   P2P_TIMEOUT=20000
   
   # Optional:
   TUNNEL_TOKEN=your_cloudflare_token
   CACHE_BACKEND=redis
   ```

4. **Deploy**
   - Click "Apply"
   - Wait for build to complete
   - Service starts automatically

5. **Access Application**
   - Get URL from Render dashboard
   - Format: `https://self-streme-xxx.onrender.com`
   - Add to Stremio: `https://your-url/manifest.json`

#### Render Configuration Options

**Service Type:**
- Web Service (recommended)
- Background Worker (for processing only)

**Instance Type:**
- Free tier: Limited resources, sleeps after inactivity
- Starter: $7/month, no sleep, 512MB RAM
- Standard: $25/month, 2GB RAM
- Pro: Custom resources

**Auto-Deploy:**
```yaml
autoDeployment:
  enabled: true
  branch: main
```

**Health Checks:**
```yaml
healthCheck:
  path: /health
  interval: 60
  timeout: 10
```

#### Troubleshooting Render

**Build fails:**
```bash
# Check build logs
# Verify package.json dependencies
# Ensure Node version compatibility
```

**Service sleeps (free tier):**
```bash
# Upgrade to paid tier
# Or use external uptime monitor
# Configure warm-up requests
```

**Out of memory:**
```bash
# Upgrade instance type
# Reduce CACHE_MAX_SIZE
# Use external Redis
```

## Additional Platforms

### Docker Compose (Recommended)

See main `docker-compose.yml` in project root.

```bash
# Production deployment
docker-compose up -d

# With Cloudflare Tunnel
TUNNEL_TOKEN=xxx docker-compose up -d
```

**Documentation:** `../docker/README.md`

### Heroku

Create `Procfile` in project root:
```
web: node src/index.js
```

Deploy:
```bash
heroku create self-streme-app
heroku config:set NODE_ENV=production
git push heroku main
```

### Railway

Railway auto-detects Node.js apps.

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### DigitalOcean App Platform

Create app:
```bash
doctl apps create --spec digitalocean.yaml
```

`digitalocean.yaml`:
```yaml
name: self-streme
services:
- name: web
  github:
    repo: your-username/self-streme
    branch: main
  build_command: npm install
  run_command: npm start
  envs:
  - key: NODE_ENV
    value: production
```

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Initialize and deploy
fly launch
fly deploy
```

### AWS (EC2/ECS)

**EC2:**
```bash
# SSH to instance
ssh ubuntu@your-instance

# Clone and setup
git clone https://github.com/your-username/self-streme.git
cd self-streme
npm install
npm start
```

**ECS:**
Use Docker image with AWS ECS task definitions.

### Google Cloud Run

```bash
# Build container
gcloud builds submit --tag gcr.io/PROJECT-ID/self-streme

# Deploy
gcloud run deploy self-streme \
  --image gcr.io/PROJECT-ID/self-streme \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Azure Container Instances

```bash
az container create \
  --resource-group myResourceGroup \
  --name self-streme \
  --image your-registry/self-streme:latest \
  --ports 11470 \
  --environment-variables NODE_ENV=production
```

## Environment Variables Reference

### Required
- `NODE_ENV` - Environment mode (production/development)
- `PORT` - Application port (default: 11470)

### Optional
- `ENABLE_HTTP_FALLBACK` - Enable HTTP fallback (default: true)
- `P2P_TIMEOUT` - P2P timeout in ms (default: 20000)
- `SOURCE_TEST_TIMEOUT` - Source test timeout (default: 5000)
- `TUNNEL_TOKEN` - Cloudflare Tunnel token
- `CACHE_BACKEND` - Cache backend (memory/redis/sqlite)
- `CACHE_MAX_SIZE` - Max cache size
- `CACHE_TTL` - Cache time-to-live (seconds)

### Platform-Specific
- `REDIS_URL` - Redis connection URL (Render, Heroku)
- `DATABASE_URL` - Database URL (if using PostgreSQL)

## Resource Requirements

### Minimum
- **CPU:** 1 core
- **RAM:** 1GB
- **Disk:** 5GB
- **Network:** Stable internet connection

### Recommended
- **CPU:** 2+ cores
- **RAM:** 2GB+
- **Disk:** 10GB+ (for cache)
- **Network:** High bandwidth for streaming

### Production
- **CPU:** 4+ cores
- **RAM:** 4GB+
- **Disk:** 50GB+ (SSD recommended)
- **Network:** 100Mbps+ bandwidth
- **Backup:** Regular automated backups

## Security Considerations

### 1. Environment Variables
- Never commit `.env` files
- Use platform secret managers
- Rotate tokens regularly

### 2. Network Security
- Use HTTPS (via Cloudflare Tunnel or reverse proxy)
- Implement rate limiting
- Configure firewall rules

### 3. Access Control
- Restrict admin access
- Use authentication for sensitive endpoints
- Monitor access logs

### 4. Updates
- Keep dependencies updated
- Monitor security advisories
- Apply patches promptly

## Monitoring & Logging

### Health Checks
All platforms support health check endpoint:
```
GET /health
Response: {"status": "ok", "uptime": 12345}
```

### Logging
Configure logging based on platform:

**Pterodactyl:**
- View in panel console
- Check `/app/logs/` directory

**Render:**
- View in Render dashboard logs
- Configure log drains

**Docker:**
```bash
docker-compose logs -f
```

### Metrics
- Response times
- Active streams
- Cache hit rate
- Source success rates

```bash
# Check source statistics
curl http://your-url/api/sources/stats
```

## Backup Strategies

### Data to Backup
- Configuration files (`.env`)
- Cache data (if persistent)
- Custom modifications
- Deployment configurations

### Backup Methods

**Manual:**
```bash
# Backup configuration
cp .env .env.backup-$(date +%Y%m%d)

# Backup cache (if using file-based)
tar czf cache-backup.tar.gz data/ downloads/
```

**Automated:**
```bash
# Daily backup cron
0 0 * * * /path/to/backup-script.sh
```

**Platform-Specific:**
- **Pterodactyl:** Use panel backup feature
- **Render:** Use Render disk snapshots
- **Docker:** Volume backups

## Performance Optimization

### 1. Cache Configuration
```bash
CACHE_BACKEND=redis  # Faster than sqlite/memory
CACHE_MAX_SIZE=10GB  # Adjust based on disk
CACHE_TTL=86400      # 24 hours
```

### 2. Resource Allocation
- Increase RAM for better caching
- Use SSD for faster I/O
- Multiple CPU cores for concurrent streams

### 3. Network Optimization
- Use CDN (Cloudflare)
- Enable HTTP/2
- Configure compression

### 4. Database Optimization
- Use Redis for production
- Enable persistence
- Configure eviction policies

## Cost Estimation

### Free Tier Options
- **Render:** Free tier with limitations
- **Railway:** $5 credit/month
- **Fly.io:** Free allowance
- **Pterodactyl:** Self-hosted (hardware cost only)

### Paid Options
- **Render Starter:** $7/month
- **Railway Pro:** $20/month
- **DigitalOcean:** $6-12/month (droplet)
- **AWS:** Variable (t3.small ~$15/month)

### Self-Hosted
- **VPS:** $5-20/month
- **Dedicated:** $50+/month
- **Hardware:** One-time cost

## Migration Guide

### From Pterodactyl to Render
```bash
# Export environment variables from Pterodactyl
# Add to Render environment
# Deploy to Render
# Update DNS/URLs
# Test thoroughly
# Shut down Pterodactyl instance
```

### From Docker to Cloud Platform
```bash
# Backup data volumes
# Push code to Git
# Configure cloud platform
# Deploy
# Restore data if needed
# Update integrations
```

## Support & Documentation

- [Main README](../README.md) - Project overview
- [Docker Guide](../docker/README.md) - Docker deployment
- [Quick Start](../docs/QUICK_START.md) - Getting started
- [Troubleshooting](../docs/TROUBLESHOOTING_P2P.md) - Common issues

## Contributing

To add new platform configurations:
1. Create configuration file in this directory
2. Document usage in this README
3. Test deployment thoroughly
4. Submit pull request

---

**Last Updated:** 2024
**Maintained by:** Development Team