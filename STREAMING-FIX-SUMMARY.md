# Streaming Fix Summary

**Issue Fixed:** "Can't stream on all devices and localhost"

## What Was Wrong

1. **Port Confusion:** Configuration files showed port 3000 in `.env.docker.example` but server actually uses port 7000
2. **CORS Headers Missing:** Video streaming requires Range headers for seeking/skipping functionality
3. **Unclear Logging:** Server logs showed `0.0.0.0` instead of helpful access URLs
4. **LAN Access Issues:** URL detection wasn't properly handling local network IPs

## What Was Fixed

### 1. Port Configuration
- ✅ Updated `.env.docker.example` to use port 7000 (matches actual default)
- ✅ Added clear documentation about port usage in comments

### 2. Enhanced CORS for Video Streaming
- ✅ Added `Range`, `Accept-Ranges`, and `Content-Range` headers
- ✅ Exposed headers required for video seeking
- ✅ Added comprehensive allowed headers list
- ✅ Documented CORS permissiveness as intentional for Stremio compatibility

### 3. Improved Server Logging
Server now shows:
```
🚀 Server running on port 7000
🌐 Listening on: 0.0.0.0 (all network interfaces)
   - Localhost: http://localhost:7000
   - LAN/Network: http://<YOUR_IP>:7000
ℹ️  Access from devices on the same network:
   1. Find your server's IP address (use 'hostname -I' or 'ipconfig')
   2. Use: http://<YOUR_IP>:7000/manifest.json
```

### 4. Better URL Detection
- ✅ Separated loopback (127.0.0.1) from LAN IPs (192.168.x.x, 10.x.x.x)
- ✅ Allows LAN IPs even in production mode
- ✅ Clearer warnings for configuration issues

### 5. Comprehensive Documentation
- ✅ Created `STREAMING-TROUBLESHOOTING.md` with:
  - Quick diagnostics
  - Common issues and solutions
  - Device-specific troubleshooting
  - Docker configuration examples
  - Network diagnostic commands

## How to Use

### Localhost Access
```
http://localhost:7000/manifest.json
```

### LAN/Network Access
1. Find your server's IP:
   ```bash
   # Linux/Mac
   hostname -I
   
   # Windows
   ipconfig
   ```

2. Use the IP in Stremio:
   ```
   http://192.168.1.100:7000/manifest.json
   ```
   (Replace with your actual IP)

### Remote Access
Set `BASE_URL` in `.env`:
```env
BASE_URL=https://your-domain.com
```

## Quick Verification

Test that everything works:

```bash
# 1. Check server is running
curl http://localhost:7000/health

# 2. Test manifest
curl http://localhost:7000/manifest.json

# 3. Check CORS headers
curl -I http://localhost:7000/manifest.json

# 4. Test URL detection
curl http://localhost:7000/debug/url
```

Expected results:
- Health check: `{"status":"ok","timestamp":"..."}`
- Manifest: JSON with addon info
- CORS headers: `Access-Control-Allow-Origin: *`
- Debug: Shows detected URLs and configuration

## Troubleshooting

If streaming still doesn't work:

1. **Check firewall:**
   ```bash
   sudo ufw allow 7000/tcp
   ```

2. **Verify server is listening:**
   ```bash
   netstat -tulpn | grep 7000
   ```

3. **Test from another device:**
   - Open browser on phone/tablet
   - Navigate to: `http://YOUR_SERVER_IP:7000/health`

4. **Read full guide:**
   See [STREAMING-TROUBLESHOOTING.md](./STREAMING-TROUBLESHOOTING.md) for detailed help

## Files Changed

1. `.env.docker.example` - Fixed port from 3000 to 7000
2. `src/index.js` - Enhanced CORS and logging
3. `src/utils/urlHelper.js` - Improved URL detection
4. `README.md` - Added streaming troubleshooting section
5. `STREAMING-TROUBLESHOOTING.md` - New comprehensive guide

## Related Documentation

- [STREAMING-TROUBLESHOOTING.md](./STREAMING-TROUBLESHOOTING.md) - Detailed troubleshooting
- [README.md](./README.md) - General setup and usage
- [P2P-QUICK-FIX.md](./P2P-QUICK-FIX.md) - Torrent-specific issues

---

**Date:** 2025-11-12  
**Issue:** Fix streaming on all devices and localhost  
**Status:** ✅ Complete
