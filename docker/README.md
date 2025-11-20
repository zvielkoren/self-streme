# Docker Configuration Files

This directory contains Docker-related configuration files for Self-Streme deployment.

## Files Overview

### `docker-compose.yml` (Main file - in root)
Primary Docker Compose configuration for production deployment.

**Location:** `../docker-compose.yml`

**Usage:**
```bash
docker-compose up -d
```

**Features:**
- Production-ready configuration
- Health checks
- Automatic restart policies
- Volume management
- Network configuration

### `docker-compose.dev.yml`
Development environment configuration with hot-reload support.

**Usage:**
```bash
docker-compose -f docker-compose.yml -f docker/docker-compose.dev.yml up
```

**Features:**
- Source code mounting
- Development dependencies
- Debug logging
- File watching
- Port exposure for debugging

**Override Configuration:**
```yaml
services:
  app:
    volumes:
      - ./src:/app/src
      - ./logs:/app/logs
    environment:
      - NODE_ENV=development
      - DEBUG=*
```

### `docker-compose.ports.yml`
Alternative port configuration for environments with port conflicts.

**Usage:**
```bash
docker-compose -f docker-compose.yml -f docker/docker-compose.ports.yml up
```

**Use Cases:**
- Multiple instances on same host
- Port conflicts with other services
- Custom networking requirements
- Development/staging separation

**Custom Ports Example:**
```yaml
services:
  app:
    ports:
      - "3001:11470"  # Map to different host port
```

## Quick Start

### Production Deployment
```bash
# 1. Create environment file
cp example.env .env

# 2. Edit configuration
nano .env

# 3. Start services
docker-compose up -d

# 4. View logs
docker-compose logs -f

# 5. Check status
docker-compose ps
```

### Development Environment
```bash
# 1. Use dev configuration
docker-compose -f docker-compose.yml -f docker/docker-compose.dev.yml up

# 2. Code changes auto-reload
# Edit files in src/

# 3. View real-time logs
docker-compose logs -f app
```

### Custom Ports
```bash
# Run on different port
docker-compose -f docker-compose.yml -f docker/docker-compose.ports.yml up -d
```

## Configuration Combinations

### Production + Custom Ports
```bash
docker-compose -f docker-compose.yml -f docker/docker-compose.ports.yml up -d
```

### Development + Custom Ports
```bash
docker-compose \
  -f docker-compose.yml \
  -f docker/docker-compose.dev.yml \
  -f docker/docker-compose.ports.yml \
  up
```

## Environment Variables

Common environment variables used across configurations:

### Core Settings
- `NODE_ENV` - Environment (production/development)
- `PORT` - Internal application port (default: 11470)
- `HOST` - Bind host (default: 0.0.0.0)

### Streaming Settings
- `P2P_TIMEOUT` - P2P connection timeout (ms)
- `ENABLE_HTTP_FALLBACK` - Enable HTTP fallback (true/false)
- `SOURCE_TEST_TIMEOUT` - Source testing timeout (ms)

### Cloudflare Tunnel
- `TUNNEL_TOKEN` - Cloudflare Tunnel authentication token
- `TUNNEL_METRICS` - Enable metrics (default: localhost:2000)

### Cache Configuration
- `CACHE_BACKEND` - Cache backend (memory/redis/sqlite)
- `CACHE_MAX_SIZE` - Maximum cache size
- `CACHE_TTL` - Time to live (seconds)

### Redis (if using)
- `REDIS_HOST` - Redis server host
- `REDIS_PORT` - Redis server port
- `REDIS_PASSWORD` - Redis password

## Volume Management

### Persistent Data
```yaml
volumes:
  data:         # Application data
  downloads:    # Downloaded torrents
  logs:         # Application logs
  temp:         # Temporary files
```

### Mounting Locations
- `/app/data` - Database and persistent data
- `/app/downloads` - Cached video files
- `/app/logs` - Log files
- `/app/temp` - Temporary processing files

### Backup Volumes
```bash
# Backup data
docker run --rm -v self-streme_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/backup-data.tar.gz /data

# Restore data
docker run --rm -v self-streme_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/backup-data.tar.gz -C /
```

## Networking

### Default Network
- Bridge network for container isolation
- Exposed ports for external access
- Internal DNS resolution

### Custom Networks
```yaml
networks:
  streme-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Port Mapping
- **11470** - Main application HTTP
- **11471** - Alternative port (ports.yml)
- **2000** - Cloudflare Tunnel metrics (internal)

## Health Checks

Containers include health checks:

```yaml
healthcheck:
  test: ["CMD", "node", "healthcheck.js"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**Check health:**
```bash
docker-compose ps
docker inspect self-streme-app --format='{{.State.Health.Status}}'
```

## Common Commands

### Start Services
```bash
docker-compose up -d                    # Detached mode
docker-compose up                       # Foreground mode
docker-compose up --build               # Rebuild images
```

### Stop Services
```bash
docker-compose stop                     # Stop containers
docker-compose down                     # Stop and remove
docker-compose down -v                  # Stop and remove volumes
```

### View Logs
```bash
docker-compose logs                     # All logs
docker-compose logs -f                  # Follow logs
docker-compose logs -f app              # Specific service
docker-compose logs --tail=100 app      # Last 100 lines
```

### Container Management
```bash
docker-compose ps                       # List containers
docker-compose restart                  # Restart all
docker-compose restart app              # Restart specific
docker-compose exec app sh              # Shell access
```

### Image Management
```bash
docker-compose build                    # Build images
docker-compose build --no-cache         # Clean build
docker-compose pull                     # Pull latest images
docker-compose push                     # Push to registry
```

### Resource Usage
```bash
docker stats                            # Real-time stats
docker-compose top                      # Running processes
docker system df                        # Disk usage
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
lsof -i :11470
netstat -tulpn | grep 11470

# Option 1: Stop conflicting service
sudo systemctl stop conflicting-service

# Option 2: Use custom ports
docker-compose -f docker-compose.yml -f docker/docker-compose.ports.yml up -d
```

### Permission Denied
```bash
# Fix volume permissions
docker-compose exec app chown -R node:node /app/data
docker-compose exec app chown -R node:node /app/downloads
```

### Container Won't Start
```bash
# Check logs
docker-compose logs app

# Check environment
docker-compose config

# Validate compose file
docker-compose -f docker-compose.yml config

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Out of Disk Space
```bash
# Clean up Docker
docker system prune -a              # Remove unused data
docker volume prune                 # Remove unused volumes
docker image prune -a               # Remove unused images

# Check volume sizes
docker system df -v
```

### Network Issues
```bash
# Recreate network
docker-compose down
docker network prune
docker-compose up -d

# Check network connectivity
docker-compose exec app ping google.com
docker-compose exec app curl https://instant.io
```

## Best Practices

### 1. Use .env Files
```bash
# Never commit .env
echo ".env" >> .gitignore

# Use example as template
cp example.env .env
```

### 2. Regular Backups
```bash
# Backup volumes weekly
0 0 * * 0 /path/to/backup-script.sh
```

### 3. Monitor Resources
```bash
# Set up monitoring
docker-compose logs -f | grep ERROR
docker stats --no-stream
```

### 4. Update Regularly
```bash
# Pull latest changes
git pull
docker-compose pull
docker-compose up -d
```

### 5. Security
- Don't expose unnecessary ports
- Use secrets management
- Keep images updated
- Review logs regularly

## Production Checklist

- [ ] Environment variables configured
- [ ] Volumes backed up regularly
- [ ] Health checks enabled
- [ ] Resource limits set
- [ ] Logging configured
- [ ] Monitoring in place
- [ ] SSL/TLS configured (via tunnel or proxy)
- [ ] Firewall rules applied
- [ ] Regular updates scheduled

## Performance Tuning

### Resource Limits
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Cache Optimization
```yaml
environment:
  - CACHE_BACKEND=redis
  - CACHE_MAX_SIZE=10GB
  - CACHE_TTL=86400
```

### Network Performance
```yaml
networks:
  streme-net:
    driver: bridge
    driver_opts:
      com.docker.network.driver.mtu: 1450
```

## Integration Examples

### With Nginx Reverse Proxy
```nginx
upstream self-streme {
    server localhost:11470;
}

server {
    listen 80;
    server_name streme.example.com;

    location / {
        proxy_pass http://self-streme;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### With Traefik
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.streme.rule=Host(`streme.example.com`)"
  - "traefik.http.services.streme.loadbalancer.server.port=11470"
```

### With Cloudflare Tunnel
```yaml
environment:
  - TUNNEL_TOKEN=${TUNNEL_TOKEN}
```

## See Also

- [Main README](../README.md) - Project overview
- [Deployment Guide](../docs/DEPLOYMENT.md) - Detailed deployment
- [Quick Start](../docs/QUICK_START.md) - Getting started
- [Troubleshooting](../docs/TROUBLESHOOTING_P2P.md) - Common issues

---

**Last Updated:** 2024
**Maintained by:** Development Team