// client/systems/PlayerController.js
import * as THREE from 'three';
import { currentSensitivity, resetMouseMovement } from '../input.js';

const PI_2 = Math.PI / 2;

export default class PlayerController {
  constructor(camera, keyStates, mouseStates) {
    this.camera = camera;
    this.keyStates = keyStates;
    this.mouseStates = mouseStates;
    this.speed = 5; // meters per second

    // Private vectors for movement calculation
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._movement = new THREE.Vector3();

    // Variables for look controls
    this.pitch = 0;
    this.yaw = 0;
  }

  update(dt) {
    this.updateMovement(dt);
    this.updateLook();
  }

  updateMovement(dt) {
    const speed = this.speed * dt;

    const moveForward = (this.keyStates['KeyW'] ? 1 : 0) - (this.keyStates['KeyS'] ? 1 : 0);
    const moveStrafe = (this.keyStates['KeyD'] ? 1 : 0) - (this.keyStates['KeyA'] ? 1 : 0);

    if (moveForward === 0 && moveStrafe === 0) {
        return;
    }

    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    this._forward.normalize();

    this._right.crossVectors(this._forward, this.camera.up);

    this._movement.set(0, 0, 0);
    this._movement.addScaledVector(this._forward, moveForward);
    this._movement.addScaledVector(this._right, moveStrafe);
    this._movement.normalize();

    this.camera.position.addScaledVector(this._movement, speed);
  }

  updateLook() {
    const movementX = this.mouseStates.movementX || 0;
    const movementY = this.mouseStates.movementY || 0;

    if (movementX === 0 && movementY === 0) {
        return;
    }

    this.yaw -= movementX * 0.002 * currentSensitivity;
    this.pitch -= movementY * 0.002 * currentSensitivity;

    this.pitch = Math.max(-PI_2, Math.min(PI_2, this.pitch));

    const cameraEuler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(cameraEuler);

    // Reset mouse movement deltas after processing
    resetMouseMovement();
  }
}
