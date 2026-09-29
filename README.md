# 📱 Mousely — Futuristic Presentation Remote & Touch Trackpad

> Turn any smartphone (iPhone / Android) into a sleek presentation clicker, multi-touch trackpad, voice dictation assistant, and system volume controller for your computer. Zero app store downloads required.

---

## ✨ Features

- 🌌 **Futuristic OLED Trackpad:** Radial glowing touch dot matrix on Canvas (60 FPS) with haptic feedback.
- 🖱️ **Multi-Touch Gestures:** Smooth 1-finger cursor movement, tap-to-click, and natural 2-finger reverse scrolling.
- 🎯 **Presenter Controls:** Slide back/forward chevrons (`‹` / `›`), fullscreen presentation start (`F5`), and quick exit (`Esc`).
- 🎙️ **Rapid Voice-to-Text Dictation:** Instant speech recognition in English & Russian that types directly into active presentation and text fields on your computer.
- ⌨️ **Live Keyboard Modal:** Real-time phone-to-PC typing with rapid backspace hold-to-delete sync.
- 🔊 **System Volume Controller:** Interactive volume capsule slider synced with OS system audio.
- 📱 **Instant Pairing:** 4-digit PIN code + high-contrast QR code for instant pairing between mobile and computer over WebSockets / HTTPS.
- 🔄 **Orientation Adaptive:** Seamless layout for both vertical (portrait) and horizontal (landscape) handheld modes.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher)

### 2. Installation
```bash
# Clone repository
git clone https://github.com/Nekono3/mousely.git
cd mousely

# Install dependencies
npm install
```

### 3. Run Server
```bash
npm start
# or: node server.js
```

### 4. Connect Phone
1. Open the URL printed in the terminal (Local IP or Public Cloudflare Tunnel URL) on your computer.
2. Click **"💻 I'm on a Computer"** to display the pairing QR code and 4-digit PIN.
3. On your phone, scan the QR code with your camera (or open the website on your phone and enter the PIN).
4. Enjoy wireless remote control!

---

## 🖥️ Cross-Platform Support

| Platform | Mouse & Keyboard Injection | Volume Control | Status |
| :--- | :--- | :--- | :--- |
| **Linux (Wayland / Hyprland)** | `ydotool` / `/dev/uinput` | `wpctl` / `pactl` | ✅ Fully Supported |
| **Linux (X11)** | `@nut-tree-fork/nut-js` | `pactl` / `amixer` | ✅ Fully Supported |
| **Windows 10 / 11** | `@nut-tree-fork/nut-js` (Native API) | Native | ✅ Fully Supported |
| **macOS (Apple Silicon & Intel)** | `@nut-tree-fork/nut-js` (CoreGraphics) | Native | ✅ Fully Supported |
| **Mobile (iOS Safari & Android Chrome)** | Web Touch / Web Speech / WebSockets | N/A | ✅ No App Install Needed |

---

## 📄 License
MIT License.
