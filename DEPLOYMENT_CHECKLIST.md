# ✅ Checklist - Local P2P Streaming Deployment

## 📋 לפני ההתקנה

- [ ] יש לך גישת Admin ל-Pterodactyl/Pelican
- [ ] יש לך SSH access לשרת Host
- [ ] Node.js 18+ מותקן
- [ ] יש Cloudflare Tunnel token

---

## 🚀 התקנה (5 דקות)

### 1. עדכן את הקוד
- [ ] `git pull origin main` (או העתק את הקבצים המעודכנים)
- [ ] וודא ש-`src/api/streamingApi.js` עודכן (יש את תיקון הבאג)

### 2. קונפיגורציה
- [ ] `cp .env.pterodactyl .env`
- [ ] ערוך `.env` אם צריך (PORT, TOKEN, וכו')
- [ ] וודא: `CACHE_ONLY_MODE=false` ו-`DIRECT_STREAM_ONLY=false`

### 3. פורטים בפאנל
- [ ] Admin → Servers → Self-Streme → Network
- [ ] Create Allocation: 6881
- [ ] Create Allocation: 6882
- [ ] Create Allocation: 6883
- [ ] Create Allocation: 6884
- [ ] Create Allocation: 6885
- [ ] Create Allocation: 6886
- [ ] Create Allocation: 6887
- [ ] Create Allocation: 6888
- [ ] Create Allocation: 6889

### 4. Firewall (SSH לHost)
```bash
- [ ] ssh root@your-server
- [ ] sudo ufw allow 6881:6889/tcp
- [ ] sudo ufw allow 6881:6889/udp
- [ ] sudo ufw reload
- [ ] sudo ufw status (בדיקה)
```

### 5. Cloudflare Tunnel
- [ ] Dashboard: https://one.dash.cloudflare.com/
- [ ] Zero Trust → Networks → Tunnels
- [ ] Configure → Public Hostname
- [ ] Service URL: `http://localhost:11470` (לא 3000!)
- [ ] Save

### 6. Restart
- [ ] `sudo systemctl restart wings` (SSH)
- [ ] Restart שרת Self-Streme (בפאנל)
- [ ] חכה 30 שניות

---

## 🧪 בדיקות (2 דקות)

### בקונסול Pterodactyl:

#### בדיקה 1: Health
```bash
- [ ] curl http://localhost:11470/health
      # Expected: {"status":"ok"}
```

#### בדיקה 2: Ports
```bash
- [ ] netstat -tlnp | grep node
      # Expected: 11470, 12470, 6881, etc.
```

#### בדיקה 3: Add Torrent
```bash
- [ ] curl -X POST http://localhost:11470/api/torrents \
        -H "Content-Type: application/json" \
        -d '{"magnetUri":"magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"}'
      # Expected: {"success":true}
```

#### בדיקה 4: Check Status (חכה 30 שניות)
```bash
- [ ] curl http://localhost:11470/api/torrents/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
      # Expected: "peers": 3+ (אם P2P עובד)
```

#### בדיקה 5: Stream Info
```bash
- [ ] curl http://localhost:11470/stream/info/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
      # Expected: {"success":true, "data":{...}}
      # או: {"error":"Torrent not found..."} (אם עדיין מוריד)
```

### בדפדפן:

- [ ] https://stream.zviel.com/health
- [ ] https://stream.zviel.com/test-torrent-streaming
- [ ] הוסף magnet link בUI
- [ ] חכה לpeers
- [ ] לחץ Stream
- [ ] **וידאו רץ!** 🎉

---

## 🔍 Troubleshooting

### אם אין peers:
- [ ] בדוק: `sudo ufw status | grep 688`
- [ ] בדוק: `netstat -tlnp | grep 6881`
- [ ] בדוק לוגים: חפש "Found peer" או "Still no peers"
- [ ] נסה טורנט פופולרי אחר

### אם Cloudflare Tunnel timeout:
- [ ] בדוק שה-Tunnel מצביע ל-`localhost:11470`
- [ ] הקטן `TORRENT_TIMEOUT` ל-20000 ב-`.env`
- [ ] Restart השרת

### אם "Cannot read properties":
- [ ] וודא ש-`src/api/streamingApi.js` עודכן
- [ ] הוסף טורנט דרך `/api/torrents` לפני stream
- [ ] חכה שהטורנט יתחיל להוריד

---

## ✅ הצלחה!

אם עברת את כל הבדיקות:

🎉 **השרת שלך מוריד טורנטים לוקלית ומסטרים אותם!**

### מה עכשיו:

- [ ] נסה סרטים/סדרות אחרים
- [ ] הוסף את ה-Addon ל-Stremio
- [ ] קבע גבולות Cache אם צריך
- [ ] הפעל monitoring (אופציונלי)

---

## 📊 מצב תקין:

```
Logs אמורים להראות:
✅ "Server running on port 11470"
✅ "Cloudflare Tunnel is ready"
✅ "TorrentService initialized"
✅ "Adding torrent: dd8255..."
✅ "Found peer: xxx.xxx.xxx.xxx"
✅ "Downloading..."
✅ "Progress: 5%"

Ports אמורים להיות:
✅ 11470 - HTTP API
✅ 12470 - Stremio Addon
✅ 6881-6889 - BitTorrent P2P
```

---

**זמן כולל:** ~10 דקות  
**קושי:** בינוני  
**תוצאה:** סטרימינג לוקלי מהשרת שלך! 🚀
