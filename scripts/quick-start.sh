#!/bin/bash

# Self-Streme Quick Start Script
# One command to set everything up and run the torrent streaming service

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                        ║${NC}"
echo -e "${BLUE}║          Self-Streme Quick Start                       ║${NC}"
echo -e "${BLUE}║     Torrent Streaming Service + Stremio Addon          ║${NC}"
echo -e "${BLUE}║                                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo -e "${YELLOW}Please install Node.js 18+ from https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version is too old (found: $(node -v))${NC}"
    echo -e "${YELLOW}Please upgrade to Node.js 18+ from https://nodejs.org/${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm $(npm -v) detected${NC}"
echo ""

# Install dependencies
echo -e "${BLUE}[1/5] Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${YELLOW}→ node_modules exists, skipping install${NC}"
    echo -e "${YELLOW}  Run 'rm -rf node_modules && npm install' to reinstall${NC}"
fi
echo ""

# Create .env file if it doesn't exist
echo -e "${BLUE}[2/5] Configuring environment...${NC}"
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# Server Configuration
PORT=7000
ADDON_PORT=7001
NODE_ENV=development

# Cache Configuration
CACHE_BACKEND=memory
CACHE_MAX_DISK_MB=10000
CACHE_TTL=86400

# Torrent Configuration
TORRENT_TIMEOUT=60000
TORRENT_MAX_RETRIES=3
TORRENT_RETRY_DELAY=5000

# Optional: Redis (if using Redis backend)
# REDIS_URL=redis://localhost:6379

# Optional: API Security
# API_KEY=your-secret-api-key-here
EOF
    echo -e "${GREEN}✓ Created .env configuration file${NC}"
else
    echo -e "${YELLOW}→ .env already exists, skipping${NC}"
fi
echo ""

# Check/Display port availability
echo -e "${BLUE}[3/5] Checking ports...${NC}"
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠ Port $port is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✓ Port $port is available${NC}"
        return 0
    fi
}

check_port 7000 || echo -e "${YELLOW}  You may need to change PORT in .env${NC}"
check_port 7001 || echo -e "${YELLOW}  You may need to change ADDON_PORT in .env${NC}"
echo ""

# Display firewall info
echo -e "${BLUE}[4/5] Network configuration...${NC}"
echo -e "${YELLOW}→ For optimal BitTorrent performance, open ports:${NC}"
echo -e "  ${YELLOW}TCP/UDP 6881-6889${NC} (BitTorrent P2P)"
echo -e "  ${YELLOW}TCP 7000${NC} (Torrent API & Streaming)"
echo -e "  ${YELLOW}TCP 7001${NC} (Stremio Addon)"
echo ""
echo -e "${YELLOW}Linux firewall commands (if needed):${NC}"
echo -e "  sudo ufw allow 6881:6889/tcp"
echo -e "  sudo ufw allow 6881:6889/udp"
echo -e "  sudo ufw allow 7000/tcp"
echo -e "  sudo ufw allow 7001/tcp"
echo ""

# Create data directory
mkdir -p data/cache
echo -e "${GREEN}✓ Created data directories${NC}"
echo ""

# Start the service
echo -e "${BLUE}[5/5] Starting Self-Streme...${NC}"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Service URLs:${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Torrent Test UI:${NC}     http://localhost:7000/test-torrent-streaming"
echo -e "  ${GREEN}API Documentation:${NC}   http://localhost:7000/docs"
echo -e "  ${GREEN}Health Check:${NC}        http://localhost:7000/health"
echo -e "  ${GREEN}Stremio Addon:${NC}       http://localhost:7001/manifest.json"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Test with Big Buck Bunny (Public Domain):${NC}"
echo -e "  Magnet: ${YELLOW}magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""
echo -e "${GREEN}Starting now...${NC}"
echo ""

# Start the server
npm start
