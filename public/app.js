// State
let ws = null;
let isConnected = false;
let hapticsEnabled = true;
let sensitivity = 1.5;
let invertScroll = true;
let currentVolume = 70;
let currentLang = 'en-US';
let isRecognizing = false;
let recognition = null;
let currentRole = 'remote'; // 'host' or 'remote'
let currentRoom = 'MAIN';

// View Containers
const landingView = document.getElementById('landingView');
const pcHostView = document.getElementById('pcHostView');
const remoteControllerView = document.getElementById('remoteControllerView');

// Landing Elements
const btnSelectPC = document.getElementById('btnSelectPC');
const btnSelectPhone = document.getElementById('btnSelectPhone');
const manualPinInput = document.getElementById('manualPinInput');
const btnJoinPin = document.getElementById('btnJoinPin');

// Host View Elements
const hostQrImg = document.getElementById('hostQrImg');
const hostRoomPin = document.getElementById('hostRoomPin');
const hostStatusTitle = document.getElementById('hostStatusTitle');
const hostRemotesCount = document.getElementById('hostRemotesCount');
const hostLogsContainer = document.getElementById('hostLogsContainer');
const btnSwitchDevice = document.getElementById('btnSwitchDevice');
const btnCopyLink = document.getElementById('btnCopyLink');
const copyLinkText = document.getElementById('copyLinkText');
const hostStatusCard = document.getElementById('hostStatusCard');

let pairingUrl = '';

function generateRandomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Remote Elements
const connectionText = document.getElementById('connectionText');
const btnOpenSettings = document.getElementById('btnOpenSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const closeSettingsBackdrop = document.getElementById('closeSettingsBackdrop');
const settingsModal = document.getElementById('settingsModal');
const sensitivitySlider = document.getElementById('sensitivitySlider');
const sensitivityVal = document.getElementById('sensitivityVal');
const invertScrollCheckbox = document.getElementById('invertScrollCheckbox');
const hapticsCheckbox = document.getElementById('hapticsCheckbox');
const btnSwitchDeviceFromSettings = document.getElementById('btnSwitchDeviceFromSettings');
const btnExit = document.getElementById('btnExit');

// Volume Modal Elements
const btnVolToggle = document.getElementById('btnVolToggle');
const volumeOverlay = document.getElementById('volumeOverlay');
const closeVolumeBackdrop = document.getElementById('closeVolumeBackdrop');
const btnCloseVolume = document.getElementById('btnCloseVolume');
const volumeCapsuleTrack = document.getElementById('volumeCapsuleTrack');
const volumeCapsuleFill = document.getElementById('volumeCapsuleFill');
const volumeModalVal = document.getElementById('volumeModalVal');
const volumeCenterIcon = document.getElementById('volumeCenterIcon');

// Keyboard Modal Elements
const btnOpenKeyboard = document.getElementById('btnOpenKeyboard');
const keyboardOverlay = document.getElementById('keyboardOverlay');
const closeKeyboardBackdrop = document.getElementById('closeKeyboardBackdrop');
const btnCloseKeyboard = document.getElementById('btnCloseKeyboard');
const liveTextInput = document.getElementById('liveTextInput');

// Voice Elements
const btnMic = document.getElementById('btnMic');
const transcriptPreview = document.getElementById('transcriptPreview');
const transcriptText = document.getElementById('transcriptText');
const langChips = document.querySelectorAll('.lang-chip');

// Slide Elements
const btnPrev = document.getElementById('btnPrevSlide');
const btnNext = document.getElementById('btnNextSlide');
const btnPresentStart = document.getElementById('btnPresentStart');
const btnLeftClick = document.getElementById('btnLeftClick');
const btnRightClick = document.getElementById('btnRightClick');

function triggerHaptic(pattern = 25) {
  if (hapticsEnabled && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

// 1. ROUTING & VIEW CONTROLLER
function showView(viewName) {
  landingView.style.display = 'none';
  pcHostView.style.display = 'none';
  remoteControllerView.style.display = 'none';

  if (viewName === 'landing') {
    landingView.style.display = 'flex';
  } else if (viewName === 'host') {
    pcHostView.style.display = 'flex';
    initHostMode();
  } else if (viewName === 'remote') {
    remoteControllerView.style.display = 'flex';
    initRemoteMode();
  }
}

function checkInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  const modeParam = params.get('mode');

  if (roomParam) {
    currentRoom = roomParam.toUpperCase().trim();
    currentRole = 'remote';
    showView('remote');
  } else if (modeParam === 'host') {
    currentRole = 'host';
    currentRoom = generateRandomPin();
    showView('host');
  } else if (modeParam === 'remote') {
    currentRole = 'remote';
    currentRoom = 'MAIN';
    showView('remote');
  } else {
    // Show device selection landing
    showView('landing');
  }
}

// Landing View Actions
btnSelectPC.addEventListener('click', () => {
  currentRole = 'host';
  currentRoom = generateRandomPin();
  showView('host');
});

btnSelectPhone.addEventListener('click', () => {
  currentRole = 'remote';
  currentRoom = 'MAIN';
  showView('remote');
});

function joinViaPin() {
  const pin = manualPinInput.value.trim().toUpperCase();
  if (pin) {
    currentRoom = pin;
    currentRole = 'remote';
    showView('remote');
  }
}

btnJoinPin.addEventListener('click', joinViaPin);

manualPinInput.addEventListener('input', () => {
  if (manualPinInput.value.trim().length === 4) {
    joinViaPin();
  }
});

manualPinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    joinViaPin();
  }
});

btnSwitchDevice.addEventListener('click', () => showView('landing'));
btnSwitchDeviceFromSettings.addEventListener('click', () => {
  settingsModal.classList.remove('active');
  showView('landing');
});

// Copy link button handler
if (btnCopyLink) {
  btnCopyLink.addEventListener('click', async () => {
    if (!pairingUrl) {
      pairingUrl = `${window.location.origin}/?room=${encodeURIComponent(currentRoom)}`;
    }
    try {
      await navigator.clipboard.writeText(pairingUrl);
      copyLinkText.textContent = 'Copied!';
      setTimeout(() => { copyLinkText.textContent = 'Copy Direct Link'; }, 2000);
    } catch (e) {
      prompt('Copy this pairing URL:', pairingUrl);
    }
  });
}

// 2. PC HOST MODE SETUP
async function initHostMode() {
  hostRoomPin.textContent = currentRoom;
  const origin = window.location.origin;

  try {
    const res = await fetch(`/api/qr?room=${encodeURIComponent(currentRoom)}&origin=${encodeURIComponent(origin)}`);
    const data = await res.json();
    if (data.qrDataURL) {
      hostQrImg.src = data.qrDataURL;
    }
    if (data.connectUrl) {
      pairingUrl = data.connectUrl;
    }
    if (typeof data.volume === 'number') currentVolume = data.volume;
  } catch (err) {
    console.error('Failed to load host QR', err);
  }

  connectWebSocket('host');
}

// 3. REMOTE CONTROLLER MODE SETUP
function initRemoteMode() {
  setTimeout(() => {
    initDotGrid();
    renderDotGrid();
  }, 100);
  connectWebSocket('remote');
}

// 4. WEBSOCKET ROUTER (ROOM-BASED)
function connectWebSocket(role) {
  if (ws) {
    try { ws.close(); } catch (e) {}
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}?role=${role}&room=${encodeURIComponent(currentRoom)}`;

  if (connectionText) connectionText.textContent = 'Connecting...';

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      isConnected = true;
      if (connectionText) connectionText.textContent = 'Connected';
      triggerHaptic([30, 40]);
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'TUNNEL_READY') {
          if (role === 'host') initHostMode();
        }

        if (msg.type === 'ROOM_STATUS') {
          if (role === 'host') {
            const count = msg.remotesCount || 0;
            hostRemotesCount.textContent = `${count} Phone(s) Paired`;
            hostStatusTitle.textContent = count > 0 ? 'Remote Connected' : 'Listening for Remote...';
          }
        }

        if (msg.type === 'LOG_EVENT') {
          if (role === 'host') {
            const row = document.createElement('div');
            row.className = 'log-row';
            const time = new Date(msg.timestamp).toLocaleTimeString();
            row.textContent = `[${time}] ${msg.action}`;
            hostLogsContainer.prepend(row);
          }
        }

        if (msg.type === 'CONNECTED' || msg.type === 'VOLUME_SYNC') {
          if (typeof msg.volume === 'number') {
            updateVolumeUI(msg.volume);
          }
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      isConnected = false;
      if (connectionText) connectionText.textContent = 'Reconnecting...';
      setTimeout(() => connectWebSocket(role), 2000);
    };

    ws.onerror = () => { ws.close(); };
  } catch (err) {
    setTimeout(() => connectWebSocket(role), 2000);
  }
}

let heartbeatInterval = null;
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PING' }));
    }
  }, 10000);
}

function sendAction(action, payload = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action, ...payload }));
  }
}

// 5. FUTURISTIC DOT MATRIX CANVAS
const canvas = document.getElementById('dotCanvas');
const ctx = canvas.getContext('2d');
let dots = [];
let activeTouches = new Map();
let canvasWidth = 0;
let canvasHeight = 0;
const DOT_SPACING = 24;
const INFLUENCE_RADIUS = 120;

function initDotGrid() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvasWidth = rect.width;
  canvasHeight = rect.height;

  if (canvasWidth === 0 || canvasHeight === 0) return;

  canvas.width = canvasWidth * dpr;
  canvas.height = canvasHeight * dpr;
  ctx.scale(dpr, dpr);

  dots = [];
  const cols = Math.floor(canvasWidth / DOT_SPACING);
  const rows = Math.floor(canvasHeight / DOT_SPACING);
  const offsetX = (canvasWidth - cols * DOT_SPACING) / 2 + DOT_SPACING / 2;
  const offsetY = (canvasHeight - rows * DOT_SPACING) / 2 + DOT_SPACING / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push({
        x: offsetX + c * DOT_SPACING,
        y: offsetY + r * DOT_SPACING,
        baseRadius: 1.5,
        targetRadius: 1.5,
        currentRadius: 1.5,
        baseAlpha: 0.15,
        targetAlpha: 0.15,
        currentAlpha: 0.15
      });
    }
  }
}

window.addEventListener('resize', () => setTimeout(initDotGrid, 50));
window.addEventListener('orientationchange', () => setTimeout(initDotGrid, 150));

function renderDotGrid() {
  if (remoteControllerView.style.display === 'none') {
    requestAnimationFrame(renderDotGrid);
    return;
  }

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i];
    let maxFactor = 0;

    activeTouches.forEach((touch) => {
      const dx = touch.x - dot.x;
      const dy = touch.y - dot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < INFLUENCE_RADIUS) {
        const factor = Math.pow(1 - dist / INFLUENCE_RADIUS, 2);
        if (factor > maxFactor) maxFactor = factor;
      }
    });

    dot.targetRadius = dot.baseRadius + maxFactor * 4.5;
    dot.targetAlpha = dot.baseAlpha + maxFactor * 0.85;

    dot.currentRadius += (dot.targetRadius - dot.currentRadius) * 0.22;
    dot.currentAlpha += (dot.targetAlpha - dot.currentAlpha) * 0.22;

    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.currentRadius, 0, Math.PI * 2);

    if (maxFactor > 0.05) {
      ctx.fillStyle = `rgba(0, 210, 255, ${dot.currentAlpha})`;
    } else {
      ctx.fillStyle = `rgba(100, 140, 200, ${dot.currentAlpha})`;
    }
    ctx.fill();
  }

  activeTouches.forEach((touch) => {
    const grad = ctx.createRadialGradient(touch.x, touch.y, 0, touch.x, touch.y, INFLUENCE_RADIUS);
    grad.addColorStop(0, 'rgba(0, 210, 255, 0.12)');
    grad.addColorStop(0.5, 'rgba(0, 210, 255, 0.04)');
    grad.addColorStop(1, 'rgba(0, 210, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(touch.x, touch.y, INFLUENCE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  });

  requestAnimationFrame(renderDotGrid);
}

// 6. TOUCH INTERACTIONS
let touchStartTime = 0;
let lastTouchX = 0;
let lastTouchY = 0;
let hasMoved = false;

function updateTouchPositions(e) {
  const rect = canvas.getBoundingClientRect();
  activeTouches.clear();
  for (let i = 0; i < e.touches.length; i++) {
    const t = e.touches[i];
    activeTouches.set(t.identifier, {
      x: t.clientX - rect.left,
      y: t.clientY - rect.top
    });
  }
}

canvas.addEventListener('touchstart', (e) => {
  touchStartTime = Date.now();
  hasMoved = false;
  updateTouchPositions(e);

  if (e.touches.length === 1) {
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  updateTouchPositions(e);

  if (e.touches.length === 1) {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    const rawDx = (currentX - lastTouchX) * sensitivity;
    const rawDy = (currentY - lastTouchY) * sensitivity;

    if (Math.abs(rawDx) > 0.4 || Math.abs(rawDy) > 0.4) {
      hasMoved = true;
      const dx = rawDx * (1 + Math.min(Math.abs(rawDx) * 0.04, 1.4));
      const dy = rawDy * (1 + Math.min(Math.abs(rawDy) * 0.04, 1.4));
      sendAction('MOUSE_MOVE', { dx, dy });
    }

    lastTouchX = currentX;
    lastTouchY = currentY;

  } else if (e.touches.length === 2) {
    const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const rawDeltaY = (currentY - lastTouchY) * 2;

    if (Math.abs(rawDeltaY) > 1.5) {
      hasMoved = true;
      const scrollDy = invertScroll ? rawDeltaY : -rawDeltaY;
      sendAction('MOUSE_SCROLL', { dy: scrollDy });
      lastTouchY = currentY;
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  updateTouchPositions(e);
  const duration = Date.now() - touchStartTime;

  if (!hasMoved && duration < 250) {
    if (e.changedTouches.length === 1) {
      sendAction('MOUSE_CLICK', { button: 'left' });
      triggerHaptic(25);
    }
  }
});

canvas.addEventListener('touchcancel', (e) => {
  updateTouchPositions(e);
});

btnLeftClick.addEventListener('click', () => {
  sendAction('MOUSE_CLICK', { button: 'left' });
  triggerHaptic(25);
});

btnRightClick.addEventListener('click', () => {
  sendAction('MOUSE_CLICK', { button: 'right' });
  triggerHaptic([20, 25]);
});

// 7. VOLUME MODAL
function updateVolumeUI(vol) {
  currentVolume = Math.max(0, Math.min(100, Math.round(vol)));
  if (volumeCapsuleFill) volumeCapsuleFill.style.height = `${currentVolume}%`;
  if (volumeModalVal) volumeModalVal.textContent = `${currentVolume}%`;

  let icon = '🔊';
  if (currentVolume === 0) icon = '🔇';
  else if (currentVolume < 40) icon = '🔉';

  if (volumeCenterIcon) volumeCenterIcon.textContent = icon;
}

btnVolToggle.addEventListener('click', () => {
  volumeOverlay.classList.add('active');
  triggerHaptic(25);
});

btnCloseVolume.addEventListener('click', () => {
  volumeOverlay.classList.remove('active');
  triggerHaptic(20);
});

closeVolumeBackdrop.addEventListener('click', () => {
  volumeOverlay.classList.remove('active');
});

let isAdjustingVolume = false;

function handleVolumeCapsuleTouch(e) {
  const touch = e.touches[0];
  const rect = volumeCapsuleTrack.getBoundingClientRect();
  const offsetY = touch.clientY - rect.top;
  const ratio = 1 - (offsetY / rect.height);
  const newVol = Math.max(0, Math.min(100, Math.round(ratio * 100)));

  updateVolumeUI(newVol);
  sendAction('SET_VOLUME', { value: newVol });
}

volumeCapsuleTrack.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isAdjustingVolume = true;
  handleVolumeCapsuleTouch(e);
  triggerHaptic(20);
}, { passive: false });

volumeCapsuleTrack.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (isAdjustingVolume) handleVolumeCapsuleTouch(e);
}, { passive: false });

volumeCapsuleTrack.addEventListener('touchend', () => {
  isAdjustingVolume = false;
  triggerHaptic(30);
});

// 8. KEYBOARD MODAL
let lastTextBuffer = '';
let isComposing = false;

btnOpenKeyboard.addEventListener('click', () => {
  keyboardOverlay.classList.add('active');
  liveTextInput.value = '';
  lastTextBuffer = '';
  isComposing = false;
  setTimeout(() => liveTextInput.focus(), 150);
  triggerHaptic(25);
});

btnCloseKeyboard.addEventListener('click', () => {
  keyboardOverlay.classList.remove('active');
  triggerHaptic(20);
});

closeKeyboardBackdrop.addEventListener('click', () => {
  keyboardOverlay.classList.remove('active');
});

function syncKeyboardBuffer() {
  const currentVal = liveTextInput.value;

  if (currentVal.length > lastTextBuffer.length) {
    const addedText = currentVal.slice(lastTextBuffer.length);
    sendAction('TYPE_TEXT', { text: addedText });
  } else if (currentVal.length < lastTextBuffer.length) {
    const deletedCount = lastTextBuffer.length - currentVal.length;
    for (let i = 0; i < deletedCount; i++) {
      sendAction('KEY_BACKSPACE');
    }
  }

  lastTextBuffer = currentVal;
}

liveTextInput.addEventListener('compositionstart', () => {
  isComposing = true;
});

liveTextInput.addEventListener('compositionend', () => {
  isComposing = false;
  syncKeyboardBuffer();
});

liveTextInput.addEventListener('input', () => {
  if (!isComposing) {
    syncKeyboardBuffer();
  }
});

liveTextInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendAction('KEY_ENTER');
    liveTextInput.value += '\n';
    lastTextBuffer = liveTextInput.value;
  }
});

// 9. VOICE DICTATION (EN & RU)
langChips.forEach(chip => {
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    langChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentLang = chip.dataset.lang;
    triggerHaptic(20);

    if (recognition && isRecognizing) {
      isRecognizing = false;
      try { recognition.stop(); } catch (err) {}
      setTimeout(() => startSpeechEngine(), 150);
    }
  });
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let lastSentSpeechText = '';

function startSpeechEngine() {
  if (!SpeechRecognition) {
    transcriptText.textContent = 'Speech recognition not supported';
    return;
  }

  try {
    if (recognition) {
      try { recognition.abort(); } catch (e) {}
    }

    recognition = new SpeechRecognition();
    recognition.lang = currentLang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;
    lastSentSpeechText = '';

    recognition.onstart = () => {
      isRecognizing = true;
      btnMic.classList.add('recording');
      transcriptText.textContent = 'Listening... Speak now';
      transcriptPreview.classList.add('active-speech');
      triggerHaptic([30, 50]);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const textToShow = finalTranscript || interimTranscript;
      if (textToShow) {
        transcriptText.textContent = textToShow;
      }

      if (finalTranscript) {
        const trimmed = finalTranscript.trim();
        if (trimmed && trimmed !== lastSentSpeechText) {
          lastSentSpeechText = trimmed;
          sendAction('TYPE_TEXT', { text: trimmed + ' ' });
          triggerHaptic(25);
        }
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech event error:', e.error);
      if (e.error === 'not-allowed') {
        transcriptText.textContent = 'Mic permission needed';
      }
      stopSpeechEngine();
    };

    recognition.onend = () => {
      if (isRecognizing) {
        try { recognition.start(); } catch (e) { stopSpeechEngine(); }
      } else {
        stopSpeechEngine();
      }
    };

    recognition.start();
  } catch (err) {
    console.error('Recognition start error:', err);
    stopSpeechEngine();
  }
}

function stopSpeechEngine() {
  if (isRecognizing && transcriptText.textContent) {
    const txt = transcriptText.textContent.trim();
    if (txt && !txt.includes('Listening') && !txt.includes('Speak now') && !txt.includes('Tap mic') && txt !== lastSentSpeechText) {
      sendAction('TYPE_TEXT', { text: txt + ' ' });
    }
  }
  isRecognizing = false;
  btnMic.classList.remove('recording');
  transcriptPreview.classList.remove('active-speech');
  transcriptText.textContent = 'Tap mic to speak...';
  lastSentSpeechText = '';
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }
}

function toggleMic(e) {
  if (e) e.preventDefault();
  if (isRecognizing) {
    stopSpeechEngine();
    triggerHaptic(25);
  } else {
    startSpeechEngine();
  }
}

btnMic.addEventListener('click', toggleMic);
btnMic.addEventListener('touchend', (e) => {
  e.preventDefault();
  toggleMic(e);
});

// 10. PRESENTER CHEVRON CONTROLS
btnPrev.addEventListener('click', () => {
  sendAction('SLIDE_PREV');
  triggerHaptic(45);
});

btnNext.addEventListener('click', () => {
  sendAction('SLIDE_NEXT');
  triggerHaptic(45);
});

btnPresentStart.addEventListener('click', () => {
  sendAction('SLIDE_START');
  triggerHaptic(35);
});

btnExit.addEventListener('click', () => {
  sendAction('SLIDE_EXIT');
  triggerHaptic(45);
});

// 11. SETTINGS MODAL
btnOpenSettings.addEventListener('click', () => {
  settingsModal.classList.add('active');
  triggerHaptic(20);
});

btnCloseSettings.addEventListener('click', () => {
  settingsModal.classList.remove('active');
  triggerHaptic(20);
});

closeSettingsBackdrop.addEventListener('click', () => {
  settingsModal.classList.remove('active');
});

sensitivitySlider.addEventListener('input', (e) => {
  sensitivity = parseFloat(e.target.value);
  sensitivityVal.textContent = `${sensitivity.toFixed(1)}x`;
});

invertScrollCheckbox.addEventListener('change', (e) => {
  invertScroll = e.target.checked;
  triggerHaptic(20);
});

hapticsCheckbox.addEventListener('change', (e) => {
  hapticsEnabled = e.target.checked;
  if (hapticsEnabled) triggerHaptic(30);
});

// Check route on startup
checkInitialRoute();
