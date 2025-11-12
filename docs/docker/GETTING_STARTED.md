# 🚀 Getting Started with Docker & Cloudflare Tunnel

**Complete setup in 3 minutes!**

---

## Prerequisites

- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- (Optional) Cloudflare account for tunnel setup

---

## Option 1: Quick Start (No Tunnel)

Perfect for local testing or VPS with public IP.

```bash
# 1. Clone repository
git clone <your-repo-url>
cd self-streme

# 2. Create configuration
cp .env.docker.example .env

# 3. Start container
docker-compose up -d

# 4. View logs
docker-compose logs -f
```

**Access**: http://localhost:3000

---

## Option 2: With Cloudflare Tunnel

Secure external access without port forwarding.

### Step 1: Get Cloudflare Token (2 minutes)

1. Visit https://one.dash.cloudflare.com/
2. Go to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Name it: `my-streme-tunnel`
5. **Copy the token** (starts with `eyJh...`)

### Step 2: Configure Public Hostname

In your tunnel settings:
- **Subdomain**: `stream`
- **Domain**: `yourdomain.com`
- **Service Type**: `HTTP`
- **URL**: `localhost:3000`

### Step 3: Deploy with Tunnel

```bash
# 1. Create .env file with your token
cat > .env << 'ENVFILE'
NODE_ENV=production
PORT=3000
TUNNEL_TOKEN=eyJhIjoiPASTE_YOUR_TOKEN_HERE
BASE_URL=https://stream.yourdomain.com
LOG_LEVEL=info
ENVFILE

# 2. Start container
docker-compose up -d

# 3. Watch logs for tunnel connection
docker-compose logs -f
```

**Look for**: `[SUCCESS] Cloudflare Tunnel is ready`

**Access**: https://stream.yourdomain.com

---

## Verify It's Working

```bash
# Check health
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2024-..."}

# View logs
docker-compose logs -f

# Check tunnel connection (if using tunnel)
docker-compose logs | grep TUNNEL
```

---

## What Just Happened?

```
Docker Container Started
    ↓
start.js checks for TUNNEL_TOKEN
    ↓
    ├─→ Token found? → Start cloudflared + app
    └─→ No token? → Start app only
    ↓
Both services log to Docker
    ↓
You can access your app!
```

---

## Next Steps

- ✅ **Running?** Great! Check out [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for common commands
- 📖 **Need help?** See [DOCKER_SETUP.md](DOCKER_SETUP.md) for troubleshooting
- 🌐 **Deployment?** Check [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for scenarios
- 🔍 **Examples?** See [EXAMPLES.md](EXAMPLES.md) for real-world setups

---

## Common Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Run tests
./scripts/test-tunnel.sh
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs

# Common fixes:
# - Port 3000 already in use? Change PORT in .env
# - Missing .env file? Copy from .env.docker.example
```

### Tunnel not connecting

```bash
# Verify token
docker-compose logs | grep TUNNEL

# Fix:
# - Check token is correct in .env
# - Verify tunnel is active in Cloudflare dashboard
# - Ensure public hostname is configured
```

---

## Help & Documentation

| Document | What's Inside |
|----------|---------------|
| [README_DOCKER.md](README_DOCKER.md) | Complete overview |
| [DOCKER_SETUP.md](DOCKER_SETUP.md) | Detailed setup guide |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Command cheat sheet |
| [EXAMPLES.md](EXAMPLES.md) | Real-world scenarios |

---

**Questions? Issues? Check the docs above or run `./scripts/test-tunnel.sh` to diagnose!**
