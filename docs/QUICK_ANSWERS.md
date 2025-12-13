# Quick Answers - Self-Streme Addon with Domain

## Your Questions Answered

### Q1: What works automatically in the addon?

**Already working without any configuration:**

✅ **Torrent Streaming** - Downloads and streams torrents automatically  
✅ **DHT Peer Discovery** - Finds peers without trackers  
✅ **Cache System** - Stores frequently watched content  
✅ **Multi-source Search** - Searches multiple torrent sites  
✅ **Adaptive Quality** - Adjusts based on connection speed  
✅ **Health Monitoring** - Auto-cleanup and maintenance  
✅ **Stremio Integration** - Works as Stremio addon immediately  

**These work as soon as you start the server - no setup needed!**

---

### Q2: I want to watch everything on Stremio using my domain

**Simple answer: Just 3 steps!**

#### Step 1: Set your domain in `.env`

```env
# Copy example.env to .env if you haven't
BASE_URL=https://yourdomain.com
PORT=7000
```

#### Step 2: Start the server

```bash
npm install
npm start
```

#### Step 3: Add to Stremio

1. Open Stremio app
2. Go to **Settings → Addons**
3. Click **"Add addon"**
4. Enter: `https://yourdomain.com/manifest.json`
5. Click **Install**

**That's it! Now search for any movie/show in Stremio and streams will appear automatically.**

---

## How It Works Behind the Scenes

```
You search in Stremio
        ↓
Stremio asks your addon: "Do you have this movie?"
        ↓
Your addon searches torrents and replies: "Yes! Here's the stream"
        ↓
Stremio plays it
        ↓
EVERYTHING HAPPENS AUTOMATICALLY
```

---

## What About P2P Hole Punching?

**P2P is OPTIONAL** - The addon already works great without it!

### Without P2P (default):
- ✅ Works immediately
- ✅ Uses DHT and trackers to find peers
- ⚠️ May have issues with some strict firewalls

### With P2P (optional enhancement):
- ✅ All the above benefits
- ✅ PLUS: Better connectivity through firewalls
- ✅ PLUS: Connects to more peers
- ⚠️ Requires 5 minutes to set up

**When to add P2P?**
- Only if you have connectivity issues
- Only if you're behind strict firewall/NAT
- Most users don't need it!

---

## Using Domain with Stremio - Complete Guide

### Option A: Local Testing (No Domain)

```bash
# Just run it
npm start

# Add to Stremio:
http://localhost:7000/manifest.json
```

**Use case:** Testing on your computer only

---

### Option B: Public Domain (Recommended)

#### If using Cloudflare Tunnel (easiest):

```env
# In .env file:
TUNNEL_TOKEN=your_cloudflare_token_here
BASE_URL=https://yourdomain.com
PORT=7000
```

```bash
npm start
```

Your addon is now public at: `https://yourdomain.com/manifest.json`

#### If using regular hosting (VPS, etc.):

1. **Point domain to your server IP**
   - Add A record: `yourdomain.com → your.server.ip`

2. **Set up reverse proxy (nginx example):**

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:7000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. **Add SSL certificate:**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

4. **Update .env:**

```env
BASE_URL=https://yourdomain.com
PORT=7000
```

5. **Start server:**

```bash
npm start
```

---

## What Stremio Needs From Your Domain

Stremio only needs **2 things**:

1. **Manifest**: `https://yourdomain.com/manifest.json`
   - This tells Stremio about your addon

2. **Stream endpoint**: `https://yourdomain.com/stream/{type}/{id}`
   - This provides the actual stream links

**Everything else is handled automatically by your addon!**

---

## Testing Your Setup

### Test 1: Is server running?

```bash
curl http://localhost:7000/health
```

Expected: `{"status":"ok",...}`

### Test 2: Is manifest accessible?

```bash
curl https://yourdomain.com/manifest.json
```

Expected: Valid JSON with addon info

### Test 3: Can I get streams?

```bash
curl https://yourdomain.com/stream/movie/tt0111161
```

Expected: List of stream objects

### Test 4: Works in Stremio?

1. Add addon with domain URL
2. Search "The Shawshank Redemption"
3. Click on it
4. See streams appear in player

---

## Common Issues

### "Addon not found" in Stremio

**Fix:**
- Ensure domain is accessible: `curl https://yourdomain.com/health`
- Check BASE_URL in `.env` matches your domain exactly
- Stremio requires HTTPS for remote addons (use Cloudflare or Let's Encrypt)

### Streams not playing

**Fix:**
- Check logs: `tail -f logs/app.log`
- Test endpoint: `https://yourdomain.com/status`
- Verify torrents are found: `https://yourdomain.com/test-torrent-streaming`

### Slow or no peers

**Fix:**
- This is normal for unpopular content
- Try more popular movies/shows first
- Consider adding P2P enhancement (see SIMPLE_P2P_INTEGRATION.js)

---

## Environment Variables You Actually Need

**Minimum configuration:**

```env
BASE_URL=https://yourdomain.com
PORT=7000
```

**That's it! Everything else is optional.**

**Optional but useful:**

```env
# Cloudflare tunnel (easiest public access)
TUNNEL_TOKEN=your_token

# Better search results
JACKETT_URL=http://localhost:9117
JACKETT_API_KEY=your_key

# Larger cache
CACHE_MAX_DISK_MB=10000

# P2P enhancement (optional)
P2P_ENABLED=true
SIGNALING_PORT=8080
```

---

## Quick Start Checklist

- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Copy `example.env` to `.env`
- [ ] Set `BASE_URL` to your domain
- [ ] Run `npm start`
- [ ] Check `https://yourdomain.com/health`
- [ ] Add `https://yourdomain.com/manifest.json` to Stremio
- [ ] Search for content in Stremio
- [ ] Enjoy!

---

## Summary

**What you asked:**
1. ❓ What works automatically?
   - ✅ **Everything!** Torrent streaming, search, caching - all automatic once server starts

2. ❓ I want to watch on Stremio using domain
   - ✅ **Set BASE_URL in .env, start server, add domain/manifest.json to Stremio**

**The addon works automatically. You just need to:**
1. Set your domain in configuration
2. Start the server
3. Add to Stremio

**No manual steps needed while watching - everything happens in the background!**

---

## Need More Help?

- **Basic setup**: See `DOMAIN_SETUP_GUIDE.md`
- **P2P enhancement**: See `SIMPLE_P2P_INTEGRATION.js`
- **Full P2P docs**: See `docs/P2P_HOLE_PUNCHING.md`
- **Test P2P**: Run `node test-p2p.js`
- **Check logs**: `tail -f logs/app.log`
- **Health check**: Visit `https://yourdomain.com/status`

---

## TL;DR

```bash
# 1. Configure
echo "BASE_URL=https://yourdomain.com" > .env

# 2. Start
npm start

# 3. Add to Stremio
# Open Stremio → Addons → Add: https://yourdomain.com/manifest.json

# 4. Watch anything!
# Everything happens automatically from here
```

**Your addon handles torrent search, download, streaming, caching - all in the background. You just watch! 🎬**