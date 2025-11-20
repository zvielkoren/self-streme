# Seedbox Integration Guide

Complete guide to integrating your own seedbox as a custom HTTP source for 99.9% reliability and complete control.

---

## Why Self-Host?

**Benefits:**
- 100% control over content availability
- No API keys or rate limits
- Pre-cache popular content
- Privacy (no third-party knows what you stream)
- One-time setup, unlimited use
- Can reach 99.9% reliability

**Cost:**
- Seedbox: €5-15/month
- More expensive than single premium service
- But gives you complete control

---

## Architecture

```
┌─────────────────────┐
│   Self-Streme       │
│   (Your Server)     │
└──────────┬──────────┘
           │
           ├── Try P2P (WebTorrent)
           │
           ├── Try Seedbox (Your Custom Source) ← NEW!
           │   └── Pre-cached torrents via HTTP
           │
           ├── Try Premium Services (Real-Debrid, etc.)
           │
           └── Try Free Sources (Fallback)
```

---

## Prerequisites

- Basic command line knowledge
- SSH access to a server or seedbox
- Domain name (optional but recommended)

---

## Step 1: Choose and Setup Seedbox

### Recommended Providers

| Provider | Cost | Storage | Bandwidth | Best For |
|----------|------|---------|-----------|----------|
| **Seedhost.eu** | €5-10/mo | 500GB-1TB | 2-5TB | Beginners |
| **Ultraseedbox** | €7-15/mo | 1-3TB | 5-10TB | Best value |
| **Whatbox.ca** | $15-30/mo | 1-4TB | 3-12TB | Performance |
| **Hetzner Dedicated** | €40-60/mo | 2x4TB | Unlimited | Serious use |

### Setup Process

1. **Sign up for seedbox**
   - Choose plan with enough storage for your library
   - Minimum 500GB recommended

2. **Get SSH access**
   ```bash
   ssh username@seedbox-hostname.com
   ```

3. **Verify tools are installed**
   ```bash
   # Check for transmission or rtorrent
   which transmission-remote
   # or
   which rtorrent
   
   # Check for web server
   which nginx
   # or
   which apache2
   ```

---

## Step 2: Configure Torrent Client

Most seedboxes come with web UI (ruTorrent, Deluge, Transmission), but we need CLI access.

### For Transmission

```bash
# Edit transmission settings
nano ~/.config/transmission-daemon/settings.json

# Key settings:
{
  "download-dir": "/home/username/files",
  "rpc-enabled": true,
  "rpc-username": "your_username",
  "rpc-password": "your_password",
  "rpc-port": 9091
}

# Restart transmission
killall transmission-daemon
transmission-daemon
```

### For rTorrent

```bash
# Edit rtorrent config
nano ~/.rtorrent.rc

# Key settings:
directory.default.set = ~/files
network.port_range.set = 50000-50000
network.port_random.set = no

# Restart rtorrent
killall rtorrent
screen -dmS rtorrent rtorrent
```

---

## Step 3: Setup HTTP File Server

### Option A: Nginx (Recommended)

```bash
# Install nginx (if not already installed)
sudo apt update
sudo apt install nginx

# Create nginx config
sudo nano /etc/nginx/sites-available/seedbox-files

# Add this configuration:
```

```nginx
server {
    listen 8080;
    server_name _;
    
    root /home/username/files;
    autoindex off;  # Security: disable directory listing
    
    # Allow range requests for video streaming
    location / {
        # Basic auth for security
        auth_basic "Seedbox Files";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        # CORS headers (if needed)
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        
        # Streaming optimizations
        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;
        
        # Support range requests (for video seeking)
        add_header Accept-Ranges bytes;
        
        # Cache headers
        expires 24h;
        add_header Cache-Control "public, immutable";
    }
    
    # Security: block hidden files
    location ~ /\. {
        deny all;
    }
    
    # Optimize for large files
    client_max_body_size 0;
    client_body_buffer_size 1M;
    
    # Logging
    access_log /var/log/nginx/seedbox-access.log;
    error_log /var/log/nginx/seedbox-error.log;
}
```

```bash
# Create password file
sudo htpasswd -c /etc/nginx/.htpasswd yourusername
# Enter password when prompted

# Enable site
sudo ln -s /etc/nginx/sites-available/seedbox-files /etc/nginx/sites-enabled/
sudo nginx -t  # Test config
sudo systemctl restart nginx

# Test it works
curl -u yourusername:yourpassword http://localhost:8080/
```

### Option B: Python Simple HTTP Server (Quick Test)

```bash
# Navigate to download directory
cd ~/files

# Start server (Python 3)
python3 -m http.server 8080

# Or with authentication
# Install dependencies first:
pip install twisted

# Then run:
twistd -n web --port 8080 --path ~/files
```

### Option C: Caddy (Easiest + Auto HTTPS)

```bash
# Install Caddy
curl https://getcaddy.com | bash -s personal

# Create Caddyfile
nano ~/Caddyfile

# Add:
seedbox.yourdomain.com {
    root /home/username/files
    browse  # Optional: enable directory listing
    basicauth / yourusername yourpassword
    
    # Enable gzip
    gzip
    
    # CORS
    cors
}

# Run Caddy
caddy -conf ~/Caddyfile
```

---

## Step 4: Secure Your Seedbox

### 1. Use HTTPS (Recommended)

**With Caddy (automatic):**
Already done! Caddy auto-configures Let's Encrypt.

**With Nginx + Let's Encrypt:**

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d seedbox.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### 2. Firewall Rules

```bash
# Allow only your Self-Streme server IP
sudo ufw allow from YOUR_SELFSTREME_IP to any port 8080
sudo ufw enable
```

### 3. IP Whitelist in Nginx

```nginx
# In your nginx config, add:
location / {
    # Whitelist your IP
    allow YOUR_SELFSTREME_IP;
    deny all;
    
    # ... rest of config
}
```

### 4. Use API Token Instead of Basic Auth

```bash
# Generate random token
TOKEN=$(openssl rand -hex 32)
echo "Your token: $TOKEN"

# In nginx config:
location / {
    if ($arg_token != "YOUR_TOKEN_HERE") {
        return 403;
    }
    # ... rest of config
}
```

---

## Step 5: Integrate with Self-Streme

### Method 1: Add as Custom Source (Automatic)

Edit `src/services/torrentDownloadSources.js`:

```javascript
// Add after the class definition, before export

// Auto-add seedbox if configured
if (process.env.SEEDBOX_URL && process.env.SEEDBOX_TOKEN) {
  downloadSources.addCustomSource({
    name: "My Seedbox",
    priority: 4, // After premium services (1-3), before free sources (10+)
    buildUrl: (infoHash, fileName) => {
      const baseUrl = process.env.SEEDBOX_URL;
      const token = process.env.SEEDBOX_TOKEN;
      
      // Option 1: Direct file path (if you organize by infohash)
      return `${baseUrl}/${infoHash}/${encodeURIComponent(fileName)}?token=${token}`;
      
      // Option 2: Flat directory structure
      // return `${baseUrl}/${encodeURIComponent(fileName)}?token=${token}`;
    },
    needsMetadata: false,
    supportsResume: true,
    note: "Self-hosted seedbox",
  });
}
```

### Method 2: Add in Environment Variables

```bash
# Add to .env
SEEDBOX_URL=https://seedbox.yourdomain.com
SEEDBOX_TOKEN=your_secret_token_here
SEEDBOX_USERNAME=username  # If using basic auth
SEEDBOX_PASSWORD=password
```

### Method 3: Advanced - API Endpoint

Create a seedbox API that Self-Streme can query:

**On Seedbox (seedbox-api.js):**

```javascript
// Install: npm install express
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DOWNLOAD_DIR = '/home/username/files';
const API_TOKEN = process.env.API_TOKEN;

// Middleware: verify token
app.use((req, res, next) => {
  if (req.query.token !== API_TOKEN) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  next();
});

// List all files
app.get('/api/files', (req, res) => {
  const files = fs.readdirSync(DOWNLOAD_DIR).map(file => ({
    name: file,
    size: fs.statSync(path.join(DOWNLOAD_DIR, file)).size,
    path: `/files/${file}`
  }));
  res.json({ files });
});

// Find file by info hash or name
app.get('/api/find', (req, res) => {
  const { infoHash, fileName } = req.query;
  
  // Search for file
  const files = fs.readdirSync(DOWNLOAD_DIR);
  const match = files.find(f => 
    f.includes(fileName) || 
    fs.existsSync(path.join(DOWNLOAD_DIR, infoHash, fileName))
  );
  
  if (match) {
    res.json({ 
      found: true, 
      url: `https://seedbox.yourdomain.com/files/${encodeURIComponent(match)}?token=${API_TOKEN}` 
    });
  } else {
    res.json({ found: false });
  }
});

app.listen(3001, () => console.log('Seedbox API running on port 3001'));
```

**In Self-Streme (custom source):**

```javascript
downloadSources.addCustomSource({
  name: "My Seedbox API",
  priority: 4,
  buildUrl: async (infoHash, fileName) => {
    try {
      const response = await axios.get(
        `${process.env.SEEDBOX_API_URL}/api/find`,
        {
          params: {
            infoHash,
            fileName,
            token: process.env.SEEDBOX_TOKEN
          }
        }
      );
      
      return response.data.found ? response.data.url : null;
    } catch (error) {
      logger.error(`Seedbox API error: ${error.message}`);
      return null;
    }
  },
  isAsync: true,
  supportsResume: true,
  note: "Self-hosted seedbox with API",
});
```

---

## Step 6: Automate Torrent Downloads

### Script: Auto-download Popular Content

```bash
#!/bin/bash
# auto-download-popular.sh

# Popular movie torrents list
POPULAR_TORRENTS=(
  "magnet:?xt=urn:btih:HASH1..."
  "magnet:?xt=urn:btih:HASH2..."
  "magnet:?xt=urn:btih:HASH3..."
)

for magnet in "${POPULAR_TORRENTS[@]}"; do
  echo "Adding: $magnet"
  transmission-remote -a "$magnet"
done
```

### Script: Monitor and Pre-cache

```bash
#!/bin/bash
# monitor-and-cache.sh

# Watch Self-Streme logs for requested torrents
LOG_FILE="/path/to/self-streme/logs/app.log"

tail -f "$LOG_FILE" | while read line; do
  # Extract info hash from failed requests
  if echo "$line" | grep -q "Download failed from all sources"; then
    INFO_HASH=$(echo "$line" | grep -oP 'infohash:\K[a-f0-9]{40}')
    
    if [ ! -z "$INFO_HASH" ]; then
      echo "Pre-caching failed torrent: $INFO_HASH"
      magnet="magnet:?xt=urn:btih:$INFO_HASH"
      transmission-remote -a "$magnet"
    fi
  fi
done
```

### Cron Job: Regular Cleanup

```bash
# Edit crontab
crontab -e

# Add cleanup job (remove old files weekly)
0 3 * * 0 find /home/username/files -type f -mtime +30 -delete

# Add monitoring job (check disk space daily)
0 9 * * * df -h /home/username/files | mail -s "Seedbox Disk Usage" you@email.com
```

---

## Step 7: Test Integration

### 1. Test HTTP Access

```bash
# From Self-Streme server
curl -I "https://seedbox.yourdomain.com/testfile.mkv?token=YOUR_TOKEN"

# Should return:
# HTTP/2 200
# Accept-Ranges: bytes
# Content-Length: 1234567890
```

### 2. Test in Self-Streme

```bash
# Add test file to seedbox
cd ~/files
wget https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4

# Test custom source
curl "http://localhost:11470/api/sources/stats"
# Should show your seedbox in the list

# Try streaming
curl "http://localhost:11470/stream/proxy/INFO_HASH"
# Check logs for seedbox attempts
```

### 3. Monitor Logs

```bash
# Watch Self-Streme logs
tail -f logs/app.log | grep "Seedbox"

# Watch seedbox nginx logs
ssh seedbox "tail -f /var/log/nginx/seedbox-access.log"
```

---

## Step 8: Advanced Features

### A. Organize Files by Info Hash

```bash
#!/bin/bash
# organize-by-hash.sh

# Organize downloads into infohash directories
DOWNLOAD_DIR="/home/username/files"

cd "$DOWNLOAD_DIR"
for file in *; do
  if [ -f "$file" ]; then
    # Get infohash from torrent client
    HASH=$(transmission-remote -l | grep "$file" | awk '{print $1}')
    
    if [ ! -z "$HASH" ]; then
      mkdir -p "$HASH"
      mv "$file" "$HASH/"
      echo "Organized: $file -> $HASH/"
    fi
  fi
done
```

### B. CDN Integration

```bash
# Use Cloudflare in front of seedbox for:
# - DDoS protection
# - Global CDN caching
# - Hide seedbox IP

# Steps:
# 1. Point domain to Cloudflare
# 2. Enable "orange cloud" (proxied)
# 3. Page Rules -> Cache Everything for *.mkv, *.mp4
# 4. Update SEEDBOX_URL to use Cloudflare domain
```

### C. Multi-Seedbox Load Balancing

```javascript
// In torrentDownloadSources.js
const SEEDBOXES = [
  { url: 'https://seedbox1.com', token: 'token1', priority: 4 },
  { url: 'https://seedbox2.com', token: 'token2', priority: 5 },
  { url: 'https://seedbox3.com', token: 'token3', priority: 6 },
];

SEEDBOXES.forEach((seedbox, index) => {
  downloadSources.addCustomSource({
    name: `Seedbox ${index + 1}`,
    priority: seedbox.priority,
    buildUrl: (infoHash, fileName) => 
      `${seedbox.url}/${infoHash}/${encodeURIComponent(fileName)}?token=${seedbox.token}`,
    supportsResume: true,
  });
});
```

---

## Complete Setup Example

### Environment Variables

```bash
# .env file
SEEDBOX_URL=https://files.myseedbox.com
SEEDBOX_TOKEN=a1b2c3d4e5f6g7h8i9j0
SEEDBOX_USERNAME=myuser
SEEDBOX_PASSWORD=mypass

# Optional: Multiple seedboxes
SEEDBOX_1_URL=https://seedbox1.com
SEEDBOX_1_TOKEN=token1
SEEDBOX_2_URL=https://seedbox2.com
SEEDBOX_2_TOKEN=token2
```

### Full Priority Order

With seedbox integrated:

1. P2P (WebTorrent) - Priority 0
2. Real-Debrid - Priority 1
3. AllDebrid - Priority 2
4. Premiumize - Priority 3
5. **My Seedbox** - Priority 4 ← Your custom source
6. WebTor.io - Priority 10
7. Other free sources - Priority 11-21

---

## Monitoring and Maintenance

### Health Check Script

```bash
#!/bin/bash
# seedbox-health.sh

URL="https://seedbox.yourdomain.com"
TOKEN="your_token"

# Check if seedbox is responding
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health?token=$TOKEN")

if [ "$STATUS" != "200" ]; then
  echo "ALERT: Seedbox is down (HTTP $STATUS)"
  # Send notification
  curl -X POST https://your-alert-webhook.com -d "Seedbox is down"
else
  echo "Seedbox is healthy"
fi

# Check disk space
USAGE=$(ssh seedbox "df -h /home/username/files | tail -1 | awk '{print \$5}' | sed 's/%//'")
if [ "$USAGE" -gt 90 ]; then
  echo "WARNING: Disk usage at ${USAGE}%"
fi
```

### Automated Monitoring

```bash
# Add to crontab (check every 5 minutes)
*/5 * * * * /path/to/seedbox-health.sh
```

---

## Troubleshooting

### Issue: "Connection refused"

**Check:**
```bash
# Is nginx running?
sudo systemctl status nginx

# Is firewall blocking?
sudo ufw status

# Test locally on seedbox
ssh seedbox "curl -I http://localhost:8080"
```

### Issue: "403 Forbidden"

**Check:**
```bash
# File permissions
ls -la ~/files/

# Should be readable by nginx user
sudo chown -R www-data:www-data ~/files/
sudo chmod -R 755 ~/files/

# Check nginx error log
sudo tail -f /var/log/nginx/seedbox-error.log
```

### Issue: "404 Not Found"

**Check:**
```bash
# Does file exist?
ssh seedbox "ls -la ~/files/"

# Check nginx root path
sudo nginx -T | grep "root"

# Test URL structure
curl -v "https://seedbox.com/exact-filename.mkv?token=TOKEN"
```

### Issue: "Range requests not working"

**Fix nginx config:**
```nginx
location / {
    # Enable range requests
    add_header Accept-Ranges bytes;
    
    # Don't use gzip for video files (breaks ranges)
    gzip off;
}
```

---

## Security Checklist

- [ ] HTTPS enabled (Let's Encrypt)
- [ ] Authentication enabled (token or basic auth)
- [ ] Firewall configured (whitelist Self-Streme IP)
- [ ] Directory listing disabled
- [ ] Hidden files blocked
- [ ] Fail2ban configured (prevent brute force)
- [ ] Regular security updates
- [ ] Strong passwords/tokens
- [ ] Logs monitored
- [ ] Backup authentication method

---

## Cost Analysis

### Option 1: Seedbox Only

- **Seedbox:** €10/month
- **Domain:** €10/year (€0.83/month)
- **Total:** €10.83/month
- **Reliability:** ~85-90% (depends on your caching)

### Option 2: Seedbox + Real-Debrid

- **Seedbox:** €10/month (for your content)
- **Real-Debrid:** €2.66/month (180-day plan)
- **Total:** €12.66/month
- **Reliability:** 99%+

### Option 3: Real-Debrid Only

- **Real-Debrid:** €2.66/month
- **Total:** €2.66/month
- **Reliability:** 98%

**Recommendation:**
- Start with Real-Debrid only (cheapest, 98% reliability)
- Add seedbox if you want more control or have specific content needs

---

## Next Steps

1. [ ] Choose and setup seedbox
2. [ ] Configure HTTP server
3. [ ] Secure with HTTPS and authentication
4. [ ] Integrate with Self-Streme
5. [ ] Test with sample torrents
6. [ ] Set up monitoring
7. [ ] Automate popular content caching
8. [ ] Consider adding premium service as backup

---

## Related Documentation

- [Premium Services Guide](PREMIUM_SERVICES.md)
- [Streaming Reliability Guide](../STREAMING_RELIABILITY.md)
- [Dynamic Sources Documentation](../DYNAMIC_SOURCES.md)
- [Configuration Reference](../CONFIGURATION.md)

---

**Last Updated:** 2025-11-20  
**Version:** 1.0