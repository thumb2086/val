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
