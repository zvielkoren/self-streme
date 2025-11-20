#!/bin/bash
#
# Self-Streme Quick Setup Script for Pterodactyl Panel
# This script helps you quickly set up Self-Streme on a Pterodactyl server
# Now with optional Cloudflare Tunnel support!
#

set -e

echo "=================================================="
echo "  Self-Streme Quick Setup for Pterodactyl"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running in Pterodactyl container
if [ ! -d "/home/container" ]; then
    echo -e "${YELLOW}Warning: Not detected as Pterodactyl container${NC}"
    echo "This script is designed for Pterodactyl panel servers"
    echo "Continuing anyway..."
    CONTAINER_DIR="."
else
    CONTAINER_DIR="/home/container"
    cd "$CONTAINER_DIR"
fi

echo -e "${BLUE}Current directory: $(pwd)${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
echo -e "${BLUE}Checking Node.js version...${NC}"
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js version: $NODE_VERSION${NC}"
    
    # Extract major version
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "${RED}✗ Error: Node.js 18 or higher is required${NC}"
        echo "Current version: $NODE_VERSION"
        exit 1
    fi
else
    echo -e "${RED}✗ Error: Node.js is not installed${NC}"
    exit 1
fi

# Check npm
echo -e "${BLUE}Checking npm...${NC}"
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm version: $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ Error: npm is not installed${NC}"
    exit 1
fi

echo ""

# Ask about Cloudflare Tunnel installation
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Cloudflare Tunnel Support (Optional)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Cloudflare Tunnel allows you to expose your server to the internet"
echo "with HTTPS support without opening firewall ports or port forwarding."
echo ""
echo "Benefits:"
echo "  • Automatic HTTPS/SSL"
echo "  • No port forwarding needed"
echo "  • Protection from DDoS attacks"
echo "  • Access from anywhere"
echo ""

INSTALL_CLOUDFLARED=false
if command_exists cloudflared; then
    CLOUDFLARED_VERSION=$(cloudflared --version 2>&1 | head -1)
    echo -e "${GREEN}✓ cloudflared is already installed: $CLOUDFLARED_VERSION${NC}"
    INSTALL_CLOUDFLARED=false
else
    read -p "Do you want to install Cloudflare Tunnel support? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        INSTALL_CLOUDFLARED=true
    fi
fi

echo ""

# Function to install cloudflared for Cloudflare Tunnel support
install_cloudflared() {
    echo -e "${BLUE}Installing cloudflared for Cloudflare Tunnel support...${NC}"
    
    # Detect architecture
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            CLOUDFLARED_ARCH="amd64"
            ;;
        aarch64|arm64)
            CLOUDFLARED_ARCH="arm64"
            ;;
        armv7l|armhf)
            CLOUDFLARED_ARCH="arm"
            ;;
        *)
            echo -e "${YELLOW}⚠ Unsupported architecture: $ARCH${NC}"
            echo "Cloudflare Tunnel will not be available"
            return 1
            ;;
    esac
    
    # Download cloudflared
    CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CLOUDFLARED_ARCH}"
    
    if command_exists wget; then
        wget -q "$CLOUDFLARED_URL" -O cloudflared
    elif command_exists curl; then
        curl -sL "$CLOUDFLARED_URL" -o cloudflared
    else
        echo -e "${YELLOW}⚠ Neither wget nor curl found${NC}"
        echo "Skipping cloudflared installation"
        return 1
    fi
    
    # Verify download was successful
    if [ ! -s cloudflared ]; then
        echo -e "${RED}✗ Failed to download cloudflared${NC}"
        rm -f cloudflared
        return 1
    fi
    
    # Make it executable and move to local bin
    chmod +x cloudflared
    
    # Try to move to a directory in PATH
    if [ -w "/usr/local/bin" ]; then
        mv cloudflared /usr/local/bin/
        echo -e "${GREEN}✓ cloudflared installed to /usr/local/bin${NC}"
    elif [ -w "$HOME/.local/bin" ]; then
        mkdir -p "$HOME/.local/bin"
        mv cloudflared "$HOME/.local/bin/"
        export PATH="$HOME/.local/bin:$PATH"
        echo -e "${GREEN}✓ cloudflared installed to $HOME/.local/bin${NC}"
        echo -e "${YELLOW}⚠ Added $HOME/.local/bin to PATH for this session${NC}"
    else
        # Keep it in current directory
        export PATH=".:$PATH"
        echo -e "${GREEN}✓ cloudflared installed to current directory${NC}"
        echo -e "${YELLOW}⚠ You may need to move it to a directory in your PATH${NC}"
    fi
    
    # Verify installation
    if command_exists cloudflared; then
        CLOUDFLARED_VERSION=$(cloudflared --version 2>&1 | head -1)
        echo -e "${GREEN}✓ cloudflared version: $CLOUDFLARED_VERSION${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ cloudflared installed but not in PATH${NC}"
        return 1
    fi
}

# Install cloudflared if requested
if [ "$INSTALL_CLOUDFLARED" = true ]; then
    install_cloudflared
    CLOUDFLARED_INSTALLED=$?
else
    CLOUDFLARED_INSTALLED=1
fi

echo ""

# Check if this is already a git repository
if [ -d ".git" ]; then
    echo -e "${GREEN}✓ Git repository detected${NC}"
    echo -e "${BLUE}Updating to latest version...${NC}"
    git fetch origin
    git reset --hard origin/main
    echo -e "${GREEN}✓ Updated to latest version${NC}"
else
    # Check if directory is empty or has only this script
    FILE_COUNT=$(ls -A | wc -l)
    if [ "$FILE_COUNT" -gt 1 ]; then
        echo -e "${YELLOW}Warning: Directory is not empty${NC}"
        echo "Files found: $(ls -A | head -5)"
        read -p "Do you want to continue? This may overwrite files (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Setup cancelled."
            exit 1
        fi
    fi
    
    echo -e "${BLUE}Cloning Self-Streme repository...${NC}"
    git clone https://github.com/zvielkoren/self-streme.git temp_repo
    
    # Move files from temp_repo to current directory
    shopt -s dotglob
    mv temp_repo/* .
    rm -rf temp_repo
    
    echo -e "${GREEN}✓ Repository cloned${NC}"
fi

echo ""

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install --production
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""

# Create necessary directories
echo -e "${BLUE}Creating directories...${NC}"
mkdir -p media temp
echo -e "${GREEN}✓ Directories created${NC}"

echo ""

# Configure environment
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env file already exists${NC}"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        CREATE_ENV=true
    else
        CREATE_ENV=false
    fi
else
    CREATE_ENV=true
fi

if [ "$CREATE_ENV" = true ]; then
    echo -e "${BLUE}Configuring environment...${NC}"
    
    # Get port from environment or ask
    if [ -z "$SERVER_PORT" ]; then
        read -r -p "Enter server port [7000]: " PORT_INPUT
        SERVER_PORT=${PORT_INPUT:-7000}
    fi
    
    # Get base URL or use auto-detect
    if [ -z "$BASE_URL" ]; then
        echo ""
        echo "Enter your server's public URL (e.g., http://your-ip:7000)"
        echo "Leave empty for auto-detection:"
        read -r -p "Base URL: " BASE_URL
    fi
    
    # Ask for Cloudflare Tunnel token if cloudflared is installed
    TUNNEL_TOKEN=""
    if [ "$CLOUDFLARED_INSTALLED" = "0" ] || command_exists cloudflared; then
        echo ""
        echo -e "${BLUE}Cloudflare Tunnel Configuration${NC}"
        echo "If you have a Cloudflare Tunnel token, enter it now."
        echo "Get your token from: https://one.dash.cloudflare.com/"
        echo "Leave empty to skip (you can add it later to .env file)"
        read -r -p "Tunnel Token: " TUNNEL_TOKEN
    fi
    
    # Create .env file
    cat > .env << EOF
# Server Configuration
PORT=${SERVER_PORT}
BASE_URL=${BASE_URL}

# Media Configuration
MEDIA_PATH=./media

# Cache Configuration
CACHE_BACKEND=memory
CACHE_TTL=3600
CACHE_MAX_SIZE=1000
CACHE_MAX_DISK_MB=5000
CACHE_CLEANUP_INTERVAL=300

# Torrent Configuration
TORRENT_TIMEOUT=60000
TORRENT_MAX_RETRIES=3

# Cloudflare Tunnel (Optional)
# Get your token from: https://one.dash.cloudflare.com/
# When set, the app will automatically connect to Cloudflare Tunnel for HTTPS access
TUNNEL_TOKEN=${TUNNEL_TOKEN}

# External Services (Optional)
# JACKETT_URL=http://localhost:9117
# JACKETT_API_KEY=your_api_key_here
# OMDB_API_KEY=your_omdb_api_key
EOF
    
    echo -e "${GREEN}✓ .env file created${NC}"
fi

echo ""
echo "=================================================="
echo -e "${GREEN}  Setup Complete! 🎉${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}Your Self-Streme server is ready to start!${NC}"
echo ""
echo "Configuration:"
echo "  Port: ${SERVER_PORT}"
echo "  Base URL: ${BASE_URL:-Auto-detect}"

# Show Cloudflare Tunnel status
if [ "$CLOUDFLARED_INSTALLED" = "0" ] || command_exists cloudflared; then
    if [ -n "$TUNNEL_TOKEN" ]; then
        echo -e "  ${GREEN}Cloudflare Tunnel: Enabled ✓${NC}"
    else
        echo -e "  ${YELLOW}Cloudflare Tunnel: Installed (no token configured)${NC}"
    fi
fi

echo ""
echo "Next steps:"
echo "  1. Start your server in Pterodactyl console"
if [ -n "$TUNNEL_TOKEN" ]; then
    echo "  2. Wait for tunnel to connect (check logs for tunnel URL)"
    echo "  3. Access addon via Cloudflare Tunnel URL"
else
    echo "  2. Access addon at: http://YOUR_IP:${SERVER_PORT}/manifest.json"
    echo "  3. Test magnet converter: http://YOUR_IP:${SERVER_PORT}/test-magnet-converter"
fi
echo ""
echo "To start manually:"
echo "  npm start"
echo ""

# Add Cloudflare Tunnel specific instructions
if [ "$CLOUDFLARED_INSTALLED" = "0" ] || command_exists cloudflared; then
    echo -e "${BLUE}Cloudflare Tunnel Notes:${NC}"
    echo "  • Get your tunnel token: https://one.dash.cloudflare.com/"
    echo "  • Add token to .env: TUNNEL_TOKEN=your_token_here"
    echo "  • Restart server after adding token"
    echo "  • The tunnel provides automatic HTTPS access"
    echo "  • No port forwarding or firewall changes needed"
    echo "  • Check logs for your tunnel's public URL"
    echo ""
fi

echo "For more information, see:"
echo "  docs/PTERODACTYL_DEPLOYMENT.md"
echo "  docs/DEPLOYMENT.md"
echo "  docs/QUICK_START_CLOUDFLARE.md"
echo "  README.md"
echo ""
echo "=================================================="
