# Self-Streme 🎬

**Self-Hosted Streaming Server & Stremio Addon**

Self-Streme is a powerful, self-hosted streaming solution that bridges your local media, torrent networks, and Stremio. It provides a robust backend for streaming content directly to Stremio or any web browser, featuring advanced caching, P2P acceleration, and automated Docker deployment.

---

## 🚀 Quick Start (Docker)

The easiest way to run Self-Streme is using Docker.

```bash
# 1. Run the container
docker run -d \
  --name self-streme \
  -p 7000:7000 \
  -p 7001:7001 \
  -p 6881:6881 \
  -p 6881:6881/udp \
  -e TORRENT_PORT=6881 \
  ghcr.io/zvielkoren/self-streme:latest

# 2. Access the server
# Open http://localhost:7000 in your browser
```

---

## ✨ Key Features

- **Advanced P2P Streaming:** 
  - Integrated **Hole Punching** service (P2PCoordinator) to connect through firewalls/NATs.
  - Hybrid fallback: Tries P2P first, falls back to HTTP download if peers are scarce.
- **Smart Caching:** 
  - Caches torrents and metadata to memory or disk (configurable).
  - "Head & Holes" strategy prioritizes the start of video files for instant playback.
- **Stremio Integration:** 
  - Works as a native Stremio addon.
  - Supports movies, series, and anime.
- **Cross-Platform:** 
  - Runs anywhere Docker runs (Linux, Windows, macOS, Raspberry Pi).
  - Includes automated GitHub Actions for building Docker images.

---

## 🛠️ Configuration

Configure the server using environment variables:

| Variable | Description | Default | 
| :--- | :--- | :--- |
| `PORT` | API Server Port | `7000` |
| `ADDON_PORT` | Stremio Addon Port | `7001` |
| `TORRENT_PORT` | **Important:** Port for incoming P2P connections | `0` (Random) |
| `TUNNEL_TOKEN` | Cloudflare Tunnel Token (optional) | - |
| `CACHE_BACKEND` | Cache storage (`memory`, `redis`, `sqlite`) | `memory` |
| `MEDIA_PATH` | Path to local media files | `./media` |

### Recommended Docker Command for Production
For best performance, map the torrent port (TCP+UDP) to ensure connectivity:

```bash
docker run -d \
  --name self-streme \
  --restart unless-stopped \
  -p 7000:7000 \
  -p 7001:7001 \
  -p 6881:6881 \
  -p 6881:6881/udp \
  -e TORRENT_PORT=6881 \
  -v ./data:/app/data \
  ghcr.io/zvielkoren/self-streme:latest
```

---

## 📚 Documentation

- [**P2P Setup Guide**](docs/P2P_SETUP_GUIDE.md) - Detailed network configuration.
- [**Deployment Guide**](docs/DEPLOYMENT.md) - Deploy to VPS, Pterodactyl, or Render.
- [**Streaming Flow**](docs/STREAMING-FLOW.md) - How the hybrid streaming engine works.
- [**Troubleshooting**](docs/TROUBLESHOOTING_P2P.md) - Fix common connectivity issues.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.