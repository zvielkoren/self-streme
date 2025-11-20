# 🎬 Local P2P Streaming על Pterodactyl/Pelican

## 📋 סקירה

מדריך זה מסביר איך להגדיר את Self-Streme ל**הורדה לוקלית וסטרימינג ישיר** מהשרת שלך.

---

## 🎯 מה זה "Local Streaming"?

```
┌──────────────────────────────────────────────┐
│              תהליך הסטרימינג                 │
├──────────────────────────────────────────────┤
│ 1. משתמש מבקש stream                        │
│    ↓                                         │
│ 2. השרת מתחבר ל-BitTorrent P2P             │
│    ↓                                         │
│ 3. מוריד את תחילת הקובץ (Sequential)        │
│    ↓                                         │
│ 4. מתחיל stream כשיש מספיק bytes            │
│    ↓                                         │
│ 5. משתמש רואה וידאו (Progressive)           │
│    ↓                                         │
│ 6. השרת ממשיך להוריד ברקע                  │
│    ↓                                         │
│ 7. הקובץ נשמר בקאש לשימוש חוזר             │
└──────────────────────────────────────────────┘
```

---

## ✅ שינויים שבוצעו

### 1. תוקן הבאג ב-`streamingApi.js`
- הוספנו בדיקה אם `files` הוא `undefined`
- החזרת שגיאה ברורה אם הטורנט לא נמצא
- הודעה מועילה למשתמש

### 2. עודכן `.env` לסטרימינג לוקלי
```env
CACHE_ONLY_MODE=false
DIRECT_STREAM_ONLY=false
```

### 3. הוספנו timeout וretry logic
```env
TORRENT_TIMEOUT=60000
TORRENT_MAX_RETRIES=3
```

---

## 🚀 הגדרה

### שלב 1: העתק את הקונפיג החדש
```bash
cp .env.pterodactyl .env
```

### שלב 2: עדכן את Cloudflare Tunnel
וודא שה-Tunnel מצביע ל-`localhost:11470` (לא 3000!)

### שלב 3: פתח פורטים ל-P2P

#### בפאנל Pterodactyl/Pelican:
1. **Admin** → **Servers** → Self-Streme
2. **Network** → **Create Allocation**
3. הוסף פורטים: 6881-6889
4. **Assign** לשרת

#### בשרת (SSH):
```bash
sudo ufw allow 6881:6889/tcp
sudo ufw allow 6881:6889/udp
sudo ufw reload
```

### שלב 4: Restart Wings
```bash
sudo systemctl restart wings
```

### שלב 5: Restart Self-Streme
בפאנל - לחץ **Restart**

---

## 🧪 בדיקה

### 1. Health Check
```bash
curl http://localhost:11470/health
```

### 2. הוסף טורנט
```bash
curl -X POST http://localhost:11470/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri":"magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'
```

### 3. בדוק סטטוס
```bash
curl http://localhost:11470/api/torrents/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

צפוי לראות:
```json
{
  "infoHash": "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
  "status": "downloading",
  "progress": 0.15,
  "peers": 8,
  "downloadSpeed": 1234567
}
```

### 4. Stream!
```
https://stream.zviel.com/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

---

## 📊 תרחישים

### תרחיש 1: P2P עובד ✅
```
משתמש → Stream request
   ↓
Server מוצא peers (8 peers)
   ↓
מוריד @ 2 MB/s
   ↓
Stream מתחיל אחרי 5 שניות
   ↓
הצלחה! 🎉
```

### תרחיש 2: P2P לא עובד (אין peers) ❌
```
משתמש → Stream request
   ↓
Server מחפש peers (60 שניות)
   ↓
לא מצא peers
   ↓
שגיאה: "Still no peers after 60000ms"
```

**פתרון:** הפעל `USE_EXTERNAL_FALLBACK=true`

---

## ⚙️ קונפיגורציה מתקדמת

### Hybrid Mode (מומלץ!)
```env
CACHE_ONLY_MODE=false
TORRENT_TIMEOUT=30000
USE_EXTERNAL_FALLBACK=true
```

**מה זה עושה:**
1. מנסה P2P למשך 30 שניות
2. אם אין peers → עובר לwebtor.io
3. משתמש תמיד מקבל stream!

---

## 🔧 Troubleshooting

### "Still no peers"
**בעיה:** אין חיבורי P2P

**פתרונות:**
1. בדוק שפורטים 6881-6889 פתוחים
2. בדוק firewall: `sudo ufw status`
3. בדוק Wings: `sudo systemctl status wings`
4. השתמש ב-Hybrid Mode

### "Cannot read properties of undefined"
**בעיה:** הטורנט לא נוסף למערכת

**פתרון:** הוסף דרך `/api/torrents` לפני stream

### Cloudflare Tunnel timeout
**בעיה:** הבקשה לוקחת יותר מדי זמן

**פתרון:** הקטן `TORRENT_TIMEOUT` ל-20000

---

## 📈 ביצועים

### תפוקה צפויה:
- **Download speed:** 1-10 MB/s (תלוי ב-seeders)
- **Time to stream:** 5-30 שניות
- **Disk usage:** עד `CACHE_MAX_DISK_MB` (5000 MB default)
- **Memory:** ~500MB-1GB

### אופטימיזציה:
```env
CACHE_MAX_SIZE=2000
CACHE_MAX_DISK_MB=10000
TORRENT_TIMEOUT=30000
```

---

## 🎯 סיכום

✅ **עכשיו יש לך:**
- הורדה לוקלית של טורנטים
- סטרימינג ישיר מהשרת
- Progressive streaming (צפייה תוך כדי הורדה)
- קאש חכם (שימוש חוזר)
- תמיכה ב-Range requests (seek)

**השתמש בזה עם Stremio, Web UI, או API ישיר!**

---

## 📚 מסמכים נוספים

- [ONE_COMMAND_START.md](ONE_COMMAND_START.md) - התחלה מהירה
- [QUICK_START.md](QUICK_START.md) - מדריך מפורט
- [PTERODACTYL_DEPLOYMENT.md](docs/PTERODACTYL_DEPLOYMENT.md) - הגדרה מלאה
