# P2P/Torrent Troubleshooting Guide

## 🔍 Common Issues & Solutions

This guide helps resolve peer discovery and torrent connectivity issues with Self-Streme.

---

## Issue: "No peers found after initial discovery"

### Symptoms
```
warn: No peers found after initial discovery period. Peers: 0, continuing to wait...
warn: No peers available for <hash>, continuing to search...
info: Connecting... peers: 0, DHT nodes: 0
```

### Root Causes & Solutions

#### 1. **Firewall Blocking DHT/Tracker Connections**

**Problem:** Your firewall is blocking UDP ports needed for DHT and tracker communication.

**Solution:**
```bash
# Linux (UFW)
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp
sudo ufw reload

# Linux (iptables)
sudo iptables -A INPUT -p tcp --dport 6881:6889 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 6881:6889 -j ACCEPT
sudo iptables-save

# Docker: Add to docker-compose.yml
ports:
  - "6881-6889:6881-6889/tcp"
  - "6881-6889:6881-6889/udp"
```

**Note:** If using `network_mode: "host"`, ports are already exposed on the host.

---

#### 2. **Network Isolation (Docker/Container)**

**Problem:** Container network isolation prevents P2P connections.

**Current docker-compose.yml already uses `network_mode: "host"`** which should work. If you're still having issues:

**Alternative Solution - Bridge Mode with Port Mapping:**
```yaml
services:
  self-streme:
    # Comment out network_mode: host
    # network_mode: "host"
    
    # Use explicit port mapping instead
    ports:
      - "7000:7000"           # App port
      - "6881-6889:6881-6889" # BitTorrent ports
      - "6881-6889:6881-6889/udp" # DHT ports
```

---

#### 3. **VPN/Proxy Blocking P2P**

**Problem:** Your VPN or proxy provider blocks P2P traffic.

**Solutions:**
- Use a VPN that supports P2P (check provider documentation)
- Configure VPN split tunneling to exclude torrent traffic
- Disable VPN temporarily to test
- Switch to a P2P-friendly VPN server

**Test without VPN:**
```bash
# Temporarily disable VPN and restart
docker-compose restart
```

---

#### 4. **ISP Throttling/Blocking**

**Problem:** Internet Service Provider blocks or throttles BitTorrent traffic.

**Detection:**
```bash
# Test if UDP ports are accessible
nc -u -l -p 6881  # In one terminal
nc -u localhost 6881  # In another terminal
```

**Solutions:**
- Use a VPN to encrypt traffic
- Use different trackers (already configured in the app)
- Contact ISP about P2P restrictions

---

#### 5. **Dead/Unpopular Torrent**

**Problem:** The torrent hash has no active seeders.

**Check torrent health:**
1. Copy the info hash from logs (e.g., `453475aec9bb4de3423649db8aa3cd2312538ca7`)
2. Search on torrent sites: `https://www.google.com/search?q=453475aec9bb4de3423649db8aa3cd2312538ca7`
3. Check if torrent is active/has seeders

**Solution:**
- Try a different torrent/source
- Use Jackett integration to find alternative sources

---

#### 6. **DHT Bootstrap Failure**

**Problem:** Can't connect to DHT bootstrap nodes.

**Recent Fix:** The latest code update adds proper DHT bootstrap nodes:
- `router.bittorrent.com:6881`
- `router.utorrent.com:6881`
- `dht.transmissionbt.com:6881`
- `dht.aelitis.com:6881`
- `dht.libtorrent.org:25401`

**Verify DNS Resolution:**
```bash
# Test if DHT nodes are reachable
dig router.bittorrent.com
ping router.bittorrent.com

# Test UDP connectivity
nc -u -v router.bittorrent.com 6881
```

**If DNS fails:**
```bash
# Add to /etc/hosts or use alternative DNS
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf
```

---

## 🛠️ Debugging Steps

### 1. Check Application Logs

```bash
# Docker logs
docker-compose logs -f --tail=100 self-streme

# Look for:
# ✅ "WebTorrent client initialized with DHT bootstrap nodes"
# ✅ "DHT: enabled/ready, DHT nodes: N" (N > 0)
# ✅ "Peer connected, total peers: N"
# ❌ "DHT nodes: 0" - DHT not connecting
# ❌ "No peers found" - No seeders or connectivity issue
```

### 2. Test Network Connectivity

```bash
# Enter container
docker exec -it self-streme sh

# Test tracker connectivity (HTTP)
wget -O- http://tracker.opentrackr.org:1337/announce 2>&1 | grep -i "200\|404"

# Test UDP trackers (requires netcat with UDP support)
echo -n "test" | nc -u -w1 tracker.opentrackr.org 1337

# Test DHT bootstrap nodes
nc -u -v -w2 router.bittorrent.com 6881
nc -u -v -w2 router.utorrent.com 6881
```

### 3. Monitor DHT Status

Check logs for DHT status:
```
info: Connecting... DHT: enabled/ready, DHT nodes: 156
```

**Expected behavior:**
- `DHT: enabled/ready` - DHT is working
- `DHT nodes: N` where N > 0 - Connected to DHT network
- `DHT nodes: 0` - **Problem:** Can't connect to DHT

### 4. Verify Tracker Responses

The app uses 20+ trackers for redundancy. Check if ANY respond:

```bash
# Watch logs for tracker activity
docker-compose logs -f | grep -i "tracker\|peer"
```

You should see:
```
info: Peer connected, total peers: 1
debug: Active trackers: 5
```

---

## 🔧 Configuration Tweaks

### Increase Timeout for Slow Networks

Edit `self-streme/.env`:
```env
# Increase timeouts for slow/restricted networks
TORRENT_TIMEOUT=180000  # 3 minutes (default: 120000)
TORRENT_MAX_RETRIES=5   # 5 retries (default: 4)
```

Restart:
```bash
docker-compose restart
```

### Use Alternative Trackers

If default trackers are blocked, add more in `src/config/index.js`:

```javascript
trackers: [
  // Add these alternative trackers
  "udp://open.stealth.si:80/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://tracker.coppersurfer.tk:6969/announce",
  "udp://glotorrents.pw:6969/announce",
  "udp://torrent.gresille.org:80/announce",
  "udp://p4p.arenabg.com:1337",
  "udp://tracker.leechers-paradise.org:6969",
  // ... existing trackers
],
```

---

## 🌐 Network Architecture Issues

### NAT Traversal Problems

**Symptoms:** Works on some networks but not others.

**Solution:** The app already enables NAT-PMP and UPnP. Ensure your router supports these:

```javascript
// Already configured in torrentService.js
natUpmp: true,  // Enable NAT traversal
natPmp: true,   // Enable NAT port mapping
```

**Router Configuration:**
1. Access router admin panel
2. Enable UPnP/NAT-PMP
3. Add manual port forwarding for 6881-6889 if UPnP doesn't work

### Multiple Network Interfaces

**Problem:** Server has multiple IPs, binding to wrong one.

**Solution:** Set explicit bind address:

```javascript
// In src/core/torrentService.js constructor
this.client = new WebTorrent({
  // ... existing options
  torrentPort: 6881,  // Explicit torrent port
  dhtPort: 6881,      // Explicit DHT port
});
```

---

## 📊 Monitoring & Metrics

### Check WebTorrent Client Health

Add this endpoint to check DHT status (create `src/routes/debug.js`):

```javascript
router.get('/debug/torrent-status', (req, res) => {
  const torrentService = require('../core/torrentService').default;
  
  res.json({
    activeTorrents: torrentService.client.torrents.length,
    dhtEnabled: !!torrentService.client.dht,
    dhtReady: torrentService.client.dht?.ready || false,
    dhtNodes: torrentService.client.dht?.nodes?.toArray?.()?.length || 0,
    torrents: torrentService.client.torrents.map(t => ({
      infoHash: t.infoHash,
      name: t.name,
      peers: t.numPeers,
      progress: t.progress,
      downloadSpeed: t.downloadSpeed,
      uploadSpeed: t.uploadSpeed,
    }))
  });
});
```

Access: `http://localhost:7000/debug/torrent-status`

---

## 🧪 Testing & Validation

### Test with Known-Good Torrent

Use a well-seeded torrent to verify connectivity:

```bash
# Popular Linux distro torrents (always well-seeded)
# Ubuntu Desktop 22.04 LTS
magnet:?xt=urn:btih:5fc8780a9e0c56ec12d518b85c9aba1dc8fdb1e5

# Test in logs
docker-compose logs -f | grep -E "peers|DHT"
```

### Verify Firewall Rules

```bash
# Linux - Check open ports
sudo netstat -tuln | grep -E "6881|6889"

# Docker - Check container ports
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Test UDP port externally (from another machine)
nc -u -v YOUR_SERVER_IP 6881
```

---

## 🚨 Known Limitations

1. **WebRTC Disabled**: The app disables WebRTC (`wrtc: false`) for better server compatibility. This means no browser-to-browser peer connections.

2. **No Incoming Connections in NAT**: If behind strict NAT without port forwarding, you can only make outgoing connections to peers.

3. **Tracker Downtime**: Public trackers go down frequently. The app uses 20+ trackers for redundancy.

4. **DHT Bootstrap Time**: Initial DHT connection can take 30-60 seconds. Be patient.

---

## ✅ Success Indicators

You know it's working when you see:

```
✅ info: WebTorrent client initialized with DHT bootstrap nodes
✅ info: Connecting... DHT: enabled/ready, DHT nodes: 156
✅ info: Peer connected, total peers: 5
✅ info: Found 5 peers, continuing to connect...
✅ info: Download progress: 12.3%, peers: 8, speed: 1.2MB/s
✅ info: Torrent ready after 15234ms, peers: 10, seeds: 5
```

---

## 🆘 Still Not Working?

1. **Collect Diagnostics:**
   ```bash
   # Save full logs
   docker-compose logs > torrent-debug.log
   
   # Check environment
   docker-compose config
   
   # Network status
   docker network inspect self-streme-network
   ```

2. **Test Alternative:**
   - Try with Jackett (external torrent search)
   - Use direct URL streaming instead of torrents
   - Check if specific content has working torrents

3. **Community Support:**
   - Check GitHub issues for similar problems
   - Provide logs when asking for help
   - Include: OS, Docker version, network setup

---

## 📚 Additional Resources

- [WebTorrent Documentation](https://webtorrent.io/docs)
- [BitTorrent DHT Protocol](http://www.bittorrent.org/beps/bep_0005.html)
- [Tracker List](https://github.com/ngosang/trackerslist)
- [Docker Networking](https://docs.docker.com/network/)

---

**Last Updated:** 2025-01-12  
**Version:** 1.0.0