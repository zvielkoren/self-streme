# P2P/Torrent Troubleshooting Guide

## 🔍 Common Issues & Solutions

This guide helps resolve peer discovery and torrent connectivity issues with Self-Streme.

---

## Issue: "Nothing happening" when clicking play

### Symptoms
- The player opens but stays black or shows a loading spinner forever.
- Logs show `Torrent discovery timeout`.
- Peers count remains at `0`.

### Root Causes & Solutions

#### 1. **P2P Coordinator Integration (v1.0.0+)**
Self-Streme now uses an integrated **P2P Coordinator** to handle NAT traversal automatically. 

**Verify initialization:**
Check your logs for:
```
[INFO] P2P Coordinator initialized for Hole Punching
[INFO] NAT Type: Restricted Cone NAT (or similar)
```
If you see an error here, check if `TORRENT_PORT` is already in use by another application.

#### 2. **Docker Port Mapping (Crucial)**
If running in Docker, you **must** map the UDP port for DHT and Hole Punching to work.

**Correct Docker Run:**
```bash
docker run -d -p 7000:7000 -p 6881:6881 -p 6881:6881/udp -e TORRENT_PORT=6881 ...
```
Without `/udp`, you will likely have 0 peers.

#### 3. **Firewall Blocking UDP**
**Problem:** Your host firewall (Windows Firewall, UFW) is blocking port 6881.

**Solution:**
- **Windows:** Allow `node.exe` or port `6881` (TCP/UDP) in Windows Defender Firewall.
- **Linux:** `sudo ufw allow 6881/udp && sudo ufw allow 6881/tcp`.

---

## Issue: "No peers found after initial discovery"

### Symptoms
```
warn: No peers found after initial discovery period. Peers: 0, continuing to wait...
info: Connecting... peers: 0, DHT nodes: 0
```

### Root Causes & Solutions

#### 1. **ISP Throttling/Blocking**
Some ISPs block BitTorrent traffic by default.
- **Solution:** Try using a VPN or enabling the **Cloudflare Tunnel** feature if you have a custom domain.

#### 2. **Dead/Unpopular Torrent**
If the content is very old or obscure, there may simply be no seeders.
- **Check:** Try playing a popular movie (e.g., a recent 2024/2025 release) to see if it works. If popular movies work, the issue is the specific torrent.

#### 3. **DHT Bootstrap Failure**
The client needs to connect to the "Global Peer Map" (DHT). If `DHT nodes: 0`, your server cannot find peers.
- **Solution:** Ensure your server has outgoing internet access and can resolve DNS (`router.bittorrent.com`).

---

## 🔧 Debugging Steps

### 1. Check Torrent Status
Access the debug endpoint in your browser:
`http://localhost:7000/debug/torrent-status`

**What to look for:**
- `dht.nodes`: Should be > 50.
- `torrents.peers`: Should be > 0 during playback.

### 2. Enter Container for Network Test
```bash
docker exec -it self-streme sh
# Inside container:
nc -u -v -w2 router.bittorrent.com 6881
```
If it says `succeeded`, UDP traffic is working correctly.

---

## ✅ Success Indicators

You know it's working when you see:
```
✅ info: P2P Coordinator initialized for Hole Punching
✅ info: Metadata received for <movie_name>
✅ info: Applying Head Strategy... (playback starting)
✅ info: Peer connected, total peers: 5
```

---

**Last Updated:** 2025-12-28  
**Version:** 1.0.0
