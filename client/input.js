export const keyStates = {};
export const mouseStates = {
  left: false,
  right: false,
  middle: false,
  movementX: 0,
  movementY: 0
};
export let currentSensitivity = 1.0;

export function initInputSystem(sensitivity = 1.0) {
  currentSensitivity = sensitivity;

  document.addEventListener('mousemove', onMouseMove, false);
  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);
  document.addEventListener('mousedown', onMouseDown, false);
  document.addEventListener('mouseup', onMouseUp, false);
}

function onKeyDown(event) {
  keyStates[event.code] = true;
  
  if (window.weaponSystem && !event.repeat) {
    // 處理 F 鍵秀槍
    if (event.code === 'KeyF') {
      window.weaponSystem.inspectWeapon();
    }
    
    // 武器切換快速鍵
    const weaponKeys = {
      Digit1: 'classic',
      Digit2: 'ghost',
      Digit3: 'spectre',
      Digit4: 'vandal',
      Digit5: 'phantom',
      
      // 數字鍵盤
      Numpad1: 'classic',
      Numpad2: 'ghost',
      Numpad3: 'spectre',
      Numpad4: 'vandal',
      Numpad5: 'phantom'
    };

    if (weaponKeys[event.code]) {
      const weaponId = weaponKeys[event.code];
      window.weaponSystem.setWeapon(weaponId, 0);
      console.log('[INPUT] Switching to weapon:', weaponId);
    }
  }
}

function onKeyUp(event) {
  keyStates[event.code] = false;
}

function onMouseDown(event) {
  if (event.button === 0) mouseStates.left = true;
  if (event.button === 1) mouseStates.middle = true;
  if (event.button === 2) mouseStates.right = true;
}

function onMouseUp(event) {
  if (event.button === 0) mouseStates.left = false;
  if (event.button === 1) mouseStates.middle = false;
  if (event.button === 2) mouseStates.right = false;
}

function onMouseMove(event) {
  // 只在多人對戰模式時鎖定游標
  if (document.pointerLockElement && window.currentMode !== 'training') {
    mouseStates.movementX = event.movementX || 0;
    mouseStates.movementY = event.movementY || 0;
  }
}

export function updateSensitivity(newSensitivity) {
  currentSensitivity = newSensitivity;
}

// Function to reset mouse movement deltas after they've been processed
export function resetMouseMovement() {
  mouseStates.movementX = 0;
  mouseStates.movementY = 0;
}
