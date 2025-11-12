# 🎬 Streaming Troubleshooting Guide

**Having trouble streaming on different devices or localhost?** This guide will help you fix common streaming issues.

---

## 🔍 Quick Diagnostics

### Test Your Connection

1. **Check if server is running:**
   ```bash
   curl http://localhost:7000/health
   ```
   Expected: `{"status":"ok","timestamp":"..."}`

2. **Test manifest endpoint:**
   ```bash
   curl http://localhost:7000/manifest.json
   ```
   Expected: JSON with addon info

3. **Check URL detection:**
   ```bash
   curl http://localhost:7000/debug/url
   ```
   This shows how the server detects your URL and network configuration

---

## 🌐 Common Streaming Issues

### Issue 1: Can't Stream from Localhost

**Symptoms:**
- Server runs but can't access from `http://localhost:7000`
- Connection refused errors

**Solutions:**

1. **Check if port is in use:**
   ```bash
   lsof -i :7000
   # or
   netstat -an | grep 7000
   ```

2. **Verify server is listening on all interfaces:**
   - Server should bind to `0.0.0.0:7000` (not just `127.0.0.1`)
   - Check server logs for: `🌐 Listening on: 0.0.0.0 (all network interfaces)`

3. **Try alternative localhost addresses:**
   - `http://127.0.0.1:7000`
   - `http://localhost:7000`
   - `http://0.0.0.0:7000`

4. **Check firewall rules:**
   ```bash
   # Linux (UFW)
   sudo ufw allow 7000/tcp
   
   # Linux (iptables)
   sudo iptables -A INPUT -p tcp --dport 7000 -j ACCEPT
   ```

---

### Issue 2: Can't Stream from Other Devices on Network

**Symptoms:**
- Works on localhost but not from phones, tablets, or other computers
- Connection timeout from other devices

**Solutions:**

1. **Find your server's IP address:**
   ```bash
   # Linux/Mac
   hostname -I
   # or
   ip addr show
   
   # Windows
   ipconfig
   ```
   Look for IP like `192.168.1.100` or `10.0.0.50`

2. **Test connection from another device:**
   - Open browser on phone/tablet
   - Navigate to: `http://YOUR_IP:7000/health`
   - Example: `http://192.168.1.100:7000/health`

3. **Configure firewall to allow LAN access:**
   ```bash
   # Linux (UFW) - Allow from local network
   sudo ufw allow from 192.168.0.0/16 to any port 7000
   
   # Or allow from anywhere (less secure)
   sudo ufw allow 7000/tcp
   ```

4. **Set BASE_URL for network access:**
   Edit `.env` file:
   ```env
   BASE_URL=http://192.168.1.100:7000
   ```
   Replace `192.168.1.100` with your actual server IP

5. **Restart the server:**
   ```bash
   # Docker
   docker-compose restart
   
   # Direct
   npm start
   ```

---

### Issue 3: Video Playback Issues (Buffering, Seeking)

**Symptoms:**
- Video starts but can't seek/skip
- Constant buffering
- Playback freezes

**Solutions:**

1. **Check CORS headers:**
   ```bash
   curl -I http://localhost:7000/manifest.json
   ```
   Should include:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Expose-Headers: Content-Range, Accept-Ranges`

2. **Verify Range request support:**
   ```bash
   curl -I -H "Range: bytes=0-1000" http://localhost:7000/play/movie/tt0111161/0
   ```
   Should return `206 Partial Content`

3. **Check network bandwidth:**
   - Ensure stable network connection
   - For LAN: Check WiFi signal strength
   - For remote: Check upload speed on server

4. **Increase torrent timeout (if using torrents):**
   Edit `.env`:
   ```env
   TORRENT_TIMEOUT=180000  # 3 minutes
   TORRENT_MAX_RETRIES=5
   ```

---

### Issue 4: Stremio Can't Find Addon

**Symptoms:**
- Stremio doesn't show the addon
- "Failed to load addon" error

**Solutions:**

1. **Use correct URL format in Stremio:**
   
   **For localhost:**
   ```
   http://localhost:7000/manifest.json
   ```
   
   **For LAN devices:**
   ```
   http://192.168.1.100:7000/manifest.json
   ```
   Replace `192.168.1.100` with your server IP
   
   **For remote access:**
   ```
   https://your-domain.com/manifest.json
   ```

2. **Verify manifest is accessible:**
   ```bash
   curl http://localhost:7000/manifest.json
   ```

3. **Check Stremio logs:**
   - Open Stremio
   - Go to Settings → Advanced
   - Enable debug logs
   - Check for connection errors

4. **Try reinstalling addon:**
   - Remove addon from Stremio
   - Clear Stremio cache
   - Reinstall with correct URL

---

## 🐳 Docker-Specific Issues

### Port Mapping with Docker

**Using `network_mode: host` (Recommended for P2P):**
- Server binds directly to host's port 7000
- Access via: `http://localhost:7000` or `http://YOUR_IP:7000`
- No port mapping needed
- Best for torrents/P2P

**Using bridge mode with port mapping:**
Edit `docker-compose.yml`:
```yaml
services:
  self-streme:
    # Comment out network_mode: host
    # network_mode: "host"
    
    # Add port mapping instead
    ports:
      - "7000:7000"
      - "6881-6889:6881-6889/tcp"  # For torrents
      - "6881-6889:6881-6889/udp"  # For torrents
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

---

## 📱 Device-Specific Issues

### iOS/iPhone/iPad

1. **Use HTTP proxy streaming:**
   - iOS requires HTTP streams (not magnet links)
   - Server automatically detects iOS and provides HTTP URLs

2. **Check iOS network permissions:**
   - Ensure Stremio has network access permission
   - Check iOS firewall settings

3. **Test in browser first:**
   ```
   http://YOUR_SERVER_IP:7000/health
   ```

### Android

1. **Works with both magnet and HTTP:**
   - Android supports both magnet links and HTTP streaming

2. **Check Android firewall:**
   - Some Android devices have built-in firewalls
   - Ensure network access is allowed

### Smart TVs / Streaming Devices

1. **Use HTTP proxy streaming:**
   - Most smart TVs work better with HTTP streams
   - Server auto-detects and adapts

2. **Check network connectivity:**
   - Ensure TV is on same network as server
   - Test connection: `http://YOUR_SERVER_IP:7000/health`

---

## ⚙️ Configuration Reference

### Environment Variables for Streaming

Create/edit `.env` file:

```env
# Server port (default: 7000)
PORT=7000

# Base URL - Set this for consistent access across devices
# For localhost only:
# BASE_URL=http://localhost:7000
#
# For LAN access (replace with your IP):
BASE_URL=http://192.168.1.100:7000
#
# For public access with domain:
# BASE_URL=https://stream.yourdomain.com

# Node environment
NODE_ENV=production
```

After editing, restart:
```bash
# Docker
docker-compose restart

# Direct
npm start
```

---

## 🔧 Advanced Troubleshooting

### Check Server Logs

**Docker:**
```bash
docker-compose logs -f self-streme
```

**Direct:**
```bash
# Logs are output to console
npm start
```

**Look for:**
- ✅ `🚀 Server running on port 7000`
- ✅ `🌐 Listening on: 0.0.0.0 (all network interfaces)`
- ✅ `Trust Proxy: enabled`
- ❌ Connection errors
- ❌ Port already in use

### Network Diagnostic Commands

```bash
# Check if server is listening
netstat -tulpn | grep 7000

# Test from another device
curl http://YOUR_SERVER_IP:7000/health

# Check firewall status
sudo ufw status

# Check routing
ip route show

# Test DNS resolution
nslookup your-domain.com
```

---

## 📊 Quick Reference: Access URLs

| Device/Location | URL Format | Example |
|----------------|------------|---------|
| **Same Computer** | `http://localhost:7000` | `http://localhost:7000/manifest.json` |
| **Same Network (LAN)** | `http://YOUR_IP:7000` | `http://192.168.1.100:7000/manifest.json` |
| **Remote (with domain)** | `https://yourdomain.com` | `https://stream.example.com/manifest.json` |
| **Remote (with IP)** | `http://YOUR_PUBLIC_IP:7000` | `http://203.0.113.10:7000/manifest.json` |

---

## 🆘 Still Not Working?

1. **Run full diagnostics:**
   ```bash
   curl http://localhost:7000/debug/url
   curl http://localhost:7000/health
   curl http://localhost:7000/manifest.json
   ```

2. **Check firewall:**
   ```bash
   sudo ufw status
   sudo iptables -L
   ```

3. **Verify network connectivity:**
   ```bash
   ping YOUR_SERVER_IP
   telnet YOUR_SERVER_IP 7000
   ```

4. **Review logs for errors:**
   ```bash
   docker-compose logs | grep -i error
   ```

5. **Test with minimal configuration:**
   - Stop server
   - Remove `.env` file
   - Start with defaults
   - Test localhost access first

---

## 💡 Pro Tips

1. **Always test localhost first** before trying other devices
2. **Use static IP** for your server (set in router) for consistent LAN access
3. **Set BASE_URL explicitly** for production deployments
4. **Allow firewall ports** before testing from other devices
5. **Check server logs** - they provide detailed connection information
6. **Use `network_mode: host`** in Docker for best compatibility

---

## 📚 Related Documentation

- [README.md](README.md) - General setup and features
- [P2P-QUICK-FIX.md](P2P-QUICK-FIX.md) - Torrent connectivity issues
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Production deployment guides

---

**Last Updated:** 2025-11-12  
**Issue Reference:** Fix streaming on all devices and localhost

If you've tried everything and still have issues, please check the server logs and firewall settings. 99% of streaming issues are related to network configuration or firewall blocking.
