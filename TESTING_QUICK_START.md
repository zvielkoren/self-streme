# 🧪 Testing the One-Command Setup

## Quick Test Commands

### Test on Linux/macOS
```bash
# From the project root
./start.sh
```

### Test on Windows
```cmd
quick-start.bat
```

### Test via npm
```bash
npm run quick-start
```

## What to Expect

1. **Script starts** with blue banner
2. **Node.js check** - Should pass if you have 18+
3. **Dependencies install** - Takes 20-40 seconds first time
4. **Configuration created** - Creates `.env` automatically
5. **Port checks** - Verifies 7000 and 7001 available
6. **Service starts** - Both servers launch

## Success Indicators

You'll see:
```
════════════════════════════════════════════════════════
Service URLs:
════════════════════════════════════════════════════════
  Torrent Test UI:     http://localhost:7000/test-torrent-streaming
  API Documentation:   http://localhost:7000/docs
  Health Check:        http://localhost:7000/health
  Stremio Addon:       http://localhost:7001/manifest.json
════════════════════════════════════════════════════════
```

## Verification Steps

1. Open http://localhost:7000/test-torrent-streaming
2. Should see the test interface
3. Paste this magnet:
   ```
   magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
   ```
4. Click "Add Torrent"
5. Wait 10-30 seconds for peers
6. Click "Stream" when ready
7. Video should play in browser

## If Something Goes Wrong

### Permission Denied
```bash
bash start.sh
```

### Port in Use
Edit `.env` and change:
```
PORT=8000
```

### Dependencies Fail
```bash
rm -rf node_modules
./start.sh
```

## Clean Test (Reset Everything)

```bash
# Remove generated files
rm -rf node_modules .env data/cache

# Run fresh setup
./start.sh
```

## What Gets Created

After first run:
```
self-streme/
├── .env                    ← Auto-generated config
├── node_modules/           ← Dependencies installed
└── data/
    └── cache/             ← Cache directory
```

## Success!

If you can:
- ✅ Run the script without errors
- ✅ Access http://localhost:7000/test-torrent-streaming
- ✅ Add a torrent
- ✅ Stream video

**Then everything is working perfectly!** 🎉
