# Stremio Addon with Secure Torrent Streaming

This project implements a **complete Stremio addon + server solution for secure magnet streaming**. The architecture ensures that magnet links are never exposed directly to Stremio, instead providing temporary signed URLs for secure content access.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│     Stremio     │◄──►│  Stremio Addon   │◄──►│ Streaming Server│
│     Client      │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                           │
                              ▼                           ▼
                       ┌──────────────┐            ┌─────────────┐
                       │ Stream URLs  │            │ WebTorrent  │
                       │ (signed)     │            │ Client      │
                       └──────────────┘            └─────────────┘
```

### Key Components:

1. **Stremio Addon** - Provides stream discovery without exposing magnet links
2. **Secure Streaming Server** - Handles torrents and generates signed URLs
3. **Signed URL System** - Temporary access tokens with 24-hour validity
4. **Range Request Support** - Proper video seeking/streaming for Stremio

## 🔒 Security Features

- **No Direct Magnet Exposure**: Magnet links never reach Stremio client
- **Signed URLs**: Cryptographically signed access tokens
- **Time-Limited Access**: URLs expire after 24 hours (configurable)
- **Server-Side Torrenting**: All P2P activity isolated to server
- **Bandwidth Control**: Configurable upload/download limits

## 📁 File Structure

```
src/
├── core/
│   ├── secureStreamingServer.js    # Main torrent handling & URL signing
│   ├── secureStreamService.js      # Stream service with security
│   └── streamService.js            # Original stream service (legacy)
├── providers/
│   ├── simpleSearch.js             # Demo search provider
│   └── index.js                    # Full provider system (optional)
├── addon.js                        # Stremio addon implementation
├── index.js                        # Main server with endpoints
├── manifest.js                     # Stremio addon manifest
└── config/index.js                 # Configuration settings
```

## 🚀 Installation & Setup

### Prerequisites

- Node.js 16+ 
- npm or yarn
- Sufficient disk space for torrent caching

### Step 1: Install Dependencies

```bash
git clone <your-repo>
cd self-streme
npm install
```

### Step 2: Environment Configuration

Create `.env` file (optional - defaults work for local development):

```bash
# Server Configuration
PORT=7000
BASE_URL=http://127.0.0.1:7000

# Security
STREAM_SECRET_KEY=your-secret-key-here

# Torrent Settings (optional)
TORRENT_MAX_CONNECTIONS=100
TORRENT_DOWNLOAD_LIMIT=0
TORRENT_UPLOAD_LIMIT=0
```

### Step 3: Start the Server

```bash
npm start
```

The server will start on `http://127.0.0.1:7000`

### Step 4: Add to Stremio

1. Open Stremio Desktop/Web
2. Go to **Add-ons** section
3. Click **Community Add-ons**
4. Enter URL: `http://127.0.0.1:7000/manifest.json`
5. Click **Install**

## 📡 API Endpoints

### Stremio Addon Endpoints

- `GET /manifest.json` - Addon manifest for Stremio
- `GET /stream/{type}/{imdbId}` - Get streams for content
- `GET /meta/{type}/{imdbId}` - Get metadata for content

### Streaming Endpoints

- `GET /secure-stream/{token}` - Stream content via signed URL
- `POST /api/generate-secure-url` - Generate signed URL (testing)
- `GET /api/stats` - Server statistics

### Health & Status

- `GET /health` - Health check
- `GET /status` - Detailed server status

## 💻 Code Examples

### 1. Generating Signed URLs

```javascript
import SecureStreamingServer from './src/core/secureStreamingServer.js';

const server = new SecureStreamingServer();

// Generate secure URL for a magnet link
const magnetLink = 'magnet:?xt=urn:btih:...';
const secureUrl = await server.generateSignedUrl(magnetLink, 0, 24);

console.log('Secure URL:', secureUrl.url);
console.log('Expires:', secureUrl.expiresAt);
```

### 2. Custom Stream Provider

```javascript
// src/providers/customProvider.js
class CustomProvider {
    async search(imdbId, type, season, episode) {
        // Your torrent search logic here
        return [
            {
                title: 'Movie Title 1080p',
                quality: '1080p', 
                size: 2147483648,
                seeders: 100,
                magnet: 'magnet:?xt=urn:btih:...',
                source: 'CustomProvider'
            }
        ];
    }
}

export default new CustomProvider();
```

### 3. Using the Secure Stream Service

```javascript
import secureStreamService from './src/core/secureStreamService.js';

// Get secure streams for a movie
const streams = await secureStreamService.getStreams('movie', 'tt1234567');

// Each stream will have a secure URL instead of magnet link
streams.forEach(stream => {
    console.log(`${stream.title}: ${stream.url}`);
    console.log(`Expires: ${stream.expiresAt}`);
});
```

## 🔧 Configuration Options

### Torrent Settings

```javascript
// src/config/index.js
torrent: {
    maxConnections: 100,        // Max peer connections
    downloadLimit: 0,           // KB/s, 0 = unlimited  
    uploadLimit: 0,             // KB/s, 0 = unlimited
    cleanupInterval: 3600000,   // Cleanup inactive torrents (ms)
}
```

### Security Settings

```javascript
// Signing key for URLs (auto-generated if not provided)
STREAM_SECRET_KEY=your-256-bit-key

// URL validity period (hours)
const validityHours = 24;
```

## 🗺️ Magnet Hash to File Mapping

The system automatically handles file mapping within torrents:

```javascript
// When generating signed URLs
const secureUrl = await server.generateSignedUrl(
    magnetLink,
    fileIndex,    // Which file in the torrent (0 = first video file)
    validityHours
);

// The system filters for video files automatically
const videoFiles = torrent.files.filter(file => 
    ['.mp4', '.mkv', '.avi', '.mov', '.m4v', '.webm'].includes(
        file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    )
);
```

## 🔐 Temporary Signed URLs Implementation

### URL Structure

```
https://your-server.com/secure-stream/{base64_payload}.{signature}
```

### Payload Format

```javascript
{
    "infoHash": "torrent_info_hash", 
    "fileIndex": 0,
    "expiresAt": 1640995200000
}
```

### Signature Verification

```javascript
const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
```

## 🌐 Production Deployment

### Environment Variables

```bash
NODE_ENV=production
PORT=80
BASE_URL=https://your-domain.com
STREAM_SECRET_KEY=your-production-secret-key
```

### Docker Setup

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
EXPOSE 7000

CMD ["npm", "start"]
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:7000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Range $http_range;
    }
}
```

## ⚠️ Important Considerations

### Bandwidth & Storage

- **Download Bandwidth**: Torrents will consume download bandwidth
- **Upload Bandwidth**: Seeding consumes upload bandwidth (can be limited)
- **Storage**: Torrent files cached locally (auto-cleanup after inactivity)
- **Memory**: WebTorrent keeps active torrents in memory

### Security Considerations

- **Secret Key**: Use a strong, randomly generated secret key in production
- **HTTPS**: Always use HTTPS in production for signed URL security
- **Access Control**: Consider adding IP restrictions or user authentication
- **Legal Compliance**: Ensure compliance with local laws regarding P2P content

### Performance Optimization

```javascript
// Recommended production settings
torrent: {
    maxConnections: 50,         // Reduce for better performance
    downloadLimit: 5120,        // 5MB/s download limit
    uploadLimit: 1024,          // 1MB/s upload limit
    cleanupInterval: 1800000,   // 30 minutes cleanup
}
```

### Caching Strategy

- **Stream Cache**: 1 hour TTL for stream lists
- **Torrent Cache**: Keep active torrents for 30 minutes after last access
- **URL Cache**: Signed URLs valid for 24 hours (configurable)

### Error Handling

The system includes comprehensive error handling:

- **Invalid Tokens**: Returns 403 Forbidden
- **Expired URLs**: Automatic cleanup and 403 response
- **Torrent Errors**: Graceful fallback and error logging
- **Network Issues**: Retry logic and timeout handling

## 🧪 Testing

### Test Signed URL Generation

```bash
curl -X POST http://localhost:7000/api/generate-secure-url \
  -H "Content-Type: application/json" \
  -d '{"magnetLink": "magnet:?xt=urn:btih:your-hash-here"}'
```

### Test Streaming

```bash
curl -I http://localhost:7000/secure-stream/{your-token-here}
```

### Check Server Stats

```bash
curl http://localhost:7000/api/stats
```

## 🔧 Troubleshooting

### Common Issues

1. **"No video files found"**: Torrent contains no supported video formats
2. **"Invalid or expired token"**: URL has expired or signature is invalid
3. **"Timeout adding torrent"**: Torrent has no active peers or is invalid
4. **High memory usage**: Too many active torrents, reduce cleanup interval

### Debug Mode

```bash
LOG_LEVEL=debug npm start
```

### Logs Location

Logs are output to console by default. For production, consider log aggregation:

```javascript
import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});
```

## 📋 License & Legal

- Ensure compliance with local laws regarding P2P content sharing
- Consider implementing content filtering mechanisms
- Use responsibly and respect content creators' rights
- This is for educational/personal use - adapt as needed for your use case

---

**Note**: This implementation provides a complete foundation for secure torrent streaming in Stremio. Customize the search providers and add additional security measures as needed for your specific deployment requirements.