#!/bin/bash

# P2P/Torrent Connectivity Diagnostic Script
# This script helps diagnose peer discovery and DHT connectivity issues

set -e

echo "=========================================="
echo "  Self-Streme P2P Diagnostics"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check Docker Status
echo "1. Checking Docker Status..."
if command -v docker &> /dev/null; then
    check_pass "Docker is installed"
    if docker ps &> /dev/null; then
        check_pass "Docker daemon is running"
    else
        check_fail "Docker daemon is not running"
        exit 1
    fi
else
    check_fail "Docker is not installed"
    exit 1
fi
echo ""

# 2. Check Container Status
echo "2. Checking Container Status..."
if docker ps --format "{{.Names}}" | grep -q "self-streme"; then
    check_pass "self-streme container is running"
    CONTAINER_ID=$(docker ps --filter "name=self-streme" --format "{{.ID}}")
else
    check_fail "self-streme container is not running"
    echo "   Run: docker-compose up -d"
    exit 1
fi
echo ""

# 3. Check Network Mode
echo "3. Checking Network Configuration..."
NETWORK_MODE=$(docker inspect $CONTAINER_ID --format '{{.HostConfig.NetworkMode}}')
echo "   Network Mode: $NETWORK_MODE"
if [ "$NETWORK_MODE" == "host" ]; then
    check_pass "Using host network mode (good for P2P)"
else
    check_warn "Not using host network mode"
    echo "   Checking port mappings..."
    PORTS=$(docker port $CONTAINER_ID 2>/dev/null)
    if [ -z "$PORTS" ]; then
        check_fail "No ports mapped (P2P may not work)"
    else
        echo "$PORTS" | while read line; do
            echo "   → $line"
        done
    fi
fi
echo ""

# 4. Check Firewall (if ufw is available)
echo "4. Checking Firewall Rules..."
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null | grep -i "status:" | awk '{print $2}')
    if [ "$UFW_STATUS" == "active" ]; then
        check_warn "UFW firewall is active"
        echo "   Checking BitTorrent ports..."
        if sudo ufw status | grep -q "6881:6889"; then
            check_pass "BitTorrent ports (6881-6889) are allowed"
        else
            check_fail "BitTorrent ports are NOT allowed"
            echo "   Run: sudo ufw allow 6881:6889/tcp"
            echo "   Run: sudo ufw allow 6881:6889/udp"
        fi
    else
        check_pass "UFW firewall is inactive"
    fi
elif command -v iptables &> /dev/null; then
    check_warn "Using iptables (manual check needed)"
    echo "   Check with: sudo iptables -L -n | grep 688"
else
    check_pass "No firewall detected"
fi
echo ""

# 5. Check DNS Resolution for DHT Bootstrap Nodes
echo "5. Checking DHT Bootstrap Nodes..."
DHT_NODES=(
    "router.bittorrent.com"
    "router.utorrent.com"
    "dht.transmissionbt.com"
    "dht.aelitis.com"
    "dht.libtorrent.org"
)

for node in "${DHT_NODES[@]}"; do
    if nslookup "$node" &> /dev/null 2>&1 || dig "$node" &> /dev/null 2>&1 || host "$node" &> /dev/null 2>&1; then
        check_pass "Can resolve: $node"
    else
        check_fail "Cannot resolve: $node"
    fi
done
echo ""

# 6. Check Tracker Connectivity
echo "6. Checking Tracker Connectivity..."
HTTP_TRACKERS=(
    "http://tracker.opentrackr.org:1337/announce"
    "http://tracker.openbittorrent.com:80/announce"
)

for tracker in "${HTTP_TRACKERS[@]}"; do
    if curl -s -m 5 -o /dev/null -w "%{http_code}" "$tracker" | grep -q "200\|404\|405"; then
        check_pass "Can connect to: $tracker"
    else
        check_warn "Cannot connect to: $tracker"
    fi
done
echo ""

# 7. Check Container Logs for Issues
echo "7. Analyzing Container Logs..."
RECENT_LOGS=$(docker logs --tail=100 $CONTAINER_ID 2>&1)

if echo "$RECENT_LOGS" | grep -q "WebTorrent client initialized"; then
    check_pass "WebTorrent client initialized"
else
    check_warn "WebTorrent initialization not found in recent logs"
fi

if echo "$RECENT_LOGS" | grep -q "DHT bootstrap"; then
    check_pass "DHT bootstrap nodes configured"
else
    check_warn "DHT bootstrap not mentioned (may need code update)"
fi

PEER_COUNT=$(echo "$RECENT_LOGS" | grep -o "peers: [0-9]*" | tail -1 | awk '{print $2}')
if [ ! -z "$PEER_COUNT" ]; then
    if [ "$PEER_COUNT" -gt 0 ]; then
        check_pass "Found peers in logs: $PEER_COUNT"
    else
        check_fail "No peers found (peers: 0)"
    fi
fi

DHT_NODES_COUNT=$(echo "$RECENT_LOGS" | grep -o "DHT nodes: [0-9]*" | tail -1 | awk '{print $3}')
if [ ! -z "$DHT_NODES_COUNT" ]; then
    if [ "$DHT_NODES_COUNT" -gt 0 ]; then
        check_pass "Connected to DHT nodes: $DHT_NODES_COUNT"
    else
        check_fail "Not connected to DHT (DHT nodes: 0)"
    fi
fi

ERROR_COUNT=$(echo "$RECENT_LOGS" | grep -c "error\|Error\|ERROR" || true)
if [ "$ERROR_COUNT" -gt 0 ]; then
    check_warn "Found $ERROR_COUNT errors in recent logs"
    echo "   Run 'docker logs $CONTAINER_ID' to see details"
fi
echo ""

# 8. Check for VPN
echo "8. Checking for VPN..."
if ip link show | grep -q "tun\|tap"; then
    check_warn "VPN interface detected (may affect P2P)"
    echo "   If P2P doesn't work, try disabling VPN temporarily"
else
    check_pass "No VPN detected"
fi
echo ""

# 9. Test UDP Connectivity (if nc is available)
echo "9. Testing UDP Connectivity..."
if command -v nc &> /dev/null; then
    # Test if we can send UDP packets
    if timeout 2 nc -u -z router.bittorrent.com 6881 2>&1 | grep -q "succeeded\|open"; then
        check_pass "UDP connectivity appears to work"
    else
        check_warn "UDP connectivity test inconclusive"
        echo "   This is normal - UDP tests often show as 'failed' even when working"
    fi
else
    check_warn "netcat (nc) not available for UDP testing"
fi
echo ""

# 10. Summary and Recommendations
echo "=========================================="
echo "  Summary & Recommendations"
echo "=========================================="
echo ""

# Count issues
ISSUES=0

# Check critical issues
if ! docker ps --format "{{.Names}}" | grep -q "self-streme"; then
    ISSUES=$((ISSUES + 1))
fi

if [ "$DHT_NODES_COUNT" == "0" ] 2>/dev/null; then
    echo "⚠ ISSUE: DHT not connecting"
    echo "  → Check firewall rules for UDP ports 6881-6889"
    echo "  → Verify DNS can resolve DHT bootstrap nodes"
    echo "  → Check if VPN/ISP is blocking BitTorrent traffic"
    echo ""
    ISSUES=$((ISSUES + 1))
fi

if [ "$PEER_COUNT" == "0" ] 2>/dev/null; then
    echo "⚠ ISSUE: No peers found"
    echo "  → The torrent may be dead/unpopular (no seeders)"
    echo "  → Firewall may be blocking tracker connections"
    echo "  → Wait 1-2 minutes for DHT to discover peers"
    echo ""
    ISSUES=$((ISSUES + 1))
fi

if [ "$NETWORK_MODE" != "host" ] && [ -z "$PORTS" ]; then
    echo "⚠ ISSUE: No port mappings in bridge mode"
    echo "  → Add port mappings to docker-compose.yml"
    echo "  → Or switch to network_mode: host"
    echo ""
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ No major issues detected!${NC}"
    echo ""
    echo "If you're still having problems:"
    echo "  1. Wait 1-2 minutes for DHT to bootstrap"
    echo "  2. Try a well-seeded torrent to test"
    echo "  3. Check the full logs: docker-compose logs -f"
    echo "  4. See docs/TROUBLESHOOTING_P2P.md for more help"
else
    echo -e "${YELLOW}Found $ISSUES potential issue(s)${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review the issues above"
    echo "  2. See docs/TROUBLESHOOTING_P2P.md for detailed solutions"
    echo "  3. Check logs: docker-compose logs -f self-streme"
fi

echo ""
echo "=========================================="
echo "  Diagnostic Complete"
echo "=========================================="
echo ""
echo "For more help, see: docs/TROUBLESHOOTING_P2P.md"
echo "View logs: docker-compose logs -f self-streme"
echo "Test endpoint: curl http://localhost:7000/debug/torrent-status"
echo ""
