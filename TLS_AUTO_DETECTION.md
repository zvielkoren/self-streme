# 🔒 TLS Auto-Detection System

Self-Streme includes a sophisticated **automatic HTTPS/TLS detection system** that makes deployment seamless across any platform—no manual URL configuration needed in most cases.

---

## 🎯 Overview

The app automatically detects:
- ✅ Whether it's behind HTTPS (SSL/TLS)
- ✅ The correct domain/hostname
- ✅ If Cloudflare or other CDN is in use
- ✅ The client's real IP address

**Deploy once, run anywhere** - from localhost to production, from nginx to Cloudflare.

---

## 🔍 How It Works

### Detection Priority (Highest to Lowest)

1. **Environment Variable Override**
   - If `BASE_URL` is set → use that (manual override)
   - Allows forcing specific URL regardless of headers

2. **HTTPS Detection via Multiple Headers**
   - `X-Forwarded-Proto: https`
   - `CF-Visitor: {"scheme":"https"}` (Cloudflare)
   - `CF-Proto: https` (Cloudflare)
   - `X-Forwarded-Ssl: on`
   - `X-ARR-SSL` (Azure)
   - `Front-End-Https: on` (IIS)
   - `X-Url-Scheme: https`
   - `X-Forwarded-Scheme: https`
   - `req.secure` (direct TLS)

3. **Smart Production Defaults**
   - If behind proxy + production mode → defaults to HTTPS
   - Prevents accidental HTTP in production

4. **Host Detection via Headers**
   - `X-Forwarded-Host` (most reverse proxies)
   - `CF-Host` (Cloudflare)
   - `X-Original-Host`
   - `Host` header (standard)

5. **Platform-Specific Auto-Detection**
   - Render: `RENDER_EXTERNAL_URL`
   - Railway: `RAILWAY_STATIC_URL`
   - Heroku: `HEROKU_APP_NAME`

---

## 🌐 Supported Proxies & CDNs

### CDNs
- ✅ **Cloudflare** - Full detection with CF-specific headers
- ✅ **CloudFront** - Standard X-Forwarded headers
- ✅ **Fastly** - Standard headers
- ✅ **Akamai** - Standard headers

### Reverse Proxies
- ✅ **nginx** - X-Forwarded-* headers
- ✅ **Apache** - mod_proxy headers
- ✅ **Caddy** - Auto-configured headers
- ✅ **Traefik** - Docker-aware headers
- ✅ **HAProxy** - Standard headers

### Hosting Panels
- ✅ **Plesk** - nginx/Apache integration
- ✅ **cPanel** - Apache integration
- ✅ **DirectAdmin** - nginx/Apache

### Cloud Platforms
- ✅ **Render.com** - Native integration
- ✅ **Heroku** - Platform detection
- ✅ **Railway** - Platform detection
- ✅ **Fly.io** - Standard headers
- ✅ **DigitalOcean App Platform** - Standard headers
- ✅ **Azure App Service** - X-ARR-SSL
- ✅ **AWS ELB/ALB** - X-Forwarded-Proto

---

## 📊 Detection Examples

### Cloudflare + Plesk
```
Incoming headers:
  CF-Visitor: {"scheme":"https"}
  CF-Connecting-IP: 203.0.113.1
  X-Forwarded-Proto: https
  X-Forwarded-Host: example.com

Detected:
  protocol: "https"
  host: "example.com"
  baseUrl: "https://example.com"
  isCloudflare: true
```

### nginx Reverse Proxy
```
Incoming headers:
  X-Forwarded-Proto: https
  X-Forwarded-Host: example.com
  X-Real-IP: 203.0.113.1

Detected:
  protocol: "https"
  host: "example.com"
  baseUrl: "https://example.com"
  isCloudflare: false
```

### Direct Connection (Development)
```
Incoming headers:
  Host: 127.0.0.1:7000

Detected:
  protocol: "http"
  host: "127.0.0.1:7000"
  baseUrl: "http://127.0.0.1:7000"
  isCloudflare: false
```

### Render.com
```
Environment:
  RENDER_EXTERNAL_URL: https://self-streme.onrender.com
  NODE_ENV: production

Detected:
  protocol: "https"
  host: "self-streme.onrender.com"
  baseUrl: "https://self-streme.onrender.com"
```

---

## 🔧 Configuration Options

### Option 1: Auto-Detection (Recommended)

**No configuration needed!** Just deploy.

```bash
# .env file - minimal or empty
NODE_ENV=production
PORT=7000
```

The app will:
1. Read headers from your proxy/CDN
2. Detect HTTPS automatically
3. Use correct domain from `Host` or `X-Forwarded-Host`
4. Generate correct URLs for Stremio

### Option 2: Manual Override

Force a specific URL (bypasses all detection):

```bash
# .env file
BASE_URL=https://your-domain.com
NODE_ENV=production
PORT=7000
```

Use when:
- Auto-detection fails
- You want guaranteed consistency
- Testing specific configurations
- Multiple domains point to same app

---

## 🐛 Debugging Auto-Detection

### Debug Endpoint

Visit: `https://your-domain.com/debug/url`

**Example Response:**
```json
{
  "detected": {
    "protocol": "https",
    "host": "example.com",
    "baseUrl": "https://example.com",
    "isCloudflare": true,
    "clientIp": "203.0.113.1"
  },
  "headers": {
    "x-forwarded-proto": "https",
    "x-forwarded-host": "example.com",
    "cf-visitor": "{\"scheme\":\"https\"}",
    "cf-connecting-ip": "203.0.113.1",
    "cf-ray": "7d1234567890abcd-LAX",
    "host": "example.com"
  },
  "environment": {
    "NODE_ENV": "production",
    "BASE_URL": "(auto-detect)",
    "RENDER_EXTERNAL_URL": null
  },
  "request": {
    "secure": false,
    "protocol": "http",
    "hostname": "example.com",
    "ip": "127.0.0.1"
  }
}
```

### Interpretation

✅ **Good Detection:**
```json
"detected": {
  "protocol": "https",
  "baseUrl": "https://your-domain.com"
}
```

❌ **Bad Detection:**
```json
"detected": {
  "protocol": "http",  // Should be https!
  "baseUrl": "http://your-domain.com"
}
```

### Common Issues & Solutions

| Symptom | Cause | Fix |
|---------|-------|-----|
| `protocol: "http"` but using Cloudflare | Cloudflare SSL mode = "Flexible" | Set to "Full" or "Full (strict)" |
| `host: "localhost"` in production | Proxy not forwarding `X-Forwarded-Host` | Add header to proxy config |
| `protocol: "http"` behind nginx | Missing `proxy_set_header X-Forwarded-Proto` | Add to nginx config |
| Detection changes per request | No `BASE_URL` set | Set `BASE_URL` for consistency |

---

## 📝 Required Proxy Configuration

### nginx
```nginx
location / {
    proxy_pass http://127.0.0.1:7000;
    
    # Required headers:
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
}
```

### Apache
```apache
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:7000/
ProxyPassReverse / http://127.0.0.1:7000/

# Required headers:
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Host "%{HTTP_HOST}e"
```

### Caddy
```
reverse_proxy 127.0.0.1:7000
```
*(Caddy sets headers automatically)*

### Traefik (Docker)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.app.rule=Host(`example.com`)"
```
*(Traefik sets headers automatically)*

---

## 🎯 Use Cases

### Use Case 1: Development → Production
```
Development:
  http://127.0.0.1:7000
  ↓ (same code, no changes)
Production:
  https://your-domain.com
```

✅ Auto-detected from environment

### Use Case 2: Multiple Domains
```
Production domains:
  https://stream.example.com
  https://example.com
  https://backup.example.org

Solution: Set BASE_URL to primary domain
  BASE_URL=https://stream.example.com
```

### Use Case 3: Internal + External Access
```
Internal: http://10.0.0.5:7000
External: https://stream.example.com

If BASE_URL not set:
  - Internal requests → http://10.0.0.5:7000
  - External requests → https://stream.example.com

If BASE_URL=https://stream.example.com:
  - All requests → https://stream.example.com
```

---

## 🔒 Security Considerations

### Trust Proxy Setting

The app sets `app.set('trust proxy', true)` which means:

✅ **Safe when:**
- Behind reverse proxy (nginx, Apache, Cloudflare)
- Headers are set by trusted proxy
- Not directly exposed to internet

❌ **Unsafe when:**
- Directly exposed to internet without proxy
- Untrusted users can set headers

**Recommendation:** Always run behind a reverse proxy in production.

### Header Spoofing Protection

The Express `trust proxy` setting ensures:
- Headers are only trusted from configured proxies
- Client-set headers are ignored
- IP addresses are correctly extracted

---

## 📈 Benefits

1. **Zero Configuration** - Deploy anywhere, works immediately
2. **Environment Agnostic** - Same code for dev/staging/production
3. **CDN Ready** - Cloudflare, CloudFront, Fastly supported
4. **Multi-Platform** - VPS, Docker, PaaS, all supported
5. **Debuggable** - `/debug/url` endpoint shows exactly what's detected
6. **Flexible** - Manual override option with `BASE_URL`

---

## 🚀 Quick Start

1. Deploy your app anywhere
2. Setup reverse proxy (nginx/Apache/Cloudflare)
3. Ensure proxy forwards headers
4. Done! App auto-detects HTTPS

Test it:
```bash
curl -s https://your-domain.com/debug/url | jq '.detected'
```

Should show:
```json
{
  "protocol": "https",
  "host": "your-domain.com",
  "baseUrl": "https://your-domain.com",
  "isCloudflare": true/false
}
```

---

## 📚 Additional Resources

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Platform-specific deployment guides
- [QUICK_START_CLOUDFLARE.md](./QUICK_START_CLOUDFLARE.md) - Cloudflare setup in 2 minutes
- [README.md](./README.md) - Main documentation

---

**Made with ❤️ for seamless deployment everywhere**