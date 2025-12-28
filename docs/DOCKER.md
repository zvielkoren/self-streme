# Docker Deployment Guide

Self-Streme is optimized for Docker. We provide pre-built images via the GitHub Container Registry.

## Quick Reference

| Feature | Details |
| :--- | :--- |
| **Image** | `ghcr.io/zvielkoren/self-streme:latest` |
| **Ports** | `7000` (API), `7001` (Addon), `6881` (P2P) |
| **Volumes** | `/app/data` (Config), `/app/media` (Local files) |

---

## 1. Running with Docker CLI

Pull and run the latest stable version:

```bash
docker pull ghcr.io/zvielkoren/self-streme:latest

docker run -d \
  --name self-streme \
  --restart unless-stopped \
  -p 7000:7000 \
  -p 7001:7001 \
  -p 6881:6881 \
  -p 6881:6881/udp \
  -e TORRENT_PORT=6881 \
  -v self_streme_data:/app/data \
  ghcr.io/zvielkoren/self-streme:latest
```

## 2. Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  self-streme:
    image: ghcr.io/zvielkoren/self-streme:latest
    container_name: self-streme
    restart: unless-stopped
    ports:
      - "7000:7000"
      - "7001:7001"
      - "6881:6881"
      - "6881:6881/udp"
    environment:
      - TORRENT_PORT=6881
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
```

Run it:
```bash
docker-compose up -d
```

---

## 3. Versioning

We use semantic versioning for our Docker tags:

- `latest`: Always the most recent stable release.
- `1.0.0`: Specific version (recommended for stability).
- `master`: Bleeding edge build from the main branch (may be unstable).

Check `package.json` in the repository to see the current version number.

## 4. Troubleshooting

**Container is unhealthy / Unhealthy status:**
This usually happens if the internal health check fails.
- Check logs: `docker logs self-streme`
- Ensure ports `7000` is not blocked.

**Cannot access localhost:7000:**
- Ensure you mapped the ports correctly (`-p 7000:7000`).
- If running on Windows/Mac, ensure Docker Desktop is running.
