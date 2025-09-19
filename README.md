<div align="center">

# 🎬 Self-Streme

**A Powerful Self-Hosted Streaming Server with Stremio Integration**

**License:** [Private](LICENSE) | **Node.js:** [≥18.0.0](https://nodejs.org/) | **Platform:** [Stremio](https://www.stremio.com/)

*Transform your media library into a professional streaming platform*

</div>

---

## 🌟 Overview

Self-Streme is a sophisticated Stremio addon that seamlessly bridges your local media collection with the Stremio ecosystem. Experience your personal content library with the polish and convenience of professional streaming services.

## ✨ Features

### 🎥 **Media Streaming**
- **Local Library Support** - Stream movies, TV series, and other video content
- **Source Selection** - Choose from multiple streaming sources with quality options
- **Multiple Quality Options** - Automatic quality detection (1080p, 720p, 480p)
- **Format Compatibility** - Support for MP4, MKV, AVI, WebM, MOV, FLV
- **Subtitle Integration** - SRT, VTT, ASS, SSA subtitle support
- **Range Request Support** - Efficient video seeking and partial content delivery

### 🚀 **Advanced Streaming Capabilities**
- **Hash-Based Caching** - Intelligent file caching with automatic cleanup
- **Enhanced Torrent Streaming** - Direct torrent-to-stream with 60s timeout, progressive backoff, and DHT support
- **Reliable Connectivity** - 12 high-quality trackers, NAT traversal, and local service discovery
- **Smart Retry Logic** - 3 retry attempts with exponential backoff for improved reliability
- **Direct URL Streaming** - Seamless redirection to external streaming sources
- **iOS Optimization** - Enhanced compatibility for iOS devices
- **Proxy-Aware URLs** - Seamless operation behind proxies and load balancers

### 🗂️ **Scalable Cache Architecture**
- **Multi-Backend Support** - Memory, SQLite, and Redis backends
- **Smart Resource Limits** - Configurable cache size and disk usage limits
- **Intelligent Eviction** - LRU-based cleanup when limits are reached
- **Persistent Storage** - Optional cache persistence across server restarts
- **Real-time Monitoring** - Live cache status and performance metrics

### 🌐 **Enterprise Features**
- **Torrent Streaming** - Direct torrent-to-stream functionality
- **Jackett Integration** - Extended torrent source discovery
- **Environment Configuration** - Flexible deployment options
- **Professional Logging** - Comprehensive activity monitoring
- **Cross-Platform** - Windows, macOS, Linux support

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18.0.0 or higher
- **npm** package manager
- **Stremio** application

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/zvielkoren/self-streme.git
   cd self-streme
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Create environment file (optional)
   cp example.env .env
   
   # Create media directories
   mkdir -p media temp
   ```

4. **Launch the Server**
   ```bash
   npm start
   ```

5. **Connect to Stremio**
   - Open Stremio application
   - Navigate to **Addons** → **Community Addons**
   - Click **"Install from URL"**
   - Enter: `http://127.0.0.1:7001/manifest.json`
   - Click **Install**

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=7000                    # Main server port
ADDON_PORT=7001             # Stremio addon port
BASE_URL=http://127.0.0.1:7000  # Server base URL

# Media Configuration
MEDIA_PATH=./media          # Local media library path

# Scalable Cache Configuration
CACHE_BACKEND=memory        # Cache backend: memory, sqlite, redis
CACHE_TTL=3600             # Cache TTL in seconds (default: 1 hour)
CACHE_MAX_SIZE=1000        # Maximum number of cached files
CACHE_MAX_DISK_MB=5000     # Maximum disk usage in MB
CACHE_CLEANUP_INTERVAL=300 # Cleanup interval in seconds
CACHE_PERSISTENT=false     # Enable persistent cache storage

# External Services (Optional)
JACKETT_URL=http://localhost:9117    # Jackett server URL
JACKETT_API_KEY=your_api_key_here    # Jackett API key
OMDB_API_KEY=your_omdb_api_key      # OMDB API key for metadata

# Torrent Configuration
TORRENT_TIMEOUT=60000            # Torrent connection timeout in ms (default: 60s)
TORRENT_MAX_RETRIES=3            # Maximum retry attempts for failed torrents
```

### Scaling Configuration

The application supports different deployment scenarios:

| Deployment | Backend | Cache Size | Disk Limit | Best For |
|------------|---------|------------|------------|----------|
| **Development** | `memory` | 100 files | 1GB | Local testing |
| **Small Production** | `sqlite` | 1000 files | 5GB | Personal servers |
| **Large Production** | `redis` | 10000 files | 50GB | Enterprise deployment |

### Configuration Options

Edit `src/config/index.js` for advanced settings:

| Option | Default | Description |
|--------|---------|-------------|
| `server.port` | `7000` | Main streaming server port |
| `server.addonPort` | `7001` | Stremio addon server port |
| `media.libraryPath` | `"./media"` | Local media directory |
| `media.tempPath` | `"./temp"` | Temporary files directory |
| `media.supportedVideoFormats` | Various | Supported video file types |
| `media.supportedSubtitleFormats` | Various | Supported subtitle file types |

## 📁 Directory Structure

```
self-streme/
├── media/              # Your media files go here
│   ├── movies/
│   └── series/
├── temp/               # Temporary files and cache
├── src/
│   ├── config/         # Configuration files
│   ├── core/           # Core services (streaming, torrents)
│   ├── services/       # Scalable cache manager and handlers
│   └── utils/          # Utility functions
├── .env                # Environment variables (optional)
└── SOURCE_SELECTION.md # Documentation for source selection features
```

## 🎯 Usage Guide

### Source Selection Streaming

The enhanced streaming system allows you to select from multiple sources for each piece of content:

1. **Browse Content** in Stremio as usual
2. **Multiple Sources** will appear for popular content
3. **Select Your Preferred Source** based on quality and availability
4. **Automatic Caching** ensures faster subsequent access

#### Source Selection API

Access sources directly via REST API:

```bash
# Get available sources for a movie
GET /stream/movie/tt0111161

# Play a specific source by index
GET /play/movie/tt0111161/0    # First source
GET /play/movie/tt0111161/1    # Second source

# Series with season/episode
GET /play/series/tt0903747/0/1/1  # First source, S1E1
```

### Cache Management

Monitor and manage the scalable cache system:

```bash
# Check cache status
GET /api/cache-config

# Get detailed scaling information
GET /api/cache-stats

# Force cleanup
POST /api/cache-config
Content-Type: application/json
{"forceCleanup": true}
```

### Adding Media Content

1. **Organize Your Files**
   ```
   media/
   ├── movies/
   │   ├── The Matrix (1999).mp4
   │   └── Inception (2010).mkv
   └── series/
       └── Breaking Bad/
           ├── Season 1/
           └── Season 2/
   ```

2. **Subtitle Support**
   - Place subtitle files alongside video files
   - Use matching filenames: `movie.mp4` + `movie.srt`

3. **Access via Stremio**
   - Search for content in Stremio
   - Look for "Self-Streme" sources
   - Select preferred quality and enjoy!

### Testing Interface

Visit `http://localhost:7000/test-source-selection` for a comprehensive test interface that demonstrates:
- Source selection with multiple quality options
- Real-time cache status monitoring
- Scaling backend information
- Performance metrics and limits

## 🔧 Troubleshooting

### Common Issues

**Connection Problems**
- Ensure ports 7000 and 7001 are not blocked by firewall
- Check if another service is using these ports
- Verify Stremio can access `http://127.0.0.1:7001/manifest.json`

**Media Not Appearing**
- Confirm files are in supported formats
- Check file permissions in media directory
- Restart the server after adding new content

**iOS Streaming Issues**
- The server automatically optimizes streams for iOS devices
- Source selection provides iOS-specific stream URLs
- Ensure stable network connection for best performance

**Cache Performance**
- Monitor cache usage via `/api/cache-stats`
- Adjust cache limits in environment variables
- Use Redis backend for high-load scenarios
- Enable persistent cache for faster restarts

**Source Selection Issues**
- Sources timeout after 30 seconds for faster feedback
- Try different source indices if one fails
- Check cache status for disk space availability
- Use test interface for troubleshooting: `/test-source-selection`

### Getting Help

1. Check server logs for error messages
2. Verify configuration in `src/config/index.js`
3. Ensure all dependencies are properly installed

## 🛠️ Development

### Performance Features

Self-Streme includes several performance optimizations:

- **⚡ Faster Results**: 30-second timeout (reduced from 2 minutes)
- **📅 Smart Scheduling**: Configurable cache cleanup intervals  
- **🗂️ Scalable Cache**: Multiple backend support (Memory/SQLite/Redis)
- **📊 Resource Limits**: Intelligent disk usage and file count management
- **🔄 Persistent Storage**: Optional cache persistence across restarts

### Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with auto-reload
```

### Environment Examples

```bash
# Development Environment
CACHE_BACKEND=memory
CACHE_MAX_SIZE=100
CACHE_MAX_DISK_MB=1000

# Production Environment  
CACHE_BACKEND=redis
CACHE_MAX_SIZE=10000
CACHE_MAX_DISK_MB=50000
CACHE_PERSISTENT=true
```

### API Endpoints

#### Core Endpoints
- `GET /` - Installation page
- `GET /manifest.json` - Stremio addon manifest
- `GET /health` - Health check
- `GET /status` - Server status

#### Streaming Endpoints
- `GET /stream/{type}/{id}` - Get available sources for content
- `GET /stream/{type}/{id}.json` - iOS-optimized source listing
- `GET /play/{type}/{id}/{fileIdx}` - Play specific source by index
- `GET /play/{type}/{id}/{fileIdx}/{season}/{episode}` - Series episodes

#### Cache Management
- `GET /api/cache-config` - Cache configuration and status
- `GET /api/cache-stats` - Detailed scaling information
- `POST /api/cache-config` - Force cache cleanup

#### Testing
- `GET /test-source-selection` - Interactive source selection demo

## 🔐 Security Considerations

- **Private Use Only** - This software is intended for personal media libraries
- **Network Security** - Consider firewall rules for external access
- **Content Rights** - Ensure you have rights to stream all content
- **Regular Updates** - Keep dependencies updated for security

## 📋 System Requirements

### Minimum Requirements
- **Operating System**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **Memory**: 512MB RAM minimum, 1GB recommended
- **Storage**: 100MB for application, additional space for media cache
- **Network**: Stable internet connection for torrent features

### Recommended for Production
- **Memory**: 2GB+ RAM for optimal cache performance
- **Storage**: SSD with 10GB+ free space for cache
- **Network**: High-bandwidth connection for multiple concurrent streams
- **Database**: Redis server for distributed caching (large deployments)

### Scaling Considerations
- **Development**: Memory backend, 1GB cache limit
- **Small Production**: SQLite backend, 5GB cache limit
- **Large Production**: Redis backend, 50GB+ cache limit with multiple instances

## 📄 License

**Private License** - All rights reserved

This software is provided for personal use only. Redistribution, modification, or commercial use is strictly prohibited without explicit permission.

---

<div align="center">

**Made with ❤️ for the Stremio Community**

*Experience your media library like never before*

</div>
