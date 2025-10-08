// client/main.js
import { connect } from './network.js';
import WeaponSystem from './systems/WeaponSystem.js';
import BulletSystem from './systems/BulletSystem.js';
import { keyStates, mouseStates, initInputSystem } from './input.js';
import PlayerController from './systems/PlayerController.js';
import { Graphics } from './graphics.js';
import MapSystem from './systems/MapSystem.js';
import CrosshairSystem from './systems/CrosshairSystem.js';
import { WEAPONS } from '@configs/weapons.js';

// ========== 簡易 UI 幫手 ==========
function $(sel) { return document.querySelector(sel); }

// ========== UI 顯示/隱藏控制 ==========
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

function showScreen(screenId) {
  document.querySelectorAll('.menu-screen').forEach(div => {
    div.classList.remove('active');
  });
  const target = $(screenId);
  if (target) {
    target.classList.add('active');
    console.log('[UI] showScreen ->', screenId);
  } else {
    console.warn('[UI] showScreen target not found:', screenId);
  }
}

function hideAllScreens() {
  document.querySelectorAll('.menu-screen').forEach(div => {
    div.classList.remove('active');
  });
}
function toast(msg) {
  // A simple, non-blocking toast notification would be better in a real application.
  console.log(`[TOAST] ${msg}`);
  alert(msg);
}

// ========== 全域狀態 ==========
let socket = null;
let currentRoomId = null;
let weaponSystem = null;
let bulletSystem = null;
let inMatch = false;
let myUsername = null;
let graphics = null;
let mapSystem = null;
let isPaused = false;
let playerController = null;
let _lastSentPos = 0;
let crosshair = null;
let currentMode = 'training';
let myLastHealth = 100;

let selectedWeaponConfig = {
  weaponId: 'classic',
  skinIndex: 0
};

function requestPointerLock() {
  const canvas = graphics?.renderer?.domElement || document.body;
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
}

// ========== UI 元素快取 ==========
const ammoDisplay = $('#ammo-display');
const ammoText = $('#ammo-text');
const healthDisplay = $('#health-display');
const healthBar = $('#health-bar');
const healthText = $('#health-text');
const roomHostDisplay = $('#room-host-display');
const playerList = $('#player-list');
const weaponInfoDisplay = $('#weapon-info-display');
const weaponNameText = $('#weapon-name-text');
const skinNameText = $('#skin-name-text');

const ui = {
  updateAmmo(current, max) {
    if (!ammoDisplay || !ammoText) return;
    ammoText.textContent = `${current} / ${max}`;
  }
};

function clearRoomUi() {
  const info = $('#room-info');
  if (info) hide(info);
  if (playerList) playerList.innerHTML = '';
  if (roomHostDisplay) roomHostDisplay.textContent = '';
  show($('#join-create-room-section'));
  updateStartBtnAvailability([]);
}

function leaveCurrentRoom() {
  if (socket && currentRoomId) {
    try {
      socket.emit('leaveRoom', currentRoomId);
    } catch (e) {
      console.warn('Error leaving room:', e.message);
    }
  }
  currentRoomId = null;
  clearRoomUi();
}

// ========== 認證相關 ==========
async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '請求失敗');
  return data;
}

async function doRegister() {
  const username = $('#register-username').value.trim();
  const password = $('#register-password').value.trim();
  if (!username || !password) return toast('請輸入帳號與密碼');
  await api('/api/register', { username, password });
  toast('註冊成功，請登入');
  $('#login-tab').click();
}

async function doLogin() {
  const username = $('#login-username').value.trim();
  const password = $('#login-password').value.trim();
  if (!username || !password) return toast('請輸入帳號與密碼');

  try {
    const { token } = await api('/api/login', { username, password });
    showScreen('#main-menu-screen');
    await connectSocket(token, username);
  } catch (error) {
    toast(`登入失敗: ${error.message}`);
  }
}

// ========== Socket.IO ==========
async function connectSocket(token, username) {
  if (socket) {
    try {
      socket.disconnect();
    } catch (e) {
      console.warn('Error disconnecting previous socket:', e.message);
    }
  }

  socket = connect(token, username);

  socket.on('connect', () => console.log('[SOCKET] connected, id:', socket.id));

  socket.on('me', ({ username: receivedUsername }) => {
    myUsername = receivedUsername;
    setHost(roomHostDisplay?.textContent);
    updateStartBtnAvailability();
  });

  socket.on('connect_error', (err) => {
    console.error('連線失敗:', err?.message);
    toast('連線失敗，請重新登入');
    showScreen('#auth-screen');
  });

  // Room/Game events
  socket.on('roomCreated', ({ roomId, host }) => {
    currentRoomId = roomId;
    $('#room-id-display').textContent = roomId;
    show($('#room-info'));
    hide($('#join-create-room-section'));
    setHost(host);
    socket.emit('requestPlayerList', roomId);
  });

  socket.on('roomJoined', ({ roomId, host }) => {
    currentRoomId = roomId;
    $('#room-id-display').textContent = roomId;
    show($('#room-info'));
    hide($('#join-create-room-section'));
    setHost(host);
    socket.emit('requestPlayerList', roomId);
  });

  socket.on('roomFull', () => toast('房間已滿，請嘗試其他房間'));
  socket.on('updatePlayers', (players) => {
    renderPlayers(players);
    updateStartBtnAvailability(players);
  });

  socket.on('roundStart', (gameState) => {
    currentMode = gameState.mode;
    startMatch();
  });

  socket.on('gameEnd', ({ winner, score }) => {
    endMatch();
    toast(`遊戲結束！ ${winner} 隊獲勝！`);
    showScreen('#main-menu-screen');
  });

  socket.on('roundEnd', ({ winner, score }) => {
    toast(`回合結束！ ${winner} 隊獲勝！`);
  });

  socket.on('gameStateUpdate', (data) => {
    if (!myUsername) return;
    const me = data?.players?.[myUsername];
    if (me) {
      if (me.health < myLastHealth) {
        const damageIndicator = $('#damage-indicator');
        if (damageIndicator) {
          damageIndicator.classList.remove('flash');
          void damageIndicator.offsetWidth;
          damageIndicator.classList.add('flash');
        }
      }
      myLastHealth = me.health;
      updateHealth(me.health);
    }
  });

  socket.on('leaderboardUpdate', (leaderboardData) => {
    const scoreboardList = $('#scoreboard-list');
    if (!scoreboardList) return;
    scoreboardList.innerHTML = '';
    leaderboardData.forEach(p => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.padding = '4px 0';
      li.innerHTML = `<span>${p.username}</span><span>${p.kills}</span>`;
      scoreboardList.appendChild(li);
    });
  });

  socket.on('playerDied', ({ username, killer }) => {
    if (username === myUsername) {
      updateHealth(0);
      if (currentMode === 'deathmatch') {
        endMatch();
      }
    }
    if (killer === myUsername) {
      const killConfirm = $('#kill-confirm');
      if (killConfirm) {
        killConfirm.classList.remove('show');
        void killConfirm.offsetWidth;
        killConfirm.classList.add('show');
      }
    }
  });

  socket.on('roomClosed', () => {
    toast('房間已關閉');
    endMatch();
    clearRoomUi();
    showScreen('#main-menu-screen');
  });

  socket.on('disconnect', () => {
    endMatch();
    clearRoomUi();
    showScreen('#auth-screen');
  });
}

// ========== Multiplayer UI Bindings ==========
function bindMultiplayerUi() {
  // ... (omitted for brevity, no changes here)
}

// ========== Main Menu & Other Screens ==========
function bindMenuUi() {
  $('#multiplayer-btn')?.addEventListener('click', () => showScreen('#multiplayer-screen'));
  $('#settings-btn')?.addEventListener('click', () => showScreen('#settings-screen'));
  $('#weapon-skins-btn')?.addEventListener('click', () => {
    renderWeaponSkins();
    showScreen('#weapon-skins-screen');
  });
  $('#close-skins')?.addEventListener('click', () => showScreen('#main-menu-screen'));
  $('#target-practice-settings-btn')?.addEventListener('click', () => {
    showScreen('#practice-settings-screen');
  });
  $('#start-practice-btn')?.addEventListener('click', () => {
    if (!socket) return toast('請先登入連線');
    socket.emit('startTraining');
    requestPointerLock();
  });
  $('#close-settings')?.addEventListener('click', () => showScreen('#main-menu-screen'));
  $('#back-to-main-from-practice-settings')?.addEventListener('click', () => showScreen('#main-menu-screen'));
}

// ========== Weapon Skins ==========
function renderWeaponSkins() {
  const container = $('#weapon-skins-list');
  if (!container) return;
  container.innerHTML = '';

  Object.entries(WEAPONS).forEach(([weaponId, weapon]) => {
    const weaponDiv = document.createElement('div');
    weaponDiv.className = 'weapon-skin-group';
    const title = document.createElement('h3');
    title.textContent = weapon.name;
    weaponDiv.appendChild(title);

    const skinList = document.createElement('div');
    skinList.className = 'skin-list';

    weapon.skins.forEach((skin, skinIndex) => {
      const skinButton = document.createElement('button');
      skinButton.className = 'btn btn-secondary skin-btn';
      skinButton.textContent = skin.name;
      skinButton.dataset.weaponId = weaponId;
      skinButton.dataset.skinIndex = skinIndex;

      if (weaponId === selectedWeaponConfig.weaponId && skinIndex === selectedWeaponConfig.skinIndex) {
        skinButton.classList.add('active');
      }

      skinButton.addEventListener('click', () => {
        selectedWeaponConfig.weaponId = weaponId;
        selectedWeaponConfig.skinIndex = skinIndex;

        container.querySelectorAll('.skin-btn').forEach(btn => btn.classList.remove('active'));
        skinButton.classList.add('active');

        if (weaponSystem) {
          weaponSystem.setWeapon(weaponId, skinIndex);
        }
        updateWeaponUi(weaponId, skinIndex);
      });

      skinList.appendChild(skinButton);
    });

    weaponDiv.appendChild(skinList);
    container.appendChild(weaponDiv);
  });
}

// ========== Match Control ==========
function startMatch() {
  inMatch = true;
  isPaused = false;
  hideAllScreens();

  if (!weaponSystem) {
    weaponSystem = new WeaponSystem({ network: socket, ui, graphics, bulletSystem });
  }
  weaponSystem.setWeapon(selectedWeaponConfig.weaponId, selectedWeaponConfig.skinIndex);

  show(ammoDisplay);
  show(healthDisplay);
  show(weaponInfoDisplay);
  updateHealth(100);
  myLastHealth = 100;
  updateWeaponUi(selectedWeaponConfig.weaponId, selectedWeaponConfig.skinIndex);

  const scoreboard = $('#scoreboard');
  if (scoreboard) {
    scoreboard.style.display = currentMode === 'deathmatch' ? 'block' : 'none';
  }
  crosshair?.show();

  const canvas = graphics?.renderer?.domElement || document.body;
  const onCanvasClick = () => {
    if (inMatch && !isPaused && !document.querySelector('.menu-screen.active')) {
      requestPointerLock();
    }
  };
  canvas.addEventListener('click', onCanvasClick);

  const onPlChange = () => {
    const isLocked = document.pointerLockElement === canvas;
    if (inMatch && !isLocked && !isPaused) {
      isPaused = true;
      showScreen('#pause-screen');
    }
    if (isLocked) crosshair?.show(); else crosshair?.hide();
  };
  document.addEventListener('pointerlockchange', onPlChange);

  startMatch._cleanup = () => {
    document.removeEventListener('pointerlockchange', onPlChange);
    canvas.removeEventListener('click', onCanvasClick);
    hide(ammoDisplay);
    crosshair?.hide();
  };

  if (!mapSystem) {
    mapSystem = new MapSystem(graphics);
  }
  mapSystem.load('valorant_arena', {});
}

function endMatch() {
  inMatch = false;
  isPaused = false;
  if (startMatch._cleanup) startMatch._cleanup();
  if (document.exitPointerLock && document.pointerLockElement) {
    document.exitPointerLock();
  }
  hide(healthDisplay);
  hide(weaponInfoDisplay);
  hide($('#scoreboard'));
}

// ========== UI Helpers ==========
function updateWeaponUi(weaponId, skinIndex) {
  if (!weaponInfoDisplay || !weaponNameText || !skinNameText) return;
  const weapon = WEAPONS[weaponId];
  const skin = weapon?.skins?.[skinIndex];
  if (!weapon || !skin) return;

  weaponNameText.textContent = weapon.name;
  skinNameText.textContent = skin.name;
}

function updateHealth(value) {
  if (!healthBar || !healthText) return;
  const v = Math.max(0, Math.min(100, Math.floor(value)));
  healthBar.style.width = `${v}%`;
  healthText.textContent = v;
}

function setHost(host) {
  const isHost = !!(host && myUsername && host === myUsername);
  if (roomHostDisplay) roomHostDisplay.textContent = host || '';
  const startGameBtn = $('#start-game-btn');
  if(startGameBtn) {
    startGameBtn.disabled = !isHost;
  }
}

function renderPlayers(players = []) {
  if (!playerList) return;
  playerList.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p;
    playerList.appendChild(li);
  });
}

function updateStartBtnAvailability(players) {
  const startGameBtn = $('#start-game-btn');
  if (startGameBtn) {
    const isHost = roomHostDisplay.textContent === myUsername;
    startGameBtn.disabled = !isHost || players.length < 2;
  }
}

// ========== Auth Tabs & Buttons ==========
function bindAuthUi() {
  const loginTab = $('#login-tab');
  const registerTab = $('#register-tab');
  const loginForm = $('#login-form');
  const registerForm = $('#register-form');

  loginTab?.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    show(loginForm);
    hide(registerForm);
  });

  registerTab?.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    show(registerForm);
    hide(loginForm);
  });

  $('#register-btn')?.addEventListener('click', () => doRegister().catch(e => toast(e.message)));
  $('#login-btn')?.addEventListener('click', () => doLogin().catch(e => toast(e.message)));
}

// ========== Local Player Movement & Sync ==========
function updateLocalPlayer(dt) {
  if (inMatch && !isPaused && playerController) {
    playerController.update(dt);
    const now = performance.now();
    if (socket && currentRoomId && now - _lastSentPos > 50) {
      _lastSentPos = now;
      const cam = graphics.getCamera();
      const pos = cam.position;
      const rot = { x: cam.rotation.x, y: cam.rotation.y, z: cam.rotation.z };
      socket.emit('playerUpdate', { roomId: currentRoomId, position: { x: pos.x, y: pos.y, z: pos.z }, rotation: rot });
    }
  }
}

function gameLoop(now) {
  gameLoop.last = gameLoop.last || now;
  const dt = (now - gameLoop.last) / 1000;
  gameLoop.last = now;
  updateLocalPlayer(dt);
  weaponSystem?.updateAttachment?.();
  graphics.render();
  requestAnimationFrame(gameLoop);
}

// ========== Bootstrap ==========
(function bootstrap() {
  bindAuthUi();
  bindMenuUi();
  bindMultiplayerUi();

  graphics = new Graphics();
  graphics.init();

  bulletSystem = new BulletSystem(graphics);
  crosshair = new CrosshairSystem(document.getElementById('crosshair'));
  const slider = $('#sensitivity-slider');
  const initSensitivity = parseFloat(slider?.value || '1.0');
  initInputSystem(initSensitivity);
  playerController = new PlayerController(graphics.getCamera(), keyStates, mouseStates);

  requestAnimationFrame(gameLoop);
  showScreen('#auth-screen');
})();