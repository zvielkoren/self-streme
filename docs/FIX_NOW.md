# 🚀 Fix Your Manifest Access Issue - Step by Step

## 🔴 Current Problem

```
Error: Failed to get addon manifest from https://1.1.1.1/manifest.json
Failed to fetch: Failed to fetch
```

**What's happening:**
- Your server at `1.1.1.1` redirects to `https://panel.domain.com` (Plesk panel)
- Your Self-Streme app is configured for `localhost` only
- Stremio cannot access the manifest from the internet

---

## ✅ Fix It Now - Choose Your Method

### **Method 1: Use a Domain (BEST - Recommended)**

If you have a domain name, this is the cleanest solution.

#### Step 1: Point Your Domain to the Server

In your domain DNS settings:
```
Type: A
Name: stremio (or whatever subdomain you want)
Value: 1.1.1.1
TTL: 3600
```

This will create: `stremio.your-domain.com` → `1.1.1.1`

#### Step 2: Setup SSL Certificate in Plesk

1. Login to your Plesk panel at `https://panel.domain.com`
2. Go to **Domains** → Select your domain
3. Click **SSL/TLS Certificates**
4. Click **Install** next to "Let's Encrypt"
5. Enable **Secure the domain** and **Secure www subdomain**
6. Click **Get it free**

#### Step 3: Configure nginx Reverse Proxy in Plesk

1. In Plesk, go to **Domains** → Your domain → **Apache & nginx Settings**
2. Scroll down to **Additional nginx directives**
3. Add this configuration:

```nginx
# Self-Streme Addon Configuration
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
    proxy_read_timeout 300;
    proxy_connect_timeout 300;
}
```

4. Click **OK** and **Apply**

#### Step 4: Update Your .env File

SSH into your server and edit the file:

```bash
cd /path/to/self-streme
nano .env
```

Update this line:
```env
BASE_URL=https://stremio.your-domain.com/stremio
```

Save and exit (Ctrl+X, Y, Enter)

#### Step 5: Install and Run with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Navigate to your project
cd /path/to/self-streme

# Install dependencies if not already done
npm install

# Start the application
pm2 start src/index.js --name self-streme

# Save the PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Copy and run the command it outputs
```

#### Step 6: Test It

```bash
# Test locally first
curl http://localhost:7000/health

# Test through nginx
curl https://stremio.your-domain.com/stremio/health

# Test the manifest
curl https://stremio.your-domain.com/stremio/manifest.json
```

#### Step 7: Add to Stremio

1. Open Stremio app
2. Go to **Addons** → **Community Addons**
3. Click **"Install from URL"**
4. Enter: `stremio://stremio.your-domain.com/stremio/manifest.json`
5. Click **Install**

🎉 **Done!**

---

### **Method 2: Use IP Address with Custom Port (QUICK TEST)**

This is quicker but less professional. Good for testing.

#### Step 1: Open Port 7000 in Firewall

In Plesk:
1. Go to **Tools & Settings** → **Firewall**
2. Click **Add Custom Rule**
3. Set:
   - Port: `7000`
   - Protocol: TCP
   - Action: Allow
4. Click **OK**

Or via SSH:
```bash
# UFW
sudo ufw allow 7000/tcp
sudo ufw reload

# Or iptables
sudo iptables -A INPUT -p tcp --dport 7000 -j ACCEPT
sudo iptables-save
```

#### Step 2: Update Your .env File

```bash
cd /path/to/self-streme
nano .env
```

Change this line to:
```env
BASE_URL=http://1.1.1.1:7000
```

Save and exit.

#### Step 3: Run the Application

```bash
# Quick start
npm start

# Or better with PM2
npm install -g pm2
pm2 start src/index.js --name self-streme
pm2 save
pm2 startup
```

#### Step 4: Test It

```bash
# From another machine or your local PC
curl http://1.1.1.1:7000/health
curl http://1.1.1.1:7000/manifest.json
```

#### Step 5: Add to Stremio

1. Open Stremio app
2. Go to **Addons** → **Community Addons**
3. Click **"Install from URL"**
4. Enter: `stremio://1.1.1.1:7000/manifest.json`
5. Click **Install**

⚠️ **Note:** This uses HTTP (not HTTPS) and exposes the port directly. OK for testing, not recommended for production.

---

### **Method 3: Auto-Detect (If Already Have Reverse Proxy)**

If you already have nginx configured to proxy to your app.

#### Step 1: Enable Auto-Detection

```bash
cd /path/to/self-streme
nano .env
```

Comment out the BASE_URL line:
```env
# BASE_URL will be auto-detected from proxy headers
#BASE_URL=http://127.0.0.1:7000
```

#### Step 2: Restart the App

```bash
pm2 restart self-streme
# or
npm start
```

#### Step 3: Check Detection

```bash
curl https://your-domain.com/debug/url
```

This will show what URL the app detected.

---

## 🔍 Quick Verification Commands

### Check if App is Running
```bash
# Check if listening on port 7000
netstat -tln | grep 7000
# or
ss -tln | grep 7000

# Check PM2 status
pm2 status

# View logs
pm2 logs self-streme
```

### Check nginx Configuration
```bash
# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Check nginx status
sudo systemctl status nginx
```

### Test Endpoints
```bash
# Health check
curl http://localhost:7000/health

# Manifest
curl http://localhost:7000/manifest.json

# External (replace with your URL)
curl https://your-domain.com/stremio/manifest.json
```

---

## 🐛 Troubleshooting

### App Won't Start

```bash
# Check what's using port 7000
lsof -ti:7000

# Kill the process
kill $(lsof -ti:7000)

# Try starting again
pm2 start src/index.js --name self-streme
```

### Can't Access Externally

```bash
# Check firewall
sudo ufw status
sudo iptables -L -n | grep 7000

# Check if app is listening on all interfaces
netstat -tln | grep 7000
# Should show 0.0.0.0:7000 or :::7000
```

### 502 Bad Gateway

```bash
# Make sure app is running
pm2 status

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify proxy_pass URL in nginx config is correct
```

### SSL Certificate Issues

If using Cloudflare:
1. Set SSL/TLS mode to **"Full (strict)"** NOT "Flexible"
2. Ensure your origin server (Plesk) has a valid SSL certificate
3. Clear Cloudflare cache

---

## 📋 What You Need Before Starting

- [x] Access to your server (SSH or Plesk)
- [ ] Domain name (recommended) OR willing to use IP:port
- [ ] Ability to modify nginx config (via Plesk or SSH)
- [ ] Firewall access (to open ports if needed)
- [ ] Node.js 18+ installed on server
- [ ] npm installed on server

---

## 🎯 Recommended Setup

**Best Production Configuration:**

```
1. Domain: stremio.your-domain.com
2. SSL: Let's Encrypt (free via Plesk)
3. Reverse Proxy: nginx at /stremio/
4. Process Manager: PM2
5. BASE_URL: https://stremio.your-domain.com/stremio
```

**Why:**
- ✅ Professional URL
- ✅ HTTPS encryption
- ✅ Hidden ports (uses 443/80)
- ✅ Auto-restart on crashes
- ✅ Works with Cloudflare/CDN

---

## 📞 Need More Help?

1. **Run the diagnostic script:**
   ```bash
   cd self-streme
   chmod +x diagnose.sh
   ./diagnose.sh
   ```

2. **Use the quick fix script:**
   ```bash
   chmod +x quick-fix.sh
   ./quick-fix.sh
   ```

3. **Check detailed documentation:**
   - `FIXING_MANIFEST_ACCESS.md` - Comprehensive solutions
   - `DEPLOYMENT.md` - Full deployment guide
   - `TROUBLESHOOTING_SUMMARY.md` - Common issues

4. **Check logs:**
   ```bash
   pm2 logs self-streme
   tail -f ~/self-streme/combined.log
   sudo tail -f /var/log/nginx/error.log
   ```

---

## ✅ Success Checklist

You'll know it's working when:

- [ ] `curl http://localhost:7000/health` returns `{"status":"ok"}`
- [ ] `curl http://localhost:7000/manifest.json` returns JSON
- [ ] External URL is accessible (via domain or IP)
- [ ] Manifest shows correct URL in response
- [ ] Stremio successfully installs the addon
- [ ] You can search for content in Stremio and see Self-Streme sources

---

**🚀 Quick Start Command Sequence**

If you want to just get it running quickly for testing:

```bash
# 1. Update BASE_URL
cd /path/to/self-streme
sed -i 's|BASE_URL=.*|BASE_URL=http://1.1.1.1:7000|' .env

# 2. Open firewall
sudo ufw allow 7000/tcp

# 3. Install and start
npm install
npm install -g pm2
pm2 start src/index.js --name self-streme
pm2 save

# 4. Test
curl http://1.1.1.1:7000/manifest.json

# 5. Add to Stremio
# stremio://1.1.1.1:7000/manifest.json
```

**Then upgrade to proper domain + HTTPS setup using Method 1 above!**

---

Good luck! 🎬✨
