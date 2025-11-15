# Deploying Self-Streme on Pterodactyl Panel

This guide will help you deploy Self-Streme on a Pterodactyl panel server.

## 📋 Prerequisites

- Pterodactyl Panel access (admin or user with server creation permissions)
- Node.js egg installed on your panel (or use the custom egg provided)
- Minimum 512MB RAM (1GB+ recommended)
- At least 2GB disk space (more if caching torrents)

## 🚀 Quick Installation

### Method 1: Using the Self-Streme Egg (Recommended)

1. **Import the Egg**
   - Download `pterodactyl-egg.json` from this repository
   - In Pterodactyl Admin Panel, go to **Nests** → **Import Egg**
   - Select the downloaded JSON file
   - Choose or create a nest (e.g., "Streaming Servers")

2. **Create a New Server**
   - Go to **Servers** → **Create New**
   - Select the "Self-Streme" egg
   - Configure the following:
     - **Server Port**: 7000 (or any available port)
     - **Base URL**: Your server's public URL (e.g., `http://your-ip:7000`)
     - Leave other settings as default

3. **Start the Server**
   - Click **Start** on your server console
   - Wait for the message: "Server running on port 7000"
   - Your addon will be available at: `http://YOUR_IP:PORT/manifest.json`

### Method 2: Manual Installation with Generic Node.js Egg

If you can't import the custom egg, use a generic Node.js egg:

1. **Create Server with Node.js Egg**
   - Create a new server using the default Node.js egg
   - Allocate at least 512MB RAM and 2GB disk space

2. **Configure Startup Command**
   ```bash
   npm install && npm start
   ```

3. **Clone Repository**
   In the server console or file manager:
   ```bash
   git clone https://github.com/zvielkoren/self-streme.git .
   ```

4. **Install Dependencies**
   ```bash
   npm install --production
   ```

5. **Configure Environment**
   Create a `.env` file with:
   ```env
   PORT=7000
   BASE_URL=http://YOUR_IP:7000
   MEDIA_PATH=./media
   CACHE_BACKEND=memory
   CACHE_MAX_SIZE=1000
   CACHE_MAX_DISK_MB=5000
   ```

6. **Start the Server**
   Click the **Start** button in the Pterodactyl console

## ⚙️ Configuration

### Environment Variables

Configure these in the Pterodactyl **Startup** tab:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SERVER_PORT` | Port to listen on | `7000` | Yes |
| `BASE_URL` | Public URL for the server | Auto-detect | No |
| `AUTO_UPDATE` | Auto-pull latest code on start | `0` | No |
| `CACHE_BACKEND` | Cache type (memory/sqlite/redis) | `memory` | No |
| `CACHE_MAX_SIZE` | Max cached files | `1000` | No |
| `CACHE_MAX_DISK_MB` | Max cache disk usage (MB) | `5000` | No |
| `JACKETT_URL` | Jackett server URL | - | No |
| `JACKETT_API_KEY` | Jackett API key | - | No |

### Port Configuration

1. In Pterodactyl, go to **Network** tab
2. Note your allocated port (e.g., `25565` maps to internal `7000`)
3. Use the external port in your Base URL: `http://YOUR_IP:25565`

### Firewall Rules

Ensure the allocated port is open:
```bash
# On the host machine (not in Pterodactyl console)
sudo ufw allow 25565/tcp
```

## 🎬 Usage

### Accessing the Addon

1. **Find Your Server URL**
   - External: `http://YOUR_IP:EXTERNAL_PORT/manifest.json`
   - Internal: `http://localhost:7000/manifest.json`

2. **Add to Stremio**
   - Open Stremio
   - Go to **Addons** → **Community Addons**
   - Click **Install from URL**
   - Enter your manifest URL
   - Click **Install**

### Testing the Setup

1. **Health Check**
   ```bash
   curl http://YOUR_IP:PORT/health
   ```

2. **Test Magnet Conversion**
   ```bash
   curl "http://YOUR_IP:PORT/stream/magnet?magnet=magnet:?xt=urn:btih:HASH"
   ```

3. **Access Test Page**
   Open in browser: `http://YOUR_IP:PORT/test-magnet-converter`

## 🔧 Troubleshooting

### Server Won't Start

**Problem**: Server crashes or won't start

**Solutions**:
1. Check Node.js version (requires 18+):
   ```bash
   node --version
   ```
2. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install --production
   ```
3. Check console logs in Pterodactyl for specific errors

### Port Already in Use

**Problem**: Error "Port already in use"

**Solutions**:
1. Change the `SERVER_PORT` variable in Startup settings
2. Ensure no other service is using the port
3. Restart the Pterodactyl daemon:
   ```bash
   # On host machine
   sudo systemctl restart wings
   ```

### Can't Access from Outside

**Problem**: Server works locally but not accessible externally

**Solutions**:
1. Check Pterodactyl **Network** tab for correct port allocation
2. Verify firewall allows the port:
   ```bash
   sudo ufw status
   ```
3. Update `BASE_URL` to match your external IP/domain
4. Ensure your router forwards the port (if behind NAT)

### Magnet Links Not Streaming

**Problem**: Magnet conversion works but streaming fails

**Solutions**:
1. The app provides multiple streaming options - try the external services
2. External services work without P2P - use the recommended URL from the response
3. Check if the torrent has seeders (use the enhanced magnet link)
4. For local streaming, ensure UDP ports 6881-6889 are open:
   ```bash
   sudo ufw allow 6881:6889/tcp
   sudo ufw allow 6881:6889/udp
   ```

### High Memory Usage

**Problem**: Server uses too much RAM

**Solutions**:
1. Reduce cache size in environment variables:
   ```env
   CACHE_MAX_SIZE=500
   CACHE_MAX_DISK_MB=2000
   ```
2. Use `sqlite` instead of `memory` cache backend
3. Increase server RAM allocation in Pterodactyl

### Auto-Update Not Working

**Problem**: `AUTO_UPDATE=1` doesn't pull latest changes

**Solutions**:
1. Ensure `.git` directory exists (use git clone, not file upload)
2. Check git permissions:
   ```bash
   git config --global --add safe.directory /home/container
   ```
3. Manually update:
   ```bash
   git pull origin main
   npm install
   ```

## 📊 Resource Requirements

### Minimum Requirements
- **RAM**: 512MB
- **CPU**: 1 vCore
- **Disk**: 2GB
- **Network**: 10Mbps

### Recommended for Production
- **RAM**: 1-2GB
- **CPU**: 2 vCores
- **Disk**: 5-10GB (for cache)
- **Network**: 100Mbps

### Heavy Usage (Multiple Users)
- **RAM**: 4GB+
- **CPU**: 4 vCores
- **Disk**: 20GB+ (for cache)
- **Network**: 1Gbps
- **Cache Backend**: Redis (separate server)

## 🔐 Security Best Practices

1. **Use HTTPS**: Set up a reverse proxy (nginx/Cloudflare)
2. **Restrict Access**: Use firewall rules to limit IP access
3. **Regular Updates**: Enable `AUTO_UPDATE=1` or update regularly
4. **Monitor Logs**: Check Pterodactyl console for suspicious activity
5. **Limit Cache**: Set reasonable cache size limits
6. **Private Use**: Don't expose publicly without authentication

## 📦 Backup & Restore

### Backup
```bash
# Backup configuration
cp .env .env.backup

# Backup media library (if using local files)
tar -czf media-backup.tar.gz media/

# Backup cache (optional)
tar -czf cache-backup.tar.gz temp/
```

### Restore
```bash
# Restore configuration
cp .env.backup .env

# Restore media
tar -xzf media-backup.tar.gz

# Reinstall dependencies
npm install --production
```

## 🔄 Updating Self-Streme

### Automatic Update (Recommended)
Set `AUTO_UPDATE=1` in environment variables and restart the server.

### Manual Update
```bash
cd /home/container
git pull origin main
npm install --production
# Restart server via Pterodactyl console
```

## 🌐 Using with Reverse Proxy

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:7000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then set: `BASE_URL=http://your-domain.com`

### Cloudflare Tunnel
1. Install cloudflared on the host machine
2. Create a tunnel pointing to `localhost:7000`
3. Set `BASE_URL` to your Cloudflare URL

## 📞 Support

- **GitHub Issues**: https://github.com/zvielkoren/self-streme/issues
- **Documentation**: Check other docs in `/docs` folder
- **Pterodactyl Discord**: For panel-specific issues

## 📝 Example Startup Script

If you need a custom startup script, use this in Pterodactyl:

```bash
#!/bin/bash

# Navigate to server directory
cd /home/container

# Auto-update if enabled
if [ "${AUTO_UPDATE}" = "1" ]; then
    echo "Checking for updates..."
    git pull origin ${BRANCH:-main}
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
PORT=${SERVER_PORT}
BASE_URL=${BASE_URL}
CACHE_BACKEND=${CACHE_BACKEND:-memory}
CACHE_MAX_SIZE=${CACHE_MAX_SIZE:-1000}
CACHE_MAX_DISK_MB=${CACHE_MAX_DISK_MB:-5000}
JACKETT_URL=${JACKETT_URL}
JACKETT_API_KEY=${JACKETT_API_KEY}
EOF
fi

# Install/update dependencies
echo "Installing dependencies..."
npm install --production

# Start the server
echo "Starting Self-Streme..."
npm start
```

## 🎉 Success!

Your Self-Streme server should now be running on Pterodactyl! 

Access your addon at: `http://YOUR_IP:PORT/manifest.json`

Test the magnet converter at: `http://YOUR_IP:PORT/test-magnet-converter`
