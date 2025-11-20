# 📦 סיכום עדכוני הקוד - Local P2P Streaming

## ✅ קבצים שעודכנו

### 1. `src/api/streamingApi.js`
**שינוי:** תוקן באג `Cannot read properties of undefined (reading 'map')`

**קוד שנוסף:**
```javascript
// Check if files is valid
if (!files || !Array.isArray(files)) {
  logger.warn(`No files found for torrent: ${infoHash}`);
  return res.status(404).json({
    error: "Torrent not found or no files available",
    infoHash,
    message: "The torrent may not have been added yet or failed to load. Try adding it via /api/torrents first."
  });
}
```

**לפני:** השרת קרס כש-`getTorrentFiles()` החזיר `undefined`  
**אחרי:** משתמש מקבל שגיאה ברורה עם הוראות

---

### 2. `.env.pterodactyl` (חדש)
**תיאור:** קובץ קונפיג מוכן לשימוש ב-Pterodactyl/Pelican

**הגדרות עיקריות:**
```env
PORT=11470                    # Pterodactyl port
ADDON_PORT=12470
BASE_URL=https://stream.zviel.com
CACHE_ONLY_MODE=false         # Enable P2P
DIRECT_STREAM_ONLY=false      # Enable local download
TORRENT_TIMEOUT=60000
TORRENT_MAX_RETRIES=3
```

---

### 3. `PTERODACTYL_LOCAL_STREAMING.md` (חדש)
**תיאור:** מדריך מלא להגדרת סטרימינג לוקלי

**כולל:**
- הסבר על Local vs External streaming
- הוראות התקנה צעד אחר צעד
- פתיחת פורטים
- בדיקות
- Troubleshooting
- תרחישים (P2P עובד / לא עובד)

---

### 4. `CODE_UPDATES_SUMMARY.md` (זה!)
**תיאור:** סיכום כל השינויים

---

## 🎯 מה השתנה בהתנהגות

### לפני העדכון:
```
❌ CACHE_ONLY_MODE=true → רק שירותים חיצוניים
❌ /stream/info/ קורס אם אין טורנט
❌ לא ברור למשתמש מה קרה
```

### אחרי העדכון:
```
✅ CACHE_ONLY_MODE=false → הורדה לוקלית + stream
✅ /stream/info/ מחזיר שגיאה ברורה
✅ הודעות מועילות למשתמש
✅ תיעוד מלא
```

---

## 📋 צעדים להטמעה

### בשרת Pterodactyl/Pelican:

1. **העתק קונפיג חדש:**
   ```bash
   cp .env.pterodactyl .env
   ```

2. **עדכן Cloudflare Tunnel:**
   - Dashboard → Tunnels → Configure
   - Service URL: `http://localhost:11470`

3. **פתח פורטים:**
   - בפאנל: Allocations 6881-6889
   - בFirewall: `sudo ufw allow 6881:6889/tcp && sudo ufw allow 6881:6889/udp`

4. **Restart:**
   ```bash
   sudo systemctl restart wings
   # ובפאנל: Restart שרת Self-Streme
   ```

5. **בדוק:**
   ```bash
   curl http://localhost:11470/health
   ```

---

## 🧪 בדיקת השינויים

### בדיקה 1: Health Check
```bash
curl http://localhost:11470/health
# Expected: {"status":"ok",...}
```

### בדיקה 2: הוסף טורנט
```bash
curl -X POST http://localhost:11470/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri":"magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'

# Expected: {"success":true, "infoHash":"...", "status":"downloading"}
```

### בדיקה 3: בדוק info (לפני תיקון היה קורס!)
```bash
curl http://localhost:11470/stream/info/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c

# Expected: {"success":true, "data":{...}} 
# או: {"error":"Torrent not found..."} אם עדיין מוריד
```

### בדיקה 4: Stream
```
https://stream.zviel.com/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c

# Expected: וידאו מתחיל לרוץ!
```

---

## 📊 השוואת מצבים

| תכונה | External Only | Local P2P | Hybrid |
|-------|--------------|-----------|--------|
| מהירות | מהיר (CDN) | תלוי ב-peers | הטוב משני העולמות |
| תלות | webtor.io | עצמאי | גיבוי |
| פרטיות | נמוך | גבוה | בינוני |
| עלות Bandwidth | אפס | בינוני | בינוני |
| Cache | לא | כן | כן |

### המלצה: **Hybrid Mode**
```env
CACHE_ONLY_MODE=false
TORRENT_TIMEOUT=30000
USE_EXTERNAL_FALLBACK=true
```

---

## 🔍 Troubleshooting

### אם `/stream/info/` עדיין מחזיר שגיאה:

1. **בדוק שהטורנט נוסף:**
   ```bash
   curl http://localhost:11470/api/torrents
   ```

2. **בדוק שיש peers:**
   ```bash
   curl http://localhost:11470/api/torrents/HASH
   # חפש: "peers": 3
   ```

3. **בדוק לוגים:**
   ```
   # בקונסול Pterodactyl, חפש:
   "Found peer"
   "Downloading"
   ```

### אם אין peers:

1. **בדוק פורטים:**
   ```bash
   sudo ufw status | grep 688
   netstat -tlnp | grep 6881
   ```

2. **בדוק Wings:**
   ```bash
   sudo systemctl status wings
   ```

3. **השתמש ב-Hybrid Mode**

---

## 🎉 סיכום

**קבצים שונו:**
- ✅ `src/api/streamingApi.js` - באג תוקן
- ✅ `.env.pterodactyl` - קונפיג חדש
- ✅ `PTERODACTYL_LOCAL_STREAMING.md` - מדריך
- ✅ `CODE_UPDATES_SUMMARY.md` - זה!

**התנהגות חדשה:**
- ✅ השרת מוריד טורנטים לוקלית
- ✅ מסטרים ישירות מהדיסק שלו
- ✅ שגיאות ברורות ומועילות
- ✅ תיעוד מלא

**מוכן לשימוש!** 🚀

---

**צריך עזרה? קרא:** `PTERODACTYL_LOCAL_STREAMING.md`
