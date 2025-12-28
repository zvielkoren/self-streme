# P2P & Connectivity Setup Guide

This guide explains how to configure Self-Streme for maximum connectivity and performance using the integrated P2P Coordinator and Hole Punching service.

## Why is this important?
Without proper P2P configuration, your server might struggle to find peers (seeders) for torrents, leading to:
- "Nothing happening" when clicking play.
- Slow download speeds.
- Buffering or connection timeouts.

## The Solution: Hole Punching + Port Forwarding

Self-Streme v1.0.0+ includes a **P2P Coordinator** that attempts to "punch holes" through your router's firewall to establish direct connections with peers. However, for 100% reliability, manual port forwarding is still recommended.

---


## 1. Docker Configuration (Recommended)

When running in Docker, you **must** map the torrent port for both TCP and UDP traffic.

### Command Line
```bash
docker run -d \
  --name self-streme \
  -p 7000:7000 \
  -p 7001:7001 \
  -p 6881:6881 \
  -p 6881:6881/udp \
  -e TORRENT_PORT=6881 \
  ghcr.io/zvielkoren/self-streme:latest
```

### Docker Compose
```yaml
version: "3.8"
services:
  self-streme:
    image: ghcr.io/zvielkoren/self-streme:latest
    ports:
      - "7000:7000"
      - "7001:7001"
      - "6881:6881"      # Torrent TCP
      - "6881:6881/udp"  # Torrent UDP (DHT/Hole Punching)
    environment:
      - TORRENT_PORT=6881
```

---


## 2. Router Port Forwarding

If you are running Self-Streme at home (behind a router):

1. Log in to your router settings (usually `192.168.1.1` or `192.168.0.1`).
2. Find the **Port Forwarding** / **Virtual Server** section.
3. Create a new rule:
   - **Service Name:** Self-Streme P2P
   - **Port Range:** `6881`
   - **Local IP:** The IP address of the computer running Docker (e.g., `192.168.1.100`)
   - **Protocol:** **TCP & UDP** (Both are essential)

---


## 3. Verify Connectivity

Once running, check the logs or the startup message.

**Success Indicators:**
```
[INFO] Advanced TorrentService initialized { utp: true, torrentPort: 6881, ... }
[INFO] P2P Coordinator initialized for Hole Punching
```

If you see these messages, your server is ready to stream!

---


## Troubleshooting

- **"Connection Refused"**: Ensure no other torrent client (uTorrent, qBittorrent) is using port 6881 on the same machine.
- **Still no peers?**: Try restart the container. It can take up to 60 seconds for the DHT (Distributed Hash Table) to bootstrap and find peers.
