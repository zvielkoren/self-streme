# Maintenance Placeholder Quick Reference

Quick guide for using maintenance placeholders in Self-Streme.

## What Are Maintenance Placeholders?

When maintenance mode is enabled, Self-Streme shows beautiful, informative placeholders instead of errors:

- **Streaming**: Users see a maintenance stream in Stremio with status info
- **Web UI**: Professional maintenance page with countdown and auto-refresh
- **API**: Structured JSON responses with maintenance details

## Quick Commands

### Enable Maintenance with Message

```bash
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Upgrading streaming service - back in 30 minutes",
    "estimatedEndTime": "2024-01-15T10:30:00Z"
  }'
```

### Preview Placeholders (Without Enabling)

```bash
# Preview full maintenance page
curl http://localhost:7000/api/maintenance/preview/page

# Preview streaming placeholder
curl http://localhost:7000/api/maintenance/preview/streaming

# Preview stream object (for Stremio)
curl http://localhost:7000/api/maintenance/preview/stream-object
```

### Check Status

```bash
curl http://localhost:7000/api/maintenance/status
```

### Disable Maintenance

```bash
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN"
```

## Environment Configuration

```bash
# .env file
MAINTENANCE_MODE=false
MAINTENANCE_MESSAGE="Service under maintenance. Please try again later."
MAINTENANCE_END_TIME="2024-01-15T10:00:00Z"

# Whitelist IPs that can bypass maintenance
MAINTENANCE_WHITELIST_IPS="192.168.1.100,10.0.0.50"

# Bypass token for special access
MAINTENANCE_BYPASS_TOKEN="your-secret-token"

# Admin token for API control
ADMIN_TOKEN="your-secure-admin-token"
```

## What Users See

### In Stremio
```
🔧 Service Under Maintenance
Service under maintenance - Expected completion: Jan 15, 10:30 AM
Quality: Maintenance | Size: N/A | Seeders: 0
```

### In Web Browser
```
🔧
⚠️ MAINTENANCE IN PROGRESS

Streaming Service Unavailable
🎬 Self-Streme

[Custom maintenance message]

⏰ Estimated Completion: Jan 15, 2024, 10:30:00 AM
⌛ Time Remaining: 2 hours 15 minutes

[Refresh Status] [Check Status API]

Auto-refreshing in 30 seconds
```

### API Response
```json
{
  "error": "Service Unavailable",
  "message": "Service under maintenance",
  "estimatedEndTime": "2024-01-15T10:30:00Z",
  "timeRemaining": "2 hours 15 minutes",
  "maintenanceMode": true
}
```

## Features

### ✅ Automatic Recovery
- Pages auto-refresh every 30 seconds
- Status checked every 10 seconds via API
- Seamless return to service when maintenance ends

### ✅ Time Management
- Displays time remaining until completion
- Auto-disables when scheduled end time passes
- Countdown timer on web pages

### ✅ Smart Detection
- Different placeholders for streaming vs. web requests
- JSON responses for API clients
- HTML pages for browsers

### ✅ Access Control
- Whitelisted IPs can bypass maintenance
- Bypass token for special access
- Admin API always accessible

## Testing

```bash
# 1. Enable maintenance (with short duration for testing)
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: admin123" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Testing maintenance mode",
    "estimatedEndTime": "2024-01-15T10:05:00Z"
  }'

# 2. Test streaming endpoint (should return placeholder)
curl http://localhost:7000/stream/movie/tt0111161.json

# 3. Test web page (should show maintenance page)
open http://localhost:7000/

# 4. Test API (should return JSON with 503)
curl http://localhost:7000/api/base-url

# 5. Check status
curl http://localhost:7000/api/maintenance/status

# 6. Disable maintenance
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: admin123"
```

## Bypass Methods

### Using Whitelist IP
```bash
# Add to .env
MAINTENANCE_WHITELIST_IPS="192.168.1.100"

# Requests from 192.168.1.100 will bypass maintenance
```

### Using Bypass Token
```bash
# Add to .env
MAINTENANCE_BYPASS_TOKEN="secret-token-123"

# Use in request
curl "http://localhost:7000/stream/movie/tt0111161.json?bypass=secret-token-123"

# Or as header
curl -H "X-Maintenance-Bypass: secret-token-123" http://localhost:7000/...
```

## Customization

### Custom Message
```bash
curl -X PUT http://localhost:7000/api/maintenance/update \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Upgrading database - streaming will resume at 3 PM EST"
  }'
```

### Custom Styling
Edit files:
- `src/static/maintenance-placeholder.html` - Full maintenance page
- `src/utils/maintenanceMode.js` - Streaming placeholder (inline HTML)

### Custom Timing
In placeholder HTML files, adjust:
```javascript
setTimeout(() => location.reload(), 30000);  // Auto-refresh (30s)
setInterval(checkStatus, 10000);             // Status check (10s)
```

## Files Overview

```
src/
├── utils/
│   └── maintenanceMode.js          # Core logic + placeholder generation
├── static/
│   └── maintenance-placeholder.html # Full maintenance page
├── core/
│   └── streamService.js             # Stream placeholder integration
├── api/
│   └── maintenanceApi.js            # API endpoints + preview
└── index.js                         # Middleware integration
```

## Common Use Cases

### Scheduled Maintenance
```bash
# Enable with end time
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: admin123" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Scheduled maintenance: upgrading to v2.0",
    "estimatedEndTime": "2024-01-15T12:00:00Z"
  }'

# System auto-disables at 12:00 PM
```

### Emergency Maintenance
```bash
# Quick enable without end time
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: admin123" \
  -H "Content-Type: application/json" \
  -d '{"message": "Emergency fix in progress"}'

# Manually disable when done
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: admin123"
```

### Database Migration
```bash
# Enable with detailed message
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: admin123" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Migrating database to new server. No data will be lost.",
    "estimatedEndTime": "2024-01-15T14:00:00Z"
  }'
```

## Troubleshooting

### Placeholders Not Showing?
```bash
# Check status
curl http://localhost:7000/api/maintenance/status

# Verify middleware is active (check logs)
# Should see: [Maintenance] Mode initialized: ENABLED
```

### Can't Access Admin API?
```bash
# Check admin token
echo $ADMIN_TOKEN

# Use correct header
curl -H "X-Admin-Token: YOUR_TOKEN" ...
```

### Auto-Refresh Not Working?
1. Check browser console for errors
2. Verify `/api/maintenance/status` is accessible
3. Check for Content Security Policy issues

## Best Practices

1. **Always set estimated end time** for better user experience
2. **Test on staging first** before production
3. **Use clear, specific messages** (not just "down for maintenance")
4. **Whitelist admin IPs** so you can verify service works
5. **Monitor auto-disable** in logs when scheduled time passes

## See Also

- [MAINTENANCE_PLACEHOLDER.md](docs/MAINTENANCE_PLACEHOLDER.md) - Full documentation
- [MAINTENANCE_MODE.md](docs/MAINTENANCE_MODE.md) - Maintenance mode guide
- [MAINTENANCE_MODE_QUICK.md](MAINTENANCE_MODE_QUICK.md) - Quick maintenance reference

## Quick Links

- Preview Page: `http://localhost:7000/api/maintenance/preview/page`
- Preview Streaming: `http://localhost:7000/api/maintenance/preview/streaming`
- Status API: `http://localhost:7000/api/maintenance/status`
- Static File: `http://localhost:7000/static/maintenance-placeholder.html`
