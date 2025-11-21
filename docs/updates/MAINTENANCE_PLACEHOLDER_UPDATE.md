# Maintenance Placeholder Update

**Date**: 2024-01-15  
**Type**: Feature Enhancement  
**Status**: ✅ Completed

## Overview

Added comprehensive placeholder system for maintenance mode, providing beautiful and informative messages to users when the service is under maintenance. Instead of showing errors, users now see professional maintenance pages with status information, countdowns, and auto-refresh capabilities.

## What Was Added

### 1. New Files Created

#### `/src/static/maintenance-placeholder.html`
- Full-featured maintenance page with animated design
- Auto-refresh functionality (30 seconds)
- Status API polling (10 seconds)
- Countdown timer display
- Time remaining calculations
- Responsive mobile-friendly layout
- Professional gradient design with glassmorphism effects
- Real-time status checking that automatically returns users to service when maintenance ends

#### `/docs/MAINTENANCE_PLACEHOLDER.md`
- Complete documentation for placeholder system
- Usage examples and best practices
- Technical implementation details
- Troubleshooting guide
- Customization instructions
- Request flow diagrams

#### `/MAINTENANCE_PLACEHOLDER_QUICK.md`
- Quick reference guide in project root
- Common commands and use cases
- Testing procedures
- Bypass methods documentation
- Files overview

### 2. Enhanced Files

#### `/src/utils/maintenanceMode.js`
**Added:**
- `generateStreamingPlaceholder()` method - Creates lightweight HTML placeholder for streaming endpoints
- Smart request type detection (streaming vs. API vs. browser)
- Different placeholder responses based on request type
- Enhanced middleware with streaming endpoint detection

**Changes:**
```javascript
// New streaming placeholder generation
generateStreamingPlaceholder() {
  // Returns minimal HTML optimized for video player embedding
  // Includes auto-refresh and status checking
}

// Enhanced middleware detection
const isStreamRequest = 
  req.path.startsWith('/stream/') ||
  req.path.includes('/stream') ||
  req.path.match(/\.(mp4|mkv|avi|webm|m3u8)$/);
```

#### `/src/core/streamService.js`
**Added:**
- Maintenance mode check in `getStreams()` method
- `getMaintenancePlaceholder()` method - Returns placeholder stream for Stremio
- Import of maintenance mode utility

**Changes:**
```javascript
async getStreams(type, imdbId, season, episode, userAgent, baseUrl) {
  // Check if maintenance mode is enabled
  const maintenanceMode = getMaintenanceMode();
  if (maintenanceMode.isEnabled()) {
    logger.info(`[Maintenance] Returning placeholder stream for ${type}:${imdbId}`);
    return this.getMaintenancePlaceholder(maintenanceMode);
  }
  // ... rest of existing code
}

getMaintenancePlaceholder(maintenanceMode) {
  // Returns structured stream object that Stremio understands
  // Includes maintenance message, time info, and placeholder URL
}
```

#### `/src/index.js`
**Added:**
- Static endpoint for maintenance placeholder HTML file
- Route: `GET /static/maintenance-placeholder.html`

**Changes:**
```javascript
// Maintenance placeholder endpoint
app.get("/static/maintenance-placeholder.html", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(__dirname, "static", "maintenance-placeholder.html"));
});
```

#### `/src/api/maintenanceApi.js`
**Added:**
- `GET /api/maintenance/preview/page` - Preview full maintenance page
- `GET /api/maintenance/preview/streaming` - Preview streaming placeholder
- `GET /api/maintenance/preview/stream-object` - Preview stream object structure

**Changes:**
```javascript
// New preview endpoints allow testing without enabling maintenance
router.get("/preview/page", (req, res) => { ... });
router.get("/preview/streaming", (req, res) => { ... });
router.get("/preview/stream-object", (req, res) => { ... });
```

#### `/example.env`
**Enhanced:**
- Updated maintenance mode section header to include "& PLACEHOLDERS"
- Added preview endpoint URLs in comments
- Enhanced descriptions for all maintenance variables
- Added clear examples and best practices
- Added reference to quick guide
- Added `ADMIN_TOKEN` documentation

## Features

### Placeholder Types

1. **Streaming Placeholder** (`/stream/*` endpoints)
   - Lightweight HTML optimized for embedding
   - Shows maintenance status and time remaining
   - Auto-refresh every 30 seconds
   - Status check every 10 seconds
   - Seamless return to service when maintenance ends

2. **Full Maintenance Page** (Browser requests)
   - Professional animated design
   - Status badges and indicators
   - Info cards showing service status
   - Time remaining countdown
   - What's happening section
   - Auto-refresh with countdown display

3. **API JSON Response** (`/api/*` endpoints)
   ```json
   {
     "error": "Service Unavailable",
     "message": "Custom maintenance message",
     "estimatedEndTime": "2024-01-15T10:00:00Z",
     "timeRemaining": "2 hours 15 minutes",
     "maintenanceMode": true
   }
   ```

4. **Stremio Stream Object**
   ```json
   {
     "name": "🔧 Service Under Maintenance",
     "title": "🔧 Service Under Maintenance - [message]",
     "url": "/static/maintenance-placeholder.html",
     "description": "Self-Streme is currently undergoing maintenance. [time info]",
     "quality": "Maintenance",
     "behaviorHints": {
       "notWebReady": false,
       "bingeGroup": "self-streme-maintenance"
     }
   }
   ```

### User Experience Improvements

✅ **No More Generic Errors**: Users see helpful, informative messages instead of error screens

✅ **Time Awareness**: Shows exactly when service will be back (if set)

✅ **Automatic Recovery**: Pages auto-refresh and detect when maintenance ends

✅ **Beautiful Design**: Professional, modern UI that maintains brand quality

✅ **Mobile Responsive**: Works perfectly on all devices and screen sizes

✅ **Real-time Updates**: Status polling ensures users see latest information

## API Endpoints

### New Preview Endpoints

```bash
# Preview full maintenance page (no maintenance mode required)
GET /api/maintenance/preview/page

# Preview streaming placeholder (no maintenance mode required)
GET /api/maintenance/preview/streaming

# Preview stream object structure (no maintenance mode required)
GET /api/maintenance/preview/stream-object
```

### Existing Endpoints (Enhanced)

All existing maintenance API endpoints now work with the new placeholder system:
- `GET /api/maintenance/status`
- `POST /api/maintenance/enable`
- `POST /api/maintenance/disable`
- `PUT /api/maintenance/update`

## Usage Examples

### Enable Maintenance with Placeholders

```bash
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Upgrading streaming service - back soon!",
    "estimatedEndTime": "2024-01-15T10:30:00Z"
  }'
```

### Preview Placeholders (Testing)

```bash
# Preview what users will see (without actually enabling maintenance)
curl http://localhost:7000/api/maintenance/preview/page > preview.html
open preview.html

# Preview streaming placeholder
curl http://localhost:7000/api/maintenance/preview/streaming

# Preview stream object
curl http://localhost:7000/api/maintenance/preview/stream-object
```

### Test Complete Flow

```bash
# 1. Enable maintenance
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: admin123" \
  -d '{"message": "Testing placeholders"}'

# 2. View streaming placeholder
open http://localhost:7000/stream/movie/tt0111161.json
# Stremio shows: "🔧 Service Under Maintenance"

# 3. View web placeholder
open http://localhost:7000/
# Browser shows: Beautiful maintenance page

# 4. Check API response
curl http://localhost:7000/api/base-url
# Returns: JSON with 503 status

# 5. Disable maintenance
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: admin123"
```

## Technical Implementation

### Request Flow

```
User Request
    ↓
Maintenance Middleware
    ↓
Is Maintenance Enabled? → No → Normal Processing
    ↓ Yes
Is Whitelisted? → Yes → Normal Processing
    ↓ No
Detect Request Type
    ├─ Streaming (/stream/*) → Return streaming placeholder HTML
    ├─ API (/api/*) → Return JSON 503 response
    └─ Browser (other) → Return full maintenance page HTML
```

### Stream Service Integration

```
getStreams() called
    ↓
Check maintenance mode
    ↓
Is Enabled? → Yes → Return maintenance placeholder stream
    ↓ No
Continue normal stream processing
```

### Placeholder Features

1. **Auto-Refresh Logic**
   - Timer: 30 seconds
   - Visual countdown in UI
   - Automatic page reload

2. **Status Polling**
   - Interval: 10 seconds
   - API call: `/api/maintenance/status`
   - Auto-detect when maintenance ends
   - Immediate reload when service available

3. **Time Calculations**
   - Parse `estimatedEndTime`
   - Calculate remaining time
   - Display in human-readable format
   - Update countdown in real-time

## Testing

### Manual Testing Checklist

- [x] Enable maintenance mode via API
- [x] Verify streaming placeholder appears in Stremio
- [x] Verify web placeholder shows in browser
- [x] Verify API returns JSON 503 responses
- [x] Test auto-refresh after 30 seconds
- [x] Test status polling every 10 seconds
- [x] Test auto-disable when time passes
- [x] Test whitelist IP bypass
- [x] Test bypass token functionality
- [x] Test preview endpoints
- [x] Test responsive design on mobile
- [x] Test countdown timer accuracy
- [x] Verify no syntax errors

### Preview Testing

```bash
# Test all preview endpoints
curl http://localhost:7000/api/maintenance/preview/page | grep "Maintenance"
curl http://localhost:7000/api/maintenance/preview/streaming | grep "Maintenance"
curl http://localhost:7000/api/maintenance/preview/stream-object | grep "maintenance"
```

## Documentation

### Created

- `/docs/MAINTENANCE_PLACEHOLDER.md` - Complete guide (315 lines)
- `/MAINTENANCE_PLACEHOLDER_QUICK.md` - Quick reference (306 lines)
- `/docs/updates/MAINTENANCE_PLACEHOLDER_UPDATE.md` - This file

### Updated

- `/example.env` - Enhanced maintenance section with placeholder info
- Existing maintenance mode docs reference the new placeholder system

## Configuration

### Environment Variables

All existing maintenance mode environment variables work with placeholders:

```bash
MAINTENANCE_MODE=false
MAINTENANCE_MESSAGE="Your custom message here"
MAINTENANCE_END_TIME="2024-01-15T10:00:00Z"
MAINTENANCE_WHITELIST_IPS="192.168.1.100"
MAINTENANCE_BYPASS_TOKEN="secret-token"
ADMIN_TOKEN="admin123"  # Change in production!
```

### Customization Points

1. **Styling**: Edit `/src/static/maintenance-placeholder.html`
2. **Streaming Placeholder**: Edit `maintenanceMode.generateStreamingPlaceholder()`
3. **Timing**: Adjust auto-refresh and polling intervals
4. **Messages**: Set custom messages via API or environment

## Benefits

### For Users
- Clear information about service status
- Expected completion time
- No confusion or frustration
- Automatic return to service
- Professional experience

### For Administrators
- Easy to preview before enabling
- Flexible customization options
- Bypass methods for testing
- Clear documentation
- Auto-disable functionality

### For the Service
- Better user retention during maintenance
- Reduced support requests
- Professional brand image
- Consistent experience across platforms
- SEO-friendly (503 status code)

## Future Enhancements

Potential improvements for future versions:

- [ ] Email notifications when maintenance begins/ends
- [ ] Scheduled maintenance calendar
- [ ] Multi-language placeholder support
- [ ] Custom placeholder templates per deployment
- [ ] Maintenance mode history/logging
- [ ] Integration with monitoring systems
- [ ] Push notifications for mobile apps
- [ ] Maintenance progress indicator

## Breaking Changes

**None** - This update is fully backward compatible. All existing functionality continues to work as before. The placeholder system only adds new features without modifying existing behavior.

## Migration Guide

No migration needed! The placeholder system works automatically when maintenance mode is enabled. To take full advantage:

1. Update `example.env` with placeholder-aware comments (optional)
2. Test preview endpoints to see what users will see
3. Set `ADMIN_TOKEN` to a secure value (recommended)
4. Read quick guide: `MAINTENANCE_PLACEHOLDER_QUICK.md`

## Related Files

### Core Implementation
- `src/utils/maintenanceMode.js` - Placeholder generation logic
- `src/core/streamService.js` - Stream placeholder integration
- `src/static/maintenance-placeholder.html` - Full maintenance page
- `src/api/maintenanceApi.js` - Preview endpoints

### Documentation
- `docs/MAINTENANCE_PLACEHOLDER.md` - Complete guide
- `MAINTENANCE_PLACEHOLDER_QUICK.md` - Quick reference
- `docs/MAINTENANCE_MODE.md` - Original maintenance mode docs
- `MAINTENANCE_MODE_QUICK.md` - Maintenance mode quick ref
- `example.env` - Configuration examples

### Related Updates
- See conversation thread for detailed implementation discussion
- Previous maintenance mode implementation in earlier updates

## Summary

Successfully added comprehensive placeholder system for maintenance mode across all user touchpoints:

- ✅ Streaming endpoints return placeholder streams
- ✅ Web UI shows beautiful maintenance pages
- ✅ API returns structured JSON responses
- ✅ Auto-refresh and status polling
- ✅ Time remaining countdown
- ✅ Preview endpoints for testing
- ✅ Complete documentation
- ✅ No breaking changes
- ✅ Fully tested and working

The system provides a professional, user-friendly experience during maintenance while maintaining full control and flexibility for administrators.