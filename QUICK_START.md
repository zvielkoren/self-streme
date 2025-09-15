# Quick Start Guide - Stremio Secure Streaming

This guide will get you up and running with the secure Stremio addon in 5 minutes.

## 🚀 Quick Installation

### 1. Clone and Install

```bash
git clone <this-repository>
cd self-streme
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will start on `http://127.0.0.1:7000`

### 3. Add to Stremio

1. Open **Stremio Desktop** or **Stremio Web**
2. Go to **Add-ons** → **Community Add-ons**
3. Enter this URL: `http://127.0.0.1:7000/manifest.json`
4. Click **Install**

### 4. Test It Out

1. Search for any movie in Stremio (e.g., search for any IMDb ID like "tt1234567")
2. Look for "Self-Streme" streams in the results
3. Select a stream - it will use secure URLs instead of magnet links!

## 🧪 Testing Examples

### Run Standalone Examples

#### Example 1: Secure Addon
```bash
node examples/secure-addon-example.js
```
Visit: `http://localhost:7001/manifest.json`

#### Example 2: Streaming Server Only
```bash
node examples/streaming-server-example.js
```
Visit: `http://localhost:8000` for web interface

### Test API Endpoints

#### Generate Secure URL
```bash
curl -X POST http://localhost:7000/api/generate-secure-url \
  -H "Content-Type: application/json" \
  -d '{"magnetLink": "magnet:?xt=urn:btih:your-hash-here"}'
```

#### Check Server Stats
```bash
curl http://localhost:7000/api/stats
```

#### Health Check
```bash
curl http://localhost:7000/health
```

## 🔍 How It Works

### Traditional Stremio Addon (INSECURE)
```
Stremio → Addon → Returns magnet:// links → Stremio downloads directly
```

### This Secure Implementation
```
Stremio → Addon → Returns https:// signed URLs → Server handles torrents
```

## 🔒 Security Benefits

1. **No Magnet Exposure**: Stremio never sees the actual magnet links
2. **Temporary Access**: URLs expire after 24 hours (configurable)
3. **Server-Side P2P**: All torrent activity isolated to your server
4. **Signed URLs**: Cryptographically secured access tokens
5. **Range Support**: Proper video seeking and streaming

## 🛠️ Configuration

### Environment Variables
```bash
# Optional - copy to .env file
PORT=7000
BASE_URL=http://127.0.0.1:7000
STREAM_SECRET_KEY=your-secret-key
TORRENT_MAX_CONNECTIONS=100
```

### For Production
```bash
NODE_ENV=production
BASE_URL=https://your-domain.com
STREAM_SECRET_KEY=strong-random-key-here
```

## 📱 Stremio Integration

### What Stremio Sees
```json
{
  "streams": [
    {
      "url": "https://your-server.com/secure-stream/abc123...",
      "title": "Movie Title 1080p [1080p] (2.0 GB) 👥156",
      "quality": "1080p",
      "behaviorHints": {
        "notWebReady": true
      }
    }
  ]
}
```

### What Actually Happens
1. User selects stream in Stremio
2. Stremio requests the signed URL from your server
3. Your server validates the token and streams the torrent content
4. Stremio receives HTTP video stream with range support

## 🚨 Important Notes

- **Legal**: Only use with content you have rights to stream
- **Bandwidth**: Server will use bandwidth for torrent downloads
- **Storage**: Torrents are cached temporarily on your server
- **Performance**: Consider server specs for multiple concurrent streams

## 🔧 Troubleshooting

### Common Issues

**Error: "Cannot find package 'express'"**
```bash
npm install
```

**Error: "Invalid or expired token"**
- URL has expired (24h default)
- Generate a new secure URL

**Error: "No video files found"**
- Torrent contains no supported video formats
- Try a different torrent source

### Debug Mode
```bash
LOG_LEVEL=debug npm start
```

## 📚 Next Steps

1. **Customize Providers**: Edit `src/providers/simpleSearch.js` to add real torrent sources
2. **Add Authentication**: Implement user authentication for production use
3. **Scale Up**: Use Redis for caching and load balancing for multiple servers
4. **Monitor**: Add logging and monitoring for production deployment

## 💡 Example Use Cases

- **Personal Media Server**: Stream your torrents securely
- **Development**: Test torrent streaming without exposing magnet links
- **Privacy**: Keep P2P activity on your server, not client devices
- **Content Filtering**: Add server-side content filtering and access control

---

🎉 **You're all set!** Your Stremio addon now streams torrents securely without exposing magnet links to the client.