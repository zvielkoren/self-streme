# Project Structure

Complete directory and file organization for Self-Streme.

## Overview

Self-Streme is organized into clear, logical directories for easy navigation and maintenance. All scripts, tests, deployment files, and documentation are properly organized.

## Root Directory Structure

```
self-streme/
├── src/                    # Source code
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── docker/                 # Docker configurations
├── deployment/             # Platform deployment files
├── test/                   # Test files
├── logs/                   # Application logs
├── data/                   # Application data
├── downloads/              # Cached downloads
├── temp/                   # Temporary files
├── .devcontainer/          # VS Code dev container
├── .github/                # GitHub workflows
├── node_modules/           # Dependencies (ignored)
│
├── .dockerignore           # Docker ignore rules
├── .gitignore              # Git ignore rules
├── CHANGELOG.md            # Version history
├── docker-compose.yml      # Main Docker Compose
├── Dockerfile              # Docker image definition
├── example.env             # Environment template
├── LICENSE                 # Project license
├── package.json            # Node.js dependencies
├── package-lock.json       # Dependency lock file
├── PROJECT_STRUCTURE.md    # This file
├── README.md               # Main documentation
├── SUMMARY-HE.md           # Hebrew summary
└── UPDATES.md              # Recent updates
```

## Directory Details

### `/src` - Source Code

Main application code organized by functionality.

```
src/
├── api/                    # API route handlers
│   ├── torrentApi.js       # Torrent endpoints
│   └── streamingApi.js     # Streaming endpoints
│
├── config/                 # Configuration
│   └── index.js            # Main config
│
├── core/                   # Core services
│   ├── streamService.js    # Stream management
│   └── torrentService.js   # Torrent handling
│
├── providers/              # External providers
│   └── [provider files]    # Provider integrations
│
├── services/               # Business logic services
│   ├── external/           # External service integrations
│   ├── fallbackProvider.js             # Fallback logic
│   ├── globalProvider.js               # Global provider
│   ├── hybridStreamService.js          # Hybrid streaming ⭐
│   ├── hybridStreamService.fixed.js    # Fixed version
│   ├── magnetToHttpService.js          # Magnet conversion
│   ├── proxyService.js                 # Proxy handling
│   ├── requestDeduplicator.js          # Request dedup
│   ├── scalableCacheManager.js         # Cache management
│   ├── streamHandler.js                # Stream handling
│   ├── streamHandler.new.js            # New handler
│   ├── subtitleService.js              # Subtitle support
│   ├── torrentDownloadSources.js       # Dynamic sources ⭐
│   ├── torrentService.js               # Torrent service
│   └── torrentService.new.js           # New service
│
├── static/                 # Static assets
│   └── [static files]      # HTML, CSS, images
│
├── utils/                  # Utility functions
│   ├── logger.js           # Logging utility
│   └── urlHelper.js        # URL utilities
│
├── addon.js                # Stremio addon core
├── addon.new.js            # New addon version
├── addon.rewrite.js        # Rewritten addon
├── index.js                # Main entry point ⭐
├── index.new.js            # New index
├── index.rewrite.js        # Rewritten index
├── manifest.js             # Stremio manifest
└── server.js               # Express server
```

**Key Files:**
- ⭐ `index.js` - Application entry point
- ⭐ `hybridStreamService.js` - Handles P2P + HTTP fallback
- ⭐ `torrentDownloadSources.js` - 12 dynamic download sources

### `/docs` - Documentation

All project documentation organized by topic.

```
docs/
├── docker/                 # Docker-specific docs
│   └── [docker docs]       # Docker guides
│
├── ANIME-SUPPORT.md        # Anime streaming features
├── CACHE-ONLY-MODE.md      # Offline mode
├── DEPLOYMENT.md           # Deployment guide
├── DIRECT-STREAMING.md     # P2P streaming
├── DOCKER.md               # Docker quick start
├── DYNAMIC_SOURCES.md      # Multi-source system ⭐
├── FEATURES.md             # Feature list
├── HEBREW-SUBTITLES.md     # Hebrew support
├── HYBRID_HTTP_DOWNLOAD.md # HTTP fallback
├── MAGNET_CONVERTER.md     # Magnet conversion
├── NO-P2P-STREAMING.md     # HTTP-only mode
├── PTERODACTYL_DEPLOYMENT.md # Panel deployment
├── QUICK_START.md          # Quick start guide
├── QUICK_START_CLOUDFLARE.md # Cloudflare tunnel
├── README.md               # Documentation index ⭐
├── SOURCE_SELECTION.md     # Source selection
├── STARTUP_GUIDE.md        # Detailed startup
├── STREAMING-FLOW.md       # How streaming works
├── TESTING_QUICK_START.md  # Testing guide
├── TLS_AUTO_DETECTION.md   # HTTPS setup
└── TROUBLESHOOTING_P2P.md  # Troubleshooting
```

**Key Docs:**
- ⭐ `README.md` - Documentation hub
- ⭐ `DYNAMIC_SOURCES.md` - Multi-source streaming system
- ⭐ `QUICK_START.md` - Getting started

### `/scripts` - Utility Scripts

Bash scripts for setup, maintenance, and deployment.

```
scripts/
├── apply-p2p-fixes.sh      # Legacy P2P fixes
├── diagnose-p2p.sh         # P2P diagnostics
├── diagnose-torrent.sh     # Torrent diagnostics
├── fix-streaming.sh        # Streaming fixes
├── fix-streaming-simple.sh # Quick fixes
├── pterodactyl-setup.sh    # Pterodactyl setup
├── quick-fix.sh            # Common fixes
├── quick-start.bat         # Windows quick start
├── quick-start.sh          # Linux/Mac quick start
├── start.sh                # Production startup
├── test-tunnel.sh          # Tunnel testing
└── README.md               # Scripts documentation ⭐
```

**Usage:**
```bash
chmod +x scripts/*.sh
./scripts/quick-start.sh
```

### `/docker` - Docker Files

Docker Compose configurations for different scenarios.

```
docker/
├── docker-compose.dev.yml   # Development override
├── docker-compose.ports.yml # Custom ports
└── README.md                # Docker documentation ⭐
```

**Main Docker file:**
- `../docker-compose.yml` (in root)

**Usage:**
```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.yml -f docker/docker-compose.dev.yml up

# Custom ports
docker-compose -f docker-compose.yml -f docker/docker-compose.ports.yml up
```

### `/deployment` - Deployment Configs

Platform-specific deployment configurations.

```
deployment/
├── pterodactyl-egg.json    # Pterodactyl Panel egg
├── render.yaml             # Render.com config
└── README.md               # Deployment guide ⭐
```

**Platforms:**
- Pterodactyl Panel
- Render.com
- Docker (see /docker)
- Custom VPS

### `/test` - Test Files

Test utilities and test server implementations.

```
test/
├── start-torrent-server.js # Torrent test server
├── testServer.js           # General test server
└── README.md               # Testing guide ⭐
```

**Usage:**
```bash
# Run test server
node test/testServer.js

# Run torrent test
node test/start-torrent-server.js
```

### `/logs` - Application Logs

Runtime logs (created automatically, git-ignored).

```
logs/
├── combined.log            # All logs
├── error.log               # Error logs only
└── [date].log              # Daily logs
```

### `/data` - Application Data

Persistent data storage (git-ignored).

```
data/
├── cache.db                # SQLite cache
└── [runtime data]          # Other data files
```

### `/downloads` - Cached Downloads

Downloaded torrent files (git-ignored).

```
downloads/
└── [cached files]          # Video files
```

### `/temp` - Temporary Files

Temporary processing files (git-ignored).

```
temp/
├── downloads/              # In-progress downloads
└── [temp files]            # Processing files
```

## Configuration Files

### Environment Configuration

- `example.env` - Environment template
- `.env` - Your configuration (create from example, git-ignored)

**Key Variables:**
```bash
NODE_ENV=production
PORT=11470
ENABLE_HTTP_FALLBACK=true
P2P_TIMEOUT=20000
TUNNEL_TOKEN=your_token
```

### Package Configuration

- `package.json` - Node.js dependencies and scripts
- `package-lock.json` - Dependency lock file

**Key Scripts:**
```bash
npm start          # Start production
npm run dev        # Development mode
npm test           # Run tests
```

### Docker Configuration

- `Dockerfile` - Docker image build instructions
- `docker-compose.yml` - Main orchestration
- `.dockerignore` - Files to exclude from image

### Git Configuration

- `.gitignore` - Files to exclude from Git
  - `/node_modules/`
  - `/logs/`
  - `/data/`
  - `/downloads/`
  - `/temp/`
  - `.env`

## Key Features by Location

### Dynamic Sources System
**Files:**
- `src/services/torrentDownloadSources.js` - Source definitions
- `src/services/hybridStreamService.js` - Integration
- `src/index.js` - API endpoints

**Docs:**
- `docs/DYNAMIC_SOURCES.md`

### P2P Streaming
**Files:**
- `src/core/torrentService.js` - P2P logic
- `src/services/torrentService.js` - Service wrapper

**Docs:**
- `docs/DIRECT-STREAMING.md`
- `docs/TROUBLESHOOTING_P2P.md`

### HTTP Fallback
**Files:**
- `src/services/hybridStreamService.js` - Fallback logic
- `src/services/torrentDownloadSources.js` - Source management

**Docs:**
- `docs/HYBRID_HTTP_DOWNLOAD.md`

### Cache System
**Files:**
- `src/services/scalableCacheManager.js` - Cache management
- `src/config/index.js` - Cache configuration

**Docs:**
- `docs/CACHE-ONLY-MODE.md`

## File Naming Conventions

### Source Files
- **Lowercase with camelCase**: `torrentService.js`
- **Purpose-based naming**: `hybridStreamService.js`
- **Version suffixes**: `addon.new.js`, `addon.rewrite.js`

### Documentation
- **UPPERCASE**: `README.md`, `CHANGELOG.md`
- **Descriptive names**: `DYNAMIC_SOURCES.md`
- **Hyphen-separated**: `HYBRID_HTTP_DOWNLOAD.md`

### Scripts
- **Lowercase with hyphens**: `quick-start.sh`
- **Action-based**: `fix-streaming.sh`
- **Platform suffix**: `.sh` (bash), `.bat` (Windows)

### Configuration
- **Lowercase with dots**: `docker-compose.yml`
- **Purpose-based**: `docker-compose.dev.yml`
- **Hidden files**: `.env`, `.gitignore`

## Development Workflow

### 1. Initial Setup
```bash
# Clone repository
git clone https://github.com/your-username/self-streme.git
cd self-streme

# Install dependencies
npm install

# Create environment
cp example.env .env

# Start development
npm run dev
```

### 2. Making Changes
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes in src/

# Test changes
npm test
node test/testServer.js

# Commit changes
git add .
git commit -m "Add new feature"
```

### 3. Documentation
```bash
# Update relevant docs in docs/
# Update CHANGELOG.md
# Update this file if structure changes
```

### 4. Deployment
```bash
# Production deployment
docker-compose up -d

# Or use platform-specific method
# See deployment/README.md
```

## Important Paths

### Frequently Accessed
- `src/index.js` - Main entry point
- `src/services/torrentDownloadSources.js` - Source configuration
- `src/services/hybridStreamService.js` - Streaming logic
- `docs/README.md` - Documentation hub
- `.env` - Configuration (create from example.env)

### Configuration
- `package.json` - Dependencies and scripts
- `docker-compose.yml` - Docker orchestration
- `example.env` - Environment template
- `.gitignore` - Git exclusions

### Documentation
- `README.md` - Project overview
- `CHANGELOG.md` - Version history
- `docs/DYNAMIC_SOURCES.md` - Multi-source guide
- `docs/QUICK_START.md` - Getting started

### Utilities
- `scripts/quick-start.sh` - Quick setup
- `scripts/fix-streaming.sh` - Troubleshooting
- `test/testServer.js` - Testing

## Version Control

### Tracked Files
- All source code (`src/`)
- Documentation (`docs/`)
- Scripts (`scripts/`)
- Configuration templates (`example.env`)
- Docker files
- Package files

### Ignored Files
- `node_modules/` - Dependencies
- `logs/` - Runtime logs
- `data/` - Application data
- `downloads/` - Cached files
- `temp/` - Temporary files
- `.env` - Environment configuration
- `*.log` - Log files

## Migration Notes

### From Old Structure
Previously scattered files now organized:
- Scripts → `scripts/`
- Deployment configs → `deployment/`
- Test files → `test/`
- Docker overrides → `docker/`
- Redundant docs → removed

### Language Consistency
All files in English except:
- `SUMMARY-HE.md` - Hebrew summary (explicit language marker)

## Best Practices

### Adding New Files

1. **Source Code** → `src/[category]/filename.js`
2. **Documentation** → `docs/FILENAME.md`
3. **Scripts** → `scripts/action-name.sh`
4. **Tests** → `test/feature.test.js`
5. **Config** → Root or appropriate subdirectory

### Naming
- Use descriptive names
- Follow existing conventions
- Add README.md to new directories
- Update this file for structural changes

### Documentation
- Every directory has README.md
- Update CHANGELOG.md for changes
- Keep docs/ synchronized with code
- Cross-reference related docs

## Quick Reference

### Start Application
```bash
npm start                    # Production
npm run dev                  # Development
docker-compose up -d         # Docker
./scripts/quick-start.sh     # Quick start
```

### Testing
```bash
npm test                     # Run tests
node test/testServer.js      # Test server
./scripts/diagnose-p2p.sh    # Diagnose P2P
```

### Documentation
```bash
cat README.md                # Main readme
cat docs/README.md           # Doc index
cat docs/DYNAMIC_SOURCES.md  # Sources guide
cat PROJECT_STRUCTURE.md     # This file
```

### Logs
```bash
tail -f logs/combined.log    # All logs
tail -f logs/error.log       # Errors only
docker-compose logs -f       # Docker logs
```

## See Also

- [README.md](README.md) - Main documentation
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [docs/README.md](docs/README.md) - Documentation index
- [docs/DYNAMIC_SOURCES.md](docs/DYNAMIC_SOURCES.md) - Multi-source system
- [scripts/README.md](scripts/README.md) - Script documentation
- [docker/README.md](docker/README.md) - Docker guide
- [deployment/README.md](deployment/README.md) - Deployment guide
- [test/README.md](test/README.md) - Testing guide

---

**Last Updated:** 2024
**Version:** 2.0
**Status:** ✅ Complete and Organized

**Quick Navigation:**
[Setup](#development-workflow) | [Structure](#root-directory-structure) | [Docs](docs/README.md) | [Testing](test/README.md)