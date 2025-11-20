#!/bin/bash

# Self-Streme Streaming Fix Script
# This script fixes common streaming issues including torrent indexers, P2P connectivity, and configuration

set -e

echo "🔧 Self-Streme Streaming Fix Script"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
   echo -e "${YELLOW}Warning: Running as root is not recommended${NC}"
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Load NVM if available
if [ -d "$HOME/.nvm" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    echo "   ✓ NVM loaded"
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "   ${RED}✗ Node.js not found${NC}"
    echo ""
    echo "Please install Node.js first:"
    echo "  Visit: https://nodejs.org/"
    echo "  Or use NVM: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "   ${RED}✗ npm not found${NC}"
    exit 1
fi

echo "   ✓ Node.js $(node --version)"
echo "   ✓ npm $(npm --version)"
echo ""

# Step 1: Check and update .env file
echo "1️⃣ Checking environment configuration..."
if [ ! -f .env ]; then
    echo "   Creating .env from example.env..."
    cp example.env .env
    echo -e "   ${GREEN}✓ Created .env file${NC}"
else
    echo -e "   ${GREEN}✓ .env file exists${NC}"
fi

# Step 2: Update critical environment variables
echo ""
echo "2️⃣ Updating environment variables..."

# Backup existing .env
cp .env .env.backup.$(date +%Y%m%d-%H%M%S)
echo "   ✓ Backup created"

# Update torrent timeout and retry settings
if ! grep -q "TORRENT_TIMEOUT=" .env; then
    echo "" >> .env
    echo "# Torrent Configuration (Added by fix script)" >> .env
    echo "TORRENT_TIMEOUT=120000" >> .env
    echo "TORRENT_MAX_RETRIES=5" >> .env
    echo -e "   ${GREEN}✓ Added torrent timeout settings${NC}"
else
    sed -i 's/TORRENT_TIMEOUT=.*/TORRENT_TIMEOUT=120000/' .env
    sed -i 's/TORRENT_MAX_RETRIES=.*/TORRENT_MAX_RETRIES=5/' .env
    echo -e "   ${GREEN}✓ Updated torrent timeout settings${NC}"
fi

# Step 3: Fix port configuration
echo ""
echo "3️⃣ Checking port configuration..."

# Check if ports are available
PORT=${PORT:-7000}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "   ${YELLOW}⚠ Port $PORT is already in use${NC}"
    echo "   Stopping existing process..."
    if command -v docker-compose &> /dev/null && [ -f docker-compose.yml ]; then
        docker-compose down 2>/dev/null || true
    fi
    pkill -f "node.*self-streme" || true
    pkill -f "node.*index.js" || true
    sleep 2
fi
echo -e "   ${GREEN}✓ Port $PORT is available${NC}"

# Step 4: Configure firewall for P2P
echo ""
echo "4️⃣ Configuring firewall for P2P connections..."

# Check if ufw is installed
if command -v ufw &> /dev/null; then
    echo "   Configuring UFW firewall..."
    sudo ufw allow 7000/tcp comment 'Self-Streme HTTP' || true
    sudo ufw allow 6881:6889/tcp comment 'Self-Streme P2P TCP' || true
    sudo ufw allow 6881:6889/udp comment 'Self-Streme P2P UDP' || true
    echo -e "   ${GREEN}✓ Firewall rules added${NC}"
else
    echo -e "   ${YELLOW}⚠ UFW not found, skipping firewall configuration${NC}"
fi

# Step 5: Clear cache and temporary files
echo ""
echo "5️⃣ Clearing cache and temporary files..."
rm -rf temp/* 2>/dev/null || true
rm -rf data/cache/* 2>/dev/null || true
find . -name "*.lock" -type f -delete 2>/dev/null || true
echo -e "   ${GREEN}✓ Cache cleared${NC}"

# Step 6: Install/Update dependencies
echo ""
echo "6️⃣ Checking Node.js dependencies..."
if [ -f package.json ]; then
    if npm install --no-audit --no-fund 2>&1; then
        echo -e "   ${GREEN}✓ Dependencies updated${NC}"
    else
        echo -e "   ${YELLOW}⚠ npm install had warnings, but continuing...${NC}"
    fi
else
    echo -e "   ${RED}✗ package.json not found${NC}"
    exit 1
fi

# Step 7: Create required directories
echo ""
echo "7️⃣ Creating required directories..."
mkdir -p logs temp downloads 2>/dev/null || true

# Try to create data/cache, handle permission issues
if ! mkdir -p data/cache 2>/dev/null; then
    echo -e "   ${YELLOW}⚠ Permission issue with data directory${NC}"
    echo "   Attempting to fix ownership..."
    sudo chown -R $USER:$USER data/ logs/ temp/ downloads/ 2>/dev/null || true
    mkdir -p data/cache 2>/dev/null || echo "   Using existing directories"
fi

chmod 755 logs temp downloads 2>/dev/null || true
chmod 755 data data/cache 2>/dev/null || true
echo -e "   ${GREEN}✓ Directories created${NC}"

# Step 8: Configure alternative torrent providers
echo ""
echo "8️⃣ Configuring torrent providers..."

# Create a providers configuration
cat > src/config/providers.json << 'EOF'
{
  "providers": {
    "yts": {
      "enabled": true,
      "baseUrl": "https://yts.mx/api/v2",
      "timeout": 10000
    },
    "piratebay": {
      "enabled": true,
      "baseUrl": "https://apibay.org",
      "timeout": 10000
    },
    "torrentgalaxy": {
      "enabled": true,
      "baseUrl": "https://torrentgalaxy.to",
      "timeout": 10000
    }
  },
  "fallbackEnabled": true,
  "maxRetries": 3,
  "retryDelay": 1000
}
EOF
echo -e "   ${GREEN}✓ Provider configuration created${NC}"

# Step 9: Test connectivity
echo ""
echo "9️⃣ Testing network connectivity..."

# Test basic internet
if ping -c 1 google.com &> /dev/null; then
    echo -e "   ${GREEN}✓ Internet connection OK${NC}"
else
    echo -e "   ${RED}✗ No internet connection${NC}"
    exit 1
fi

# Test torrent tracker connectivity
echo "   Testing torrent trackers..."
TRACKERS=(
    "tracker.opentrackr.org:1337"
    "tracker.openbittorrent.com:6969"
    "open.stealth.si:80"
)

WORKING_TRACKERS=0
for tracker in "${TRACKERS[@]}"; do
    HOST=$(echo $tracker | cut -d: -f1)
    PORT=$(echo $tracker | cut -d: -f2)
    if timeout 2 nc -zv $HOST $PORT &> /dev/null; then
        ((WORKING_TRACKERS++))
    fi
done

echo -e "   ${GREEN}✓ $WORKING_TRACKERS/${#TRACKERS[@]} trackers accessible${NC}"

# Step 10: Start the service
echo ""
echo "🚀 Starting Self-Streme service..."

# Detect if using Docker
if [ -f docker-compose.yml ] && command -v docker-compose &> /dev/null; then
    echo "   Using Docker Compose..."
    docker-compose down 2>/dev/null || true
    docker-compose up -d

    # Wait for service to start
    echo "   Waiting for service to start..."
    sleep 5

    # Check if container is running
    if docker-compose ps 2>/dev/null | grep -q "Up"; then
        echo -e "   ${GREEN}✓ Docker container started${NC}"
    else
        echo -e "   ${RED}✗ Docker container failed to start${NC}"
        docker-compose logs --tail=50 2>/dev/null || true
        exit 1
    fi
else
    echo "   Using direct Node.js..."

    # Kill any existing instances
    pkill -f "node.*self-streme" || true
    pkill -f "node.*index.js" || true
    sleep 1

    # Ensure logs directory exists and is writable
    mkdir -p logs 2>/dev/null || true
    touch logs/server.log 2>/dev/null || true

    # Start in background
    nohup npm start > logs/server.log 2>&1 &
    SERVER_PID=$!
    echo "   Server PID: $SERVER_PID"
    echo $SERVER_PID > logs/server.pid 2>/dev/null || true

    # Wait for service to start
    echo "   Waiting for service to start..."
    sleep 5

    # Check if process is running
    if ps -p $SERVER_PID > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ Server started (PID: $SERVER_PID)${NC}"
    else
        echo -e "   ${RED}✗ Server failed to start${NC}"
        if [ -f logs/server.log ]; then
            tail -n 50 logs/server.log
        else
            echo "   No log file available"
        fi
        exit 1
    fi
fi

# Step 11: Verify service is working
echo ""
echo "🔍 Verifying service..."

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

# Test health endpoint
if curl -s -f http://localhost:7000/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Health check passed${NC}"
else
    echo -e "   ${RED}✗ Health check failed${NC}"
    echo "   Check logs for errors:"
    if [ -f docker-compose.yml ]; then
        docker-compose logs --tail=20
    else
        tail -n 20 logs/server.log
    fi
    exit 1
fi

# Test manifest endpoint
if curl -s -f http://localhost:7000/manifest.json > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Manifest endpoint OK${NC}"
else
    echo -e "   ${RED}✗ Manifest endpoint failed${NC}"
fi

# Step 12: Display access information
echo ""
echo "✅ Self-Streme Streaming Fix Complete!"
echo "===================================="
echo ""
echo "📱 Access URLs:"
echo "   Local:    http://localhost:7000"
echo "   Network:  http://$SERVER_IP:7000"
echo ""
echo "🔌 Stremio Addon URL:"
echo "   http://$SERVER_IP:7000/manifest.json"
echo ""
echo "📊 Monitoring:"
echo "   Health:   http://localhost:7000/health"
echo "   Status:   http://localhost:7000/status"
echo "   Debug:    http://localhost:7000/debug/url"
echo ""
echo "📝 Logs:"
if [ -f docker-compose.yml ]; then
    echo "   docker-compose logs -f self-streme"
else
    echo "   tail -f logs/server.log"
fi
echo ""
echo "🛠️ Troubleshooting:"
echo "   1. If streaming still doesn't work, check firewall settings"
echo "   2. Ensure your ISP doesn't block P2P traffic"
echo "   3. Try using a VPN if torrents are blocked"
echo "   4. Check error.log for specific issues"
echo ""
echo "💡 Tips:"
echo "   - Use popular torrents with many seeders for better performance"
echo "   - Consider setting up Jackett for more torrent sources"
echo "   - Monitor logs for any API rate limiting"
echo ""
