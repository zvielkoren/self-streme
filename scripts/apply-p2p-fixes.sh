#!/bin/bash

# Apply P2P/DHT Fixes - Rebuild Script
# This script rebuilds the container to apply DHT bootstrap fixes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo -e "${BLUE}  Self-Streme P2P Fixes - Rebuild${NC}"
echo "=========================================="
echo ""

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}This script will:${NC}"
echo "  1. Stop the current container"
echo "  2. Rebuild with DHT bootstrap fixes"
echo "  3. Start the container"
echo "  4. Monitor logs for DHT status"
echo ""
echo -e "${YELLOW}Changes include:${NC}"
echo "  • DHT bootstrap nodes (router.bittorrent.com, etc.)"
echo "  • Enhanced DHT status logging"
echo "  • New debug endpoint: /debug/torrent-status"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${BLUE}Step 1: Stopping container...${NC}"
docker compose down
echo -e "${GREEN}✓ Container stopped${NC}"
echo ""

echo -e "${BLUE}Step 2: Rebuilding with no cache...${NC}"
echo "(This may take a few minutes)"
docker compose build --no-cache
echo -e "${GREEN}✓ Container rebuilt${NC}"
echo ""

echo -e "${BLUE}Step 3: Starting container...${NC}"
docker compose up -d
echo -e "${GREEN}✓ Container started${NC}"
echo ""

echo -e "${BLUE}Step 4: Waiting for startup (10 seconds)...${NC}"
sleep 10
echo ""

echo -e "${BLUE}Step 5: Checking DHT status...${NC}"
echo ""

# Check if curl is available
if command -v curl &> /dev/null; then
    echo "Querying debug endpoint..."
    if curl -s http://localhost:7000/debug/torrent-status > /dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}Debug endpoint is responding!${NC}"
        echo ""
        echo "DHT Status:"
        curl -s http://localhost:7000/debug/torrent-status | grep -A 5 '"dht"' || echo "  (check manually)"
        echo ""
    else
        echo -e "${YELLOW}⚠ Debug endpoint not responding yet (may need more time)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ curl not available, skipping endpoint check${NC}"
fi

echo ""
echo -e "${BLUE}Recent logs:${NC}"
docker compose logs --tail=20 | grep -E "WebTorrent|DHT|bootstrap|initialized" || echo "  (no DHT messages yet)"
echo ""

echo "=========================================="
echo -e "${GREEN}  Rebuild Complete!${NC}"
echo "=========================================="
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Wait 60-90 seconds for DHT to bootstrap"
echo ""
echo "2. Check DHT status:"
echo -e "   ${BLUE}curl http://localhost:7000/debug/torrent-status${NC}"
echo ""
echo "3. Monitor logs for DHT nodes:"
echo -e "   ${BLUE}docker compose logs -f | grep -E 'DHT|peers'${NC}"
echo ""
echo "4. Run full diagnostics:"
echo -e "   ${BLUE}./scripts/diagnose-p2p.sh${NC}"
echo ""
echo "5. Watch for these SUCCESS indicators:"
echo -e "   ${GREEN}✓${NC} DHT: enabled/ready, DHT nodes: 156"
echo -e "   ${GREEN}✓${NC} Peer connected, total peers: 5"
echo -e "   ${GREEN}✓${NC} WebTorrent client initialized with DHT bootstrap nodes"
echo ""
echo -e "${YELLOW}If still having issues:${NC}"
echo "  • Check firewall: sudo ufw allow 6881:6889/udp"
echo "  • See: docs/TROUBLESHOOTING_P2P.md"
echo "  • See: P2P-QUICK-FIX.md"
echo ""
echo "=========================================="
echo ""

# Optionally tail logs
read -p "Watch live logs now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Watching logs... (Press Ctrl+C to stop)${NC}"
    echo ""
    sleep 2
    docker compose logs -f
fi
