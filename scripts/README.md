# Scripts Directory

This directory contains utility scripts for Self-Streme management and deployment.

## Available Scripts

### Setup & Installation

#### `quick-start.sh` (Linux/Mac)
Quick start script to get Self-Streme running with minimal configuration.

```bash
./scripts/quick-start.sh
```

**What it does:**
- Installs dependencies
- Creates default `.env` if missing
- Starts the server

#### `quick-start.bat` (Windows)
Windows version of the quick start script.

```cmd
scripts\quick-start.bat
```

#### `start.sh`
Standard startup script for production environments.

```bash
./scripts/start.sh
```

**Features:**
- Environment validation
- Graceful error handling
- Process management

### Maintenance & Fixes

#### `fix-streaming.sh`
Comprehensive streaming diagnostic and fix script.

```bash
./scripts/fix-streaming.sh
```

**Fixes:**
- P2P connectivity issues
- Port conflicts
- Cache problems
- Configuration errors

#### `fix-streaming-simple.sh`
Simplified version of fix-streaming with basic checks only.

```bash
./scripts/fix-streaming-simple.sh
```

**Use when:**
- Quick troubleshooting needed
- Limited system access
- First-time diagnosis

### Diagnostics

#### `diagnose-p2p.sh`
Detailed P2P system diagnostics.

```bash
./scripts/diagnose-p2p.sh
```

**Checks:**
- WebTorrent functionality
- DHT connectivity
- Tracker availability
- Peer connections

#### `diagnose-torrent.sh`
Torrent-specific diagnostics.

```bash
./scripts/diagnose-torrent.sh
```

**Analyzes:**
- Torrent service status
- Download sources availability
- Cache status
- Active streams

#### `test-tunnel.sh`
Tests Cloudflare Tunnel connectivity.

```bash
./scripts/test-tunnel.sh
```

**Validates:**
- Tunnel token
- Connection status
- Public URL accessibility
- SSL/TLS configuration

### Deployment

#### `pterodactyl-setup.sh`
Setup script for Pterodactyl Panel deployment.

```bash
./scripts/pterodactyl-setup.sh
```

**Configures:**
- Panel-specific environment
- Port mappings
- Startup commands
- Resource limits

### Legacy Scripts

#### `apply-p2p-fixes.sh`
Applies legacy P2P fixes (kept for compatibility).

```bash
./scripts/apply-p2p-fixes.sh
```

**Note:** Most functionality now integrated into main codebase.

#### `quick-fix.sh`
Quick fix script for common issues (duplicate of fix-streaming-simple).

```bash
./scripts/quick-fix.sh
```

## Usage Guidelines

### Making Scripts Executable

```bash
chmod +x scripts/*.sh
```

### Running Scripts

From project root:
```bash
./scripts/script-name.sh
```

From scripts directory:
```bash
cd scripts
./script-name.sh
```

### With Arguments

Some scripts accept arguments:
```bash
./scripts/diagnose-p2p.sh --verbose
./scripts/fix-streaming.sh --force
```

## Common Workflows

### First Time Setup
```bash
./scripts/quick-start.sh
```

### Troubleshooting Streaming Issues
```bash
# 1. Run diagnostics
./scripts/diagnose-p2p.sh

# 2. Apply fixes
./scripts/fix-streaming.sh

# 3. Restart
./scripts/start.sh
```

### Pterodactyl Deployment
```bash
# 1. Run setup
./scripts/pterodactyl-setup.sh

# 2. Configure panel egg
# Upload: ../deployment/pterodactyl-egg.json

# 3. Start via panel
```

### Testing Cloudflare Tunnel
```bash
# Set token
export TUNNEL_TOKEN=your_token_here

# Test connection
./scripts/test-tunnel.sh
```

## Environment Variables

Scripts may use these environment variables:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 11470)
- `TUNNEL_TOKEN` - Cloudflare Tunnel token
- `P2P_TIMEOUT` - P2P connection timeout
- `ENABLE_HTTP_FALLBACK` - Enable HTTP fallback (true/false)

## Script Output

Scripts use colored output:
- 🟢 **Green** - Success messages
- 🔵 **Blue** - Information
- 🟡 **Yellow** - Warnings
- 🔴 **Red** - Errors

## Error Handling

All scripts include error handling:
- Non-zero exit codes on failure
- Detailed error messages
- Cleanup on interruption
- Rollback capabilities where applicable

## Logging

Scripts log to:
- **Console** - Real-time output
- **logs/** - Persistent logs (if applicable)

View recent logs:
```bash
tail -f logs/combined.log
```

## Best Practices

1. **Always run from project root**
   ```bash
   ./scripts/script-name.sh
   ```

2. **Check exit codes**
   ```bash
   ./scripts/start.sh
   if [ $? -eq 0 ]; then
     echo "Success"
   fi
   ```

3. **Review output**
   - Read all messages
   - Check for warnings
   - Verify success indicators

4. **Backup before major changes**
   ```bash
   cp .env .env.backup
   ./scripts/fix-streaming.sh
   ```

## Contributing

When adding new scripts:

1. **Use consistent naming**
   - Lowercase with hyphens
   - Descriptive names
   - `.sh` extension for bash

2. **Include shebang**
   ```bash
   #!/bin/bash
   ```

3. **Add documentation**
   - Header comment explaining purpose
   - Usage examples
   - Required permissions

4. **Error handling**
   ```bash
   set -e  # Exit on error
   set -u  # Exit on undefined variable
   ```

5. **Update this README**
   - Add script to appropriate section
   - Document usage
   - List any dependencies

## Dependencies

Scripts may require:
- `bash` 4.0+
- `node` 18+
- `npm` 9+
- `curl` (for HTTP requests)
- `jq` (for JSON parsing)

Check dependencies:
```bash
bash --version
node --version
npm --version
curl --version
jq --version
```

## Platform Support

| Script | Linux | macOS | Windows (Git Bash) | Windows (WSL) |
|--------|-------|-------|-------------------|---------------|
| quick-start.sh | ✅ | ✅ | ✅ | ✅ |
| quick-start.bat | ❌ | ❌ | ✅ | ❌ |
| All other .sh | ✅ | ✅ | ✅ | ✅ |

## Troubleshooting Scripts

### Permission Denied
```bash
chmod +x scripts/*.sh
```

### Command Not Found
```bash
# Use explicit path
./scripts/script-name.sh

# Or add to PATH
export PATH="$PATH:./scripts"
script-name.sh
```

### Script Fails
1. Check logs: `tail -f logs/combined.log`
2. Run with debug: `bash -x scripts/script-name.sh`
3. Verify permissions: `ls -la scripts/`
4. Check dependencies: See "Dependencies" section

## Security

- Scripts don't store sensitive data
- Environment variables used for secrets
- Always review scripts before running
- Don't run scripts from untrusted sources

## Support

For issues with scripts:
1. Check this README
2. Review script comments
3. See main [Troubleshooting Guide](../docs/TROUBLESHOOTING_P2P.md)
4. Open GitHub issue

---

**Last Updated:** 2024
**Maintained by:** Development Team