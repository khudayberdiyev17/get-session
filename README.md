# Imtihon Tizimi - To'liq O'rnatish Qo'llanmasi

Bu loyiha talabalar uchun imtihon topshirish dasturi (C++ Windows client) va o'qituvchilar uchun admin panelni (Web) o'z ichiga oladi.

## 📋 Loyiha Tuzilishi

```
/workspace
├── client/          # C++ Windows dasturi (talabalar uchun)
├── server/          # Node.js backend API
├── admin-panel/     # Web admin panel (HTML/Tailwind)
├── docker/          # Docker konfiguratsiyalari
└── docker-compose.yml
```

---

## 🌐 QISM 1: Server va Admin Panelni Ishga Tushirish

### Variant A: Docker orqali (Tavsiya etiladi)

#### 1-qadam: Talablar
- Docker va Docker Compose o'rnatilgan bo'lishi kerak
- Ubuntu 22.04 (Contabo server) yoki boshqa Linux distributivi

#### 2-qadam: Docker Compose ishga tushirish

```bash
# Loyiha papkasiga o'ting
cd /workspace

# Barcha servislarni ishga tushiring
docker-compose up -d --build

# Statusini tekshiring
docker-compose ps

# Loglarni ko'rish
docker-compose logs -f
```

#### 3-qadam: Ma'lumotlar bazasini sozlash

```bash
# PostgreSQL container'iga kiring
docker exec -it exam-postgres psql -U examuser -d examdb

# Yoki tashqaridan ulanish:
# Host: localhost yoki server IP
# Port: 5432
# Database: examdb
# User: examuser
# Password: exampassword123
```

#### 4-qadam: Server ishlayotganini tekshirish

```bash
# API endpoint'ni tekshirish
curl http://localhost:3000/api/ping

# Javob: {"timestamp": 1234567890, "status": "ok"}
```

#### 5-qadam: Admin Panelga kirish

Brauzerda ochish:
- **URL**: `http://<server-ip>:8080`
- **Admin login**: `admin`
- **Admin parol**: `admin123`

> **Eslatma**: `<server-ip>` o'rniga serveringizning IP adresini qo'ying (masalan: `http://45.67.89.123:8080`)

---

### Variant B: Qo'lda O'rnatish (Dekartmagan holda)

#### 1-qadam: Node.js va PostgreSQL o'rnatish

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm postgresql postgresql-contrib nginx

# Node.js versiyasi 18+ bo'lishi kerak
node --version  # v18.x.y yoki yuqori

# PostgreSQL o'rnatish va sozlash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### 2-qadam: Ma'lumotlar bazasini yaratish

```bash
# PostgreSQL ga kiring
sudo -u postgres psql

# DB va user yaratish
CREATE DATABASE examdb;
CREATE USER examuser WITH PASSWORD 'exampassword123';
GRANT ALL PRIVILEGES ON DATABASE examdb TO examuser;
\q
```

#### 3-qadam: Backend serverni ishga tushirish

```bash
cd /workspace/server

# Dependencies o'rnatish
npm install

# .env faylini yaratish
cat > .env << EOF
PORT=3000
JWT_SECRET=supersecretkey123456
DATABASE_URL=postgresql://examuser:exampassword123@localhost:5432/examdb
NODE_ENV=production
EOF

# Serverni ishga tushirish (development)
npm run dev

# Yoki production (PM2 bilan)
npm install -g pm2
pm2 start src/index.js --name exam-server
pm2 save
pm2 startup
```

#### 4-qadam: Nginx reverse proxy sozlash (opsional)

```bash
sudo nano /etc/nginx/sites-available/exam-system
```

Quyidagi konfiguratsiyani qo'shing:

```nginx
server {
    listen 80;
    server_name <server-ip>;

    # Admin panel
    location / {
        root /workspace/admin-panel;
        try_files $uri $uri/ =404;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
# Aktivlashtirish
sudo ln -s /etc/nginx/sites-available/exam-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 💻 QISM 2: C++ Client Dasturini Kompilyatsiya Qilish

### Talablar (Windows uchun)

1. **Visual Studio 2022** (Community Edition bepul)
   - [Yuklab olish](https://visualstudio.microsoft.com/downloads/)
   - O'rnatish paytida "Desktop development with C++" komponentini tanlang

2. **Qt 6 Framework**
   - [Qt Online Installer](https://www.qt.io/download-qt-installer)
   - Qt 6.5 yoki yangiroq versiyani o'rnating
   - Komponentlar: Qt Widgets, Qt Network, Qt WebSockets

3. **CMake** (3.16+)
   - [Yuklab olish](https://cmake.org/download/)
   - Yoki Visual Studio bilan birga keladi

---

### Variant A: Visual Studio 2022 orqali

#### 1-qadam: Loyihani ochish

1. Visual Studio 2022 ni oching
2. **File → Open → Folder** tanlang
3. `/workspace/client` papkasini tanlang

#### 2-qadam: CMake konfiguratsiyasi

Visual Studio avtomatik ravishda CMakeLists.txt ni aniqlaydi va konfiguratsiya qiladi.

Agar muammo bo'lsa:
- **Project → Configure Cache** ni bosing
- Qt yo'nalishini ko'rsating (masalan: `C:\Qt\6.5\msvc2019_64`)

#### 3-qadam: Kompilyatsiya

1. Yuqoridagi menuda **Release** konfiguratsiyasini tanlang
2. **Build → Build All** ni bosing (yoki `Ctrl+Shift+B`)
3. Build muvaffaqiyatli tugagach, `.exe` fayl quyidagi joyda bo'ladi:
   ```
   /workspace/client/out/build/x64-Release/ExamClient.exe
   ```

---

### Variant B: CMake orqali (Command Line)

#### 1-qadam: Developer Command Prompt ochish

Windows Start menyusidan:
- "Developer Command Prompt for VS 2022" ni toping va oching

#### 2-qadam: Build papkasini yaratish va kompilyatsiya

```cmd
# Client papkasiga o'ting
cd C:\path\to\workspace\client

# Build papkasini yaratish
mkdir build
cd build

# CMake konfiguratsiyasi (Qt yo'nalishini o'zgartiring!)
cmake .. -G "Visual Studio 17 2022" -A x64 ^
    -DCMAKE_PREFIX_PATH="C:\Qt\6.5\msvc2019_64"

# Loyihani yaratish
cmake --build . --config Release
```

#### 3-qadam: Natijani tekshirish

```cmd
# .exe faylni ko'rish
dir Release\ExamClient.exe
```

---

### Variant C: Qt Creator orqali

#### 1-qadam: Qt Creator o'rnatish

Qt installer bilan birga Qt Creator ham o'rnatiladi.

#### 2-qadam: Loyihani ochish

1. Qt Creator ni oching
2. **File → Open File or Project**
3. `CMakeLists.txt` faylini tanlang (`/workspace/client/CMakeLists.txt`)

#### 3-qadam: Kit sozlash

1. **Projects** panelida kit tanlang:
   - Compiler: MSVC 2019 64-bit
   - Qt version: Qt 6.5.x
   - Build type: Release

2. **Configure Project** ni bosing

#### 4-qadam: Build

- **Build → Run Build** (yoki `Ctrl+B`)
- Natija: `build-ExamClient-Desktop_Qt_6_5_0_MSVC2019_64bit-Release/release/ExamClient.exe`

---

## 📦 QISM 3: .exe Faylni Tarqatish Uchun Tayyorlash

### Muammo: Qt DLL kutubxonalari kerak

C++ dastur mustaqil ishushi uchun Qt DLL fayllari kerak. Ularni avtomatik yig'ish:

#### 1-qadam: windeployqt vositasidan foydalanish

Developer Command Prompt da:

```cmd
# Release papkasiga o'ting
cd C:\path\to\workspace\client\build\Release

# windeployqt ni ishga tushiring
"C:\Qt\6.5\msvc2019_64\bin\windeployqt.exe" ExamClient.exe --release --no-compiler-runtime
```

Bu buyruq:
- Barcha kerakli Qt DLL larni nusxalaydi
- Plugins papkasini yaratadi
- Platform pluginlarini qo'shadi

#### 2-qadam: Visual C++ Redistributable

Foydalanuvchi kompyuterida Visual C++ Redistributable o'rnatilmagan bo'lsa:

1. [Microsoft saytidan yuklab oling](https://aka.ms/vs/17/release/vc_redist.x64.exe)
2. Dastur installeriga qo'shing yoki alohida o'rnating

#### 3-qadam: Yakuniy papka tuzilishi

Tarqatish uchun tayyor papka:

```
ExamClient_Distribution/
├── ExamClient.exe
├── Qt6Core.dll
├── Qt6Gui.dll
├── Qt6Widgets.dll
├── Qt6Network.dll
├── Qt6WebSockets.dll
├── ... (boshqa DLL lar)
├── platforms/
│   └── qwindows.dll
├── styles/
│   └── qwindowsvistastyle.dll
└── config.ini
```

---

## 🔧 QISM 4: Client Konfiguratsiyasi

### config.ini faylini sozlash

Client birinchi marta ishga tushganda server adresini bilishi kerak.

`config.ini` faylini oching va o'zgartiring:

```ini
[Server]
Host=45.67.89.123
Port=3000
UseHTTPS=false

[Settings]
FullScreen=true
PingThreshold=200
HeartbeatInterval=10
```

> **Muhim**: `Host` qiymatini o'z serveringiz IP adresiga o'zgartiring!

---

## 🚀 QISM 5: Dasturni O'rnatish (Installer Yaratish)

### Variant A: Inno Setup (Bepul)

#### 1-qadam: Inno Setup o'rnatish

[Inno Setup yuklab olish](https://jrsoftware.org/isdl.php)

#### 2-qadam: Installer skripti yaratish

`installer.iss` faylini yarating:

```pascal
[Setup]
AppName=Exam Client
AppVersion=1.0
DefaultDirName={pf}\ExamClient
DefaultGroupName=Exam Client
OutputDir=Output
OutputBaseFilename=ExamClient_Installer

[Files]
Source: "C:\path\to\distribution\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{group}\Exam Client"; Filename: "{app}\ExamClient.exe"
Name: "{autodesktop}\Exam Client"; Filename: "{app}\ExamClient.exe"

[Run]
Filename: "{app}\ExamClient.exe"; Description: "Dasturni ishga tushirish"; Flags: postinstall skipifsilent
```

#### 3-qadam: Compile

Inno Setup da skriptni oching va **Compile** ni bosing. Natija: `ExamClient_Installer.exe`

---

### Variant B: Advanced Installer (Professional)

1. [Advanced Installer](https://www.advancedinstaller.com/) o'rnating
2. Yangi loyiha yarating
3. Files and Folders bo'limida barcha fayllarni qo'shing
4. Shortcuts yarating
5. Build ni bosing

---

## ✅ QISM 6: Tekshirish va Test Qilish

### 1. Server ishlayotganini tekshirish

```bash
curl http://<server-ip>:3000/api/ping
# Javob: {"timestamp": ..., "status": "ok"}
```

### 2. Admin panelga kirish

Brauzerda: `http://<server-ip>:8080`
- Login: `admin`
- Parol: `admin123`

### 3. Test user yaratish

Admin panelda:
1. **Users** bo'limiga o'ting
2. **Add User** ni bosing
3. Ma'lumotlarni kiriting:
   - First Name: Test
   - Last Name: Student
   - Class: 9A
   - Username: test001
   - Password: (avtomatik generatsiya qilinadi)

### 4. Client dasturini ishga tushirish

1. `ExamClient.exe` ni ishga tushiring
2. Login sahifasida yaratilgan user bilan kiring
3. Internet tezligi tekshiriladi
4. Fan tanlanadi va imtihon boshlanadi

---

## 🛠️ Muammolarni Hal Qilish

### Muammo 1: "Qt6Core.dll not found"

**Yechim**: 
- windeployqt ni qayta ishga tushiring
- Yoki barcha DLL larni .exe bilan bir papkaga nusxalang

### Muammo 2: "Serverga ulanib bo'lmadi"

**Yechim**:
- `config.ini` dagi IP adresni tekshiring
- Server port ochiq ekanligini tekshiring (`netstat -an | findstr 3000`)
- Firewall da portni oching

### Muammo 3: "Full-screen dan chiqib ketdi"

**Yechim**:
- Bu ataylab blok qilish sababidir
- Admin panelda user ni unblock qiling
- Dastur qayta ishga tushirilganda full-screen tiklanadi

### Muammo 4: "Internet tezligi past" xatosi

**Yechim**:
- Haqiqatan internet tezligini tekshiring (speedtest.net)
- Serverga ping masofasi uzoq bo'lishi mumkin
- `config.ini` da `PingThreshold` ni oshiring (masalan: 500)

---

## 📊 API Endpointlar

| Metod | Endpoint | Tavsif |
|-------|----------|--------|
| POST | `/api/auth/login` | Login (student/admin) |
| GET | `/api/subjects` | Fanlar ro'yxati |
| GET | `/api/test/questions?subjectId=X` | Savollarni yuklash |
| POST | `/api/test/submit` | Javoblarni yuborish |
| GET | `/api/ping` | Internet tezligi testi |
| WS | `/ws` | WebSocket (heartbeat) |

---

## 🔐 Xavfsizlik

1. **JWT Token**: Har bir so'rovda token talab qilinadi
2. **Rate Limiting**: Daqiqasiga 30 so'rov
3. **Auto-block**: 3 martadan ko'p klaviatura bosilsa blok
4. **Heartbeat**: 30 soniya javob bo'lmasa blok

---

## 📞 Texnik Yordam

Muammolar yuzaga kelsa:

1. Server loglarini tekshiring: `docker-compose logs server`
2. Client debug mode: `config.ini` da `Debug=true` qiling
3. Admin panel Console (F12) da xatolarni tekshiring

---

## 📝 Litsenziya

Bu loyiha ta'lim maqsadlari uchun yaratilgan.

---

**Oxirgi yangilanish**: 2025
**Versiya**: 1.0.0
