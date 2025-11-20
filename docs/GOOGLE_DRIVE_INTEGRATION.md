# Google Drive Integration for Cached Torrents

Complete guide to integrating Google Drive as a download source for cached torrents in Self-Streme.

---

## 🎯 Overview

Google Drive integration allows you to serve torrents that are already cached/uploaded to Google Drive. This provides:

- ✅ **Extremely fast downloads** (Google's CDN)
- ✅ **100% reliability** (no seeders needed)
- ✅ **No rate limits** (for your own Google Drive)
- ✅ **Large file support** (up to 5TB per file)
- ✅ **Free** (15GB free, 100GB for $1.99/month)

Perfect for:
- Your personal collection uploaded to Google Drive
- Frequently requested content cached in advance
- Content you want to guarantee is always available

---

## 🚀 Quick Setup

### Step 1: Enable Google Drive Source

```bash
# In .env file
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_API_ENDPOINT=http://localhost:3000/gdrive
```

### Step 2: Set Up Lookup API

You need a service that maps torrent info hashes to Google Drive file IDs. Two options:

#### Option A: Use Simple JSON File (Quick Start)

```bash
# Create a simple lookup server
cd ~
mkdir gdrive-lookup
cd gdrive-lookup
npm init -y
npm install express
```

Create `server.js`:
```javascript
const express = require('express');
const app = express();

// Your torrent -> Google Drive mapping
const cache = {
  // Format: "infohash": "Google Drive URL"
  "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c": "https://drive.google.com/file/d/1ABC123DEF456/view",
  "abc123def456...": "https://drive.google.com/file/d/1XYZ789GHI012/view",
};

app.get('/gdrive/lookup', (req, res) => {
  const { infohash } = req.query;
  const url = cache[infohash];
  
  if (url) {
    res.json({ success: true, url });
  } else {
    res.json({ success: false, error: 'Not found' });
  }
});

app.listen(3000, () => {
  console.log('Google Drive lookup API running on port 3000');
});
```

Run it:
```bash
node server.js &
```

#### Option B: Use Database (Production)

See [Advanced Setup](#advanced-setup) below.

### Step 3: Restart Self-Streme

```bash
npm run stop && npm run start
```

### Step 4: Verify

```bash
# Check if Google Drive source is loaded
curl http://localhost:11470/api/sources/stats | jq '.sources[] | select(.name=="Google Drive")'

# Should return:
# {
#   "name": "Google Drive",
#   "priority": 5,
#   "verified": true,
#   "note": "Google Drive cached torrents (if available)"
# }
```

---

## 📋 How It Works

### Flow Diagram

```
User requests torrent (infohash: abc123...)
          ↓
Self-Streme queries lookup API
  GET /gdrive/lookup?infohash=abc123
          ↓
Lookup API checks database/cache
          ↓
   ┌──────┴──────┐
   ↓             ↓
Found         Not Found
   ↓             ↓
Return       Return error
Drive URL     ↓
   ↓         Try next source
Convert to direct download URL
   ↓
Download from Google Drive CDN
   ↓
Stream to user
```

### URL Conversion

Google Drive sharing links need to be converted to direct download URLs:

**Sharing URL:**
```
https://drive.google.com/file/d/1ABC123DEF456/view?usp=sharing
```

**Direct Download URL (Auto-converted):**
```
https://drive.google.com/uc?export=download&id=1ABC123DEF456&confirm=t
```

Self-Streme handles this conversion automatically.

---

## 🗄️ Building Your Torrent Cache

### Method 1: Manual Upload

1. **Download torrent file locally**
   ```bash
   # Using transmission-cli or any torrent client
   transmission-cli "magnet:?xt=urn:btih:INFOHASH"
   ```

2. **Upload to Google Drive**
   - Drag & drop to drive.google.com
   - Or use rclone for automation

3. **Get sharing link**
   - Right-click file → Share → Copy link
   - Make sure "Anyone with the link can view" is enabled

4. **Add to lookup database**
   ```javascript
   // In your lookup API
   cache["INFOHASH"] = "https://drive.google.com/file/d/FILE_ID/view";
   ```

### Method 2: Automated with rclone

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure Google Drive
rclone config

# Upload torrent files
rclone copy /path/to/downloads gdrive:/torrents/

# List files with IDs
rclone lsf gdrive:/torrents/ --format "p" --drive-shared-is-root
```

### Method 3: Use Google Drive API

```javascript
// Example: Upload and get link programmatically
const { google } = require('googleapis');
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function uploadToGoogleDrive(filePath, fileName) {
  const fileMetadata = {
    name: fileName,
    parents: ['YOUR_FOLDER_ID'] // Optional
  };
  
  const media = {
    mimeType: 'video/mp4',
    body: fs.createReadStream(filePath)
  };
  
  const file = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  });
  
  // Make publicly accessible
  await drive.permissions.create({
    fileId: file.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });
  
  return `https://drive.google.com/file/d/${file.data.id}/view`;
}
```

---

## 🔧 Advanced Setup

### Production Lookup API with Database

#### Using MongoDB

```javascript
// lookup-server.js
const express = require('express');
const mongoose = require('mongoose');

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost/gdrive-cache');

// Schema
const TorrentCache = mongoose.model('TorrentCache', {
  infohash: { type: String, unique: true, index: true },
  googleDriveUrl: String,
  fileName: String,
  fileSize: Number,
  addedAt: { type: Date, default: Date.now },
  accessCount: { type: Number, default: 0 }
});

// Lookup endpoint
app.get('/gdrive/lookup', async (req, res) => {
  try {
    const { infohash, filename } = req.query;
    
    const cached = await TorrentCache.findOne({ infohash });
    
    if (!cached) {
      return res.json({ success: false, error: 'Not found' });
    }
    
    // Increment access counter
    cached.accessCount += 1;
    await cached.save();
    
    res.json({
      success: true,
      url: cached.googleDriveUrl,
      fileName: cached.fileName,
      fileSize: cached.fileSize
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add to cache endpoint (for automation)
app.post('/gdrive/add', express.json(), async (req, res) => {
  try {
    const { infohash, googleDriveUrl, fileName, fileSize } = req.body;
    
    await TorrentCache.findOneAndUpdate(
      { infohash },
      { googleDriveUrl, fileName, fileSize },
      { upsert: true }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List all cached torrents
app.get('/gdrive/list', async (req, res) => {
  const cached = await TorrentCache.find().select('-_id infohash fileName fileSize accessCount');
  res.json({ success: true, count: cached.length, torrents: cached });
});

app.listen(3000, () => {
  console.log('Google Drive lookup API with MongoDB running on port 3000');
});
```

#### Using Redis

```javascript
// lookup-server-redis.js
const express = require('express');
const redis = require('redis');

const app = express();
const client = redis.createClient();

app.get('/gdrive/lookup', async (req, res) => {
  const { infohash } = req.query;
  
  const url = await client.get(`gdrive:${infohash}`);
  
  if (url) {
    // Increment access counter
    await client.incr(`gdrive:${infohash}:count`);
    res.json({ success: true, url });
  } else {
    res.json({ success: false, error: 'Not found' });
  }
});

app.post('/gdrive/add', express.json(), async (req, res) => {
  const { infohash, googleDriveUrl } = req.body;
  await client.set(`gdrive:${infohash}`, googleDriveUrl);
  res.json({ success: true });
});

app.listen(3000);
```

---

## 🤖 Automation Scripts

### Auto-Cache Popular Torrents

```bash
#!/bin/bash
# auto-cache.sh - Download popular torrents and upload to Google Drive

POPULAR_TORRENTS=(
  "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"  # Big Buck Bunny
  "abc123..."  # Another popular torrent
)

for INFOHASH in "${POPULAR_TORRENTS[@]}"; do
  echo "Processing $INFOHASH..."
  
  # Download torrent
  transmission-cli "magnet:?xt=urn:btih:$INFOHASH" -w /tmp/downloads/
  
  # Find downloaded file
  FILE=$(find /tmp/downloads -type f -name "*.mp4" -o -name "*.mkv" | head -1)
  
  if [ -n "$FILE" ]; then
    # Upload to Google Drive
    GDRIVE_URL=$(rclone copy "$FILE" gdrive:/cache/ --drive-shared-is-root)
    
    # Add to lookup database
    curl -X POST http://localhost:3000/gdrive/add \
      -H "Content-Type: application/json" \
      -d "{\"infohash\":\"$INFOHASH\",\"googleDriveUrl\":\"$GDRIVE_URL\"}"
    
    echo "✓ Cached $INFOHASH"
  fi
done
```

### Monitor and Auto-Cache Requested Torrents

```javascript
// monitor-requests.js - Cache torrents as they're requested
const fs = require('fs');
const { exec } = require('child_process');

// Watch Self-Streme logs
const logFile = '/path/to/self-streme/logs/app.log';

fs.watchFile(logFile, async () => {
  const logs = fs.readFileSync(logFile, 'utf8');
  const lines = logs.split('\n');
  
  // Find torrent requests
  const requestPattern = /Stream request for ([a-f0-9]{40})/;
  
  for (const line of lines) {
    const match = line.match(requestPattern);
    if (match) {
      const infohash = match[1];
      
      // Check if already cached
      const cached = await checkCache(infohash);
      if (!cached) {
        console.log(`New torrent requested: ${infohash}, adding to cache queue...`);
        await queueForCaching(infohash);
      }
    }
  }
});

async function queueForCaching(infohash) {
  // Add to queue for background processing
  exec(`./cache-torrent.sh ${infohash} &`);
}
```

---

## 🔐 Security Considerations

### Access Control

If you want to restrict access to your Google Drive files:

```javascript
// Add authentication to lookup API
const express = require('express');
const app = express();

const API_KEY = process.env.GDRIVE_LOOKUP_API_KEY;

app.use((req, res, next) => {
  const providedKey = req.headers['x-api-key'];
  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ... rest of API
```

Then in Self-Streme's .env:
```bash
GOOGLE_DRIVE_API_ENDPOINT=http://localhost:3000/gdrive
GOOGLE_DRIVE_API_KEY=your-secret-key-here
```

### Rate Limiting

Google Drive has download quotas. Implement rate limiting:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/gdrive/', limiter);
```

---

## 📊 Usage Statistics

### Track Popular Content

```javascript
// Add analytics to lookup API
app.get('/gdrive/stats', async (req, res) => {
  const stats = await TorrentCache.find()
    .sort({ accessCount: -1 })
    .limit(20)
    .select('infohash fileName accessCount');
  
  res.json({
    topRequested: stats,
    totalCached: await TorrentCache.countDocuments(),
    totalRequests: await TorrentCache.aggregate([
      { $group: { _id: null, total: { $sum: '$accessCount' } } }
    ])
  });
});
```

View stats:
```bash
curl http://localhost:3000/gdrive/stats | jq
```

---

## 🔄 Integration with Other Services

### Combine with Real-Debrid

Download from Real-Debrid and cache to Google Drive:

```javascript
// Cache Real-Debrid downloads to Google Drive
async function cacheFromRealDebrid(infohash) {
  // 1. Get from Real-Debrid
  const rdUrl = await getRealDebridUrl(infohash);
  
  // 2. Download file
  const localPath = await downloadFile(rdUrl, `/tmp/${infohash}.mkv`);
  
  // 3. Upload to Google Drive
  const gdriveUrl = await uploadToGoogleDrive(localPath, `${infohash}.mkv`);
  
  // 4. Add to cache
  await addToCache(infohash, gdriveUrl);
  
  // 5. Clean up local file
  fs.unlinkSync(localPath);
}
```

### Use with Plex/Jellyfin

Mount Google Drive and point your media server to it:

```bash
# Mount Google Drive
rclone mount gdrive:/torrents /mnt/gdrive-torrents --daemon

# Point Plex/Jellyfin to /mnt/gdrive-torrents
# Now Self-Streme and Plex share the same cached content
```

---

## 🐛 Troubleshooting

### Issue: "GOOGLE_DRIVE_API_ENDPOINT not configured"

**Solution:**
```bash
# Add to .env
GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_API_ENDPOINT=http://localhost:3000/gdrive
```

### Issue: "File not found in Google Drive cache"

**Cause:** Torrent not in your cache database

**Solution:**
1. Check if infohash is in database:
   ```bash
   curl http://localhost:3000/gdrive/lookup?infohash=YOUR_HASH
   ```
2. If not found, add it manually or let other sources handle it

### Issue: "Google Drive download fails with 403"

**Cause:** File not publicly shared or quota exceeded

**Solution:**
1. Make sure file has "Anyone with link" permissions
2. Check Google Drive quota (drive.google.com/settings/storage)
3. If quota exceeded, upgrade storage or clean up old files

### Issue: "Download is slow from Google Drive"

**Cause:** Google Drive rate limiting or network issues

**Solution:**
1. This is normal for very large files (>2GB)
2. Use multiple Google accounts for load balancing
3. Consider upgrading to Google Workspace for higher quotas

---

## 💡 Best Practices

### 1. Cache Strategically

Don't cache everything - focus on:
- Frequently requested content
- Content without seeders (hard to find)
- Your personal collection
- High-quality versions (1080p, 4K)

### 2. Organize Your Drive

```
Google Drive Structure:
/torrents/
  /movies/
    /action/
    /comedy/
  /tv-shows/
    /popular/
    /classics/
  /documentaries/
```

### 3. Use Shared Drives

For team/production use, use Google Shared Drives:
- 400,000 files per drive (vs 500,000 per account)
- Shared storage pool
- Better organization
- Team access management

### 4. Monitor Storage

```bash
# Check storage usage
rclone about gdrive:

# Clean up old/unused files
rclone delete gdrive:/torrents/ --min-age 90d --dry-run
```

### 5. Backup Your Database

```bash
# Backup MongoDB cache database
mongodump --db gdrive-cache --out /backup/

# Backup Redis cache
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backup/
```

---

## 📈 Performance

### Comparison with Other Sources

| Source | Speed | Reliability | Cost | Setup |
|--------|-------|-------------|------|-------|
| **Google Drive** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $0-2/mo | Medium |
| Real-Debrid | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $4/mo | Easy |
| Free Sources | ⭐⭐ | ⭐⭐ | Free | Easy |
| P2P Torrents | ⭐⭐⭐ | ⭐⭐ | Free | Easy |

**Google Drive advantages:**
- Free tier available (15GB)
- Your own content, your control
- No rate limits on your own files
- Extremely fast CDN
- Can share with friends

---

## 🔗 External Resources

- [Google Drive API Documentation](https://developers.google.com/drive)
- [rclone Documentation](https://rclone.org/drive/)
- [Google Drive Storage Plans](https://one.google.com/storage)

---

## ✅ Summary

**Google Drive integration provides:**
- ✅ 100% reliability for cached content
- ✅ Fast downloads from Google's CDN
- ✅ Free tier available (15GB)
- ✅ Easy to manage with rclone
- ✅ Perfect for personal collections

**Setup in 5 minutes:**
```bash
# 1. Enable in .env
echo "GOOGLE_DRIVE_ENABLED=true" >> .env
echo "GOOGLE_DRIVE_API_ENDPOINT=http://localhost:3000/gdrive" >> .env

# 2. Create simple lookup server (see Quick Setup above)

# 3. Restart Self-Streme
npm run stop && npm run start

# 4. Add your cached torrents to lookup database

# Done! ✓
```

**Questions?** See [TROUBLESHOOTING_DOWNLOAD_FAILURES.md](TROUBLESHOOTING_DOWNLOAD_FAILURES.md) or create an issue.