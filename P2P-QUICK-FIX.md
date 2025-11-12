# 🚀 P2P Quick Fix Guide

**Having issues with "No peers found" or "DHT nodes: 0"?** Try these quick fixes:

---

## ⚡ Instant Diagnostics

Run the diagnostic script:
```bash
cd self-streme
./scripts/diagnose-p2p.sh
```

Or check the debug endpoint:
```bash
curl http://localhost:7000/debug/torrent-status
```

Expected healthy response:
```json
{
  "dht": {
    "enabled": true,
    "ready": true,
    "nodes": 156  // Should be > 0
  },
  "torrents": {
    "active": 1
  }
}
```

---

## 🔥 Most Common Fixes

### 1. **Firewall Blocking** (90% of issues)

```bash
# Linux (UFW)
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp
sudo ufw reload

# Linux (iptables)
sudo iptables -A INPUT -p tcp --dport 6881:6889 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 6881:6889 -j ACCEPT

# Restart container
docker-compose restart
```

### 2. **Code Update Required**

The latest code update (2025-01-12) adds DHT bootstrap nodes. Update:

```bash
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 3. **Network Mode Issue**

Your `docker-compose.yml` should have:
```yaml
services:
  self-streme:
    network_mode: "host"  # ✅ Best for P2P
```

If using bridge mode instead, add:
```yaml
    ports:
      - "7000:7000"
      - "6881-6889:6881-6889/tcp"
      - "6881-6889:6881-6889/udp"
```

### 4. **VPN/Proxy Blocking**

Temporarily disable VPN to test:
```bash
# Stop VPN, then restart container
docker-compose restart

# If it works, your VPN blocks P2P
# Solution: Use P2P-friendly VPN or split tunneling
```

### 5. **Wait for DHT Bootstrap**

DHT takes 30-90 seconds to connect. Be patient:
```bash
# Watch logs
docker-compose logs -f | grep -E "DHT|peers"

# Look for:
# ✅ "DHT: enabled/ready, DHT nodes: 156"
# ✅ "Peer connected, total peers: 5"
```

---

## 🔍 Quick Checks

### Check if container is running:
```bash
docker ps | grep self-streme
```

### Check recent errors:
```bash
docker-compose logs --tail=50 | grep -i error
```

### Check DHT status in logs:
```bash
docker-compose logs | grep -i "DHT"
```

### Test tracker connectivity:
```bash
curl -I http://tracker.opentrackr.org:1337/announce
# Should return HTTP 200 or 404 (both are OK)
```

### Test DNS resolution:
```bash
nslookup router.bittorrent.com
# Should return IP addresses
```

---

## 📊 Understanding the Logs

### ✅ Good Signs:
```
✅ WebTorrent client initialized with DHT bootstrap nodes
✅ Connecting... DHT: enabled/ready, DHT nodes: 156
✅ Peer connected, total peers: 5
✅ Found 5 peers, continuing to connect...
✅ Download progress: 12.3%, peers: 8
```

### ❌ Problem Signs:
```
❌ DHT nodes: 0                    → DHT can't connect (firewall/network)
❌ No peers found... peers: 0      → No seeders or connectivity issue
❌ Torrent timeout after 120000ms  → Increase timeout or check network
❌ Error: ECONNREFUSED             → Tracker/DHT unreachable
```

---

## 🎯 Test with Known-Good Torrent

Use a well-seeded torrent to test (e.g., Ubuntu Desktop):

```
magnet:?xt=urn:btih:5fc8780a9e0c56ec12d518b85c9aba1dc8fdb1e5
```

If this works but your content doesn't → the torrent is dead/unpopular.

---

## ⚙️ Configuration Tweaks

### Increase timeout for slow networks:

Edit `.env`:
```env
TORRENT_TIMEOUT=180000     # 3 minutes (default: 120000)
TORRENT_MAX_RETRIES=5      # 5 retries (default: 4)
```

Restart:
```bash
docker-compose restart
```

---

## 🆘 Still Not Working?

1. **Run full diagnostics:**
   ```bash
   ./scripts/diagnose-p2p.sh > diagnostics.txt
   ```

2. **Check comprehensive guide:**
   ```bash
   cat docs/TROUBLESHOOTING_P2P.md
   ```

3. **Collect logs:**
   ```bash
   docker-compose logs > full-logs.txt
   ```

4. **Common Issues:**
   - **Dead torrent** → Try different source/use Jackett
   - **ISP blocking** → Use VPN (P2P-friendly)
   - **Network isolation** → Check Docker network mode
   - **Strict NAT** → Enable UPnP on router or port forward

---

## 🎬 Complete Restart

If all else fails, clean restart:

```bash
# Stop everything
docker-compose down

# Remove old containers
docker-compose rm -f

# Rebuild from scratch
docker-compose build --no-cache

# Start fresh
docker-compose up -d

# Watch logs
docker-compose logs -f
```

---

## 📚 Quick Links

- **Full Troubleshooting:** `docs/TROUBLESHOOTING_P2P.md`
- **Diagnostic Script:** `./scripts/diagnose-p2p.sh`
- **Debug Endpoint:** `http://localhost:7000/debug/torrent-status`
- **Container Logs:** `docker-compose logs -f self-streme`

---

## 💡 Pro Tips

1. **Always wait 1-2 minutes** for DHT to bootstrap before giving up
2. **Test with popular torrents** first to verify connectivity
3. **Check firewall rules** - this is the #1 cause of issues
4. **Use `network_mode: host`** in Docker for best P2P performance
5. **Monitor DHT nodes count** - should be > 0 within 60 seconds

---

**Last Updated:** 2025-01-12  
**Version:** 1.0.0

If you're still stuck, the issue is likely:
- Firewall blocking UDP ports
- ISP/VPN blocking BitTorrent
- Dead/unpopular torrent (no seeders)
- Network isolation preventing DHT discovery

See full guide: `docs/TROUBLESHOOTING_P2P.md`
