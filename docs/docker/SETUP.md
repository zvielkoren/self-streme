# Docker & Cloudflare Tunnel Setup Guide

Complete guide for deploying Self-Streme with optional Cloudflare Tunnel integration.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup)
- [Configuration](#configuration)
- [Deployment Options](#deployment-options)
- [Monitoring & Logs](#monitoring--logs)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Without Cloudflare Tunnel (Local/Standard Deployment)

```bash
# Build the Docker image
docker build -t self-streme .

# Run with docker-compose
docker-compose up -d

# Or run directly with Docker
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  --name self-streme \
  self-streme
```

Access your app at: `http://localhost:3000`

### With Cloudflare Tunnel

```bash
# Set your tunnel token
export TUNNEL_TOKEN="your_cloudflare_tunnel_token_here"

# Run with docker-compose
docker-compose up -d

# Or run directly with Docker
docker run -d \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e TUNNEL_TOKEN="your_token_here" \
  --name self-streme \
  self-streme
```

No port mapping needed! Access via your Cloudflare domain.

---

## Cloudflare Tunnel Setup

### Step 1: Create a Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Choose **Cloudflared** as the connector type
5. Give your tunnel a name (e.g., `self-streme-tunnel`)
6. Click **Save tunnel**

### Step 2: Get Your Tunnel Token

After creating the tunnel, you'll see installation instructions. Copy the token from the command that looks like:

```bash
cloudflared tunnel run --token eyJhIjoiXXXXXXXXXXXX...
```

Copy everything after `--token` - that's your `TUNNEL_TOKEN`.

### Step 3: Configure Public Hostname

1. In the tunnel configuration, go to the **Public Hostname** tab
2. Click **Add a public hostname**
3. Configure:
   - **Subdomain**: Your desired subdomain (e.g., `stream`)
   - **Domain**: Select your domain
   - **Type**: `HTTP`
   - **URL**: `localhost:3000` (or your app's port)
4. Click **Save hostname**

### Step 4: Deploy with Token

Create a `.env` file:

```env
TUNNEL_TOKEN=eyJhIjoiXXXXXXXXXXXX...
NODE_ENV=production
PORT=3000
```

Then start your container:

```bash
docker-compose up -d
```

### Step 5: Verify

Check the logs to confirm tunnel connection:

```bash
docker-compose logs -f
```

You should see:
- `[TUNNEL] Registered tunnel connection`
- `[APP] Server running on port 3000`
- `All services are running`

Access your app at: `https://stream.yourdomain.com`

---

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
# === Required ===
NODE_ENV=production
PORT=3000

# === Cloudflare Tunnel (Optional) ===
# If set, automatically starts cloudflared
# If not set, runs without tunnel
TUNNEL_TOKEN=your_cloudflare_tunnel_token

# === Application Settings ===
BASE_URL=https://your-domain.com
LOG_LEVEL=info

# === Cache Configuration ===
CACHE_BACKEND=memory
CACHE_TTL=3600
CACHE_MAX_SIZE=1000
CACHE_MAX_DISK_MB=5000

# === Jackett Integration (Optional) ===
JACKETT_URL=http://localhost:9117
JACKETT_API_KEY=your_jackett_api_key

# === External APIs ===
OMDB_API_KEY=your_omdb_api_key
```

### Docker Compose Configuration

The `docker-compose.yml` file includes:

- **Health checks**: Automatic container health monitoring
- **Restart policy**: `unless-stopped` for reliability
- **Resource limits**: CPU and memory constraints
- **Logging**: Automatic log rotation
- **Volumes**: Persistent data storage

Customize as needed for your environment.

---

## Deployment Options

### Option 1: Docker Compose (Recommended)

Best for production deployments with multiple services.

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Update
docker-compose pull
docker-compose up -d
```

### Option 2: Docker CLI

For simple single-container deployments.

```bash
# Build
docker build -t self-streme .

# Run
docker run -d \
  --name self-streme \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e TUNNEL_TOKEN="${TUNNEL_TOKEN}" \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  self-streme

# Logs
docker logs -f self-streme

# Stop
docker stop self-streme

# Remove
docker rm self-streme
```

### Option 3: Docker with Environment File

```bash
docker run -d \
  --name self-streme \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  self-streme
```

### Option 4: Kubernetes

Example deployment manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: self-streme
spec:
  replicas: 1
  selector:
    matchLabels:
      app: self-streme
  template:
    metadata:
      labels:
        app: self-streme
    spec:
      containers:
      - name: self-streme
        image: self-streme:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: TUNNEL_TOKEN
          valueFrom:
            secretKeyRef:
              name: cloudflare-tunnel
              key: token
        resources:
          limits:
            memory: "2Gi"
            cpu: "2000m"
          requests:
            memory: "512Mi"
            cpu: "500m"
```

---

## Monitoring & Logs

### View Real-Time Logs

```bash
# All logs
docker-compose logs -f

# Only tunnel logs
docker-compose logs -f | grep TUNNEL

# Only app logs
docker-compose logs -f | grep APP

# Last 100 lines
docker-compose logs --tail=100
```

### Log Output Examples

**Successful startup:**
```
[INFO] ============================================================
[INFO] Self-Streme Startup Manager
[INFO] ============================================================
[INFO] Environment: production
[INFO] Port: 3000
[INFO] Tunnel Token: Set ✓
[TUNNEL] Starting Cloudflare Tunnel...
[TUNNEL] Connection registered
[SUCCESS] Cloudflare Tunnel is ready
[APP] Starting application...
[APP] Server running on port 3000
[SUCCESS] Application is ready on port 3000
[SUCCESS] All services are running
```

**Without tunnel:**
```
[INFO] Tunnel Token: Not set ✗
[INFO] No TUNNEL_TOKEN provided, skipping Cloudflare Tunnel
[APP] Starting application...
[APP] Server running on port 3000
```

### Health Checks

The container includes automatic health checks:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' self-streme

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' self-streme
```

---

## Troubleshooting

### Issue: Tunnel Not Connecting

**Symptoms:**
- `[ERROR] cloudflared binary not found`
- Tunnel process exits immediately

**Solution:**
1. Rebuild the Docker image to ensure cloudflared is installed:
   ```bash
   docker-compose build --no-cache
   ```

2. Verify cloudflared is in the image:
   ```bash
   docker run --rm self-streme which cloudflared
   ```

### Issue: Invalid Tunnel Token

**Symptoms:**
- `[ERROR] Invalid token`
- Tunnel exits with code 1

**Solution:**
1. Verify your token in Cloudflare dashboard
2. Ensure token has no extra spaces or line breaks
3. Check that the tunnel wasn't deleted in Cloudflare
4. Regenerate the token if necessary

### Issue: Application Not Starting

**Symptoms:**
- `[ERROR] Application file not found`
- App exits immediately

**Solution:**
1. Ensure `src/index.js` exists
2. Check file permissions
3. Verify all dependencies are installed:
   ```bash
   docker-compose exec self-streme npm list
   ```

### Issue: Port Already in Use

**Symptoms:**
- `Error starting userland proxy: listen tcp 0.0.0.0:3000: bind: address already in use`

**Solution:**
1. Change the port mapping in `docker-compose.yml`:
   ```yaml
   ports:
     - "3001:3000"  # Maps host port 3001 to container port 3000
   ```

2. Or stop the conflicting service:
   ```bash
   lsof -i :3000
   kill -9 <PID>
   ```

### Issue: Container Keeps Restarting

**Symptoms:**
- Container status shows as "Restarting"

**Solution:**
1. Check logs for errors:
   ```bash
   docker-compose logs --tail=50
   ```

2. Run in foreground to see errors:
   ```bash
   docker-compose up
   ```

3. Verify environment variables are set correctly

### Issue: High Memory Usage

**Solution:**
1. Adjust resource limits in `docker-compose.yml`:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 1G  # Reduce limit
   ```

2. Configure cache settings:
   ```env
   CACHE_BACKEND=memory
   CACHE_MAX_SIZE=500
   CACHE_MAX_DISK_MB=2000
   ```

### Issue: Tunnel Connected but Site Not Accessible

**Symptoms:**
- Tunnel shows as connected
- Cannot access via Cloudflare URL

**Solution:**
1. Verify public hostname configuration in Cloudflare dashboard
2. Check that the service type is `HTTP` (not HTTPS)
3. Ensure the URL points to `localhost:3000`
4. Check DNS propagation (can take a few minutes)
5. Try accessing with `https://` (Cloudflare forces HTTPS)

### Debug Mode

Run with verbose logging:

```bash
docker run --rm \
  -e NODE_ENV=development \
  -e LOG_LEVEL=debug \
  -e TUNNEL_TOKEN="${TUNNEL_TOKEN}" \
  self-streme
```

---

## Advanced Usage

### Custom Cloudflare Configuration

For advanced tunnel configuration, create a `config.yml`:

```yaml
tunnel: your-tunnel-id
credentials-file: /app/.cloudflared/credentials.json

ingress:
  - hostname: stream.yourdomain.com
    service: http://localhost:3000
  - hostname: admin.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
```

Mount it in Docker:

```yaml
volumes:
  - ./config.yml:/app/.cloudflared/config.yml
```

Then use:
```bash
cloudflared tunnel --config /app/.cloudflared/config.yml run
```

### Multiple Tunnels

Run multiple services with different tunnels:

```yaml
services:
  app:
    environment:
      - TUNNEL_TOKEN=${APP_TUNNEL_TOKEN}
  
  admin:
    environment:
      - TUNNEL_TOKEN=${ADMIN_TUNNEL_TOKEN}
```

### Using with Traefik/Nginx

If using a reverse proxy, you can disable port mapping and route through the proxy:

```yaml
services:
  self-streme:
    # No ports exposed
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`stream.yourdomain.com`)"
```

---

## Security Best Practices

1. **Never commit `.env` files** with sensitive tokens
2. **Use Docker secrets** for production tokens
3. **Run as non-root user** (already configured in Dockerfile)
4. **Keep cloudflared updated** - rebuild image regularly
5. **Enable HTTPS** on Cloudflare (automatic with tunnel)
6. **Set resource limits** to prevent DoS
7. **Use health checks** for automatic recovery
8. **Monitor logs** for suspicious activity

---

## Performance Optimization

### Cache Configuration

For better performance with Docker:

```env
CACHE_BACKEND=sqlite
CACHE_TTL=7200
CACHE_MAX_SIZE=2000
CACHE_MAX_DISK_MB=10000
CACHE_PERSISTENT=true
```

### Resource Allocation

Adjust based on expected load:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
    reservations:
      cpus: '2'
      memory: 1G
```

---

## Additional Resources

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## Support

For issues specific to:
- **Cloudflare Tunnel**: Check Cloudflare Zero Trust dashboard
- **Docker**: Review container logs with `docker-compose logs`
- **Application**: Check application logs in `/app/logs`

---

**Last Updated**: 2024