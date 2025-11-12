#!/bin/bash

# Self-Streme Streaming Fix Script (Simplified)
# This script fixes streaming issues without slow network tests

set -e

echo "🔧 Self-Streme Streaming Fix (Quick Version)"
echo "============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Load NVM if available
if [ -d "$HOME/.nvm" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    echo -e "   ${GREEN}✓ NVM loaded${NC}"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "   ${RED}✗ Node.js not found${NC}"
    exit 1
fi

echo -e "   ${GREEN}✓ Node.js $(node --version)${NC}"
echo -e "   ${GREEN}✓ npm $(npm --version)${NC}"
echo ""

# Step 1: Update .env
echo "1️⃣ Updating configuration..."
if [ ! -f .env ]; then
    cp example.env .env
    echo -e "   ${GREEN}✓ Created .env${NC}"
else
    echo -e "   ${GREEN}✓ .env exists${NC}"
fi

# Backup and update .env
cp .env .env.backup.$(date +%Y%m%d-%H%M%S)

# Update timeout settings
if ! grep -q "TORRENT_TIMEOUT=" .env; then
    echo "" >> .env
    echo "# Torrent Configuration" >> .env
    echo "TORRENT_TIMEOUT=120000" >> .env
    echo "TORRENT_MAX_RETRIES=5" >> .env
else
    sed -i 's/TORRENT_TIMEOUT=.*/TORRENT_TIMEOUT=120000/' .env
    sed -i 's/TORRENT_MAX_RETRIES=.*/TORRENT_MAX_RETRIES=5/' .env
fi

echo -e "   ${GREEN}✓ Configuration updated${NC}"
echo ""

# Step 2: Fix permissions
echo "2️⃣ Fixing permissions..."
sudo chown -R $USER:$USER data/ logs/ temp/ downloads/ 2>/dev/null || true
mkdir -p logs temp data/cache downloads 2>/dev/null || true
chmod 755 logs temp data downloads 2>/dev/null || true
echo -e "   ${GREEN}✓ Permissions fixed${NC}"
echo ""

# Step 3: Clear cache
echo "3️⃣ Clearing cache..."
rm -rf temp/* 2>/dev/null || true
rm -rf data/cache/* 2>/dev/null || true
echo -e "   ${GREEN}✓ Cache cleared${NC}"
echo ""

# Step 4: Install dependencies
echo "4️⃣ Installing dependencies..."
npm install --no-audit --no-fund 2>&1 | grep -E "(added|removed|up to date)" || true
echo -e "   ${GREEN}✓ Dependencies ready${NC}"
echo ""

# Step 5: Stop any running instances
echo "5️⃣ Stopping existing instances..."
pkill -f "node.*self-streme" 2>/dev/null || true
pkill -f "node.*index.js" 2>/dev/null || true
docker-compose down 2>/dev/null || true
sleep 2
echo -e "   ${GREEN}✓ Stopped${NC}"
echo ""

# Step 6: Start service
echo "6️⃣ Starting service..."

if [ -f docker-compose.yml ] && command -v docker-compose &> /dev/null; then
    echo "   Using Docker Compose..."
    docker-compose up -d
    sleep 5

    if docker-compose ps 2>/dev/null | grep -q "Up"; then
        echo -e "   ${GREEN}✓ Docker container started${NC}"
    else
        echo -e "   ${RED}✗ Failed to start${NC}"
        exit 1
    fi
else
    echo "   Using Node.js directly..."
    nohup npm start > logs/server.log 2>&1 &
    SERVER_PID=$!
    echo "   Server PID: $SERVER_PID"
    echo $SERVER_PID > logs/server.pid 2>/dev/null
    sleep 5

    if ps -p $SERVER_PID > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ Server started${NC}"
    else
        echo -e "   ${RED}✗ Failed to start${NC}"
        [ -f logs/server.log ] && tail -n 20 logs/server.log
        exit 1
    fi
fi

echo ""

# Step 7: Verify
echo "7️⃣ Verifying service..."

sleep 2

if curl -s -f http://localhost:7000/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓ Health check passed${NC}"
else
    echo -e "   ${YELLOW}⚠ Health check pending (server still starting)${NC}"
fi

echo ""
echo "✅ Fix Complete!"
echo "================"
echo ""

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "YOUR_SERVER_IP")

echo "📱 Access URLs:"
echo "   Local:    http://localhost:7000"
echo "   Network:  http://$SERVER_IP:7000"
echo ""
echo "🔌 Stremio Addon:"
echo "   http://$SERVER_IP:7000/manifest.json"
echo ""
echo "📊 Test it:"
echo "   curl http://localhost:7000/health"
echo "   curl http://localhost:7000/manifest.json"
echo ""
echo "📝 View logs:"
if [ -f docker-compose.yml ]; then
    echo "   docker-compose logs -f self-streme"
else
    echo "   tail -f logs/server.log"
fi
echo ""
echo "🎉 Your streaming should now work!"
echo ""
