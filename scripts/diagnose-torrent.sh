#!/bin/bash

# Torrent Connectivity Diagnostic Script
# This script helps diagnose why torrents might not be connecting

echo "🔍 Self-Streme Torrent Connectivity Diagnostic"
echo "=============================================="
echo ""

# Check if server is running
echo "1️⃣  Checking if server is running..."
if curl -s http://localhost:7000/health > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running on port 7000"
    echo "   Run: npm start"
    exit 1
fi
echo ""

# Check DHT status
echo "2️⃣  Checking DHT and torrent status..."
TORRENT_STATUS=$(curl -s http://localhost:7000/debug/torrent-status 2>/dev/null)
if [ -n "$TORRENT_STATUS" ]; then
    echo "✅ Torrent service is responding"
    echo "$TORRENT_STATUS" | head -20
else
    echo "⚠️  Could not get torrent status"
fi
echo ""

# Check firewall for common torrent ports
echo "3️⃣  Checking firewall for BitTorrent ports..."
if command -v ufw &> /dev/null; then
    echo "   Checking UFW firewall..."
    if sudo ufw status 2>/dev/null | grep -q "6881:6889"; then
        echo "✅ BitTorrent ports (6881-6889) appear to be allowed"
    else
        echo "⚠️  BitTorrent ports may be blocked"
        echo "   To fix: sudo ufw allow 6881:6889/tcp && sudo ufw allow 6881:6889/udp"
    fi
elif command -v firewall-cmd &> /dev/null; then
    echo "   Checking firewalld..."
    if sudo firewall-cmd --list-ports 2>/dev/null | grep -q "6881-6889"; then
        echo "✅ BitTorrent ports (6881-6889) appear to be allowed"
    else
        echo "⚠️  BitTorrent ports may be blocked"
        echo "   To fix: sudo firewall-cmd --permanent --add-port=6881-6889/tcp"
        echo "           sudo firewall-cmd --permanent --add-port=6881-6889/udp"
        echo "           sudo firewall-cmd --reload"
    fi
else
    echo "⚠️  No known firewall detected (this is ok if not using a firewall)"
fi
echo ""

# Check if running in Docker
echo "4️⃣  Checking environment..."
if [ -f /.dockerenv ]; then
    echo "🐳 Running in Docker"
    echo "   Make sure docker-compose.yml has the correct port mappings"
    echo "   Ports 6881-6889 should be mapped for torrent connectivity"
else
    echo "💻 Running natively (not in Docker)"
fi
echo ""

# Check temp directory
echo "5️⃣  Checking temp directory..."
if [ -d "./temp" ]; then
    TEMP_SIZE=$(du -sh ./temp 2>/dev/null | cut -f1)
    FILE_COUNT=$(find ./temp -type f 2>/dev/null | wc -l)
    echo "✅ Temp directory exists"
    echo "   Size: $TEMP_SIZE"
    echo "   Files: $FILE_COUNT"
else
    echo "⚠️  Temp directory does not exist"
    echo "   Creating it now..."
    mkdir -p ./temp
    echo "✅ Created ./temp directory"
fi
echo ""

# Check network connectivity to DHT bootstrap nodes
echo "6️⃣  Checking connectivity to DHT bootstrap nodes..."
DHT_NODES=(
    "router.bittorrent.com:6881"
    "router.utorrent.com:6881"
    "dht.transmissionbt.com:6881"
)

for node in "${DHT_NODES[@]}"; do
    HOST=$(echo $node | cut -d: -f1)
    PORT=$(echo $node | cut -d: -f2)
    
    if timeout 2 bash -c "cat < /dev/null > /dev/udp/$HOST/$PORT" 2>/dev/null; then
        echo "✅ Can reach $node"
    else
        echo "⚠️  Cannot reach $node (this may be normal - UDP may not respond)"
    fi
done
echo ""

# Summary
echo "📊 Summary"
echo "=========="
echo "If you're experiencing torrent issues:"
echo ""
echo "1. ✅ Make sure the server is running"
echo "2. ✅ Check that firewall allows ports 6881-6889 (UDP and TCP)"
echo "3. ✅ Verify DHT has nodes connected (check server logs)"
echo "4. ⚠️  If torrents timeout with 0 peers after 60s, the torrent may be dead"
echo "5. 💡 Try a different torrent source - some torrents have no seeders"
echo ""
echo "For more details, check the server logs:"
echo "  docker-compose logs -f (if using Docker)"
echo "  or check the console output if running natively"
echo ""
echo "New in this version:"
echo "  • Torrents with 0 peers now fail fast (60s instead of 8+ minutes)"
echo "  • Better error messages when torrents are dead"
echo "  • No wasted retries on dead torrents"
echo ""
