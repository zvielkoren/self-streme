# ⚡ Quick Start: Cloudflare + Any Server

This guide gets your app working with HTTPS/TLS in under 5 minutes.

## 🎯 The Problem

When using **Cloudflare** (or any CDN/proxy), your app might generate `http://` URLs instead of `https://`, causing:
- Mixed content errors
- "Not secure" warnings
- Stremio refusing to load the addon

## ✅ The Solution

Your app **already auto-detects HTTPS** from proxy headers. You just need to configure Cloudflare correctly.

---

## 🚀 2-Minute Setup

### 1. Fix Cloudflare SSL Mode

**In Cloudflare Dashboard:**

1. Go to **SSL/TLS** → **Overview**
2. Change from **"Flexible"** to:
   - **"Full"** (if origin has any SSL cert, even self-signed)
   - **"Full (strict)"** (if origin has valid cert like Let's Encrypt) ← **Recommended**

⚠️ **Never use "Flexible"** - it breaks HTTPS detection!

### 2. Install SSL on Your Server

**Plesk:**
```
Domains → Your domain → SSL/TLS Certificates → Install Let's Encrypt
```

**cPanel:**
```
SSL/TLS Status → AutoSSL → Run
```

**VPS (nginx/Apache):**
```bash
sudo certbot --nginx -d your-domain.com
# or
sudo certbot --apache -d your-domain.com
```

### 3. Verify It Works

Visit: `https://your-domain.com/debug/url`

✅ Should show:
```json
{
  "detected": {
    "protocol": "https",
    "baseUrl": "https://your-domain.com",
    "isCloudflare": true
  }
}
```

❌ If you see `"protocol": "http"`, go back to step 1!

---

## 🔧 Optional: Manual Override

If auto-detection fails, force the URL:

**Environment Variable:**
```bash
BASE_URL=https://your-domain.com
```

**Where to set it:**
- Plesk: `Domains → Node.js → Environment Variables`
- cPanel: `.env` file in app root
- VPS: Add to systemd service or PM2 ecosystem file
- Docker: `docker-compose.yml` environment section

Then **restart your app**.

---

## 📋 Quick Checklist

- [ ] Cloudflare SSL mode is "Full" or "Full (strict)" (NOT "Flexible")
- [ ] Origin server has SSL certificate installed
- [ ] `/debug/url` shows `"protocol": "https"`
- [ ] `/manifest.json` has `https://` URLs
- [ ] No mixed content errors in browser console

---

## 🐛 Still Having Issues?

### Issue: Still getting HTTP URLs

**Check headers:**
```bash
curl -v https://your-domain.com/health 2>&1 | grep -i "x-forwarded"
```

Should see: `X-Forwarded-Proto: https`

**If missing**, your reverse proxy isn't forwarding headers. Add to config:

**nginx:**
```nginx
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
```

**Apache:**
```apache
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Host "%{HTTP_HOST}e"
```

**Plesk:** Add to `Apache & nginx Settings → Additional nginx directives`

### Issue: Cloudflare Error 525 (SSL Handshake Failed)

Your server doesn't have a valid SSL cert, but Cloudflare is in "Full (strict)" mode.

**Fix:**
1. Install Let's Encrypt certificate on origin
2. OR temporarily use "Full" mode (less secure)

### Issue: Mixed Content in Browser

Open browser console on `https://your-domain.com/test-source-selection`

If you see: `"Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'"`

**Fix:** Set `BASE_URL=https://your-domain.com` and restart app.

---

## 📖 How It Works

Your app uses smart auto-detection:

1. Checks for `BASE_URL` environment variable (highest priority)
2. Reads `X-Forwarded-Proto` header from proxy
3. Reads `CF-Visitor` header from Cloudflare
4. Checks 10+ other common proxy headers
5. Falls back to direct connection protocol

**This means:** Throw your code on ANY server with ANY proxy, and it should "just work" (if headers are forwarded).

---

## 🌍 Supported Platforms

✅ Cloudflare + Plesk
✅ Cloudflare + cPanel
✅ Cloudflare + nginx
✅ Cloudflare + Apache
✅ Cloudflare + Caddy
✅ Any reverse proxy that forwards headers

---

## 🎯 One-Line Test

After deployment, run:

```bash
curl -s https://your-domain.com/api/base-url | jq '.baseUrl'
```

Should output: `"https://your-domain.com"`

If it shows `http://`, you have a configuration issue (see above).

---

## 💡 Pro Tips

1. **Always use "Full (strict)"** in Cloudflare for maximum security
2. **Enable these in Cloudflare:**
   - SSL/TLS → Edge Certificates → "Always Use HTTPS"
   - SSL/TLS → Edge Certificates → "Automatic HTTPS Rewrites"
3. **Set BASE_URL** for guaranteed consistency (optional but recommended)
4. **Use `/debug/url`** endpoint to troubleshoot detection issues

---

## ✨ That's It!

Your app is now production-ready with automatic HTTPS detection. Deploy anywhere, and it will adapt to the environment.

**Still stuck?** Check the full deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)