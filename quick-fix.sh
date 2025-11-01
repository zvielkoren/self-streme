#!/bin/bash

# Self-Streme Quick Fix Script
# Updates BASE_URL in .env file for production deployment

echo "=================================="
echo "🔧 Self-Streme Quick Fix"
echo "=================================="
echo ""
echo "This script will help you configure the BASE_URL"
echo "for your production deployment."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from example.env..."
    cp example.env .env
fi

echo "Current BASE_URL configuration:"
grep "^BASE_URL=" .env 2>/dev/null || echo "  Not set (will auto-detect)"
echo ""

echo "Choose your deployment type:"
echo ""
echo "1) Domain with HTTPS (Recommended)"
echo "   Example: https://addon.example.com"
echo ""
echo "2) Domain with HTTP"
echo "   Example: http://addon.example.com"
echo ""
echo "3) IP Address with HTTP"
echo "   Example: http://88.99.144.25:7000"
echo ""
echo "4) Localhost (Development only)"
echo "   Example: http://127.0.0.1:7000"
echo ""
echo "5) Auto-detect (Recommended if behind reverse proxy)"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        read -p "Enter your domain (e.g., addon.example.com): " domain
        BASE_URL="https://${domain}"
        ;;
    2)
        read -p "Enter your domain (e.g., addon.example.com): " domain
        BASE_URL="http://${domain}"
        ;;
    3)
        read -p "Enter your IP address: " ip
        read -p "Enter port (default 7000): " port
        port=${port:-7000}
        BASE_URL="http://${ip}:${port}"
        ;;
    4)
        read -p "Enter port (default 7000): " port
        port=${port:-7000}
        BASE_URL="http://127.0.0.1:${port}"
        ;;
    5)
        echo "Setting to auto-detect mode..."
        BASE_URL=""
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

if [ -z "$BASE_URL" ]; then
    # Comment out BASE_URL for auto-detect
    sed -i.bak 's|^BASE_URL=.*|#BASE_URL=http://127.0.0.1:7000  # Auto-detect enabled|g' .env
    echo ""
    echo -e "${GREEN}✓${NC} BASE_URL set to auto-detect mode"
    echo ""
    echo "The application will automatically detect your URL from request headers."
    echo "This works well with nginx, Apache, Cloudflare, and other reverse proxies."
else
    # Update BASE_URL in .env
    sed -i.bak "s|^BASE_URL=.*|BASE_URL=${BASE_URL}|g" .env
    sed -i.bak "s|^#BASE_URL=.*|BASE_URL=${BASE_URL}|g" .env
    echo ""
    echo -e "${GREEN}✓${NC} BASE_URL updated to: ${BASE_URL}"
fi

echo ""
echo "📝 Updated .env file. Backup saved as .env.bak"
echo ""

# Show the manifest URL
if [ ! -z "$BASE_URL" ]; then
    MANIFEST_URL="${BASE_URL}/manifest.json"
    STREMIO_URL=$(echo "${BASE_URL}" | sed 's|https\?://||')

    echo "Your Stremio addon URLs:"
    echo -e "${BLUE}Manifest:${NC} ${MANIFEST_URL}"
    echo -e "${BLUE}Stremio:${NC}  stremio://${STREMIO_URL}/manifest.json"
    echo ""
fi

# Ask if user wants to restart the app
echo "Do you want to restart the application now?"
read -p "(y/n): " restart

if [ "$restart" = "y" ] || [ "$restart" = "Y" ]; then
    echo ""
    echo "Checking for running processes..."

    # Check if PM2 is running the app
    if command -v pm2 &> /dev/null && pm2 list 2>/dev/null | grep -qi "self-streme"; then
        echo "Restarting with PM2..."
        pm2 restart self-streme
        echo -e "${GREEN}✓${NC} Application restarted with PM2"
    # Check if process is running on port 7000
    elif netstat -tln 2>/dev/null | grep -q ":7000 " || ss -tln 2>/dev/null | grep -q ":7000 "; then
        echo "Killing existing process on port 7000..."
        PID=$(lsof -ti:7000 2>/dev/null || fuser 7000/tcp 2>/dev/null | awk '{print $1}')
        if [ ! -z "$PID" ]; then
            kill $PID 2>/dev/null
            sleep 2
        fi
        echo "Starting application..."
        npm start &
        echo -e "${GREEN}✓${NC} Application started"
    else
        echo "Starting application..."
        npm start &
        echo -e "${GREEN}✓${NC} Application started"
    fi
else
    echo ""
    echo "Please restart the application manually:"
    echo -e "${YELLOW}npm start${NC}"
    echo ""
    echo "Or with PM2:"
    echo -e "${YELLOW}pm2 restart self-streme${NC}"
fi

echo ""
echo "=================================="
echo "Next Steps:"
echo "=================================="
echo ""
echo "1. Ensure your firewall allows the required ports"
echo "2. Configure reverse proxy if needed (see DEPLOYMENT.md)"
echo "3. Test the manifest URL in your browser"
echo "4. Add the addon to Stremio"
echo ""
echo "For detailed deployment instructions, see:"
echo "  - FIXING_MANIFEST_ACCESS.md"
echo "  - DEPLOYMENT.md"
echo ""
echo -e "${GREEN}Done!${NC} 🎉"
