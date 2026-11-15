# Joel Media Studio Pro — Desktop App

A full professional live streaming desktop application built with Electron + ffmpeg.  
**Real RTMP output** to Twitch, YouTube, Facebook, TikTok — no browser restrictions.

---

## 🚀 Quick Start (Run from Source)

### Prerequisites
- [Node.js 18+](https://nodejs.org) (includes npm)
- Git

### 1. Install
```bash
cd electron-app
npm install
```

### 2. Run
```bash
npm start
```

The app opens as a full native window. ffmpeg is bundled automatically via `ffmpeg-static`.

---

## 📦 Build Installer

### Windows (.exe installer)
```bash
npm run build:win
```
Output: `dist/Joel Media Studio Pro Setup 1.0.0.exe`

### Mac (.dmg)
```bash
npm run build:mac
```
Output: `dist/Joel Media Studio Pro-1.0.0.dmg`

### Linux (AppImage + .deb)
```bash
npm run build:linux
```

---

## 🔴 How to Go Live (Real RTMP)

1. Open **Stream → Configure Platforms**
2. Enter your stream key for each platform:
   - **Twitch**: Creator Dashboard → Settings → Stream → Copy Key
   - **YouTube**: YouTube Studio → Go Live → Stream Key
   - **Facebook**: Creator Studio → Go Live → Stream Key
   - **TikTok**: TikTok LIVE Studio → Stream Key
3. Enable the platform toggle
4. Click **▶ Go** per platform  —  or  **🚀 GO ALL LIVE** for all at once
5. ffmpeg captures your screen/desktop and streams directly via RTMP

---

## 🎥 Features

| Feature | Status |
|---------|--------|
| Real RTMP streaming (Twitch, YouTube, Facebook, TikTok) | ✅ Native ffmpeg |
| Multi-platform simultaneous streaming | ✅ |
| Screen capture (native via Electron desktopCapturer) | ✅ |
| Webcam capture | ✅ |
| Record to MP4/MKV (save to disk) | ✅ Native ffmpeg |
| Preview + Program dual monitors | ✅ |
| Multi-view scene thumbnails | ✅ |
| Scene collections | ✅ |
| Source transform (position/scale/rotation/opacity) | ✅ |
| Virtual background | ✅ |
| Lower thirds, ticker, watermark | ✅ |
| Chroma key | ✅ |
| Closed captions | ✅ |
| Stats overlay (CPU/RAM/FPS/Bitrate) | ✅ |
| Audio mixer + compressor + noise suppression | ✅ |
| Instant replay buffer | ✅ |
| Stream schedule | ✅ |
| NDI output simulation | ✅ |
| Color grading wheels | ✅ |
| Video filters (brightness/contrast/saturation/hue/blur) | ✅ |
| Live chat simulation | ✅ |
| Stream alerts (follow/sub/donation/raid) | ✅ |
| Keyboard hotkeys | ✅ |
| Export/import scene collections | ✅ |

---

## 🏗 Architecture

```
electron-app/
├── main.js          ← Main process: window, ffmpeg, IPC handlers
├── preload.js       ← Context bridge: exposes jmsAPI to renderer
├── renderer/
│   └── index.html   ← Full UI (HTML/CSS/JS) + Electron API bridge
├── assets/
│   ├── icon.ico     ← Windows icon
│   ├── icon.icns    ← Mac icon
│   └── icon.png     ← Linux icon
└── package.json     ← Dependencies + electron-builder config
```

**IPC Flow:**
```
Renderer (UI) ──jmsAPI.streamStart()──> preload.js ──ipcRenderer──> main.js ──spawn ffmpeg──> RTMP Server
```

---

## 🔧 Add App Icons

Place your icon files in `electron-app/assets/`:
- `icon.ico` — Windows (256×256)
- `icon.icns` — Mac
- `icon.png` — Linux (512×512)

You can convert from PNG at: https://www.icoconverter.com

---

## 📋 System Requirements

| OS | Minimum |
|----|---------|
| Windows | Windows 10 64-bit |
| macOS | macOS 10.15 (Catalina) |
| Linux | Ubuntu 18.04+ |

RAM: 4GB minimum, 8GB recommended  
CPU: Quad-core (for 1080p60 streaming)
