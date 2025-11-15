# Magnet Link to Stream URL Converter

Convert any torrent magnet link to streamable HTTP URLs - **works on ANY server** without P2P requirements!

## 🌟 What Makes This Special

Unlike traditional torrent streaming that requires:
- ❌ Open firewall ports
- ❌ P2P connectivity
- ❌ Available seeders/peers
- ❌ Complex network configuration

This converter:
- ✅ Works on ANY server (Docker, VPS, Pterodactyl, shared hosting)
- ✅ No firewall configuration needed
- ✅ Uses external proxy services
- ✅ Multiple fallback options
- ✅ Enhanced magnet links with 12+ trackers
- ✅ Instant conversion - no waiting

## 🚀 Quick Start

### Web Interface

Visit: `http://your-server:7000/test-magnet-converter`

1. Paste your magnet link
2. Click "Convert to Stream URL"
3. Get multiple streaming options
4. Copy and use in any video player or Stremio

### API Usage

#### GET Request
```bash
curl "http://your-server:7000/stream/magnet?magnet=magnet:?xt=urn:btih:HASH"
```

#### POST Request
```bash
curl -X POST http://your-server:7000/stream/magnet \
  -H "Content-Type: application/json" \
  -d '{
    "magnet": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"
  }'
```

## 📊 Response Format

```json
{
  "success": true,
  "magnet": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
  "infoHash": "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
  "enhancedMagnet": "magnet:?xt=urn:btih:...&tr=...&tr=...",
  "streamUrls": {
    "external": [
      {
        "name": "TorrentDrive",
        "url": "https://www.torrentdrive.com/stream/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
        "type": "stream",
        "priority": 1
      },
      {
        "name": "BTDigg",
        "url": "https://btcache.me/torrent/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
        "type": "proxy",
        "priority": 2
      },
      {
        "name": "WebTorrent",
        "url": "https://instant.io/#dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
        "type": "redirect",
        "priority": 3
      }
    ],
    "local": {
      "name": "Self-Streme Local Proxy",
      "url": "http://localhost:7000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
      "type": "local_proxy",
      "priority": 10,
      "note": "Requires P2P connectivity and peers"
    },
    "cache": null
  },
  "recommended": "https://www.torrentdrive.com/stream/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
  "message": "Multiple streaming options available. External services work on any server without P2P.",
  "usage": {
    "external": "Use external URLs - work on any server, no P2P required",
    "local": "Use local proxy - requires P2P connectivity",
    "stremio": "Copy any URL to use in Stremio or video players"
  }
}
```

## 🎯 Understanding the Response

### External Services (Recommended)
These work on **ANY server** without P2P:
- **TorrentDrive**: Direct streaming service
- **BTDigg**: Torrent cache proxy
- **WebTorrent**: Browser-based streaming

### Local Proxy
- Requires P2P connectivity (open ports, seeders)
- Falls back if external services fail
- Good if you have proper network setup

### Enhanced Magnet
- Original magnet + 12 additional public trackers
- Better peer discovery
- Use in any torrent client

## 💡 Use Cases

### 1. Docker/Container Environments
Containers often can't open ports for P2P - use external services!
```bash
curl "http://localhost:7000/stream/magnet?magnet=YOUR_MAGNET"
# Use the "external" URLs from response
```

### 2. Behind Firewall/NAT
Corporate networks, restricted VPS - no problem!
```javascript
// In your app
const response = await fetch('/stream/magnet?magnet=' + encodeURIComponent(magnetLink));
const data = await response.json();
// Use data.streamUrls.external[0].url
```

### 3. Pterodactyl Panel
Game server panels often restrict P2P - external services to the rescue!
```bash
# Just install and use - works out of the box
```

### 4. Stremio Integration
```javascript
// In a Stremio addon
{
  "url": data.recommended,
  "name": "Via External Service",
  "title": "Stream anywhere"
}
```

## 🔧 Technical Details

### How It Works

1. **Extract InfoHash**: Parse the magnet link to get the torrent hash
2. **Enhance Magnet**: Add 12+ public trackers for better connectivity
3. **Generate URLs**: Create streaming URLs using:
   - TorrentDrive (direct streaming)
   - BTCache (torrent proxy)
   - Instant.io (WebTorrent)
   - Local proxy (if P2P available)
4. **Check Cache**: Try to find .torrent file in public caches
5. **Return Options**: Provide all available streaming methods

### External Services Used

| Service | Type | Works Without P2P | Notes |
|---------|------|-------------------|-------|
| TorrentDrive | Stream | ✅ Yes | Direct HTTP streaming |
| BTCache | Proxy | ✅ Yes | Torrent cache/proxy |
| Instant.io | WebTorrent | ✅ Yes | Browser-based |
| Local Proxy | P2P | ❌ No | Requires open ports |

### Enhanced Trackers

The service adds these public trackers:
```
udp://tracker.opentrackr.org:1337/announce
udp://open.demonii.com:1337/announce
udp://tracker.openbittorrent.com:6969/announce
udp://exodus.desync.com:6969/announce
udp://tracker.torrent.eu.org:451/announce
udp://tracker.moeking.me:6969/announce
udp://explodie.org:6969/announce
udp://tracker1.bt.moack.co.kr:80/announce
udp://tracker.theoks.net:6969/announce
udp://open.stealth.si:80/announce
https://tracker.tamersunion.org:443/announce
https://tracker.gbitt.info:443/announce
```

## 🎨 Integration Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

async function convertMagnet(magnetLink) {
  const response = await axios.get('http://localhost:7000/stream/magnet', {
    params: { magnet: magnetLink }
  });
  
  if (response.data.success) {
    console.log('Recommended URL:', response.data.recommended);
    console.log('All options:', response.data.streamUrls);
    return response.data.recommended;
  }
  throw new Error('Conversion failed');
}

// Usage
const streamUrl = await convertMagnet('magnet:?xt=urn:btih:...');
```

### Python
```python
import requests

def convert_magnet(magnet_link):
    response = requests.get(
        'http://localhost:7000/stream/magnet',
        params={'magnet': magnet_link}
    )
    data = response.json()
    
    if data['success']:
        print(f"Recommended: {data['recommended']}")
        return data['streamUrls']
    raise Exception('Conversion failed')

# Usage
stream_urls = convert_magnet('magnet:?xt=urn:btih:...')
```

### cURL One-Liner
```bash
# Get recommended URL
curl -s "http://localhost:7000/stream/magnet?magnet=MAGNET_LINK" | jq -r '.recommended'

# Get all external services
curl -s "http://localhost:7000/stream/magnet?magnet=MAGNET_LINK" | jq '.streamUrls.external'
```

## 🚨 Troubleshooting

### "Invalid magnet link" Error
**Cause**: Magnet doesn't start with `magnet:` or has invalid format

**Solution**:
```bash
# Ensure proper format
magnet:?xt=urn:btih:HASH&dn=Name&tr=tracker
```

### "Could not extract infoHash" Error
**Cause**: Magnet link doesn't contain a valid BitTorrent hash

**Solution**:
- Check that hash is 40 characters (hex) or 32 characters (base32)
- Ensure `xt=urn:btih:` is present

### External Services Not Working
**Cause**: External services may be down or blocked

**Solution**:
- Try different services from the response
- Use the enhanced magnet link in a torrent client
- Fall back to local proxy if P2P is available

### No Streaming Options Available
**Cause**: Torrent may be very new or obscure

**Solution**:
1. Use the enhanced magnet link in a torrent client first
2. Wait for the torrent to be indexed
3. Try again after some time

## 📚 Related Documentation

- [Pterodactyl Deployment](PTERODACTYL_DEPLOYMENT.md) - Deploy on Pterodactyl Panel
- [Docker Deployment](DOCKER.md) - Docker setup guide
- [Main README](../README.md) - General documentation
- [Troubleshooting](TROUBLESHOOTING_P2P.md) - P2P issues

## 🔗 API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/stream/magnet` | GET | Convert magnet (query param) |
| `/stream/magnet` | POST | Convert magnet (JSON body) |
| `/test-magnet-converter` | GET | Web UI for testing |
| `/stream/proxy/:infoHash` | GET | Local P2P streaming |

## 🎉 Benefits Summary

- ✅ **Universal Compatibility**: Works everywhere
- ✅ **No Configuration**: Just paste and convert
- ✅ **Multiple Options**: Several fallbacks
- ✅ **Enhanced Reliability**: Extra trackers added
- ✅ **Instant Results**: No waiting for peers
- ✅ **User Friendly**: Simple web interface
- ✅ **API First**: Easy integration
- ✅ **Open Source**: Free to use and modify

## 📝 License

This feature is part of Self-Streme and follows the same license terms.
