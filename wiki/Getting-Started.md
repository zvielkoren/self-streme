# 🚀 Getting Started with Self-Streme

Complete guide to installing, configuring, and running Self-Streme for the first time.

---

## 📋 Prerequisites

### System Requirements

**Minimum:**
- CPU: 1 core
- RAM: 1 GB
- Storage: 5 GB (for cache)
- Network: 10 Mbps

**Recommended:**
- CPU: 2+ cores
- RAM: 2+ GB
- Storage: 20+ GB (for cache)
- Network: 50+ Mbps

### Software Requirements

**Required:**
- Node.js 18.0.0 or higher
- npm (comes with Node.js)

**Optional:**
- Docker (for containerized deployment)
- Redis (for production caching)
- Git (for cloning repository)

### Supported Platforms

- ✅ Linux (Ubuntu, Debian, CentOS, etc.)
- ✅ macOS
- ✅ Windows (WSL recommended)
- ✅ Docker (any platform)

---

## 🔧 Installation

### Method 1: Quick Install (Recommended for Beginners)

#### Step 1: Install Node.js

**Linux (Ubuntu/Debian):**
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x or higher
npm --version
```

**macOS:**
```bash
# Using Homebrew
brew install node@18

# Verify installation
node --version
npm --version
```

**Windows:**
- Download installer from https://nodejs.org
- Run installer and follow prompts
- Verify in PowerShell:
```powershell
node --version
npm --version
```

#### Step 2: Clone Repository

```bash
# Using git
git clone https://github.com/zviel/self-streme.git
cd self-streme

# Or download ZIP from GitHub
# Extract and navigate to folder
```

#### Step 3: Install Dependencies

```bash
npm install
```

This will install all required packages. Takes 1-2 minutes.

#### Step 4: Configure

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration (optional)
nano .env  # or vim, code, etc.
```

**Minimum configuration (defaults work fine):**
```bash
# .env file
PORT=11470
LOG_LEVEL=info
```

**Recommended configuration:**
```bash
# .env file
PORT=11470
LOG_LEVEL=info

# Enable optimizations
ENABLE_INSTANT_STREAMING=true
ENABLE_PARALLEL_RACE=true
ENABLE_MULTIPART_DOWNLOAD=true
PARALLEL_DOWNLOADS=3
MULTIPART_CONNECTIONS=8

# Add premium service (95%+ reliability)
REAL_DEBRID_API_KEY=your_key_here  # Get from https://real-debrid.com/apitoken
```

#### Step 5: Start Self-Streme

```bash
npm start
```

You should see:
```
[INFO] Self-Streme starting...
[INFO] Server listening on port 11470
[INFO] Hybrid service initialized
[INFO] Instant streaming: true
[INFO] Ready to stream!
```

#### Step 6: Test

Open your browser:
```
http://localhost:11470
```

Or test with curl:
```bash
curl http://localhost:11470/health
# Should return: {"status":"ok"}
```

---

### Method 2: Docker Install (Recommended for Production)

#### Step 1: Install Docker

**Linux:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout and login again
```

**macOS/Windows:**
- Download Docker Desktop from https://docker.com
- Install and start Docker

#### Step 2: Pull or Build Image

**Option A: Pull from registry (when available):**
```bash
docker pull zviel/self-streme:latest
```

**Option B: Build locally:**
```bash
git clone https://github.com/zviel/self-streme.git
cd self-streme
docker build -t self-streme .
```

#### Step 3: Run Container

**Basic run:**
```bash
docker run -d \
  --name self-streme \
  -p 11470:11470 \
  zviel/self-streme
```

**With configuration:**
```bash
docker run -d \
  --name self-streme \
  -p 11470:11470 \
  -e REAL_DEBRID_API_KEY=your_key_here \
  -e ENABLE_INSTANT_STREAMING=true \
  -e ENABLE_PARALLEL_RACE=true \
  -v self-streme-cache:/app/temp \
  zviel/self-streme
```

**With Docker Compose:**
```yaml
# docker-compose.yml
version: '3.8'
services:
  self-streme:
    image: zviel/self-streme
    ports:
      - "11470:11470"
    environment:
      - REAL_DEBRID_API_KEY=your_key_here
      - ENABLE_INSTANT_STREAMING=true
      - ENABLE_PARALLEL_RACE=true
      - ENABLE_MULTIPART_DOWNLOAD=true
    volumes:
      - self-streme-cache:/app/temp
    restart: unless-stopped

volumes:
  self-streme-cache:
```

Start with:
```bash
docker-compose up -d
```

#### Step 4: Verify

```bash
# Check logs
docker logs self-streme

# Test
curl http://localhost:11470/health
```

---

### Method 3: Quick Start Script

Use the automated setup script:

```bash
# Download and run
curl -fsSL https://raw.githubusercontent.com/zviel/self-streme/main/scripts/install.sh | bash

# Or if you've cloned the repo
./scripts/quick-start.sh
```

This script will:
1. Check Node.js version
2. Install dependencies
3. Create default configuration
4. Start the service
5. Run health check

---

## ⚙️ Basic Configuration

### Essential Settings

Edit `.env` file:

```bash
# Server Configuration
PORT=11470                      # Port to listen on
BASE_URL=http://localhost:11470 # Auto-detected, usually don't need to set

# Logging
LOG_LEVEL=info                  # Options: debug, info, warn, error

# Instant Streaming (Already enabled by default)
ENABLE_INSTANT_STREAMING=true   # Start playback in 3-5 seconds
INITIAL_BUFFER_SIZE=10485760    # 10 MB initial buffer

# Performance Optimization
ENABLE_PARALLEL_RACE=true       # Race multiple sources
ENABLE_MULTIPART_DOWNLOAD=true  # Parallel chunk downloads
PARALLEL_DOWNLOADS=3            # Number of sources to race
MULTIPART_CONNECTIONS=8         # Parallel connections per file

# HTTP Configuration
HTTP_MAX_RETRIES=5              # Retry attempts per source
```

### Premium Services (Highly Recommended)

For 95%+ reliability, add a premium service:

```bash
# Get API key from https://real-debrid.com/apitoken
REAL_DEBRID_API_KEY=your_key_here

# Or alternatives:
ALLDEBRID_API_KEY=your_key_here
PREMIUMIZE_API_KEY=your_key_here
```

Cost: ~€0.13/day (€16 for 180 days)

### Optional: Google Drive Integration

For 100% reliability on cached content:

```bash
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_API_ENDPOINT=http://localhost:3000/gdrive
```

Requires separate lookup API setup. See [Google Drive Integration](Google-Drive-Integration).

---

## 🧪 Testing Your Installation

### 1. Health Check

```bash
curl http://localhost:11470/health
```

Expected response:
```json
{"status":"ok"}
```

### 2. Check Sources

```bash
curl http://localhost:11470/api/sources/stats | jq
```

Expected:
- Shows available sources
- Premium services listed (if configured)
- Health statistics

### 3. Test with Big Buck Bunny

```bash
# Known good torrent for testing
curl "http://localhost:11470/api/stream/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c/0"
```

Should start downloading and streaming.

### 4. Check Logs

```bash
# If running with npm
tail -f logs/app.log

# If running with Docker
docker logs -f self-streme
```

Look for:
```
[INFO] Ready to stream!
[INFO] Instant streaming: true
[INFO] Parallel race mode: true
[INFO] Multi-part download: true
```

---

## 🎬 First Stream

### Using API Directly

```bash
# Convert magnet to HTTP stream
curl -X POST http://localhost:11470/api/magnet-to-http \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'
```

Response:
```json
{
  "success": true,
  "streamUrl": "http://localhost:11470/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"
}
```

### Watch in Browser

Open the stream URL in your browser:
```
http://localhost:11470/stream/proxy/INFOHASH
```

### Using Stremio

See [Stremio Integration](Stremio-Integration) guide.

---

## 🔍 Verifying Features

### Check Instant Streaming

```bash
tail -f logs/app.log | grep -i "instant\|ready to stream"
```

You should see:
```
[Hybrid] Instant streaming: true
[StreamDownload] Ready to stream! Continuing background download...
```

### Check Parallel Racing

```bash
tail -f logs/app.log | grep -i "race\|parallel"
```

You should see:
```
[Hybrid] Parallel race mode: true
[Hybrid] 🏁 Racing 3 sources in parallel...
```

### Check Multi-Part Downloads

```bash
tail -f logs/app.log | grep -i "multipart"
```

You should see:
```
[Hybrid] Multi-part download: true
[MultiPart] Starting multi-part download...
[MultiPart] Chunks: 50, Connections: 8
```

---

## 📊 Performance Expectations

### Without Premium Service (Free)
- Success Rate: 60-70%
- Time to Playback: 5-10 seconds
- Download Speed: 2-5 MB/s

### With Premium Service (Recommended)
- Success Rate: 95-100%
- Time to Playback: 3-5 seconds
- Download Speed: 10-30 MB/s

### With All Optimizations
- Success Rate: 98-100%
- Time to Playback: 2-3 seconds
- Download Speed: 15-30 MB/s

---

## 🆘 Common Issues

### Issue: "Node version too old"

**Solution:**
```bash
# Update Node.js to version 18+
# See installation section above
```

### Issue: "Port 11470 already in use"

**Solution:**
```bash
# Change port in .env
PORT=12000

# Or kill existing process
lsof -ti:11470 | xargs kill
```

### Issue: "npm install fails"

**Solution:**
```bash
# Clear cache and retry
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue: "Downloads failing"

**Solution:**
1. Enable debug logging: `LOG_LEVEL=debug`
2. Check sources: `curl localhost:11470/api/sources/stats`
3. Add premium service: `REAL_DEBRID_API_KEY=your_key`

See [Troubleshooting](Troubleshooting) for more.

---

## 🎯 Next Steps

### Recommended Setup Path

1. ✅ **Install and run** (you just did this!)
2. → **Add premium service** - [Premium Services Guide](Premium-Services)
3. → **Enable optimizations** - [Performance Tuning](Performance-Tuning)
4. → **Configure for your needs** - [Advanced Configuration](Advanced-Configuration)
5. → **Deploy to production** - [Production Setup](Production-Setup)

### Learn Key Features

- [Instant Streaming](Instant-Streaming) - Playback in 3-5 seconds
- [Parallel Downloads](Parallel-Downloads) - 5-10x faster downloads
- [Google Drive Integration](Google-Drive-Integration) - 100% reliable caching

### Optimize Performance

- [Performance Tuning](Performance-Tuning) - Get maximum speed
- [Caching Strategy](Caching-Strategy) - Configure caching
- [Monitoring](Monitoring) - Track performance

---

## 📚 Additional Resources

### Documentation
- [Configuration Reference](Configuration)
- [API Reference](API-Reference)
- [FAQ](FAQ)

### Guides
- [Docker Deployment](Docker-Deployment)
- [Stremio Integration](Stremio-Integration)
- [Troubleshooting](Troubleshooting)

### Community
- [GitHub Issues](https://github.com/zviel/self-streme/issues)
- [Contributing](Contributing)

---

## ✅ Installation Checklist

- [ ] Node.js 18+ installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] Configuration file created (`.env`)
- [ ] Service started (`npm start`)
- [ ] Health check passed
- [ ] Test stream successful
- [ ] Logs showing correct features enabled
- [ ] (Optional) Premium service added
- [ ] (Optional) Optimizations enabled

---

## 💡 Quick Tips

1. **Always use premium services in production** - 95%+ vs 60% reliability
2. **Enable all optimizations** - They're tested and stable
3. **Monitor logs initially** - Watch for any errors
4. **Test with Big Buck Bunny first** - Known working torrent
5. **Keep Node.js updated** - Security and performance
6. **Use Docker for production** - Easier management
7. **Back up your config** - Especially API keys

---

**Last Updated:** 2025-11-20  
**Self-Streme Version:** 2.0

**Next:** [Configuration Guide](Configuration)