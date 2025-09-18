<div align="center">

# 🎬 Self-Streme

**A Powerful Self-Hosted Streaming Server with Stremio Integration**

**License:** [Private](LICENSE) | **Node.js:** ≥18.0.0 | **Platform:** [Stremio](https://www.stremio.com/)

*Transform your media library into a professional streaming platform*

</div>

---

## 🌟 Overview

Self-Streme is a sophisticated Stremio addon that seamlessly bridges your local media collection with the Stremio ecosystem. Experience your personal content library with the polish and convenience of professional streaming services.

## ✨ Features

### 🎥 **Media Streaming**
- **Local Library Support** - Stream movies, TV series, and other video content
- **Multiple Quality Options** - Automatic quality detection (1080p, 720p, 480p)
- **Format Compatibility** - Support for MP4, MKV, AVI, WebM, MOV, FLV
- **Subtitle Integration** - SRT, VTT, ASS, SSA subtitle support

### 🌐 **Advanced Capabilities**
- **Torrent Streaming** - Direct torrent-to-stream functionality
- **iOS Optimization** - Enhanced compatibility for iOS devices
- **Proxy-Aware URLs** - Seamless operation behind proxies and load balancers
- **Jackett Integration** - Extended torrent source discovery

### 🛡️ **Enterprise Ready**
- **Private Repository** - Secure personal media collection
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

# External Services (Optional)
JACKETT_URL=http://localhost:9117    # Jackett server URL
JACKETT_API_KEY=your_api_key_here    # Jackett API key
```

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
├── temp/               # Temporary files
├── src/
│   ├── config/         # Configuration files
│   ├── core/           # Core services
│   └── utils/          # Utility functions
└── .env                # Environment variables (optional)
```

## 🎯 Usage Guide

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
- Ensure stable network connection for best performance

### Getting Help

1. Check server logs for error messages
2. Verify configuration in `src/config/index.js`
3. Ensure all dependencies are properly installed

## 🛠️ Development

### Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with auto-reload
```

### API Endpoints

- `GET /` - Installation page
- `GET /manifest.json` - Stremio addon manifest
- `GET /stream/{type}/{id}` - Stream endpoints
- `GET /health` - Health check
- `GET /status` - Server status

## 🔐 Security Considerations

- **Private Use Only** - This software is intended for personal media libraries
- **Network Security** - Consider firewall rules for external access
- **Content Rights** - Ensure you have rights to stream all content
- **Regular Updates** - Keep dependencies updated for security

## 📋 System Requirements

- **Operating System**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **Memory**: 512MB RAM minimum, 1GB recommended
- **Storage**: 100MB for application, additional space for media cache
- **Network**: Stable internet connection for torrent features

## 📄 License

**Private License** - All rights reserved

This software is provided for personal use only. Redistribution, modification, or commercial use is strictly prohibited without explicit permission.

---

<div align="center">

**Made with ❤️ for the Stremio Community**

*Experience your media library like never before*

</div>
