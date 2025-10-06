// client/main.js
import * as THREE from 'three';
import { connect } from './network.js';
import WeaponSystem from './systems/WeaponSystem.js';
import BulletSystem from './systems/BulletSystem.js';
import { keyStates, mouseStates, initInputSystem, updateSensitivity } from './input.js';
import PlayerController from './systems/PlayerController.js';
import { Graphics } from './graphics.js';
import MapSystem from './systems/MapSystem.js';
import CrosshairSystem from './systems/CrosshairSystem.js';
import { WEAPONS } from '@configs/weapons.js';

// ========== 簡易 UI 幫手 ==========
function $(sel) { return document.querySelector(sel); }

// ========== 開發者模式（進階控件顯示） ==========
const DEV_MODE_KEY = 'ui.devMode';
function readDevMode() { try { return localStorage.getItem(DEV_MODE_KEY) === '1'; } catch (_) { return false; } }
function writeDevMode(enabled) { try { localStorage.setItem(DEV_MODE_KEY, enabled ? '1' : '0'); } catch (_) {} }
function applyDevModeToUi(enabled) {
  document.querySelectorAll('.dev-advanced').forEach(el => {
    if (enabled) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  });
  const cb = document.getElementById('dev-mode-toggle');
  if (cb) cb.checked = !!enabled;
}
function bindDevModeToggle() {
  const cb = document.getElementById('dev-mode-toggle');
  if (!cb) return;
  cb.addEventListener('change', (e) => {
    const enabled = !!e.target.checked;
    writeDevMode(enabled);
    applyDevModeToUi(enabled);
  });
}
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }
function showScreen(screenId) {
  // Hide all other screens by removing the 'active' class
  document.querySelectorAll('.menu-screen').forEach(div => {
    div.classList.remove('active');
  });

  // Show the target screen by adding the 'active' class
  const target = $(screenId);
  if (target) {
    target.classList.add('active');
    console.log('[UI] showScreen ->', screenId);

    // Apply developer mode UI state
    applyDevModeToUi(readDevMode());

    // Special logic for specific screens
    if (screenId === '#pause-screen') {
      populateSettingsVmSliders();
    }
  } else {
    console.warn('[UI] showScreen target not found:', screenId);
  }
}

// Hides all menu screens
function hideAllScreens() {
  document.querySelectorAll('.menu-screen').forEach(div => {
    div.classList.remove('active');
  });
}
function toast(msg) { console.log(msg); alert(msg); }

// ========== 全域狀態 ==========
let socket = null;
let currentRoomId = null;
let weaponSystem = null;
let bulletSystem = null;
let inMatch = false;
let myUsername = null;
let isHost = false;
let graphics = null;
let mapSystem = null;
let isPaused = false;
let playerController = null;
let _lastSentPos = 0;
let crosshair = null;
let fixedTargetCount = null; // 進入靶場時鎖定的靶子數量
let currentMode = 'training'; // training | multiplayer | robot
let myLastHealth = 100; // For damage indicator

// 武器選擇狀態 - 在主選單中選擇的武器會同步到遊戲中
let selectedWeaponConfig = {
  weaponId: 'pistol',
  skinIndex: 0
};

// 全域指標鎖定請求（需由使用者互動觸發）
function requestPointerLock() {
  const canvas = graphics?.renderer?.domElement || document.body;
  if (document.pointerLockElement !== canvas) {
    console.log('[POINTER] 請求指標鎖定');
    canvas.focus?.();
    canvas.requestPointerLock?.();
  }
}

// ========== 彈藥 UI ==========
const ammoDisplay = $('#ammo-display');
const ammoText = $('#ammo-text');
const healthDisplay = $('#health-display');
const healthBar = $('#health-bar');
const healthText = $('#health-text');
const startGameBtn = $('#start-game-btn');
const roomHostDisplay = $('#room-host-display');
const playerList = $('#player-list');
const joinCreateSection = $('#join-create-room-section');
let currentTeams = {}; // { username: teamKey }
const ui = {
  updateAmmo(current, max) {
    if (!ammoDisplay || !ammoText) return;
    ammoText.textContent = `${current} / ${max}`;
  }
};

// 退出房間與清理 UI
function clearRoomUi() {
  const info = $('#room-info');
  if (info) hide(info);
  if (playerList) playerList.innerHTML = '';
  if (roomHostDisplay) roomHostDisplay.textContent = '';
  isHost = false;
  updateStartBtnAvailability([]);
}

function leaveCurrentRoom() {
  if (socket && currentRoomId) {
    try { socket.emit('leaveRoom', currentRoomId); } catch (_) {}
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
  // 切回登入
  $('#login-tab').click();
}

async function doLogin() {
  const username = $('#login-username').value.trim();
  const password = $('#login-password').value.trim();
  if (!username || !password) return toast('請輸入帳號與密碼');
  const { token } = await api('/api/login', { username, password });
  // 不做任何本地儲存，僅本次會話使用 token
  // 先顯示主選單，再建立 Socket 連線，避免等待期間黑屏
  showScreen('#main-menu-screen');
  await connectSocket(token);
}

// ========== Socket.IO ==========
async function connectSocket(token) {
  // 已存在則先關閉
  if (socket) try { socket.disconnect(); } catch (_) {}

  socket = connect(token);
  console.log('[SOCKET] connecting with token length:', token?.length || 0);

  socket.on('connect', () => {
    console.log('[SOCKET] connected, id:', socket.id);
  });

  // 保存自己的名稱
  socket.on('me', ({ username }) => {
    myUsername = username;
    console.log('[ME]', myUsername);
    // 可能在我方收到 me 之前已經收到 roomCreated/roomJoined，補做一次房主判定與按鈕狀態
    setHost(roomHostDisplay?.textContent);
    updateStartBtnAvailability();
  });

  socket.on('connect_error', (err) => {
    console.error('連線失敗:', err?.message);
    toast('連線失敗，請重新登入');
    showScreen('#auth-screen');
  });

  // 房間/遊戲相關事件
  socket.on('roomCreated', ({ roomId, host }) => {
    currentRoomId = roomId;
    $('#room-id-display').textContent = roomId;
    show($('#room-info'));
    hide($('#join-create-room-section'));
    setHost(host);
    // Manually trigger player update to render the initial player list
    socket.emit('requestPlayerList', roomId);
  });

  socket.on('roomJoined', ({ roomId, host }) => {
    currentRoomId = roomId;
    $('#room-id-display').textContent = roomId;
    show($('#room-info'));
    hide($('#join-create-room-section'));
    setHost(host);
    // Manually trigger player update
    socket.emit('requestPlayerList', roomId);
  });

  socket.on('roomFull', () => {
    toast('房間已滿，請嘗試其他房間');
  });

  socket.on('updatePlayers', (players) => {
    console.log('目前玩家:', players);
    renderPlayers(players);
    updateStartBtnAvailability(players);
  });

  socket.on('roundStart', (gameState) => {
    console.log('回合開始', gameState);
    currentMode = 'multiplayer';
    startMatch();
  });

  // 單機/訓練模式事件
  socket.on('trainingStarted', ({ roomId, gameState }) => {
    console.log('[TRAINING] started', roomId, gameState);
    currentMode = 'training';
    currentRoomId = roomId;
    show($('#room-info'));
    hide(joinCreateSection);
    $('#room-id-display').textContent = roomId;
    startMatch();
  });

  socket.on('robotBattleStarted', ({ roomId, gameState }) => {
    console.log('[ROBOT] battle started', roomId, gameState);
    currentMode = 'robot';
    currentRoomId = roomId;
    show($('#room-info'));
    hide(joinCreateSection);
    $('#room-id-display').textContent = roomId;
    startMatch();
  });

  // 其他遊戲事件（炸彈/移動/離線）
  socket.on('bombPlanted', ({ position }) => {
    console.log('bombPlanted at', position);
    toast('炸彈已被安放！');
  });
  socket.on('bombDefused', () => {
    console.log('bombDefused');
    toast('炸彈已被拆除！');
  });
  socket.on('playerMoved', ({ username, position, rotation }) => {
    // 目前僅 log，之後可驅動其他玩家的 3D 模型
    console.debug('playerMoved', username, position, rotation);
  });
  socket.on('authoritativePosition', ({ position, rotation }) => {
    // 目前僅 log，之後可回寫本地插值/校正
    console.debug('authoritativePosition', position, rotation);
  });
  socket.on('playerDisconnected', ({ username, gameState }) => {
    console.log('playerDisconnected', username);
    // 從權威狀態重建玩家列表
    const players = gameState && gameState.players ? Object.keys(gameState.players) : [];
    renderPlayers(players);
    updateStartBtnAvailability(players);
  });

  socket.on('teamsUpdated', ({ teams }) => {
    currentTeams = teams || {};
    // 以 teams 的 key 當玩家名來重繪
    const players = Object.keys(currentTeams);
    renderPlayers(players);
    updateStartBtnAvailability(players);
  });

  socket.on('gameEnd', ({ winner, type, gameState }) => {
    console.log('遊戲結束', winner, type, gameState);
    endMatch();
    toast(`遊戲結束！獲勝方：${winner} (${type})`);
  });

  // 射擊相關回覆
  socket.on('playerShot', (payload) => {
    // 來自伺服器廣播的開火事件（未來可加入特效/聲音）
    console.log('playerShot', payload);
  });

  socket.on('shootRejected', ({ reason }) => {
    console.warn('射擊被拒絕:', reason);
  });

  socket.on('error', (msg) => {
    console.error('Server error:', msg);
    toast(msg);
  });

  // 狀態更新：更新自己的血量 HUD
  socket.on('gameStateUpdate', (data) => {
    if (!myUsername) return;
    const me = data?.players?.[myUsername];
    if (me) {
      if (me.health < myLastHealth) {
        const damageIndicator = $('#damage-indicator');
        if (damageIndicator) {
            damageIndicator.classList.remove('flash');
            void damageIndicator.offsetWidth; // Trigger reflow to restart animation
            damageIndicator.classList.add('flash');
        }
      }
      myLastHealth = me.health;
      updateHealth(me.health);
    }
  });

  // 計分板更新
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
    console.log('playerDied', username, 'by', killer);
    if (username === myUsername) {
      updateHealth(0);
      endMatch();
    }
    if (killer === myUsername) {
      const killConfirm = $('#kill-confirm');
      if (killConfirm) {
        killConfirm.classList.remove('show');
        void killConfirm.offsetWidth; // Trigger reflow to restart animation
        killConfirm.classList.add('show');
      }
    }
  });

  socket.on('roomClosed', () => {
    toast('房間已關閉');
    endMatch();
    clearRoomUi();
    show(joinCreateSection);
    showScreen('#main-menu-screen');
  });

  socket.on('disconnect', () => {
    endMatch();
    show(joinCreateSection);
    showScreen('#auth-screen');
  });
}

// ========== 多人房間 UI 綁定 ==========
function bindMultiplayerUi() {
  const gameModeRadios = document.querySelectorAll('input[name="gameMode"]');
  const killLimitSetting = document.getElementById('kill-limit-setting');
  const botCountSetting = document.getElementById('bot-count-setting');

  function updateDeathmatchSettings() {
    const selectedMode = document.querySelector('input[name="gameMode"]:checked')?.value;
    const isDeathmatch = selectedMode === 'deathmatch';
    if (killLimitSetting) {
        killLimitSetting.style.display = isDeathmatch ? 'block' : 'none';
    }
    if (botCountSetting) {
        botCountSetting.style.display = isDeathmatch ? 'block' : 'none';
    }
  }

  gameModeRadios.forEach(radio => radio.addEventListener('change', updateDeathmatchSettings));

  // Set initial state
  updateDeathmatchSettings();

  $('#create-room-btn')?.addEventListener('click', () => {
    if (!socket) return toast('尚未連線');
    const mode = document.querySelector('input[name="gameMode"]:checked')?.value || 'deathmatch';
    const killLimit = parseInt($('#kill-limit-input').value || '40', 10);
    const botCount = parseInt($('#bot-count-input').value || '0', 10);
    socket.emit('createRoom', { mode, killLimit, botCount });
  });

  $('#join-room-btn')?.addEventListener('click', () => {
    if (!socket) return toast('尚未連線');
    const roomId = $('#room-id-input').value.trim();
    if (!roomId) return toast('請輸入房間號碼');
    socket.emit('joinRoom', roomId);
  });

  $('#start-game-btn')?.addEventListener('click', () => {
    if (!socket || !currentRoomId) return toast('尚未加入房間');
    socket.emit('startGame', currentRoomId);
    // 使用者互動中請求鎖定
    requestPointerLock();
  });

  $('#switch-team-btn')?.addEventListener('click', () => {
    if (!socket || !currentRoomId) return toast('尚未加入房間');
    socket.emit('switchTeam', currentRoomId);
  });

  $('#leave-room-btn')?.addEventListener('click', () => {
    leaveCurrentRoom();
    show(joinCreateSection);
  });

  $('#back-to-main-multiplayer')?.addEventListener('click', () => {
    leaveCurrentRoom();
    showScreen('#main-menu-screen');
  });
}

// ========== 主選單與其他畫面 ==========
function bindMenuUi() {
  $('#multiplayer-btn')?.addEventListener('click', () => showScreen('#multiplayer-screen'));
  $('#settings-btn')?.addEventListener('click', () => showScreen('#settings-screen'));
  $('#weapon-skins-btn')?.addEventListener('click', () => {
    renderWeaponSkins();
    showScreen('#weapon-skins-screen');
  });
  $('#close-skins')?.addEventListener('click', () => showScreen('#main-menu-screen'));
  // 打開視圖調參面板
  $('#open-tuner')?.addEventListener('click', () => {
    showScreen('#weapon-tuner-screen');
    populateTunerFields();
  });
  $('#target-practice-settings-btn')?.addEventListener('click', () => {
    // 先進入靶場設定畫面，由使用者按「開始練習」再發送事件
    showScreen('#practice-settings-screen');
  });

  // 靶場練習：請求伺服器建立訓練房間
  $('#start-practice-btn')?.addEventListener('click', () => {
    if (!socket) return toast('請先登入連線');
    socket.emit('startTraining');
    // 使用者互動中請求鎖定
    requestPointerLock();
  });

  $('#close-settings')?.addEventListener('click', () => showScreen('#main-menu-screen'));
  $('#back-to-main-from-practice-settings')?.addEventListener('click', () => showScreen('#main-menu-screen'));

  // 靈敏度滑桿：數值顯示同步與即時生效
  const sensitivitySlider = $('#sensitivity-slider');
  const sensitivityValue = $('#sensitivity-value');
  if (sensitivitySlider && sensitivityValue) {
    const applySensitivity = (v) => {
      const num = parseFloat(v);
      sensitivityValue.textContent = num.toFixed(1);
      updateSensitivity(num);
    };
    sensitivitySlider.addEventListener('input', (e) => applySensitivity(e.target.value));
    // 初始化顯示與狀態
    applySensitivity(sensitivitySlider.value || '1.0');
  }

  // 動態渲染的武器/皮膚列表由 renderWeaponSkins() 建立與綁定事件
}

// ========== 武器塗裝：動態渲染與高亮 ==========
function updateActiveSkinHighlight() {
  const currentId = weaponSystem?.currentWeaponId;
  const currentSkin = weaponSystem?.skinIndex ?? 0;
  document.querySelectorAll('#weapon-skins-list .weapon-skin-item').forEach(item => {
    const w = item.getAttribute('data-weapon-id');
    const s = parseInt(item.getAttribute('data-skin-index') || '0', 10);
    if (w === currentId && s === currentSkin) item.classList.add('active');
    else item.classList.remove('active');
  });
}

function renderWeaponSkins() {
  const container = document.querySelector('#weapon-skins-list');
  if (!container) return;
  container.innerHTML = '';

  const order = ['pistol', 'rifle', 'knife'];
  const labels = { pistol: '手槍 (Pistol)', rifle: '步槍 (Rifle)', knife: '刀具 (Knife)' };

  order.forEach(weaponId => {
    const cfg = WEAPONS[weaponId];
    if (!cfg) return;

    // 類別標題
    const h = document.createElement('h3');
    h.textContent = labels[weaponId] || cfg.name || weaponId;
    container.appendChild(h);

    // 每個皮膚一個卡片
    const skins = Array.isArray(cfg.skins) ? cfg.skins : [];
    skins.forEach((skin, idx) => {
      const item = document.createElement('div');
      item.className = 'weapon-skin-item';
      item.setAttribute('data-weapon-id', weaponId);
      item.setAttribute('data-skin-index', String(idx));
      const title = document.createElement('h3');
      title.textContent = skin?.name || `Skin ${idx + 1}`;
      const desc = document.createElement('p');
      desc.textContent = `武器：${cfg.name || weaponId} ｜ 皮膚序號：${idx}`;
      item.appendChild(title);
      item.appendChild(desc);

      item.addEventListener('click', () => {
        // 更新全域選擇狀態
        selectedWeaponConfig.weaponId = weaponId;
        selectedWeaponConfig.skinIndex = idx;
        
        // 如果武器系統已初始化，立即應用
        if (weaponSystem) {
          weaponSystem.setWeapon(weaponId, idx);
        }
        
        updateActiveSkinHighlight();
        toast(`已選擇：${cfg.name || weaponId} - ${skin?.name || `Skin ${idx + 1}`}`);

        // 若調參面板可見，切換皮膚後即時刷新欄位
        const tuner = document.querySelector('#weapon-tuner-screen');
        if (tuner && getComputedStyle(tuner).display !== 'none') {
          populateTunerFields();
        }
        // 若暫停畫面可見，切換皮膚後也即時刷新滑桿
        const pause = document.querySelector('#pause-screen');
        if (pause && getComputedStyle(pause).display !== 'none') {
          populateSettingsVmSliders();
        }
      });

      container.appendChild(item);
    });
  });

  // 初次渲染時根據目前武器狀態高亮
  updateActiveSkinHighlight();
}

// ========== 對戰控制（Pointer Lock 與射擊） ==========
function startMatch() {
  inMatch = true;
  isPaused = false;

  // 進入對戰時隱藏所有選單，避免選單疊在畫面上造成看似「跳回主選單」
  hideAllScreens();

  // 建立或重設武器系統
  if (!weaponSystem) {
    console.log('[WEAPON] 初始化 WeaponSystem');
    weaponSystem = new WeaponSystem({ network: socket, ui, graphics, bulletSystem });
    // 使用主選單中選擇的武器配置
    weaponSystem.setWeapon(selectedWeaponConfig.weaponId, selectedWeaponConfig.skinIndex);
    console.log('[WEAPON] 應用選擇的武器:', selectedWeaponConfig.weaponId, 'skin:', selectedWeaponConfig.skinIndex);
  } else {
    // 回合開始時重設彈藥/狀態，保持當前武器選擇
    const weaponId = weaponSystem.currentWeaponId || selectedWeaponConfig.weaponId;
    const skinIndex = weaponSystem.skinIndex || selectedWeaponConfig.skinIndex;
    console.log('[WEAPON] 重設武器:', weaponId, 'skin:', skinIndex);
    weaponSystem.setWeapon(weaponId, skinIndex);
  }

  // 顯示 HUD
  show(ammoDisplay);
  show(healthDisplay);
  updateHealth(100);
  myLastHealth = 100; // Reset health for damage indicator

  // 根據模式顯示/隱藏計分板
  const scoreboard = $('#scoreboard');
  if (scoreboard) {
    scoreboard.style.display = currentMode === 'deathmatch' ? 'block' : 'none';
  }

  // 回合開始強制顯示準心（避免尚未鎖定時看不到）
  crosshair?.show();

  // 改善指標鎖定：僅在渲染畫布點擊時請求（避免調整 UI 時誤鎖）
  const canvas = graphics?.renderer?.domElement || document.body;
  const onCanvasClick = (e) => {
    if (!inMatch || isPaused) return;
    // 若任何選單畫面處於 active，則不鎖定
    if (document.querySelector('.menu-screen.active')) return;
    requestPointerLock();
  };
  canvas.addEventListener('click', onCanvasClick);

  // 監聽 pointer lock 變化：若在對戰中失去鎖定，視為暫停
  const onPlChange = () => {
    const canvas = graphics?.renderer?.domElement || document.body;
    const locked = document.pointerLockElement === canvas;
    if (inMatch && !locked && !isPaused) {
      isPaused = true;
      showScreen('#pause-screen');
    }
    // 準心顯示狀態
    if (locked && inMatch && !isPaused) crosshair?.show();
    else crosshair?.hide();
  };
  document.addEventListener('pointerlockchange', onPlChange);

  // 射擊/換彈事件（只在對戰中有效）
  // The new input system handles listeners globally, so we just need a cleanup function
  startMatch._cleanup = () => {
    document.removeEventListener('pointerlockchange', onPlChange);
    const canvas = graphics?.renderer?.domElement || document.body;
    canvas.removeEventListener('click', onCanvasClick);
    hide(ammoDisplay);
    crosshair?.hide();
  };

  // 地圖載入（簡易障礙）
  if (!mapSystem) {
    console.log('[MAP] 初始化 MapSystem');
    mapSystem = new MapSystem(graphics);
  }
  // 訓練模式：每次開始都重新讀取靶子數量，確保 UI 設定即時生效
  const mapKey = currentMode === 'training' ? 'training_range' : 'valorant_arena';
  let mapOpts = {};
  if (mapKey === 'training_range') {
    const val = parseInt(document.querySelector('#target-count-input')?.value || '10', 10);
    fixedTargetCount = isFinite(val) ? Math.max(1, Math.min(200, val)) : 10;
    mapOpts = { targetCount: fixedTargetCount };
    console.log('[MAP] 靶子數量設定為:', fixedTargetCount);
  }
  console.log('[MAP] 載入地圖:', mapKey, mapOpts);
  mapSystem.load(mapKey, mapOpts);
}

function endMatch() {
  inMatch = false;
  isPaused = false;
  if (startMatch._cleanup) startMatch._cleanup();
  if (document.exitPointerLock && document.pointerLockElement) {
    document.exitPointerLock();
  }
  hide(healthDisplay);
  // 隱藏計分板
  const scoreboard = $('#scoreboard');
  if (scoreboard) {
    scoreboard.style.display = 'none';
  }
}

// ========== Pause（Esc） ==========
function bindPauseUi() {
  const pauseScreen = $('#pause-screen');
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (!inMatch) return;
      const visible = getComputedStyle(pauseScreen).display !== 'none';
      if (visible) {
        // 復原遊戲：隱藏暫停並嘗試重新鎖定
        hide(pauseScreen);
        pauseScreen?.classList.remove('active');
        isPaused = false;
        requestPointerLock();
        // 鎖回時顯示準心
        const canvas = graphics?.renderer?.domElement || document.body;
        if (document.pointerLockElement === canvas) crosshair?.show();
      } else {
        // 進入暫停：解除鎖定並顯示暫停畫面
        isPaused = true;
        if (document.pointerLockElement) document.exitPointerLock();
        showScreen('#pause-screen');
        crosshair?.hide();
      }
    }
  });
  $('#resume-game')?.addEventListener('click', () => {
    hide(pauseScreen);
    pauseScreen?.classList.remove('active');
    isPaused = false;
    requestPointerLock();
  });
  $('#pause-settings')?.addEventListener('click', () => {
    hide(pauseScreen);
    pauseScreen?.classList.remove('active');
    showScreen('#settings-screen');
  });
  $('#back-to-main-pause')?.addEventListener('click', () => {
    hide(pauseScreen);
    pauseScreen?.classList.remove('active');
    endMatch();
    leaveCurrentRoom();
    showScreen('#main-menu-screen');
  });
}

// ========== UI Helpers ==========
function setHost(host) {
  if (roomHostDisplay) roomHostDisplay.textContent = host || '';
  isHost = !!(host && myUsername && host === myUsername);
}

function renderPlayers(players = []) {
  if (!playerList) return;
  playerList.innerHTML = '';
  
  if (players.length === 0) {
    const li = document.createElement('li');
    li.textContent = '無玩家在線';
    li.style.color = '#888';
    li.style.fontStyle = 'italic';
    playerList.appendChild(li);
    return;
  }
  
  players.forEach(name => {
    const li = document.createElement('li');
    const team = currentTeams?.[name] || '';
    const teamLabel = team === 'teamA' ? ' [A隊]' : team === 'teamB' ? ' [B隊]' : '';
    const isHost = name === roomHostDisplay?.textContent;
    
    li.textContent = `${name}${teamLabel}${isHost ? ' (房主)' : ''}`;
    li.style.padding = '0.25rem 0';
    li.style.borderBottom = '1px solid #333';
    
    if (isHost) {
      li.style.fontWeight = 'bold';
      li.style.color = '#00d4aa';
    }
    
    playerList.appendChild(li);
  });
}

function updateStartBtnAvailability(players) {
  if (!startGameBtn) return;
  const count = Array.isArray(players) ? players.length : playerList?.children?.length || 0;
  const canStart = isHost && count >= 1; // 允許單人開始遊戲以便測試
  startGameBtn.disabled = !canStart;
  
  // 更新按鈕文字和狀態
  if (canStart) {
    startGameBtn.textContent = '開始遊戲';
    startGameBtn.style.opacity = '1';
  } else {
    startGameBtn.textContent = '等待玩家加入...';
    startGameBtn.style.opacity = '0.6';
  }
}

function updateHealth(value) {
  if (!healthBar || !healthText) return;
  const v = Math.max(0, Math.min(100, Math.floor(value)));
  healthBar.style.width = v + '%';
  healthText.textContent = v;
}

// ========== Auth Tabs 與按鈕 ==========
function bindAuthUi() {
    const loginTab = $('#login-tab');
    const registerTab = $('#register-tab');
    const loginForm = $('#login-form');
    const registerForm = $('#register-form');

    loginTab?.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    });

    registerTab?.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });

    $('#register-btn')?.addEventListener('click', () => doRegister().catch(e => toast(e.message)));
    $('#login-btn')?.addEventListener('click', () => doLogin().catch(e => toast(e.message)));
}

// ========== 本地玩家移動與位置同步 ==========
function updateLocalPlayer(dt) {
    if (inMatch && !isPaused && playerController) {
        playerController.update(dt);

        // Throttle position updates
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

// ========== 開始 ==========
(function bootstrap() {
  bindAuthUi();
  bindMenuUi();
  bindMultiplayerUi();
  bindPauseUi();
  // 綁定並套用開發者模式狀態
  bindDevModeToggle();
  applyDevModeToUi(readDevMode());

  // 初始化 3D 渲染與視角控制
  graphics = new Graphics();
  graphics.init();
  // 初始化子彈系統（需要已初始化的 graphics.scene）
  bulletSystem = new BulletSystem(graphics);
  // 預先建立準心系統
  crosshair = new CrosshairSystem(document.getElementById('crosshair'));
  const slider = document.querySelector('#sensitivity-slider');
  const initSensitivity = parseFloat(slider?.value || '1.0');
  initInputSystem(initSensitivity);
  playerController = new PlayerController(graphics.getCamera(), keyStates, mouseStates);

  // 簡易渲染迴圈
  let last = performance.now();
  function handleGameInput() {
    if (!inMatch || isPaused || !weaponSystem) return;

    const canvas = graphics?.renderer?.domElement || document.body;

    // 允許不鎖定也能切武器/換彈（品質提升）
    // Handle reloading
    if (keyStates['KeyR']) {
      weaponSystem.startReload();
    }

    // Debug：切換槍口標記（M）
    if (keyStates['KeyM']) {
      const now = performance.now();
      if (!weaponSystem._lastMuzzleToggle || now - weaponSystem._lastMuzzleToggle > 300) {
        const enabled = !weaponSystem.isMuzzleDebugEnabled?.();
        weaponSystem.setMuzzleDebug?.(enabled);
        weaponSystem._lastMuzzleToggle = now;
        console.log(`[DEBUG] 槍口標記: ${enabled ? '開啟' : '關閉'}`);
      }
    }

    // Handle weapon switching - 防止重複切換同一武器
    const weaponMap = { Digit1: 'rifle', Digit2: 'pistol', Digit3: 'knife' };
    for (const [key, weapon] of Object.entries(weaponMap)) {
      if (keyStates[key] && weaponSystem?.currentWeaponId !== weapon) {
        // 添加延遲檢查，防止按鍵重複觸發
        if (!weaponSystem._lastSwitchTime || performance.now() - weaponSystem._lastSwitchTime > 300) {
          weaponSystem.setWeapon(weapon);
          weaponSystem._lastSwitchTime = performance.now();
        }
      }
    }

    // 射擊仍需 Pointer Lock（避免誤觸）
    if (document.pointerLockElement !== canvas) return;

    // Handle shooting
    if (mouseStates.left) {
      const cam = graphics?.getCamera?.();
      const scene = graphics?.scene;
      if (!cam || !scene) return;
      // 從畫面中心 (0,0) 設定射線
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(0, 0), cam);
      // 排除相機、tracer、武器與手部模型
      const candidates = scene.children.filter(o => o !== cam && !o?.userData?.isTracer && !o?.userData?.isWeapon && !o?.userData?.isHands);
      let hits = rc.intersectObjects(candidates, true);
      // 再次保險：過濾掉 tracer、武器與手部物件
      hits = hits.filter(h => !h.object?.userData?.isTracer && !h.object?.userData?.isWeapon && !h.object?.userData?.isHands);
      const hit = hits[0];
      const point = hit?.point || rc.ray.origin.clone().add(rc.ray.direction.clone().multiplyScalar(1000));
      const aimPoint = { x: point.x, y: point.y, z: point.z };
      weaponSystem.fire({ roomId: currentRoomId, aimPoint });
      // 命中靶子時觸發 MapSystem 回調（命中反饋 + 重生）
      if (hit?.object?.userData?.isTarget) {
        mapSystem?.onTargetHit(hit.object);
      }
    }
  }

function loop(now) {
    const dt = (now - last) / 1000;
    last = now;

    // 先更新玩家/相機，再處理射擊輸入，避免一幀延遲
    updateLocalPlayer(dt);
    handleGameInput();
    
    // 暫停時凍結彈道衰減，避免暫停畫面彈道消失
    bulletSystem?.update(isPaused ? 0 : dt);

    // 校正武器/手部掛載（避免外部誤改父子關係導致飄移）
    weaponSystem?.updateAttachment?.();

    graphics.render(dt);
    requestAnimationFrame(loop);
}
  requestAnimationFrame(loop);

  // 全域錯誤攔截，避免錯誤被吞掉造成黑屏無訊息
  window.addEventListener('error', (e) => {
    console.error('[GLOBAL ERROR]', e?.error || e?.message || e);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[UNHANDLED REJECTION]', e?.reason || e);
  });

  // Start by showing the authentication screen
  showScreen('#auth-screen');
})();