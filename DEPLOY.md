# 🚀 Imtihon Tizimi — VPS ga o'rnatish qo'llanmasi

> **0 → ishga tayyor server** — bosqichma-bosqich yo'riqnoma

---

## 📋 Mundarija

1. [VPS talablari](#1-vps-talablari)
2. [VPS ga ulanish](#2-vps-ga-ulanish)
3. [Server muhitini tayyorlash](#3-server-muhitini-tayyorlash)
4. [Loyihani serverga yuklash](#4-loyihani-serverga-yuklash)
5. [Konfiguratsiya](#5-konfiguratsiya)
6. [Docker bilan ishga tushirish](#6-docker-bilan-ishga-tushirish)
7. [Admin akkauntini yaratish](#7-admin-akkauntini-yaratish)
8. [Tekshirish](#8-tekshirish)
9. [Client sozlash](#9-client-sozlash)
10. [Xavfsizlik devori](#10-xavfsizlik-devori)
11. [Monitoring va loglar](#11-monitoring-va-loglar)
12. [Yangilash](#12-yangilash)
13. [Ma'lumotlar zaxirasi](#13-malumotlar-zaxirasi)
14. [Muammolarni hal qilish](#14-muammolarni-hal-qilish)

---

## 1. VPS talablari

### Minimal konfiguratsiya
| Resurs | Minimum | Tavsiya |
|--------|---------|---------|
| **CPU** | 1 vCPU | 2 vCPU |
| **RAM** | 1 GB | 2 GB |
| **Disk** | 20 GB SSD | 40 GB SSD |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Tarmoq** | 100 Mbps | 1 Gbps (LAN) |

### Tavsiya etilgan provayderlar
- **Beeline / Uztelecom** — O'zbekiston ichida past kechikish uchun
- **Hetzner** — arzon va ishonchli (Yevropa)
- **DigitalOcean** — oson boshqaruv
- **Linode / Vultr** — alternativa

> **Muhim:** Agar tizim faqat mahalliy tarmoq (LAN) uchun bo'lsa, oddiy kompyuter yoki mini-PC ham server sifatida ishlaydi.

---

## 2. VPS ga ulanish

### Windows da SSH (PowerShell yoki PuTTY)

```powershell
ssh root@SERVER_IP_MANZIL
```

Birinchi marta ulanganda:
```
The authenticity of host '....' can't be established.
Are you sure you want to continue connecting? yes
```
`yes` yozing va Enter bosing.

### Parolni o'zgartirish (xavfsizlik uchun)
```bash
passwd
# Yangi parol ikki marta kiriting
```

---

## 3. Server muhitini tayyorlash

Barcha buyruqlarni server terminalida bajaring.

### 3.1 Tizimni yangilash
```bash
apt update && apt upgrade -y
```

### 3.2 Kerakli dasturlarni o'rnatish
```bash
apt install -y git curl wget nano ufw
```

### 3.3 Docker o'rnatish
```bash
# Docker rasmiy skripti orqali
curl -fsSL https://get.docker.com | sh

# Docker ishga tushganini tekshirish
docker --version
# Docker version 24.x.x, ...
```

### 3.4 Docker Compose o'rnatish
```bash
# Docker Compose plugin (Docker bilan birga keladi)
docker compose version
# Docker Compose version v2.x.x

# Eski tizimda alohida o'rnatish kerak bo'lsa:
apt install -y docker-compose-plugin
```

### 3.5 Docker avtomatik ishga tushishini sozlash
```bash
systemctl enable docker
systemctl start docker
```

---

## 4. Loyihani serverga yuklash

### Variant A — Git orqali (tavsiya etiladi)

Agar loyiha GitHub/GitLab da bo'lsa:
```bash
cd /opt
git clone https://github.com/FOYDALANUVCHI/get-session.git exam-system
cd exam-system
```

### Variant B — Fayllarni to'g'ridan yuklash (SCP)

Windows da PowerShell orqali:
```powershell
# Loyiha papkasini serverga ko'chirish
scp -r "C:\Users\CYBERTRON\Desktop\_Claude_\get-session" root@SERVER_IP:/opt/exam-system
```

Yoki **WinSCP** dasturini ishlatish mumkin:
1. [WinSCP](https://winscp.net) ni yuklab o'rnating
2. `root@SERVER_IP` ga ulaning
3. `/opt/exam-system/` papkasiga loyihani ko'chiring

### Papka tuzilmasini tekshirish
```bash
ls /opt/exam-system/
# server/  admin-panel/  docker-compose.yml  nginx.conf  ...
```

---

## 5. Konfiguratsiya

### 5.1 Server `.env` faylini sozlash

```bash
cd /opt/exam-system
nano server/.env
```

Quyidagi tarkibni kiriting va **o'z qiymatlaringiz** bilan to'ldiring:

```env
PORT=3000
MONGODB_URI=mongodb://examadmin:O'ZINGIZNING_KUCHLI_PAROL@mongodb:27017/exam-system?authSource=admin
JWT_SECRET=bu_yerga_kamida_32_belgili_maxfiy_kalit_yozing_hech_kimga_bermang
NODE_ENV=production
```

> ⚠️ **Muhim xavfsizlik qoidalari:**
> - `JWT_SECRET` — kamida 32 ta tasodifiy belgi. Misol yaratish:
>   ```bash
>   openssl rand -hex 32
>   # natija: a3f8c2d1e4b5... (bu natijani nusxa oling)
>   ```
> - `MONGODB_URI` dagi parol — `admin123` dan boshqasi bo'lsin

### 5.2 `docker-compose.yml` ni sozlash

```bash
nano /opt/exam-system/docker-compose.yml
```

MongoDB parolini `.env` dagi bilan bir xil qiling:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    container_name: exam-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: examadmin
      MONGO_INITDB_ROOT_PASSWORD: O'ZINGIZNING_KUCHLI_PAROL   # .env dagi bilan bir xil!
      MONGO_INITDB_DATABASE: exam-system
    volumes:
      - mongodb_data:/data/db
    networks:
      - exam-network
    # ports qatorini o'chiramiz — tashqaridan MongoDB ga kirmaslik uchun
    # ports:
    #   - "27017:27017"

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: exam-server
    restart: unless-stopped
    env_file:
      - ./server/.env
    depends_on:
      - mongodb
    networks:
      - exam-network
    ports:
      - "3000:3000"

  admin-panel:
    image: nginx:alpine
    container_name: exam-admin-panel
    restart: unless-stopped
    volumes:
      - ./admin-panel:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - server
    networks:
      - exam-network
    ports:
      - "80:80"

networks:
  exam-network:
    driver: bridge

volumes:
  mongodb_data:
```

### 5.3 Nginx konfiguratsiyasini sozlash

```bash
nano /opt/exam-system/nginx.conf
```

`server_name` ga serveringiz IP manzilini yozing:

```nginx
server {
    listen 80;
    server_name SERVER_IP_MANZIL;   # ← o'zgartirsangiz bo'ladi
    root /usr/share/nginx/html;
    index index.html;

    # Katta fayllar uchun (DOCX import)
    client_max_body_size 50M;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://server:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    location /ws {
        proxy_pass http://server:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600;
    }
}
```

---

## 6. Docker bilan ishga tushirish

```bash
cd /opt/exam-system

# Konteynerlarni quring va ishga tushiring
docker compose up -d --build

# Holat tekshirish
docker compose ps
```

Natija shunday ko'rinishi kerak:
```
NAME                STATUS          PORTS
exam-mongodb        Up              27017/tcp
exam-server         Up              0.0.0.0:3000->3000/tcp
exam-admin-panel    Up              0.0.0.0:80->80/tcp
```

**Barcha 3 ta konteyner `Up` holatda bo'lishi shart.**

---

## 7. Admin akkauntini yaratish

```bash
cd /opt/exam-system

# Seed skriptini ishga tushirish (admin va namuna ma'lumotlar)
docker exec exam-server node src/seed.js
```

Natija:
```
Connected to MongoDB
Admin user created/updated: admin
Student created: nis@11111111
Student created: nis@22222222
Matematika subject created
Fizika subject created
Kimyo subject created

=== Seed completed successfully ===

Kirish ma'lumotlari:
Admin:   username=admin,        password=admin123
Talaba1: username=nis@11111111, password=password123
Talaba2: username=nis@22222222, password=password123
```

> ⚠️ **Admin parolini darhol o'zgartiring!**
> Admin panelga kirib → "Parolni o'zgartirish" tugmasini bosing.

---

## 8. Tekshirish

### 8.1 Server ishlayotganini tekshirish

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":...}
```

### 8.2 Admin panel ochilishini tekshirish

Brauzerda oching:
```
http://SERVER_IP_MANZIL
```

Login sahifasi chiqishi kerak. Kirish:
- Login: `admin`
- Parol: `admin123`

### 8.3 API ishlashini tekshirish

```bash
# Admin login
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Token qaytishi kerak: {"token":"eyJ...","user":{...}}
```

---

## 9. Client sozlash

O'rnatilgan `Imtihon Tizimi` dasturida server manzilingizni ko'rsating.

`config.json` faylini oching:
```
C:\Program Files\Imtihon Tizimi\resources\config.json
```

Serveringiz IP manzilini yozing:
```json
{
  "serverUrl": "http://SERVER_IP_MANZIL:3000/api",
  "wsUrl": "ws://SERVER_IP_MANZIL:3000"
}
```

> **Mahalliy tarmoq (LAN) uchun:** Server IP manzilini `ipconfig` (Windows) yoki `ip a` (Linux) buyrug'i bilan aniqlang.

---

## 10. Xavfsizlik devori

### Faqat kerakli portlarni oching

```bash
# UFW ni yoqish
ufw enable

# SSH — majburiy (o'chirilsa serverga kira olmaysiz!)
ufw allow 22/tcp

# Admin panel (HTTP)
ufw allow 80/tcp

# Server API va WebSocket
ufw allow 3000/tcp

# MongoDB — YOPIQ bo'lishi kerak (docker internal network ishlatiladi)
# ufw allow 27017  ← BU BUYRUQNI BAJARMANG

# Holatni tekshirish
ufw status
```

Natija:
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
3000/tcp                   ALLOW       Anywhere
```

---

## 11. Monitoring va loglar

### Konteynerlar holati

```bash
# Barcha konteynerlar
docker compose ps

# Server loglari (real-vaqt)
docker logs -f exam-server

# MongoDB loglari
docker logs -f exam-mongodb

# Nginx loglari
docker logs -f exam-admin-panel
```

### Tizim resurslari

```bash
# CPU va RAM ishlatilishi
docker stats

# Disk
df -h
```

### Server yuklanishida avtomatik ishga tushish

```bash
# Docker allaqachon avtomatik ishga tushadi
# docker-compose ham restart: unless-stopped sozlangan
# Tekshirish:
systemctl is-enabled docker
# enabled
```

---

## 12. Yangilash

Loyihada o'zgarish bo'lganda:

```bash
cd /opt/exam-system

# Variant A — Git orqali yangilash
git pull origin main

# Variant B — fayllarni qo'lda yuklash (WinSCP orqali)

# Konteynerlarni qayta qurish va ishga tushirish
docker compose up -d --build

# Holat tekshirish
docker compose ps
```

> **Ma'lumotlar saqlanib qoladi** — MongoDB `mongodb_data` volume da saqlanadi, qayta qurishda o'chirmaydi.

---

## 13. Ma'lumotlar zaxirasi

### Zaxira olish (backup)

```bash
# Skript yaratish
nano /opt/backup-exam.sh
```

Quyidagini yozing:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
mkdir -p $BACKUP_DIR

docker exec exam-mongodb mongodump \
  --uri="mongodb://examadmin:O'ZINGIZNING_PAROL@localhost:27017/exam-system?authSource=admin" \
  --out=/tmp/backup_$DATE

docker cp exam-mongodb:/tmp/backup_$DATE $BACKUP_DIR/

echo "Backup saved: $BACKUP_DIR/backup_$DATE"
```

```bash
chmod +x /opt/backup-exam.sh

# Qo'lda ishga tushirish
/opt/backup-exam.sh

# Har kuni soat 02:00 da avtomatik backup
crontab -e
# Quyidagini qo'shing:
# 0 2 * * * /opt/backup-exam.sh
```

### Zaxiradan tiklash

```bash
# Backup papkasini konteynerga ko'chirish
docker cp /opt/backups/backup_XXXX exam-mongodb:/tmp/restore

# Tiklash
docker exec exam-mongodb mongorestore \
  --uri="mongodb://examadmin:PAROL@localhost:27017/exam-system?authSource=admin" \
  --drop /tmp/restore/exam-system
```

---

## 14. Muammolarni hal qilish

### Konteyner ishga tushmasa

```bash
# Batafsil log ko'rish
docker compose logs exam-server
docker compose logs exam-mongodb

# Konteynerlarni to'xtatib qayta boshlash
docker compose down
docker compose up -d --build
```

### MongoDB ulanmasa

```bash
# MongoDB ishlayotganini tekshirish
docker exec -it exam-mongodb mongosh -u examadmin -p PAROL

# .env dagi MONGODB_URI ni tekshiring
# examadmin:PAROL@mongodb:27017 — to'g'rimi?
```

### Port band bo'lsa

```bash
# 80 portni kim ishlatayotganini ko'rish
ss -tlnp | grep :80

# Eski Nginx bo'lsa o'chirish
systemctl stop nginx
systemctl disable nginx
```

### Admin panelga kira olmasangiz

```bash
# Nginx ishlayotganini tekshirish
docker logs exam-admin-panel

# Server ishga tushganini tekshirish
curl http://localhost:3000/health
```

### Disk to'lib qolsa

```bash
# Docker eski obrazlarni tozalash
docker system prune -a

# Log fayllarini tozalash
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

---

## 📌 Tezkor buyruqlar (cheatsheet)

```bash
# Ishga tushirish
docker compose -f /opt/exam-system/docker-compose.yml up -d

# To'xtatish
docker compose -f /opt/exam-system/docker-compose.yml down

# Qayta ishga tushirish
docker compose -f /opt/exam-system/docker-compose.yml restart

# Loglar (real-vaqt)
docker logs -f exam-server

# Server holati
curl http://localhost:3000/health

# Foydalanuvchilarni ko'rish (MongoDB)
docker exec -it exam-mongodb mongosh \
  -u examadmin -p PAROL \
  --eval "use exam-system; db.users.find({role:'student'}).pretty()"
```

---

## 🔐 Xavfsizlik nazorati ro'yxati

O'rnatishdan keyin quyidagilarni bajaring:

- [ ] Admin paroli `admin123` dan boshqasiga o'zgartirildi
- [ ] `JWT_SECRET` — `openssl rand -hex 32` bilan yaratilgan
- [ ] MongoDB `admin123` paroli o'zgartirildi va `.env` da yangilandi
- [ ] MongoDB porti (27017) tashqaridan yopiq
- [ ] UFW xavfsizlik devori yoqilgan
- [ ] SSH parol authentication o'rniga SSH key ishlatilmoqda *(ixtiyoriy)*
- [ ] Muntazam backup sozlangan

---

> **Muammo yuzaga kelsa:** `docker compose logs` buyrug'i bilan loglarni ko'ring va xato xabarini tekshiring.
