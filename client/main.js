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

// ========== 視圖參數調節面板 ==========
function degFromRad(r) { return (r || 0) * 180 / Math.PI; }
function radFromDeg(d) { return (d || 0) * Math.PI / 180; }

function currentWeaponSkin() {
  const weaponId = weaponSystem?.currentWeaponId || selectedWeaponConfig.weaponId || 'pistol';
  const skinIndex = Number.isInteger(weaponSystem?.skinIndex) ? weaponSystem.skinIndex : (selectedWeaponConfig.skinIndex || 0);
  return { weaponId, skinIndex };
}

function mergedViewFor(weaponId, skinIndex) {
  const cfg = WEAPONS[weaponId] || {};
  const baseVM = cfg.viewModel || {};
  const skinVM = (cfg.skins && cfg.skins[skinIndex] && cfg.skins[skinIndex].viewModel) ? cfg.skins[skinIndex].viewModel : {};
  let merged = { ...baseVM, ...skinVM };
  try {
    // 優先從 WeaponSystem 的覆寫緩存讀取
    if (weaponSystem) {
      // 當前武器/皮膚可直接用公開方法
      if (weaponSystem.currentWeaponId === weaponId && weaponSystem.skinIndex === skinIndex) {
        const ov = weaponSystem.getCurrentViewModelOverride?.();
        if (ov && typeof ov === 'object') merged = { ...merged, ...ov };
      } else if (weaponSystem._vmOverridesLoaded && weaponSystem._vmOverrides) {
        const wMap = weaponSystem._vmOverrides[weaponId];
        const ov = wMap ? (wMap[String(skinIndex)] ?? wMap[skinIndex]) : null;
        if (ov && typeof ov === 'object') merged = { ...merged, ...ov };
      } else {
        // 觸發背景載入，完成後若畫面仍可見則刷新欄位
        const p = weaponSystem._ensureOverridesLoaded?.();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            const tuner = document.querySelector('#weapon-tuner-screen');
            if (tuner && getComputedStyle(tuner).display !== 'none') populateTunerFields();
            const pause = document.querySelector('#pause-screen');
            if (pause && getComputedStyle(pause).display !== 'none') populateSettingsVmSliders();
          }).catch(() => {});
        }
      }
    }
  } catch {}
  return merged;
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = (val ?? '') === '' ? '' : String(val);
}

function populateTunerFields() {
  const { weaponId, skinIndex } = currentWeaponSkin();
  const vm = mergedViewFor(weaponId, skinIndex) || {};

  // Scale：若為 number 則填單一值，否則嘗試以陣列填 X/Y/Z
  if (typeof vm.scale === 'number') {
    setInputValue('vm-scale', vm.scale);
    setInputValue('vm-scale-x', '');
    setInputValue('vm-scale-y', '');
    setInputValue('vm-scale-z', '');
  } else if (Array.isArray(vm.scale) && vm.scale.length === 3) {
    setInputValue('vm-scale', '');
    setInputValue('vm-scale-x', vm.scale[0]);
    setInputValue('vm-scale-y', vm.scale[1]);
    setInputValue('vm-scale-z', vm.scale[2]);
  } else {
    setInputValue('vm-scale', '');
    setInputValue('vm-scale-x', '');
    setInputValue('vm-scale-y', '');
    setInputValue('vm-scale-z', '');
  }

  // Position
  const pos = Array.isArray(vm.position) && vm.position.length === 3 ? vm.position : ['', '', ''];
  setInputValue('vm-pos-x', pos[0]);
  setInputValue('vm-pos-y', pos[1]);
  setInputValue('vm-pos-z', pos[2]);

  // Rotation（轉為度數）
  const rot = Array.isArray(vm.rotation) && vm.rotation.length === 3 ? vm.rotation : ['', '', ''];
  setInputValue('vm-rot-x', rot[0] === '' ? '' : degFromRad(rot[0]).toFixed(2));
  setInputValue('vm-rot-y', rot[1] === '' ? '' : degFromRad(rot[1]).toFixed(2));
  setInputValue('vm-rot-z', rot[2] === '' ? '' : degFromRad(rot[2]).toFixed(2));

  // Muzzle Offset
  const muz = Array.isArray(vm.muzzleOffset) && vm.muzzleOffset.length === 3 ? vm.muzzleOffset : ['', '', ''];
  setInputValue('vm-muz-x', muz[0]);
  setInputValue('vm-muz-y', muz[1]);
  setInputValue('vm-muz-z', muz[2]);
}

function parseNum(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

function bindTunerUi() {
  // 返回塗裝
  document.getElementById('vm-back')?.addEventListener('click', () => {
    showScreen('#weapon-skins-screen');
  });

  // 清除此皮膚覆寫（改為呼叫伺服器 API）
  document.getElementById('vm-clear')?.addEventListener('click', async () => {
    try {
      if (weaponSystem?.clearCurrentViewModelOverride) {
        await weaponSystem.clearCurrentViewModelOverride();
      } else {
        const { weaponId, skinIndex } = currentWeaponSkin();
        await fetch('/api/viewmodel-overrides/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weaponId, skinIndex })
        });
      }
      populateTunerFields();
      toast('已清除此皮膚的覆寫');
    } catch (e) {
      console.warn('[UI] 清除覆寫失敗:', e?.message || e);
      toast('清除覆寫失敗');
    }
  });

  // 保存並套用（改為呼叫伺服器 API）
  document.getElementById('vm-save')?.addEventListener('click', async () => {
    const scaleUniform = parseNum(document.getElementById('vm-scale')?.value);
    const sx = parseNum(document.getElementById('vm-scale-x')?.value);
    const sy = parseNum(document.getElementById('vm-scale-y')?.value);
    const sz = parseNum(document.getElementById('vm-scale-z')?.value);
    const px = parseNum(document.getElementById('vm-pos-x')?.value);
    const py = parseNum(document.getElementById('vm-pos-y')?.value);
    const pz = parseNum(document.getElementById('vm-pos-z')?.value);
    const rx = parseNum(document.getElementById('vm-rot-x')?.value);
    const ry = parseNum(document.getElementById('vm-rot-y')?.value);
    const rz = parseNum(document.getElementById('vm-rot-z')?.value);
    const mx = parseNum(document.getElementById('vm-muz-x')?.value);
    const my = parseNum(document.getElementById('vm-muz-y')?.value);
    const mz = parseNum(document.getElementById('vm-muz-z')?.value);

    const partial = {};
    if (Number.isFinite(scaleUniform)) partial.scale = scaleUniform;
    else if (Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sz)) partial.scale = [sx, sy, sz];

    if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz)) partial.position = [px, py, pz];

    if (Number.isFinite(rx) && Number.isFinite(ry) && Number.isFinite(rz)) partial.rotation = [radFromDeg(rx), radFromDeg(ry), radFromDeg(rz)];

    if (Number.isFinite(mx) && Number.isFinite(my) && Number.isFinite(mz)) partial.muzzleOffset = [mx, my, mz];

    try {
      if (weaponSystem?.setCurrentViewModelOverride) {
        await weaponSystem.setCurrentViewModelOverride(partial);
      } else {
        const { weaponId, skinIndex } = currentWeaponSkin();
        await fetch('/api/viewmodel-overrides/set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weaponId, skinIndex, partial })
        });
      }
      toast('已保存覆寫並套用');
    } catch (e) {
      console.warn('[UI] 保存覆寫失敗:', e?.message || e);
      toast('保存覆寫失敗');
    }
  });
}

// ========== 設定頁：武器視圖快速調整（滑桿） ==========
function setRangeAndLabel(rangeId, labelId, value, decimals = 2) {
  const r = document.getElementById(rangeId);
  const lb = document.getElementById(labelId);
  if (r) r.value = String(value);
  if (lb && Number.isFinite(+value)) lb.textContent = (+value).toFixed(decimals);
}

async function applyVmPartial(partial) {
  if (weaponSystem?.setCurrentViewModelOverride) {
    try { await weaponSystem.setCurrentViewModelOverride(partial); } catch {}
    return;
  }
  // Fallback：尚未初始化武器系統時，直接呼叫伺服器 API
  const { weaponId, skinIndex } = currentWeaponSkin();
  try {
    await fetch('/api/viewmodel-overrides/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weaponId, skinIndex, partial })
    });
  } catch {}
}

function populateSettingsVmSliders() {
  const { weaponId, skinIndex } = currentWeaponSkin();
  const vm = mergedViewFor(weaponId, skinIndex) || {};

  // Scale（若為陣列則取平均作為顯示值）
  let scaleUniform = 0.15;
  if (typeof vm.scale === 'number') scaleUniform = vm.scale;
  else if (Array.isArray(vm.scale) && vm.scale.length === 3) {
    const [sx, sy, sz] = vm.scale;
    const nums = [sx, sy, sz].map(v => +v).filter(n => Number.isFinite(n));
    if (nums.length === 3) scaleUniform = (nums[0] + nums[1] + nums[2]) / 3;
  }
  setRangeAndLabel('settings-vm-scale-range', 'settings-vm-scale-value', scaleUniform, 3);

  // Position
  const p = Array.isArray(vm.position) && vm.position.length === 3 ? vm.position : [0.6, -0.5, -1.0];
  setRangeAndLabel('settings-vm-pos-x', 'settings-vm-pos-x-value', +p[0], 2);
  setRangeAndLabel('settings-vm-pos-y', 'settings-vm-pos-y-value', +p[1], 2);
  setRangeAndLabel('settings-vm-pos-z', 'settings-vm-pos-z-value', +p[2], 2);

  // Rotation（弧度轉度）
  const r = Array.isArray(vm.rotation) && vm.rotation.length === 3 ? vm.rotation : [radFromDeg(-5), radFromDeg(180), radFromDeg(5)];
  setRangeAndLabel('settings-vm-rot-x', 'settings-vm-rot-x-value', degFromRad(+r[0]), 2);
  setRangeAndLabel('settings-vm-rot-y', 'settings-vm-rot-y-value', degFromRad(+r[1]), 2);
  setRangeAndLabel('settings-vm-rot-z', 'settings-vm-rot-z-value', degFromRad(+r[2]), 2);

  // Muzzle Offset
  const m = Array.isArray(vm.muzzleOffset) && vm.muzzleOffset.length === 3 ? vm.muzzleOffset : [0, 0, 0];
  setRangeAndLabel('settings-vm-muz-x', 'settings-vm-muz-x-value', +m[0], 2);
  setRangeAndLabel('settings-vm-muz-y', 'settings-vm-muz-y-value', +m[1], 2);
  setRangeAndLabel('settings-vm-muz-z', 'settings-vm-muz-z-value', +m[2], 2);

  // Screen Muzzle（NDC 與 Depth）
  // 來源優先順序：muzzleScreen (NDC) > 由 muzzleScreenPx 轉換
  let ndcX = 0.0, ndcY = 0.0;
  if (Array.isArray(vm.muzzleScreen) && vm.muzzleScreen.length === 2) {
    ndcX = Number.isFinite(+vm.muzzleScreen[0]) ? +vm.muzzleScreen[0] : 0;
    ndcY = Number.isFinite(+vm.muzzleScreen[1]) ? +vm.muzzleScreen[1] : 0;
  } else if (Array.isArray(vm.muzzleScreenPx) && vm.muzzleScreenPx.length === 2) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const px = +vm.muzzleScreenPx[0];
    const py = +vm.muzzleScreenPx[1];
    if (Number.isFinite(px) && Number.isFinite(py)) {
      ndcX = (px / w) * 2 - 1;
      ndcY = 1 - (py / h) * 2; // 像素原點在左上，NDC Y 向上為正
    }
  }
  const depth = Number.isFinite(+vm.muzzleDepth) ? +vm.muzzleDepth : 0.25;
  setRangeAndLabel('settings-vm-muz-screen-x', 'settings-vm-muz-screen-x-value', ndcX, 3);
  setRangeAndLabel('settings-vm-muz-screen-y', 'settings-vm-muz-screen-y-value', ndcY, 3);
  setRangeAndLabel('settings-vm-muz-depth', 'settings-vm-muz-depth-value', depth, 2);
}

function bindSettingsVmSliders() {
  // Scale
  document.getElementById('settings-vm-scale-range')?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    setRangeAndLabel('settings-vm-scale-range', 'settings-vm-scale-value', v, 3);
    if (Number.isFinite(v)) applyVmPartial({ scale: v });
  });

  // Position
  ['x', 'y', 'z'].forEach(axis => {
    document.getElementById(`settings-vm-pos-${axis}`)?.addEventListener('input', () => {
      const px = parseFloat(document.getElementById('settings-vm-pos-x')?.value);
      const py = parseFloat(document.getElementById('settings-vm-pos-y')?.value);
      const pz = parseFloat(document.getElementById('settings-vm-pos-z')?.value);
      setRangeAndLabel(`settings-vm-pos-${axis}`, `settings-vm-pos-${axis}-value`, parseFloat(document.getElementById(`settings-vm-pos-${axis}`)?.value), 2);
      if ([px, py, pz].every(Number.isFinite)) applyVmPartial({ position: [px, py, pz] });
    });
  });

  // Rotation（度數 -> 弧度）
  ['x', 'y', 'z'].forEach(axis => {
    document.getElementById(`settings-vm-rot-${axis}`)?.addEventListener('input', () => {
      const dx = parseFloat(document.getElementById('settings-vm-rot-x')?.value);
      const dy = parseFloat(document.getElementById('settings-vm-rot-y')?.value);
      const dz = parseFloat(document.getElementById('settings-vm-rot-z')?.value);
      setRangeAndLabel(`settings-vm-rot-${axis}`, `settings-vm-rot-${axis}-value`, parseFloat(document.getElementById(`settings-vm-rot-${axis}`)?.value), 2);
      if ([dx, dy, dz].every(Number.isFinite)) applyVmPartial({ rotation: [radFromDeg(dx), radFromDeg(dy), radFromDeg(dz)] });
    });
  });

  // Muzzle Offset
  ['x', 'y', 'z'].forEach(axis => {
    document.getElementById(`settings-vm-muz-${axis}`)?.addEventListener('input', () => {
      const mx = parseFloat(document.getElementById('settings-vm-muz-x')?.value);
      const my = parseFloat(document.getElementById('settings-vm-muz-y')?.value);
      const mz = parseFloat(document.getElementById('settings-vm-muz-z')?.value);
      setRangeAndLabel(`settings-vm-muz-${axis}`, `settings-vm-muz-${axis}-value`, parseFloat(document.getElementById(`settings-vm-muz-${axis}`)?.value), 2);
      if ([mx, my, mz].every(Number.isFinite)) applyVmPartial({ muzzleOffset: [mx, my, mz] });
    });
  });

  // Screen Muzzle（NDC）X/Y
  ['x', 'y'].forEach(axis => {
    document.getElementById(`settings-vm-muz-screen-${axis}`)?.addEventListener('input', () => {
      const sx = parseFloat(document.getElementById('settings-vm-muz-screen-x')?.value);
      const sy = parseFloat(document.getElementById('settings-vm-muz-screen-y')?.value);
      setRangeAndLabel(`settings-vm-muz-screen-${axis}`, `settings-vm-muz-screen-${axis}-value`, parseFloat(document.getElementById(`settings-vm-muz-screen-${axis}`)?.value), 3);
      if ([sx, sy].every(Number.isFinite)) {
        applyVmPartial({ muzzleSpace: 'screen', muzzleScreen: [sx, sy] });
      }
    });
  });

  // Screen Muzzle Depth
  document.getElementById('settings-vm-muz-depth')?.addEventListener('input', () => {
    const d = parseFloat(document.getElementById('settings-vm-muz-depth')?.value);
    setRangeAndLabel('settings-vm-muz-depth', 'settings-vm-muz-depth-value', d, 2);
    if (Number.isFinite(d)) applyVmPartial({ muzzleSpace: 'screen', muzzleDepth: d });
  });
}
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
function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }
function showScreen(screenId) {
  // 使用 active 類別控制顯示（對應 style.css: .menu-screen.active { display: flex; }）
  document.querySelectorAll('.menu-screen').forEach(div => {
    div.classList.remove('active');
    div.style.display = 'none';
  });
  const target = $(screenId);
  if (target) {
    target.classList.add('active');
    target.style.display = 'flex';
    console.log('[UI] showScreen ->', screenId);
    // 應用開發者模式顯示狀態
    applyDevModeToUi(readDevMode());
    // 顯示暫停畫面時，刷新滑桿顯示為當前武器/皮膚的視圖參數
    if (screenId === '#pause-screen') {
      populateSettingsVmSliders();
    }
  } else {
    console.warn('[UI] showScreen target not found:', screenId);
  }
}
// 隱藏所有選單畫面（進入遊戲時保險隱藏疊在上層的 UI）
function hideAllScreens() {
  document.querySelectorAll('.menu-screen').forEach(div => {
    div.classList.remove('active');
    div.style.display = 'none';
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
    hide(joinCreateSection);
    setHost(host);
    updateStartBtnAvailability();
  });

  socket.on('roomJoined', ({ roomId, host }) => {
    currentRoomId = roomId;
    $('#room-id-display').textContent = roomId;
    show($('#room-info'));
    hide(joinCreateSection);
    setHost(host);
    updateStartBtnAvailability();
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
  socket.on('gameStateUpdate', (gameState) => {
    if (!myUsername) return;
    const me = gameState?.players?.[myUsername];
    if (me) updateHealth(me.health);
  });

  socket.on('playerDied', ({ username, killer }) => {
    console.log('playerDied', username, 'by', killer);
    if (username === myUsername) {
      updateHealth(0);
      endMatch();
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
  $('#create-room-btn')?.addEventListener('click', () => {
    if (!socket) return toast('尚未連線');
    const mode = document.querySelector('input[name="gameMode"]:checked')?.value || 'deathmatch';
    const killLimit = parseInt($('#kill-limit-input').value || '40', 10);
    socket.emit('createRoom', { mode, killLimit });
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

  // 機器人對戰：直接要求伺服器建立機器人房間
  $('#bot-battle-btn')?.addEventListener('click', () => {
    if (!socket) return toast('請先登入連線');
    socket.emit('startRobotBattle');
    // 使用者互動中請求鎖定
    requestPointerLock();
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
  $('#login-tab')?.addEventListener('click', () => {
    $('#login-tab').classList.add('active');
    $('#register-tab').classList.remove('active');
    show($('#login-form'));
    hide($('#register-form'));
  });
  $('#register-tab')?.addEventListener('click', () => {
    $('#register-tab').classList.add('active');
    $('#login-tab').classList.remove('active');
    show($('#register-form'));
    hide($('#login-form'));
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
  bindTunerUi();
  bindSettingsVmSliders();
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

  // 每次載入都要求重新登入，不做自動登入
  showScreen('#auth-screen');
})();