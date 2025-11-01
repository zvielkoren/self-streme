# 🚀 Deployment Guide

This guide covers deploying **Self-Streme** to various hosting platforms. The application automatically detects HTTPS and domains from proxy headers, making it work seamlessly with Cloudflare, nginx, Apache, Plesk, and other reverse proxies.

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Cloudflare + Plesk](#cloudflare--plesk)
- [Cloudflare + nginx](#cloudflare--nginx)
- [Cloudflare + Apache](#cloudflare--apache)
- [Render.com](#rendercom)
- [Heroku](#heroku)
- [Railway](#railway)
- [Docker](#docker)
- [VPS (Ubuntu/Debian)](#vps-ubuntudebian)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

The app **auto-detects** HTTPS and your domain from proxy headers. You only need to:

1. ✅ Ensure your proxy/CDN forwards headers (`X-Forwarded-Proto`, `X-Forwarded-Host`)
2. ✅ (Optional) Set `BASE_URL=https://your-domain.com` for guaranteed consistency
3. ✅ If using Cloudflare, set SSL mode to **"Full"** or **"Full (strict)"**

---

## Cloudflare + Plesk

Perfect for shared hosting environments.

### Step 1: Install SSL Certificate in Plesk

1. Navigate to **Domains** → Select your domain
2. Click **SSL/TLS Certificates**
3. Install **Let's Encrypt** certificate (free, automatic renewal)
4. Click **Install** and wait for completion

### Step 2: Configure Cloudflare

1. In Cloudflare dashboard, go to **SSL/TLS** → **Overview**
2. Change from "Flexible" to **"Full (strict)"**
   - ⚠️ **Critical**: Do NOT use "Flexible" - it breaks HTTPS detection
3. Under **SSL/TLS** → **Edge Certificates**:
   - ✅ Enable "Always Use HTTPS"
   - ✅ Enable "Automatic HTTPS Rewrites"

### Step 3: Deploy App in Plesk

1. Go to **Domains** → your domain → **Node.js**
2. Set **Node.js version** to 18.x or higher
3. Set **Application mode** to Production
4. Set **Application root** to your app directory
5. Set **Application startup file** to `src/index.js`

### Step 4: Configure Environment Variables (Optional but Recommended)

In Plesk Node.js settings, add environment variables:

```bash
BASE_URL=https://your-domain.com
NODE_ENV=production
PORT=7000
```

### Step 5: Add nginx Headers (Important!)

1. Go to **Domains** → your domain → **Apache & nginx Settings**
2. In **Additional nginx directives**, add:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;
```

3. Click **OK**

### Step 6: Install Dependencies & Start

SSH into your server or use Plesk File Manager:

```bash
cd /var/www/vhosts/your-domain.com/httpdocs
npm install
```

In Plesk, restart the Node.js app.

### Step 7: Verify

Visit:
- `https://your-domain.com/debug/url` - Should show `"protocol": "https"`
- `https://your-domain.com/manifest.json` - Should have https URLs
- `https://your-domain.com/health` - Should return `{"status":"ok"}`

---

## Cloudflare + nginx

For VPS deployments with nginx.

### Step 1: Install SSL Certificate

```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com
```

### Step 2: Configure nginx

Create or edit `/etc/nginx/sites-available/self-streme`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:7000;
        proxy_http_version 1.1;

        # Essential headers for HTTPS detection
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts for streaming
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/self-streme /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 3: Configure Cloudflare (Same as Plesk)

Set SSL mode to **"Full (strict)"**.

### Step 4: Run App with PM2

```bash
cd /path/to/self-streme
npm install

# Install PM2
npm install -g pm2

# Start app
NODE_ENV=production pm2 start src/index.js --name self-streme

# Save PM2 config
pm2 save

# For systemd-based systems (Ubuntu/Debian with systemd)
pm2 startup systemd

# For containers or non-systemd environments, skip pm2 startup
# Instead, use pm2-runtime in your container CMD:
# CMD ["pm2-runtime", "src/index.js"]
```

**Note for Docker/Containers:**
If you see `System has not been booted with systemd as init system (PID 1)`, you're in a container or non-systemd environment. Just use:
```bash
pm2 start src/index.js --name self-streme
pm2 save
```
Skip the `pm2 startup` command and ensure PM2 is started when your container starts.

### Step 5: Verify Installation

```bash
# Check PM2 status
pm2 list

# Test the manifest endpoint
curl -I http://127.0.0.1:7000/manifest.json
# Should return: HTTP/1.1 200 OK

# Test HTTPS detection (if behind nginx)
curl -I https://your-domain.com/manifest.json
# Should return: HTTP/2 200 with https URLs in the JSON
```

Visit these URLs in your browser:
- `https://your-domain.com/health` - Should return `{"status":"ok"}`
- `https://your-domain.com/debug/url` - Should show `"protocol":"https"`
- `https://your-domain.com/manifest.json` - Should have https URLs

---

## Cloudflare + Apache

For Apache-based servers.

### Step 1: Install SSL & Enable Modules

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d your-domain.com

# Enable necessary modules
sudo a2enmod proxy proxy_http proxy_wstunnel headers ssl
sudo systemctl restart apache2
```

### Step 2: Configure Apache

Edit `/etc/apache2/sites-available/self-streme-ssl.conf`:

```apache
<VirtualHost *:443>
    ServerName your-domain.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/your-domain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/your-domain.com/privkey.pem

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:7000/
    ProxyPassReverse / http://127.0.0.1:7000/

    # Essential headers for HTTPS detection
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Host "%{HTTP_HOST}e"
    RequestHeader set X-Forwarded-Port "443"

    # WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://127.0.0.1:7000/$1 [P,L]
</VirtualHost>

<VirtualHost *:80>
    ServerName your-domain.com
    Redirect permanent / https://your-domain.com/
</VirtualHost>
```

```bash
sudo a2ensite self-streme-ssl
sudo systemctl reload apache2
```

---

## Render.com

Easiest cloud deployment with auto-SSL.

### Step 1: Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `self-streme`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Plan**: Free or Starter

### Step 2: Environment Variables

Add in Render dashboard:

```bash
NODE_ENV=production
# BASE_URL is optional - Render auto-detection works well
```

### Step 3: Deploy

Click **Create Web Service**. Render will:
- Automatically assign HTTPS domain (e.g., `self-streme.onrender.com`)
- Handle SSL certificates
- Forward proxy headers

Your app will auto-detect the URL!

### Step 4: Custom Domain (Optional)

1. In Render dashboard, go to your service → **Settings** → **Custom Domains**
2. Add your domain
3. Update DNS with provided CNAME
4. (Optional) Add Cloudflare in front - set to "Full (strict)"

---

## Heroku

Classic PaaS platform.

### Step 1: Install Heroku CLI

```bash
curl https://cli-assets.heroku.com/install.sh | sh
heroku login
```

### Step 2: Deploy

```bash
cd /path/to/self-streme
heroku create self-streme

# Set environment
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Step 3: Scale

```bash
heroku ps:scale web=1
```

The app auto-detects Heroku's environment and uses HTTPS automatically.

---

## Railway

Modern deployment platform.

### Step 1: Deploy from GitHub

1. Go to [Railway](https://railway.app/)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway auto-detects Node.js and deploys

### Step 2: Environment Variables (Optional)

```bash
NODE_ENV=production
```

Railway auto-provides `RAILWAY_STATIC_URL` which the app uses automatically.

### Step 3: Custom Domain

1. Go to your service → **Settings** → **Domains**
2. Add custom domain
3. Update your DNS

---

## Docker

Containerized deployment.

### Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app files
COPY . .

# Expose port
EXPOSE 7000

# Start app
CMD ["node", "src/index.js"]
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  self-streme:
    build: .
    ports:
      - "7000:7000"
    environment:
      - NODE_ENV=production
      - PORT=7000
      # Uncomment for manual URL override:
      # - BASE_URL=https://your-domain.com
    volumes:
      - ./media:/app/media
      - ./temp:/app/temp
    restart: unless-stopped
```

### Deploy

```bash
docker-compose up -d
```

### Behind nginx/Traefik

The app auto-detects proxy headers from Docker reverse proxies like nginx-proxy or Traefik.

**For Traefik**, add labels:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.self-streme.rule=Host(`your-domain.com`)"
  - "traefik.http.routers.self-streme.entrypoints=websecure"
  - "traefik.http.routers.self-streme.tls.certresolver=letsencrypt"
```

---

## VPS (Ubuntu/Debian)

Full manual setup.

### Step 1: System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2
```

### Step 2: Clone & Install

```bash
cd /opt
sudo git clone https://github.com/your-repo/self-streme.git
cd self-streme
sudo npm install
```

### Step 3: Create Systemd Service (Alternative to PM2)

Create `/etc/systemd/system/self-streme.service`:

```ini
[Unit]
Description=Self-Streme Streaming Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/self-streme
Environment="NODE_ENV=production"
Environment="PORT=7000"
ExecStart=/usr/bin/node /opt/self-streme/src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable self-streme
sudo systemctl start self-streme
sudo systemctl status self-streme
```

### Step 4: Setup nginx (See nginx section above)

### Troubleshooting Systemd Issues

**Error: "System has not been booted with systemd as init system (PID 1)"**

This means you're in a Docker container or non-systemd environment. Use PM2 instead:

```bash
# Install PM2
npm install -g pm2

# Start app
cd /opt/self-streme
pm2 start src/index.js --name self-streme

# Save PM2 process list
pm2 save

# Verify it's running
pm2 list
curl -I http://127.0.0.1:7000/manifest.json
```

**Error: "sudo: unable to resolve host..."**

Fix the hostname resolution:

```bash
echo "127.0.0.1 $(hostname)" >> /etc/hosts
```

This is harmless and won't affect the app, but the command above will silence it.

---

---

## Troubleshooting

### Container/Non-systemd Environments

If you see these errors:
```
System has not been booted with systemd as init system (PID 1). Can't operate.
Failed to connect to system scope bus via local transport: Host is down
```

**Solution:** You're in a container or non-systemd environment. Use PM2 or pm2-runtime:

```bash
# Option 1: PM2 (interactive)
pm2 start src/index.js --name self-streme
pm2 save

# Option 2: pm2-runtime (Docker CMD)
# Add to your Dockerfile:
# CMD ["pmGetting HTTP URLs instead of HTTPS

**Diagnosis:**

```bash
curl -s https://your-domain.com/debug/url | jq
```

Look for `"protocol": "http"` - this is the problem.

**Solutions:**

1. **Cloudflare**: Change SSL mode from "Flexible" to "Full (strict)"
2. **nginx/Apache**: Verify proxy headers are set (see configs above)
3. **Manual override**: Set `BASE_URL=https://your-domain.com`

### Issue: Mixed Content Errors in Browser

Symptoms: Console shows "Blocked: mixed content"

**Fix:** Same as above - ensure HTTPS detection works.

### Issue: "Invalid BASE_URL environment variable"

Your `BASE_URL` is malformed.

**Fix:**
```bash
# Correct format (with protocol and no trailing slash):
BASE_URL=https://your-domain.com

# Incorrect:
BASE_URL=your-domain.com  # Missing protocol
BASE_URL=https://your-domain.com/  # Trailing slash
```

### Issue: App works locally but not behind proxy

**Diagnosis:**

```bash
# Check what headers your proxy sends
curl -v https://your-domain.com/health 2>&1 | grep -i forward

# Check app detection
curl -s https://your-domain.com/debug/url
```

**Fix:** Add proxy headers to your reverse proxy config (see platform-specific sections).

### Issue: Cloudflare "Error 525: SSL Handshake Failed"

Your origin doesn't have SSL, but Cloudflare is in "Full (strict)" mode.

**Fix:**
1. Install SSL certificate on origin (Let's Encrypt)
2. OR change Cloudflare to "Full" (less secure)

### Issue: Port Already in Use

```bash
# Find what's using port 7000
sudo lsof -i :7000

# Kill it or change your port
PORT=7001 node src/index.js
```

### Debug Endpoints

The app provides helpful debug endpoints:

- `/debug/url` - Shows detected protocol, host, headers, environment
- `/api/base-url` - Shows computed base URL
- `/health` - Basic health check
- `/status` - Detailed server status

### Logs

Check logs for clues:

```bash
# PM2
pm2 logs self-streme

# Systemd
sudo journalctl -u self-streme -f

# Docker
docker-compose logs -f

# Plesk
Check Domains → Logs → Error Log
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BASE_URL` | No | Auto-detect | Full URL (e.g., `https://example.com`) - overrides auto-detection |
| `NODE_ENV` | No | `development` | Set to `production` for production |
| `PORT` | No | `7000` | Port to listen on |
| `HOST` | No | `0.0.0.0` | Host to bind to |
| `CACHE_BACKEND` | No | `memory` | `memory`, `sqlite`, or `redis` |
| `CACHE_MAX_SIZE` | No | `1000` | Max cached files |
| `CACHE_MAX_DISK_MB` | No | `5000` | Max disk usage (MB) |
| `OMDB_API_KEY` | No | - | OMDB API key for metadata |
| `JACKETT_URL` | No | - | Jackett server URL |
| `JACKETT_API_KEY` | No | - | Jackett API key |

---

## Platform-Specific Tips

### Cloudflare
- Always use "Full" or "Full (strict)" SSL
- Enable "Always Use HTTPS"
- Enable "Automatic HTTPS Rewrites"
- Optional: Enable Argo Smart Routing for better streaming

### Plesk
- Node.js app must be in "Production" mode
- Add nginx directives for proxy headers
- Use Let's Encrypt for free SSL
- Check error logs in Domains → Logs

### Render
- Auto-detection works perfectly, no BASE_URL needed
- Free tier sleeps after 15min inactivity
- Paid tier recommended for 24/7 streaming

### Railway
- Auto-detects everything
- Generous free tier
- Easy GitHub integration

### Heroku
- Free tier deprecated, use paid
- Dynos sleep on free tier
- Good for testing, expensive for production

### Docker
- Mount volumes for media and temp directories
- Use docker-compose for easier management
- Works great with Traefik/nginx-proxy

---

## Production Checklist

Before going live:

- [ ] SSL certificate installed and working
- [ ] Cloudflare (if using) set to "Full (strict)"
- [ ] Proxy headers configured in reverse proxy
- [ ] Environment variables set correctly
- [ ] Test `/debug/url` shows correct HTTPS URLs
- [ ] Test `/manifest.json` has HTTPS URLs
- [ ] Test actual streaming in Stremio
- [ ] Set up process manager (PM2/systemd)
- [ ] Configure log rotation
- [ ] Set up backups for media directory
- [ ] Monitor disk usage (cache can grow)
- [ ] Consider Redis cache for high traffic

---

## Need Help?

1. Check logs first
2. Visit `/debug/url` endpoint
3. Test with `curl -v https://your-domain.com/health`
4. Review the [Troubleshooting](#troubleshooting) section
5. Check that your reverse proxy forwards headers

**The app is designed to work anywhere** - if it doesn't, it's usually a proxy header or SSL configuration issue.