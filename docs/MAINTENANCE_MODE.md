# 🔧 Maintenance Mode

**Purpose:** Temporarily disable service access during updates, fixes, or scheduled maintenance

---

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Use Cases](#use-cases)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Maintenance mode allows you to temporarily disable access to the Self-Streme service while performing:
- System updates
- Bug fixes
- Database maintenance
- Server migrations
- Configuration changes

### Features

✅ **Custom Messages** - Display custom maintenance messages to users  
✅ **Scheduled Windows** - Auto-disable after specified time  
✅ **IP Whitelisting** - Allow admin access during maintenance  
✅ **Bypass Tokens** - Selective access via secret token  
✅ **Graceful Responses** - Beautiful maintenance page for browsers, JSON for APIs  
✅ **Persistent State** - Survives server restarts

---

## Quick Start

### Enable Maintenance Mode

**Method 1: Environment Variable**
```bash
# In .env file
MAINTENANCE_MODE=true
MAINTENANCE_MESSAGE=We're performing scheduled maintenance. Be back soon!

# Restart service
npm run stop && npm run start
```

**Method 2: API Call**
```bash
# Enable with default message
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: your_admin_token" \
  -H "Content-Type: application/json"

# Enable with custom message and end time
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Scheduled maintenance in progress. Expected completion: 2 hours",
    "estimatedEndTime": "2025-11-21T10:00:00Z"
  }'
```

### Disable Maintenance Mode

**Method 1: Environment Variable**
```bash
# In .env file
MAINTENANCE_MODE=false

# Restart service
npm run stop && npm run start
```

**Method 2: API Call**
```bash
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: your_admin_token"
```

### Check Status

```bash
# Public endpoint - no auth required
curl http://localhost:7000/api/maintenance/status
```

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "message": "Service is under maintenance",
  "estimatedEndTime": "2025-11-21T10:00:00Z",
  "timeRemaining": "1 hour 45 minutes"
}
```

---

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# ═══════════════════════════════════════════════════════════
# MAINTENANCE MODE
# ═══════════════════════════════════════════════════════════

# Enable/disable maintenance mode
MAINTENANCE_MODE=false

# Custom message shown to users
MAINTENANCE_MESSAGE=Service is currently under maintenance. Please try again later.

# Auto-disable at specified time (ISO 8601 format)
# Example: 2025-11-21T10:00:00Z
MAINTENANCE_END_TIME=

# Whitelist IPs (comma-separated)
# These IPs can bypass maintenance mode
MAINTENANCE_WHITELIST_IPS=127.0.0.1,192.168.1.100

# Bypass token for selective access
# Add ?bypass=TOKEN to URL or send X-Maintenance-Bypass: TOKEN header
MAINTENANCE_BYPASS_TOKEN=secret_admin_token_123

# Admin token for API control
ADMIN_TOKEN=your_secure_admin_token_here
```

### Configuration Examples

#### Example 1: Simple Maintenance (No End Time)
```bash
MAINTENANCE_MODE=true
MAINTENANCE_MESSAGE=We're updating the service. Please check back in 30 minutes.
```

#### Example 2: Scheduled Maintenance Window
```bash
MAINTENANCE_MODE=true
MAINTENANCE_MESSAGE=Scheduled maintenance in progress
MAINTENANCE_END_TIME=2025-11-21T10:00:00Z
```

#### Example 3: Maintenance with Admin Access
```bash
MAINTENANCE_MODE=true
MAINTENANCE_MESSAGE=Server migration in progress
MAINTENANCE_WHITELIST_IPS=127.0.0.1,192.168.1.50,10.0.0.100
MAINTENANCE_BYPASS_TOKEN=admin_bypass_2024
```

---

## API Endpoints

### GET /api/maintenance/status

**Description:** Get current maintenance status (public endpoint)

**Authentication:** None required

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "message": "Service is under maintenance",
  "estimatedEndTime": "2025-11-21T10:00:00Z",
  "timeRemaining": "2 hours 15 minutes"
}
```

---

### POST /api/maintenance/enable

**Description:** Enable maintenance mode (admin only)

**Authentication:** Required - `X-Admin-Token` header

**Request Body:**
```json
{
  "message": "Custom maintenance message (optional)",
  "estimatedEndTime": "2025-11-21T10:00:00Z (optional)"
}
```

**Example:**
```bash
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Database migration in progress",
    "estimatedEndTime": "2025-11-21T12:00:00Z"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Maintenance mode enabled",
  "status": {
    "enabled": true,
    "message": "Database migration in progress",
    "estimatedEndTime": "2025-11-21T12:00:00Z",
    "timeRemaining": "3 hours"
  }
}
```

---

### POST /api/maintenance/disable

**Description:** Disable maintenance mode (admin only)

**Authentication:** Required - `X-Admin-Token` header

**Example:**
```bash
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: your_admin_token"
```

**Response:**
```json
{
  "success": true,
  "message": "Maintenance mode disabled",
  "status": {
    "enabled": false,
    "message": null,
    "estimatedEndTime": null,
    "timeRemaining": null
  }
}
```

---

### PUT /api/maintenance/update

**Description:** Update maintenance settings without disabling (admin only)

**Authentication:** Required - `X-Admin-Token` header

**Request Body:**
```json
{
  "message": "Updated maintenance message (optional)",
  "estimatedEndTime": "2025-11-21T14:00:00Z (optional)"
}
```

**Example:**
```bash
curl -X PUT http://localhost:7000/api/maintenance/update \
  -H "X-Admin-Token: your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Maintenance extended by 1 hour",
    "estimatedEndTime": "2025-11-21T14:00:00Z"
  }'
```

---

## Use Cases

### Use Case 1: Scheduled Maintenance

**Scenario:** Weekly Sunday maintenance from 2 AM to 4 AM

**Setup:**
```bash
# Saturday 11:50 PM - Enable maintenance
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Weekly scheduled maintenance. Service will be back at 4:00 AM.",
    "estimatedEndTime": "2025-11-22T04:00:00Z"
  }'

# Perform updates...

# Maintenance auto-disables at 4:00 AM
# Or manually disable when done:
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: your_admin_token"
```

---

### Use Case 2: Emergency Hotfix

**Scenario:** Critical bug needs immediate fix

**Setup:**
```bash
# 1. Enable maintenance immediately
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Emergency maintenance in progress. Service will be restored shortly."
  }'

# 2. Apply fix (users see maintenance page)

# 3. Test with bypass token
curl "http://localhost:7000/api/stream/test?bypass=your_bypass_token"

# 4. Disable maintenance when fixed
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: your_admin_token"
```

---

### Use Case 3: Database Migration

**Scenario:** Migrate database with admin-only access

**Setup:**
```bash
# In .env
MAINTENANCE_MODE=true
MAINTENANCE_MESSAGE=Database migration in progress
MAINTENANCE_WHITELIST_IPS=127.0.0.1,192.168.1.50  # Admin IPs
MAINTENANCE_END_TIME=2025-11-21T08:00:00Z

# Admins can still access from whitelisted IPs
# Regular users see maintenance page
# Migration completes...
# Auto-disables at 8:00 AM
```

---

### Use Case 4: Server Migration

**Scenario:** Move to new server with zero downtime

**Setup:**
```bash
# 1. Set up new server
# 2. Enable maintenance on old server
curl -X POST http://old-server.com/api/maintenance/enable \
  -H "X-Admin-Token: your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "We are migrating to a new server for better performance. Please wait..."
  }'

# 3. Transfer data to new server
# 4. Update DNS to point to new server
# 5. Test new server
# 6. Keep old server in maintenance mode for 24 hours as fallback
# 7. Disable maintenance on both servers when migration confirmed
```

---

## Best Practices

### 1. **Always Set Admin Token**

```bash
# In .env - Use a strong, unique token
ADMIN_TOKEN=use_a_very_secure_random_token_here_not_this_example
```

**Why?** Prevents unauthorized access to maintenance control

---

### 2. **Use Scheduled End Times**

```bash
# Good - Auto-disables
MAINTENANCE_END_TIME=2025-11-21T10:00:00Z

# Not as good - Must manually disable
MAINTENANCE_END_TIME=
```

**Why?** Prevents forgetting to disable maintenance mode

---

### 3. **Whitelist Admin IPs**

```bash
MAINTENANCE_WHITELIST_IPS=127.0.0.1,YOUR_ADMIN_IP
```

**Why?** Allows you to test while in maintenance mode

---

### 4. **Clear Communication**

```bash
# Good message - Specific and helpful
MAINTENANCE_MESSAGE=Scheduled database upgrade in progress. Expected completion: 2:00 PM EST. Sorry for the inconvenience!

# Bad message - Vague
MAINTENANCE_MESSAGE=Down for maintenance
```

**Why?** Users appreciate transparency and time estimates

---

### 5. **Test Before Production**

```bash
# 1. Enable maintenance on staging
curl -X POST http://staging.example.com/api/maintenance/enable \
  -H "X-Admin-Token: staging_token"

# 2. Test maintenance page
curl http://staging.example.com

# 3. Test bypass
curl "http://staging.example.com?bypass=test_token"

# 4. Test API response
curl http://staging.example.com/api/stream/test

# 5. Disable when done testing
curl -X POST http://staging.example.com/api/maintenance/disable \
  -H "X-Admin-Token: staging_token"
```

---

### 6. **Monitor Logs**

```bash
# Watch maintenance events
tail -f logs/app.log | grep Maintenance
```

**What to watch for:**
- Maintenance enabled/disabled events
- Unauthorized access attempts
- IP bypass activity
- Auto-disable triggers

---

### 7. **Use Bypass Tokens Sparingly**

```bash
# Only for trusted testing
MAINTENANCE_BYPASS_TOKEN=temp_testing_token_123
```

**Best practices:**
- Use random, unpredictable tokens
- Change after each maintenance window
- Don't share publicly
- Remove from .env after testing

---

## Troubleshooting

### Problem 1: Maintenance Mode Doesn't Enable

**Symptoms:**
- API returns success but service still accessible

**Solution:**
```bash
# 1. Check if middleware is registered in index.js
# 2. Check logs
tail -f logs/app.log | grep Maintenance

# 3. Verify environment variable
echo $MAINTENANCE_MODE

# 4. Force reload
npm run stop && npm run start
```

---

### Problem 2: Can't Access Admin Endpoints

**Symptoms:**
- 401 Unauthorized when calling enable/disable

**Solution:**
```bash
# Check admin token is set
grep ADMIN_TOKEN .env

# Use correct header
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: your_actual_token_here"

# Or use query parameter
curl -X POST "http://localhost:7000/api/maintenance/enable?admin_token=your_actual_token_here"
```

---

### Problem 3: Maintenance Doesn't Auto-Disable

**Symptoms:**
- Scheduled end time passed but still in maintenance mode

**Solution:**
```bash
# 1. Check time format (must be ISO 8601)
MAINTENANCE_END_TIME=2025-11-21T10:00:00Z  # Correct
# NOT: 2025-11-21 10:00:00  # Wrong

# 2. Check server timezone
date

# 3. Manually disable if needed
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: your_admin_token"
```

---

### Problem 4: Whitelisted IP Not Working

**Symptoms:**
- Still see maintenance page from whitelisted IP

**Solution:**
```bash
# 1. Check IP format
MAINTENANCE_WHITELIST_IPS=127.0.0.1,192.168.1.100  # Correct
# NOT: MAINTENANCE_WHITELIST_IPS=127.0.0.1 192.168.1.100  # Wrong (space)

# 2. Check your actual IP
curl https://api.ipify.org

# 3. Add your IP to whitelist
echo "MAINTENANCE_WHITELIST_IPS=127.0.0.1,$(curl -s https://api.ipify.org)" >> .env

# 4. Restart
npm run stop && npm run start
```

---

### Problem 5: Maintenance State Lost After Restart

**Symptoms:**
- Service restarts and maintenance mode is disabled

**Solution:**
```bash
# Maintenance state is saved to data/maintenance.json
# Ensure data directory exists and is writable
mkdir -p data
chmod 755 data

# Check if file exists
ls -la data/maintenance.json

# If file is deleted, maintenance state is lost
# Always use environment variable for persistent state:
MAINTENANCE_MODE=true  # In .env
```

---

## Integration Examples

### Bash Script for Scheduled Maintenance

**File:** `scripts/scheduled-maintenance.sh`

```bash
#!/bin/bash

# Scheduled Maintenance Script
# Run with cron: 0 2 * * 0 /path/to/scheduled-maintenance.sh

ADMIN_TOKEN="your_admin_token_here"
API_URL="http://localhost:7000"
END_TIME=$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%SZ)

echo "=== Starting Scheduled Maintenance ==="
echo "Current time: $(date)"
echo "Estimated end: $END_TIME"

# Enable maintenance
curl -X POST "$API_URL/api/maintenance/enable" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Weekly scheduled maintenance in progress\",
    \"estimatedEndTime\": \"$END_TIME\"
  }"

# Run your maintenance tasks here
echo "Running database backup..."
# pg_dump...

echo "Running updates..."
# npm install...

echo "Restarting services..."
# npm run stop && npm run start

# Disable maintenance
echo "Disabling maintenance mode..."
curl -X POST "$API_URL/api/maintenance/disable" \
  -H "X-Admin-Token: $ADMIN_TOKEN"

echo "=== Maintenance Complete ==="
```

---

### Node.js Script

```javascript
// maintenance-control.js
import axios from 'axios';

const API_URL = 'http://localhost:7000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your_admin_token';

async function enableMaintenance(message, hours) {
  const endTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  
  const response = await axios.post(
    `${API_URL}/api/maintenance/enable`,
    { message, estimatedEndTime: endTime },
    { headers: { 'X-Admin-Token': ADMIN_TOKEN } }
  );
  
  console.log('Maintenance enabled:', response.data);
}

async function disableMaintenance() {
  const response = await axios.post(
    `${API_URL}/api/maintenance/disable`,
    {},
    { headers: { 'X-Admin-Token': ADMIN_TOKEN } }
  );
  
  console.log('Maintenance disabled:', response.data);
}

async function checkStatus() {
  const response = await axios.get(`${API_URL}/api/maintenance/status`);
  console.log('Status:', response.data);
}

// Usage
const action = process.argv[2];
const message = process.argv[3];
const hours = parseInt(process.argv[4]) || 2;

if (action === 'enable') {
  enableMaintenance(message || 'Maintenance in progress', hours);
} else if (action === 'disable') {
  disableMaintenance();
} else if (action === 'status') {
  checkStatus();
} else {
  console.log('Usage: node maintenance-control.js [enable|disable|status] [message] [hours]');
}
```

**Usage:**
```bash
# Enable with default message for 2 hours
node maintenance-control.js enable

# Enable with custom message for 3 hours
node maintenance-control.js enable "Database upgrade" 3

# Check status
node maintenance-control.js status

# Disable
node maintenance-control.js disable
```

---

## Security Considerations

### 1. **Protect Admin Token**

```bash
# .env
ADMIN_TOKEN=use_a_random_32_character_token_here

# Generate secure token (Linux/Mac)
openssl rand -hex 32
```

**Never:**
- Commit admin token to git
- Share token in public documentation
- Use simple/predictable tokens

---

### 2. **Use HTTPS in Production**

```bash
# Only accept admin requests over HTTPS
# Set up SSL/TLS for your domain
```

---

### 3. **Rate Limit Admin Endpoints**

Consider adding rate limiting to prevent brute force attacks on admin endpoints.

---

### 4. **Log All Admin Actions**

All maintenance control actions are logged with IP addresses for audit purposes.

```bash
# Review admin actions
grep "Maintenance API" logs/app.log
```

---

## Related Documentation

- [README.md](../README.md) - Main documentation
- [DEPLOYMENT_GUIDE.md](guides/DEPLOYMENT_GUIDE.md) - Production deployment
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Complete API reference

---

## Summary

✅ **Enable maintenance mode** via environment variable or API  
✅ **Schedule maintenance windows** with auto-disable  
✅ **Allow admin access** via IP whitelist or bypass token  
✅ **Control via API** for automation  
✅ **Beautiful maintenance page** for end users  
✅ **Persistent state** survives restarts

**Quick Commands:**
```bash
# Enable
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: your_token"

# Disable
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: your_token"

# Check status
curl http://localhost:7000/api/maintenance/status
```

---

**Last Updated:** November 20, 2025  
**Version:** 1.0