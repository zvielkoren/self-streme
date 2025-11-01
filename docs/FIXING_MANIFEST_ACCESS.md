# Fixing Manifest Access Issues

## 🔍 Problem Analysis

**Error:** `Failed to get addon manifest from https://1.1.1.1/manifest.json`

### What's Happening:

1. **Server Redirect**: The IP `1.1.1.1` is redirecting to `https://panel.domain.com` (Plesk panel)
2. **Local Configuration**: Your `.env` has `BASE_URL=http://127.0.0.1:7000` (localhost only)
3. **Port Access**: The app runs on port 7000 but isn't exposed to the internet
4. **SSL Issue**: Certificate mismatch when accessing via IP address with HTTPS

## ✅ Solutions

---

## **Solution 1: Deploy Behind Reverse Proxy (Recommended for Production)**

This is the best approach for a production deployment. Your server already has nginx/Plesk, so let's use it.

### Step 1: Configure Reverse Proxy

**For Plesk:**

1. Go to **Domains** → Select your domain → **Apache & nginx Settings**
2. Add to **Additional nginx directives**:

```nginx
location /stremio/ {
    proxy_pass http://127.0.0.1:7000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

3. Click **OK** and **Apply**

**For Manual nginx Configuration:**

Edit `/etc/nginx/sites-available/your-domain.conf`:

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name your-domain.com;

    # SSL configuration (if using HTTPS)
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /stremio/ {
        proxy_pass http://127.0.0.1:7000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 2: Update .env File

```env
# Use your actual domain
BASE_URL=https://your-domain.com/stremio

# Or if using HTTP:
# BASE_URL=http://your-domain.com/stremio
```

### Step 3: Restart Self-Streme

```bash
cd self-streme
npm start
```

### Step 4: Test

```bash
curl https://your-domain.com/stremio/manifest.json
```

### Step 5: Add to Stremio

```
stremio://your-domain.com/stremio/manifest.json
```

---

## **Solution 2: Direct Port Access (Simple but Less Secure)**

If you want quick access without a reverse proxy:

### Step 1: Open Port 7000

**For Plesk:**
- **Tools & Settings** → **Firewall** → Add port 7000

**For iptables:**
```bash
sudo iptables -A INPUT -p tcp --dport 7000 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

**For ufw:**
```bash
sudo ufw allow 7000/tcp
sudo ufw reload
```

### Step 2: Update .env File

```env
# Use your server IP
BASE_URL=http://88.99.144.25:7000

# Or if using a domain
# BASE_URL=http://your-domain.com:7000
```

### Step 3: Restart Self-Streme

```bash
cd self-streme
npm start
```

### Step 4: Test

```bash
curl http://88.99.144.25:7000/manifest.json
```

### Step 5: Add to Stremio

```
stremio://88.99.144.25:7000/manifest.json
```

⚠️ **Warning:** This exposes port 7000 directly. Not recommended for production.

---

## **Solution 3: Use a Domain Name with SSL (Most Professional)**

### Prerequisites:
- A domain name pointing to your server
- SSL certificate (Let's Encrypt recommended)

### Step 1: Setup Domain DNS

Point your domain to your server IP:
```
Type: A
Name: stremio (or @)
Value: 88.99.144.25
TTL: 3600
```

### Step 2: Install SSL Certificate

**With Plesk:**
1. Go to **Domains** → Your domain → **SSL/TLS Certificates**
2. Click **Install** on Let's Encrypt
3. Enable **Secure the domain** and **Secure the mail**

**Manual with Certbot:**
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### Step 3: Configure nginx (see Solution 1)

### Step 4: Update .env File

```env
BASE_URL=https://your-domain.com/stremio
```

### Step 5: Restart Self-Streme

```bash
cd self-streme
npm start
```

### Step 6: Add to Stremio

```
stremio://your-domain.com/stremio/manifest.json
```

---

## **Solution 4: Use Process Manager for Persistence**

Make sure your app stays running even after server restart:

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the app
cd self-streme
pm2 start src/index.js --name self-streme

# Save the process list
pm2 save

# Setup startup script
pm2 startup
# Run the command it outputs

# Monitor the app
pm2 monit

# View logs
pm2 logs self-streme
```

### Using systemd

Create `/etc/systemd/system/self-streme.service`:

```ini
[Unit]
Description=Self-Streme Addon
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/self-streme
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable self-streme
sudo systemctl start self-streme
sudo systemctl status self-streme
```

---

## 🧪 Testing Your Deployment

### 1. Test Manifest Access

```bash
# Replace with your actual URL
curl https://your-domain.com/stremio/manifest.json
```

Expected response:
```json
{
  "id": "com.zvicraft.selfstreme",
  "version": "1.0.0",
  "name": "Self-Streme",
  "description": "Stream movies and series from multiple sources...",
  "url": "https://your-domain.com/stremio",
  "types": ["movie", "series"],
  ...
}
```

### 2. Test Health Endpoint

```bash
curl https://your-domain.com/stremio/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 123.456,
  ...
}
```

### 3. Test Debug URL Detection

```bash
curl https://your-domain.com/stremio/debug/url
```

This shows what the app is detecting. Make sure the URLs are correct.

### 4. Test in Stremio

1. Open Stremio
2. Go to **Addons** → **Community Addons**
3. Click **Install from URL**
4. Enter your manifest URL
5. Click **Install**

---

## 🚨 Common Issues and Fixes

### Issue 1: "Failed to fetch"

**Cause:** Network/firewall blocking access

**Fix:**
- Check firewall rules
- Verify nginx is running: `sudo systemctl status nginx`
- Check app is running: `pm2 status` or `ps aux | grep node`
- Test locally first: `curl http://localhost:7000/manifest.json`

### Issue 2: "Mixed Content Error" in Stremio

**Cause:** HTTPS page loading HTTP resources

**Fix:**
- Use HTTPS for your BASE_URL
- Ensure SSL certificate is valid
- Set Cloudflare SSL mode to "Full (strict)" if using Cloudflare

### Issue 3: "Connection Refused"

**Cause:** App not running or wrong port

**Fix:**
```bash
# Check if app is running
netstat -tlnp | grep 7000

# Check logs
pm2 logs self-streme
# or
tail -f self-streme/combined.log
```

### Issue 4: "502 Bad Gateway"

**Cause:** nginx can't reach the backend

**Fix:**
- Verify app is running on port 7000
- Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Ensure proxy_pass points to correct port

### Issue 5: Wrong URL in Manifest

**Cause:** BASE_URL not set correctly

**Fix:**
- Update `.env` file with correct BASE_URL
- Restart the app
- Test `/debug/url` endpoint to see what's detected

---

## 📋 Quick Checklist

- [ ] Server/VPS accessible from internet
- [ ] Port 7000 accessible (or reverse proxy configured)
- [ ] Domain DNS pointing to server (if using domain)
- [ ] SSL certificate installed (for HTTPS)
- [ ] `.env` file has correct BASE_URL
- [ ] nginx/Apache configured with reverse proxy (recommended)
- [ ] App running with PM2 or systemd
- [ ] Firewall allows traffic
- [ ] Manifest accessible: `curl https://your-url/manifest.json`
- [ ] Successfully added to Stremio

---

## 💡 Recommended Production Setup

```
┌─────────────┐
│   Stremio   │
└──────┬──────┘
       │ HTTPS (443)
       ▼
┌─────────────────┐
│  nginx/Apache   │
│  (with SSL)     │
└──────┬──────────┘
       │ HTTP (7000)
       ▼
┌─────────────────┐
│  Self-Streme    │
│  (Node.js)      │
└─────────────────┘
```

**Configuration:**
- Domain: `addon.your-domain.com`
- SSL: Let's Encrypt
- Reverse Proxy: nginx at `/` or `/stremio/`
- Process Manager: PM2
- BASE_URL: `https://addon.your-domain.com`

---

## 📞 Still Having Issues?

1. Check the logs:
   ```bash
   # PM2 logs
   pm2 logs self-streme

   # App logs
   tail -f self-streme/combined.log
   tail -f self-streme/error.log

   # nginx logs
   sudo tail -f /var/log/nginx/error.log
   ```

2. Test the debug endpoint:
   ```bash
   curl https://your-url/debug/url
   ```

3. Verify environment:
   ```bash
   cd self-streme
   cat .env
   ```

4. Check if processes are running:
   ```bash
   pm2 status
   sudo systemctl status nginx
   ```

---

## 🎯 Quick Start for Most Users

**If you have a domain and Plesk:**

1. Update `.env`:
   ```env
   BASE_URL=https://your-domain.com/stremio
   ```

2. Add nginx config in Plesk (see Solution 1)

3. Start with PM2:
   ```bash
   npm install -g pm2
   cd self-streme
   pm2 start src/index.js --name self-streme
   pm2 save
   pm2 startup
   ```

4. Install SSL certificate in Plesk

5. Add to Stremio:
   ```
   stremio://your-domain.com/stremio/manifest.json
   ```

Done! 🎉
