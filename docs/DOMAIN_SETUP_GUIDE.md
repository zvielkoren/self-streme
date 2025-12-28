# Domain Setup Guide for Self-Streme

This guide explains what works automatically in your addon and how to set up domain access for Stremio streaming.

---

## What Works Automatically

### ✅ Without Any Configuration
Your addon already handles:
- **Torrent streaming** - WebTorrent automatically downloads and streams content
- **DHT peer discovery** - Finds peers without trackers
- **Adaptive streaming** - Adjusts quality based on connection
- **Cache management** - Stores frequently accessed content
- **Health monitoring** - Auto-cleanup and health checks

### ✅ With P2P Initialization (Optional Enhancement)
Once you initialize the P2P coordinator, these work automatically:
- **NAT type detection** - Detects your network configuration (Open/Symmetric/etc.)
- **Peer discovery** - WebSocket signaling finds other peers
- **Hole punching** - Creates direct P2P connections through NAT
- **Keep-alive** - Maintains connections automatically
- **Fallback to relay** - Uses TURN server if direct connection fails

---

## Setup Options

### Option 1: Basic Setup (No Domain - Local Only)

```bash
# Just run the server
npm start

# Access locally at:
# http://localhost:3000/manifest.json
```

**Use case**: Testing on local network only

---

### Option 2: Domain Setup (Recommended for Stremio)

#### Step 1: Set Environment Variables

Create or edit `.env` file:

```env
# Your domain
BASE_URL=https://yourdomain.com

# Port (optional, default 3000)
PORT=3000

# Enable HTTPS (recommended)
HTTPS=true

# Optional: Cloudflare tunnel token
TUNNEL_TOKEN=your_cloudflare_token_here
```

#### Step 2: Configure Reverse Proxy

If you're self-hosting, set up nginx or similar:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Step 3: Start Server

```bash
npm start
```

Your addon will be accessible at:
- **Manifest**: `https://yourdomain.com/manifest.json`
- **Health check**: `https://yourdomain.com/health`
- **Status**: `https://yourdomain.com/status`

#### Step 4: Add to Stremio

1. Open Stremio
2. Go to Settings → Addons
3. Click "Add addon"
4. Enter: `https://yourdomain.com/manifest.json`

---

### Option 3: Domain + P2P Enhancement (Best Performance)

Enable P2P hole punching for better connectivity:

#### Step 1: Initialize P2P in Your Startup

Edit `src/index.js` and add at the beginning (after imports):

```javascript
// Add this import at top
const P2PCoordinator = require('./services/p2pCoordinator');

// Add this before startServer() call
let p2pCoordinator = null;

async function initializeP2P() {
    try {
        p2pCoordinator = new P2PCoordinator({
            signalingPort: 8080,
            stunServers: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ],
            // Optional: Add TURN servers for symmetric NAT
            turnServers: [
                {
                    urls: 'turn:your-turn-server.com:3478',
                    username: 'user',
                    credential: 'pass'
                }
            ],
            enableDetailedLogging: process.env.NODE_ENV === 'development'
        });

        await p2pCoordinator.initialize();
        console.log('✓ P2P Coordinator initialized');
        
        // Log NAT info
        const natInfo = p2pCoordinator.getNATInfo();
        console.log(`NAT Type: ${natInfo.type}`);
        console.log(`Public Endpoint: ${natInfo.publicIP}:${natInfo.publicPort}`);
        
    } catch (error) {
        console.error('P2P initialization failed:', error.message);
        console.log('Continuing without P2P enhancement...');
    }
}
```

#### Step 2: Update startServer() Function

Find the `startServer()` function and add P2P initialization:

```javascript
async function startServer() {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    // Initialize P2P first
    await initializeP2P();
    
    // ... rest of your existing code ...
}
```

#### Step 3: Add Cleanup on Shutdown

In the `setupGracefulShutdown()` function, add P2P cleanup:

```javascript
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    
    // Clean up P2P
    if (p2pCoordinator) {
        await p2pCoordinator.shutdown();
        console.log('✓ P2P services stopped');
    }
    
    // ... rest of existing cleanup code ...
};
```

#### Step 4: Update .env for P2P

```env
# Your domain
BASE_URL=https://yourdomain.com

# P2P Settings
P2P_ENABLED=true
SIGNALING_PORT=8080

# Optional: External TURN server for symmetric NAT
TURN_SERVER=turn:your-turn-server.com:3478
TURN_USERNAME=user
TURN_PASSWORD=pass
```

#### Step 5: Open Firewall Ports

For P2P to work through firewalls:

```bash
# Allow signaling WebSocket
sudo ufw allow 8080/tcp

# Allow UDP for hole punching (range for dynamic allocation)
sudo ufw allow 40000:50000/udp
```

---

## Testing Your Setup

### Test 1: Basic Health Check

```bash
curl https://yourdomain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 123
}
```

### Test 2: Manifest Check

```bash
curl https://yourdomain.com/manifest.json
```

Should return valid Stremio manifest.

### Test 3: P2P Status (if enabled)

```bash
node test-p2p.js
```

Or check in your logs for:
```
✓ P2P Coordinator initialized
NAT Type: Full Cone
Public Endpoint: 1.2.3.4:8080
```

---

## What to Use in Stremio

### Direct URL
The addon works **automatically** once installed:

1. Add to Stremio: `https://yourdomain.com/manifest.json`
2. Search for content in Stremio
3. Click play - streams appear automatically

### What Happens Behind the Scenes

```
User searches content
    ↓
Stremio calls: GET /stream/movie/:imdbId
    ↓
Your addon searches torrents
    ↓
Returns magnet links
    ↓
Stremio plays via:
  - Option A: Direct magnet link (Stremio's built-in player)
  - Option B: Your streaming proxy (/stream/proxy/:infoHash)
  - Option C: Cached file (/stream/file/:infoHash/:fileIndex)
    ↓
If P2P enabled: Better peer connectivity via hole punching
```

---

## Common Issues & Solutions

### Issue: "Addon not found" in Stremio

**Solution**:
- Check domain is accessible: `curl https://yourdomain.com/manifest.json`
- Ensure HTTPS is working (Stremio requires HTTPS for remote addons)
- Check firewall allows port 3000 (or your configured port)

### Issue: Streams not playing

**Solution**:
- Check logs: `tail -f logs/app.log`
- Verify torrent sources in /status
- Test direct torrent: `/test-torrent-streaming`

### Issue: P2P not connecting peers

**Solution**:
- Check NAT type: Should be "Full Cone" or "Restricted" for best results
- If "Symmetric NAT", configure TURN server
- Check signaling port 8080 is open: `netstat -tulpn | grep 8080`
- Test WebSocket: `wscat -c ws://localhost:8080`

### Issue: Slow streaming

**Solution**:
- Enable P2P (see Option 3 above) for better peer connectivity
- Increase cache: Edit `.env` → `CACHE_SIZE=10GB`
- Add more trackers in `torrentService.js`

---

## Production Deployment Checklist

- [ ] Domain configured with HTTPS/SSL
- [ ] Reverse proxy (nginx/Apache) set up
- [ ] Firewall ports open (3000, 8080, 40000-50000)
- [ ] Environment variables set in `.env`
- [ ] P2P coordinator initialized (optional but recommended)
- [ ] TURN server configured for symmetric NAT users (optional)
- [ ] Process manager (PM2/systemd) to auto-restart
- [ ] Logs rotation configured
- [ ] Monitoring/health checks enabled

### Quick PM2 Setup

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name self-streme

# Auto-start on reboot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

---

## Summary

### Without P2P
- ✅ Everything works automatically once you add the domain to Stremio
- ✅ Torrent streaming, DHT, caching all work out of the box
- ⚠️ May have connectivity issues with some NAT configurations

### With P2P
- ✅ All the above PLUS better NAT traversal
- ✅ Automatic hole punching and peer discovery
- ✅ Better connectivity in restricted networks
- ⚠️ Requires initialization code (see Option 3)
- ⚠️ May need TURN server for symmetric NAT

**Recommended**: Start with Option 2 (domain setup), then add Option 3 (P2P) if you encounter connectivity issues.

---

## Quick Start Commands

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your domain

# 3. Start server
npm start

# 4. Test
curl https://yourdomain.com/health

# 5. Add to Stremio
# Open Stremio → Addons → Add: https://yourdomain.com/manifest.json
```

---

## Need Help?

- Check logs: `logs/app.log`
- Test endpoint: `https://yourdomain.com/status`
- Run P2P test: `node test-p2p.js`
- View documentation: `https://yourdomain.com/docs`

For P2P details, see: `docs/P2P_HOLE_PUNCHING.md`
