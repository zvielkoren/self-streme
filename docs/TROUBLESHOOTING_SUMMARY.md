# Troubleshooting Summary: Manifest Access Failed

## 🚨 The Problem

**Error:** `Failed to get addon manifest from https://1.1.1.1/manifest.json`

**What's happening:**
- Stremio cannot access your addon's manifest file
- The IP address `1.1.1.1` is redirecting to a Plesk control panel
- Your `.env` file is configured for local development only (`BASE_URL=http://127.0.0.1:7000`)
- The app is running locally but not accessible from the internet

## 🔍 Root Cause

Your Self-Streme addon is currently configured for **local development**, not production deployment. The server at `1.1.1.1` is either:

1. Not running the Self-Streme app
2. Running it but not exposing port 7000
3. Redirecting all traffic to the Plesk panel instead

## ✅ Quick Solutions

### **Solution 1: Use Domain with Reverse Proxy (Recommended)**

This is the most professional and secure approach.

**Prerequisites:**
- A domain name pointing to `1.1.1.1`
- nginx or Apache already installed (likely with Plesk)
- SSL certificate (free with Let's Encrypt)

**Steps:**

1. **Configure nginx reverse proxy** (in Plesk or manually):

   ```nginx
   location /stremio/ {
       proxy_pass http://127.0.0.1:7000/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

2. **Update `.env` file:**

   ```bash
   BASE_URL=https://your-domain.com/stremio
   ```

3. **Start the app with PM2:**

   ```bash
   npm install -g pm2
   pm2 start src/index.js --name self-streme
   pm2 save
   pm2 startup
   ```

4. **Install SSL certificate** (if not already):

   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

5. **Add to Stremio:**

   ```
   stremio://your-domain.com/stremio/manifest.json
   ```

---

### **Solution 2: Direct Port Access (Quick but Less Secure)**

If you want to test quickly without setting up a reverse proxy.

**Steps:**

1. **Open port 7000 in firewall:**

   ```bash
   # UFW
   sudo ufw allow 7000/tcp

   # iptables
   sudo iptables -A INPUT -p tcp --dport 7000 -j ACCEPT
   ```

2. **Update `.env` file:**

   ```bash
   BASE_URL=http://1.1.1.1:7000
   ```

3. **Start the app:**

   ```bash
   npm start
   ```

4. **Add to Stremio:**

   ```
   stremio://1.1.1.1:7000/manifest.json
   ```

⚠️ **Warning:** This exposes port 7000 directly to the internet. Not recommended for production.

---

### **Solution 3: Auto-Detect (Behind Reverse Proxy)**

If you already have a reverse proxy configured.

**Steps:**

1. **Update `.env` file:**

   ```bash
   # Comment out or remove BASE_URL to enable auto-detection
   #BASE_URL=http://127.0.0.1:7000
   ```

2. **Start the app:**

   ```bash
   npm start
   ```

3. **Test auto-detection:**

   ```bash
   curl https://your-domain.com/debug/url
   ```

---

## 🛠️ Helper Scripts

We've created helper scripts to make this easier:

### Run Diagnostics

```bash
cd self-streme
./diagnose.sh
```

This will check:
- ✅ Local environment (Node.js, npm, .env)
- ✅ Process status (is the app running?)
- ✅ Local connectivity
- ✅ External access
- ✅ Firewall and ports
- ✅ Web server configuration
- ✅ SSL/TLS setup

### Quick Fix Configuration

```bash
cd self-streme
./quick-fix.sh
```

This interactive script will:
- Guide you through BASE_URL configuration
- Support domain, IP, and auto-detect modes
- Update your `.env` file
- Optionally restart the app

---

## 🧪 Testing Your Deployment

### 1. Test Locally

```bash
curl http://localhost:7000/health
curl http://localhost:7000/manifest.json
```

Expected: Status 200 with JSON response

### 2. Test Externally

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
  "url": "https://your-domain.com/stremio",
  ...
}
```

### 3. Test in Stremio

1. Open Stremio app
2. Go to **Addons** → **Community Addons**
3. Click **Install from URL**
4. Enter your manifest URL
5. Click **Install**

If successful, you'll see "Self-Streme" in your addons list!

---

## 🔧 Common Issues

### Issue: "Connection Refused"

**Cause:** App not running

**Fix:**
```bash
npm start
# or
pm2 start src/index.js --name self-streme
```

### Issue: "502 Bad Gateway"

**Cause:** nginx can't reach the backend

**Fix:**
- Verify app is running: `netstat -tln | grep 7000`
- Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Ensure proxy_pass URL is correct in nginx config

### Issue: "Mixed Content Error"

**Cause:** HTTPS page loading HTTP resources

**Fix:**
- Use HTTPS in BASE_URL
- Install valid SSL certificate
- Set Cloudflare SSL to "Full (strict)" if using Cloudflare

### Issue: "Port Already in Use"

**Cause:** Another process using port 7000

**Fix:**
```bash
# Find the process
lsof -ti:7000

# Kill it
kill $(lsof -ti:7000)

# Or change port in .env
PORT=7001
```

---

## 📋 Deployment Checklist

- [ ] Server/VPS accessible from internet
- [ ] Domain DNS pointing to server (optional but recommended)
- [ ] SSL certificate installed (for HTTPS)
- [ ] `.env` file configured with correct BASE_URL
- [ ] nginx/Apache reverse proxy configured (recommended)
- [ ] Firewall allows required ports
- [ ] App running (verify with `netstat -tln | grep 7000`)
- [ ] Process manager configured (PM2 or systemd)
- [ ] Manifest accessible: `curl https://your-url/manifest.json`
- [ ] Successfully added to Stremio

---

## 📚 Additional Resources

For detailed instructions, see:

- **[FIXING_MANIFEST_ACCESS.md](./FIXING_MANIFEST_ACCESS.md)** - Comprehensive solutions guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Full deployment documentation
- **[QUICK_START_CLOUDFLARE.md](./QUICK_START_CLOUDFLARE.md)** - Cloudflare-specific setup
- **[README.md](./README.md)** - General documentation

---

## 🎯 Recommended Production Setup

```
┌─────────────┐
│   Stremio   │ (Client)
└──────┬──────┘
       │
       │ HTTPS (443)
       │
       ▼
┌─────────────────┐
│  nginx/Apache   │ (Reverse Proxy + SSL)
│  your-domain.com│
└──────┬──────────┘
       │
       │ HTTP (7000)
       │
       ▼
┌─────────────────┐
│  Self-Streme    │ (Node.js App)
│  localhost:7000 │
└─────────────────┘
```

**Configuration:**
- **Domain:** `addon.your-domain.com` or `your-domain.com/stremio`
- **SSL:** Let's Encrypt (free)
- **Reverse Proxy:** nginx at `/stremio/` path
- **Process Manager:** PM2 for auto-restart
- **BASE_URL:** `https://addon.your-domain.com` or auto-detect

---

## 💡 Pro Tips

1. **Use PM2 for production** - auto-restarts on crashes and server reboots
2. **Enable SSL/HTTPS** - required for secure streaming
3. **Use a domain name** - more professional than IP addresses
4. **Monitor logs** - `pm2 logs self-streme` or `tail -f combined.log`
5. **Set up auto-backups** - for your `.env` and media files
6. **Use Redis cache** - for better performance at scale

---

## 🆘 Still Need Help?

If you're still having issues:

1. **Run diagnostics:**
   ```bash
   ./diagnose.sh > diagnostics.txt
   ```

2. **Check logs:**
   ```bash
   tail -f combined.log
   tail -f error.log
   pm2 logs self-streme
   ```

3. **Test debug endpoint:**
   ```bash
   curl https://your-domain.com/debug/url
   ```

4. **Verify environment:**
   ```bash
   cat .env
   ```

5. **Check if running:**
   ```bash
   netstat -tln | grep 7000
   pm2 list
   ```

---

## ✅ Success Indicators

You'll know everything is working when:

- ✅ `/health` endpoint returns `{"status": "ok"}`
- ✅ `/manifest.json` returns valid JSON with your domain
- ✅ `/debug/url` shows correct HTTPS URL
- ✅ Stremio successfully installs the addon
- ✅ You can see "Self-Streme" sources in Stremio search results

---

**Made with ❤️ for the Stremio Community**

*For the latest updates and support, see the documentation files in this repository.*
