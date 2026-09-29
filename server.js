const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const os = require('os');
const path = require('path');
const { spawn, exec } = require('child_process');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const { mouse, keyboard, Key, Button, Point } = require('@nut-tree-fork/nut-js');

mouse.config.autoDelayMs = 0;
keyboard.config.autoDelayMs = 0;

const PORT = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
process.env.YDOTOOL_SOCKET = process.env.YDOTOOL_SOCKET || '/tmp/ydotoold.socket';

function runCmd(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout) => {
      resolve({ success: !err, output: (stdout || '').trim() });
    });
  });
}

function runYdotool(cmd) {
  return new Promise((resolve) => {
    exec(`YDOTOOL_SOCKET="${process.env.YDOTOOL_SOCKET}" ydotool ${cmd}`, (err, stdout) => {
      resolve({ success: !err, output: (stdout || '').trim() });
    });
  });
}

// Get PC System Volume (0 - 100)
async function getSystemVolume() {
  if (process.platform === 'linux') {
    const wp = await runCmd('wpctl get-volume @DEFAULT_AUDIO_SINK@');
    if (wp.success && wp.output) {
      const match = wp.output.match(/Volume:\s+([0-9.]+)/);
      if (match) return Math.round(parseFloat(match[1]) * 100);
    }
    const pa = await runCmd('pactl get-sink-volume @DEFAULT_SINK@');
    if (pa.success && pa.output) {
      const match = pa.output.match(/(\d+)%/);
      if (match) return parseInt(match[1], 10);
    }
  } else if (process.platform === 'darwin') {
    const res = await runCmd("osascript -e 'output volume of (get volume settings)' 2>/dev/null");
    if (res.success && res.output) {
      const v = parseInt(res.output, 10);
      if (!isNaN(v)) return v;
    }
  }
  return 70;
}

// Set PC System Volume (0 - 100)
async function setSystemVolume(percent) {
  const vol = Math.max(0, Math.min(100, Math.round(percent)));
  if (process.platform === 'linux') {
    const fraction = (vol / 100).toFixed(2);
    await runCmd(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${fraction}`);
    await runCmd(`pactl set-sink-volume @DEFAULT_SINK@ ${vol}%`);
  } else if (process.platform === 'darwin') {
    await runCmd(`osascript -e 'set volume output volume ${vol}' 2>/dev/null`);
  }
  return vol;
}

// Instant Typing directly into PC active window
async function typeTextToPC(text) {
  if (!text) return;
  if (process.platform === 'linux') {
    const escaped = text.replace(/'/g, "'\\''");
    const copyRes = await runCmd(`wl-copy -- '${escaped}'`);
    if (copyRes.success) {
      const pasteRes = await runYdotool('key 29:1 47:1 47:0 29:0'); // Ctrl+V
      if (pasteRes.success) return;
    }
    await runYdotool(`type -- '${escaped}'`);
  } else if (process.platform === 'darwin') {
    // Put text on macOS pasteboard and press Cmd+V (instant, 100% accurate, unicode/Cyrillic safe)
    const proc = spawn('pbcopy');
    proc.stdin.write(text);
    proc.stdin.end();
    await new Promise((resolve) => proc.on('close', resolve));
    await runCmd(`osascript -e 'tell application "System Events" to keystroke "v" using command down' 2>/dev/null`);
  } else {
    await keyboard.type(text);
  }
}

async function handleBackspace() {
  if (process.platform === 'linux') {
    const res = await runYdotool('key 14:1 14:0');
    if (res.success) return;
  } else if (process.platform === 'darwin') {
    await runCmd(`osascript -e 'tell application "System Events" to key code 51' 2>/dev/null`);
    return;
  }
  await keyboard.type(Key.Backspace);
}

async function handleEnter() {
  if (process.platform === 'linux') {
    const res = await runYdotool('key 28:1 28:0');
    if (res.success) return;
  } else if (process.platform === 'darwin') {
    await runCmd(`osascript -e 'tell application "System Events" to key code 36' 2>/dev/null`);
    return;
  }
  await keyboard.type(Key.Enter);
}

// Ultra-fast mouse position tracking without blocking promises
let cachedMousePos = null;

async function getMousePos() {
  if (!cachedMousePos) {
    try {
      cachedMousePos = await mouse.getPosition();
    } catch (e) {
      cachedMousePos = { x: 500, y: 500 };
    }
  }
  return cachedMousePos;
}

// Room & Multi-Device Manager
// rooms map: roomId -> { hostWs: Set, remoteWs: Set }
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { hosts: new Set(), remotes: new Set() });
  }
  return rooms.get(roomId);
}

// Local IP discovery
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const ifaceName of Object.keys(interfaces)) {
    for (const iface of interfaces[ifaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (/wlan|wi-fi|en|eth|wlp/i.test(ifaceName)) {
          return iface.address;
        }
        candidates.push(iface.address);
      }
    }
  }
  return candidates[0] || '127.0.0.1';
}

const localIP = getLocalIP();
let localURL = `http://${localIP}:${PORT}`;
let publicURL = null;
let activeURL = localURL;

// API endpoint returning QR code for a specific room or base URL
app.get('/api/qr', async (req, res) => {
  try {
    const roomId = (req.query.room || 'MAIN').toUpperCase();
    const origin = req.query.origin || publicURL || `http://${req.headers.host}` || localURL;
    const connectUrl = `${origin}/?room=${encodeURIComponent(roomId)}`;
    const qrDataURL = await QRCode.toDataURL(connectUrl, {
      margin: 1,
      scale: 10,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    const volume = await getSystemVolume();

    res.json({
      roomId,
      connectUrl,
      qrDataURL,
      volume,
      publicURL: origin
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OS Input Processing
async function handleAction(data, ws) {
  const isLinuxWayland = process.platform === 'linux';
  const isDarwin = process.platform === 'darwin';

  try {
    switch (data.action) {
      case 'SLIDE_NEXT':
        if (isLinuxWayland && (await runYdotool('key 106:1 106:0')).success) break;
        if (isDarwin) {
          await runCmd(`osascript -e 'tell application "System Events" to key code 124' 2>/dev/null`);
          break;
        }
        await keyboard.type(Key.Right);
        break;

      case 'SLIDE_PREV':
        if (isLinuxWayland && (await runYdotool('key 105:1 105:0')).success) break;
        if (isDarwin) {
          await runCmd(`osascript -e 'tell application "System Events" to key code 123' 2>/dev/null`);
          break;
        }
        await keyboard.type(Key.Left);
        break;

      case 'SLIDE_START':
        if (isLinuxWayland && (await runYdotool('key 63:1 63:0')).success) break; // F5
        if (isDarwin) {
          await runCmd(`osascript -e 'tell application "System Events" to key code 96' 2>/dev/null`); // F5
          break;
        }
        await keyboard.type(Key.F5);
        break;

      case 'SLIDE_EXIT':
        if (isLinuxWayland && (await runYdotool('key 1:1 1:0')).success) break; // Esc
        if (isDarwin) {
          await runCmd(`osascript -e 'tell application "System Events" to key code 53' 2>/dev/null`); // Esc
          break;
        }
        await keyboard.type(Key.Escape);
        break;

      case 'MOUSE_MOVE': {
        const dx = Math.round(data.dx || 0);
        const dy = Math.round(data.dy || 0);
        if (isLinuxWayland && (await runYdotool(`mousemove -- ${dx} ${dy}`)).success) break;

        const pos = await getMousePos();
        pos.x = Math.max(0, pos.x + dx);
        pos.y = Math.max(0, pos.y + dy);

        mouse.setPosition(new Point(pos.x, pos.y)).catch(() => {});
        break;
      }

      case 'MOUSE_CLICK': {
        cachedMousePos = null; // Re-sync actual OS position on clicks
        if (data.button === 'right') {
          if (isLinuxWayland && (await runYdotool('click 0xC1')).success) break;
          await mouse.click(Button.RIGHT);
        } else {
          if (isLinuxWayland && (await runYdotool('click 0xC0')).success) break;
          await mouse.click(Button.LEFT);
        }
        break;
      }

      case 'MOUSE_SCROLL': {
        const dy = Math.round(data.dy || 0);
        if (isLinuxWayland && (await runYdotool(`mousemove -w -- 0 ${dy > 0 ? 1 : -1}`)).success) break;
        if (dy > 0) await mouse.scrollDown(Math.abs(dy));
        else if (dy < 0) await mouse.scrollUp(Math.abs(dy));
        break;
      }

      case 'SET_VOLUME': {
        const currentVol = await setSystemVolume(data.value);
        if (ws.roomId) {
          const room = getOrCreateRoom(ws.roomId);
          const volMsg = JSON.stringify({ type: 'VOLUME_SYNC', volume: currentVol });
          room.remotes.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(volMsg); });
          room.hosts.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(volMsg); });
        }
        break;
      }

      case 'GET_VOLUME': {
        const currentVol = await getSystemVolume();
        ws.send(JSON.stringify({ type: 'VOLUME_SYNC', volume: currentVol }));
        break;
      }

      case 'TYPE_TEXT': {
        await typeTextToPC(data.text);
        break;
      }

      case 'KEY_BACKSPACE': {
        await handleBackspace();
        break;
      }

      case 'KEY_ENTER': {
        await handleEnter();
        break;
      }

      default:
        break;
    }

    // Forward event to host listeners in this room
    if (ws.roomId) {
      const room = getOrCreateRoom(ws.roomId);
      const logPayload = JSON.stringify({
        type: 'LOG_EVENT',
        action: data.action,
        payload: data,
        timestamp: Date.now()
      });
      room.hosts.forEach(h => {
        if (h.readyState === WebSocket.OPEN) h.send(logPayload);
      });
    }

  } catch (err) {
    console.error('Action error:', err.message);
  }
}

// WebSocket Router with Room Support
wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role') || 'remote'; // 'host' (PC) or 'remote' (Phone)
  const roomId = url.searchParams.get('room') || 'main';

  ws.role = role;
  ws.roomId = roomId;

  const room = getOrCreateRoom(roomId);
  if (role === 'host') {
    room.hosts.add(ws);
  } else {
    room.remotes.add(ws);
  }

  // Notify host of connected remotes count
  const notifyHost = () => {
    const statusMsg = JSON.stringify({
      type: 'ROOM_STATUS',
      roomId,
      remotesCount: room.remotes.size
    });
    room.hosts.forEach(h => {
      if (h.readyState === WebSocket.OPEN) h.send(statusMsg);
    });
  };

  notifyHost();

  const currentVol = await getSystemVolume();
  ws.send(JSON.stringify({ type: 'CONNECTED', roomId, role, volume: currentVol }));

  ws.on('message', async (messageBuffer) => {
    try {
      const data = JSON.parse(messageBuffer.toString());
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
        return;
      }
      await handleAction(data, ws);
    } catch (err) {
      console.error('WebSocket parse error:', err);
    }
  });

  ws.on('close', () => {
    if (role === 'host') {
      room.hosts.delete(ws);
    } else {
      room.remotes.delete(ws);
    }
    notifyHost();
  });
});

// Auto-start Cloudflare Tunnel
function findCloudflared() {
  const fs = require('fs');
  const candidates = [
    path.join(os.homedir(), '.mousely', 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'),
    path.join(os.homedir(), '.mousely', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'),
    path.join(os.homedir(), '.local', 'bin', 'cloudflared'),
    '/usr/local/bin/cloudflared',
    '/opt/homebrew/bin/cloudflared',
    'cloudflared'
  ];

  for (const p of candidates) {
    if (p === 'cloudflared') return p;
    if (fs.existsSync(p)) return p;
  }
  return 'cloudflared';
}

function startTunnel() {
  const bin = findCloudflared();
  let tunnel = null;

  try {
    tunnel = spawn(bin, ['tunnel', '--url', `http://localhost:${PORT}`]);
  } catch (e) {
    printLocalFallback();
    return;
  }

  tunnel.on('error', (err) => {
    printLocalFallback();
  });

  const handleData = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/(?!api)[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !publicURL) {
      publicURL = match[0];
      activeURL = publicURL;

      console.log('\n' + '='.repeat(54));
      console.log('  🌐 GLOBAL SECURE HUB ACTIVE');
      console.log('='.repeat(54));
      console.log(`\n  👉 Open on ANY phone / network:`);
      console.log(`     ${publicURL}\n`);

      qrcodeTerminal.generate(publicURL, { small: true }, (qr) => {
        console.log(qr);
        console.log('='.repeat(54) + '\n');
      });

      // Broadcast tunnel ready to all hosts
      rooms.forEach(room => {
        room.hosts.forEach(h => {
          if (h.readyState === WebSocket.OPEN) {
            h.send(JSON.stringify({ type: 'TUNNEL_READY', publicURL }));
          }
        });
      });
    }
  };

  if (tunnel.stdout) tunnel.stdout.on('data', handleData);
  if (tunnel.stderr) tunnel.stderr.on('data', handleData);
}

function printLocalFallback() {
  if (publicURL) return;
  console.log('\n' + '='.repeat(54));
  console.log('  🏠 LOCAL WI-FI HUB READY');
  console.log('='.repeat(54));
  console.log(`\n  📱 Open on your phone (same Wi-Fi):`);
  console.log(`     👉 ${localURL}\n`);

  qrcodeTerminal.generate(localURL, { small: true }, (qr) => {
    console.log(qr);
    console.log('='.repeat(54) + '\n');
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(54));
  console.log('  🚀 MOUSELY UNIVERSAL WEB HUB RUNNING');
  console.log('='.repeat(54));
  console.log(`\n  🏠 Local URL: ${localURL}\n`);

  startTunnel();
});
