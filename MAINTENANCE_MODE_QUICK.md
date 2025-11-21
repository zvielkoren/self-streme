# 🔧 Maintenance Mode - Quick Reference

**Enable service maintenance mode in 2 minutes**

---

## 🚀 Quick Enable

### Method 1: Environment Variable (Simplest)

```bash
# In .env file
MAINTENANCE_MODE=true
MAINTENANCE_MESSAGE=Service under maintenance. Back soon!

# Restart
npm run stop && npm run start
```

---

### Method 2: API Call (No Restart)

```bash
# Enable maintenance
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Maintenance in progress",
    "estimatedEndTime": "2025-11-21T10:00:00Z"
  }'
```

---

## ⏸️ Quick Disable

### Method 1: Environment Variable

```bash
# In .env file
MAINTENANCE_MODE=false

# Restart
npm run stop && npm run start
```

### Method 2: API Call

```bash
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: your_admin_token"
```

---

## 📊 Check Status

```bash
# Public endpoint - no auth needed
curl http://localhost:7000/api/maintenance/status
```

**Response:**
```json
{
  "enabled": true,
  "message": "Service under maintenance",
  "estimatedEndTime": "2025-11-21T10:00:00Z",
  "timeRemaining": "2 hours 30 minutes"
}
```

---

## ⚙️ Configuration (.env)

```bash
# Enable/disable
MAINTENANCE_MODE=false

# Custom message
MAINTENANCE_MESSAGE=We're updating the service. Back soon!

# Auto-disable at this time (ISO 8601)
MAINTENANCE_END_TIME=2025-11-21T10:00:00Z

# IPs that can bypass (comma-separated)
MAINTENANCE_WHITELIST_IPS=127.0.0.1,192.168.1.100

# Secret token for bypass
# Add ?bypass=TOKEN to URL
MAINTENANCE_BYPASS_TOKEN=secret_token_123

# Admin token for API control
ADMIN_TOKEN=your_secure_admin_token
```

---

## 🎯 Common Use Cases

### Scheduled Maintenance (Auto-disable)

```bash
# Enable with 2-hour window
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Weekly maintenance. Back at 4:00 AM",
    "estimatedEndTime": "2025-11-22T04:00:00Z"
  }'

# Automatically disables at 4:00 AM
```

### Emergency Hotfix

```bash
# 1. Enable immediately
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: your_token" \
  -H "Content-Type: application/json" \
  -d '{"message": "Emergency fix in progress"}'

# 2. Apply fix

# 3. Disable when done
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: your_token"
```

### Admin Access During Maintenance

```bash
# In .env - whitelist your IP
MAINTENANCE_MODE=true
MAINTENANCE_WHITELIST_IPS=127.0.0.1,YOUR_IP_HERE

# You can access, users see maintenance page
```

---

## 🔑 Bypass Options

### Option 1: IP Whitelist

```bash
# In .env
MAINTENANCE_WHITELIST_IPS=127.0.0.1,192.168.1.50
```

### Option 2: Bypass Token (URL)

```bash
# Access with token in URL
curl "http://localhost:7000/api/stream/test?bypass=your_token"
```

### Option 3: Bypass Token (Header)

```bash
# Access with token in header
curl http://localhost:7000/api/stream/test \
  -H "X-Maintenance-Bypass: your_token"
```

---

## 📝 What Users See

### Browser Users
Beautiful maintenance page with:
- Custom message
- Estimated completion time
- Time remaining
- Auto-refresh every 30 seconds

### API Users
JSON response:
```json
{
  "error": "Service Unavailable",
  "message": "Service under maintenance",
  "estimatedEndTime": "2025-11-21T10:00:00Z",
  "timeRemaining": "1 hour 30 minutes",
  "maintenanceMode": true
}
```

---

## 🛠️ API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/maintenance/status` | GET | No | Check status |
| `/api/maintenance/enable` | POST | Yes | Enable mode |
| `/api/maintenance/disable` | POST | Yes | Disable mode |
| `/api/maintenance/update` | PUT | Yes | Update settings |

**Auth:** Add `X-Admin-Token: your_token` header

---

## 🔒 Security

```bash
# 1. Set strong admin token
ADMIN_TOKEN=$(openssl rand -hex 32)

# 2. Never commit tokens to git

# 3. Change bypass token after each use

# 4. Use HTTPS in production

# 5. Monitor logs for unauthorized attempts
tail -f logs/app.log | grep "Maintenance API"
```

---

## ⚡ One-Command Examples

**Enable for 2 hours:**
```bash
curl -X POST http://localhost:7000/api/maintenance/enable \
  -H "X-Admin-Token: admin123" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Maintenance\",\"estimatedEndTime\":\"$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%SZ)\"}"
```

**Quick disable:**
```bash
curl -X POST http://localhost:7000/api/maintenance/disable -H "X-Admin-Token: admin123"
```

**Check status:**
```bash
curl -s http://localhost:7000/api/maintenance/status | jq
```

---

## 🐛 Troubleshooting

### Not Working?

```bash
# 1. Check logs
tail -f logs/app.log | grep Maintenance

# 2. Verify environment
echo $MAINTENANCE_MODE

# 3. Check status file
cat data/maintenance.json

# 4. Force restart
npm run stop && npm run start
```

### Can't Disable?

```bash
# Delete status file and restart
rm data/maintenance.json
npm run stop && npm run start

# Or use API
curl -X POST http://localhost:7000/api/maintenance/disable \
  -H "X-Admin-Token: your_token"
```

---

## 📚 Full Documentation

For complete guide, see: [docs/MAINTENANCE_MODE.md](docs/MAINTENANCE_MODE.md)

---

## ✅ Checklist

Before enabling maintenance:
- [ ] Set `ADMIN_TOKEN` in .env
- [ ] Test on staging first
- [ ] Notify users in advance
- [ ] Set realistic `estimatedEndTime`
- [ ] Whitelist admin IPs
- [ ] Monitor logs during maintenance
- [ ] Test bypass methods
- [ ] Verify disable works

---

**Quick Start:**
1. Add `MAINTENANCE_MODE=true` to .env
2. Restart service
3. Done! Users see maintenance page

**Or use API for instant enable without restart.**

---

**Last Updated:** November 20, 2025