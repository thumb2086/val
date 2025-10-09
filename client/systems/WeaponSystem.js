import * as THREE from 'three';
import { WEAPONS } from '@configs/weapons.js';
import { createClassic, createGhost, createVandal, createPhantom, createKnife } from '../models/ProceduralWeapons.js';

export default class WeaponSystem {
  constructor({ network, graphics, ui, bulletSystem } = {}) {
    this.network = network;
    this.graphics = graphics;
    this.ui = ui;
    this.bullets = bulletSystem;

    this.currentWeaponId = 'classic';
    this.skinIndex = 0;
    this.ammoInMag = 0;
    this.isReloading = false;
    this.lastShotAt = 0;
    this._weaponObject = null;
    this._loadRequestId = 0;
    this.isInspecting = false;
    this._inspectStartTime = 0;
    this._inspectAnimationFrame = null;
  }

  setWeapon(weaponId, skinIndex = 0) {
    if (!WEAPONS[weaponId]) {
      console.warn('[WeaponSystem] Weapon does not exist:', weaponId);
      return;
    }

    if (this.currentWeaponId === weaponId && this.skinIndex === skinIndex && this._weaponObject) {
      this.ui?.updateAmmo?.(this.ammoInMag, WEAPONS[weaponId].magazineSize);
      this.ui?.updateWeapon?.(this.currentWeaponId, this.skinIndex);
      return;
    }

    this._clearModel();

    this.currentWeaponId = weaponId;
    this.skinIndex = skinIndex;
    this.ammoInMag = WEAPONS[weaponId].magazineSize;

    this._loadAndAttachModel();

    this.ui?.updateAmmo?.(this.ammoInMag, WEAPONS[weaponId].magazineSize);
    this.ui?.updateWeapon?.(this.currentWeaponId, this.skinIndex);
  }

  canFire(now = performance.now()) {
    const weapon = WEAPONS[this.currentWeaponId];
    if (!weapon || this.isReloading) return false;
    const usesAmmo = weapon.usesAmmo !== false;
    if (usesAmmo && this.ammoInMag <= 0) return false;
    const intervalMs = weapon.fireRate * 1000;
    return now - this.lastShotAt >= intervalMs;
  }

  fire({ roomId, aimPoint }) {
    if (!this.canFire(performance.now())) return false;

    this.lastShotAt = performance.now();
    const weapon = WEAPONS[this.currentWeaponId];

    if (weapon.usesAmmo !== false) {
      this.ammoInMag--;
      this.ui?.updateAmmo?.(this.ammoInMag, weapon.magazineSize);
    }

    try {
      const cam = this.graphics?.getCamera?.();
      if (cam && this.bullets) {
        cam.updateMatrixWorld(true);
        const from = cam.getWorldPosition(new THREE.Vector3());
        const direction = cam.getWorldDirection(new THREE.Vector3());
        const to = from.clone().add(direction.multiplyScalar(1000));
        this.bullets.spawnTracer(from, to);
      }
    } catch (e) {
      console.warn('[WeaponSystem] Error spawning tracer:', e);
    }

    this.network?.emit?.('shoot', { roomId, point: aimPoint, weaponId: this.currentWeaponId });
    return true;
  }

  startReload() {
    if (this.isReloading) return;
    const weapon = WEAPONS[this.currentWeaponId];
    if (!weapon || weapon.usesAmmo === false) return;

    this.isReloading = true;
    setTimeout(() => {
      this.ammoInMag = weapon.magazineSize;
      this.isReloading = false;
      this.ui?.updateAmmo?.(this.ammoInMag, weapon.magazineSize);
    }, weapon.reloadTime * 1000);
  }

  _getViewModelParams() {
    const weapon = WEAPONS[this.currentWeaponId] || {};
    const skin = weapon.skins?.[this.skinIndex];
    const vm = (skin?.viewModel) || weapon.viewModel || {};

    const scale = vm.scale ?? 1.0;
    const pos = vm.position ?? [0, 0, 0];
    const rot = vm.rotation ?? [0, 0, 0];

    const scaleVec = Array.isArray(scale) ? new THREE.Vector3(...scale) : new THREE.Vector3(scale, scale, scale);
    return { scaleVec, pos, rot };
  }

  _loadAndAttachModel() {
    const cam = this.graphics?.getCamera?.();
    if (!cam) return;

    const reqId = ++this._loadRequestId;
    this._clearModel();

    const weapon = WEAPONS[this.currentWeaponId] || {};
    const skin = weapon.skins?.[this.skinIndex];
    const skinName = skin?.name || 'Default';

    let group;
    switch (this.currentWeaponId) {
      case 'classic':
        group = createClassic();
        break;
      case 'ghost':
        group = createGhost();
        break;
      case 'vandal':
        group = createVandal(skinName);
        break;
      case 'phantom':
        group = createPhantom();
        break;
      case 'knife':
        group = createKnife();
        break;
      default:
        console.warn(`[WeaponSystem] No model for ${this.currentWeaponId}, using fallback.`);
        group = new THREE.Group();
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.6), new THREE.MeshStandardMaterial({ color: 0x444444 })));
        break;
    }

    group.traverse(n => {
      if (n.isMesh) {
        n.castShadow = false;
        n.receiveShadow = false;
        n.frustumCulled = false;
        n.renderOrder = 999;
        if (n.material) {
          n.material.depthTest = false;
          n.material.depthWrite = false;
        }
      }
    });

    const { scaleVec, pos, rot } = this._getViewModelParams();
    group.scale.copy(scaleVec);
    group.position.set(...pos);
    group.rotation.set(...rot);

    if (reqId === this._loadRequestId) {
      cam.add(group);
      this._weaponObject = group;
    }
  }

  _clearModel() {
    if (this._weaponObject) {
      this._weaponObject.parent?.remove(this._weaponObject);
      this._weaponObject = null;
    }
  }

  updateAttachment() {
    const cam = this.graphics?.getCamera?.();
    if (cam && this._weaponObject && this._weaponObject.parent !== cam) {
      cam.add(this._weaponObject);
    }
  }

  inspectWeapon() {
    if (this.isReloading || !this._weaponObject) return;
    
    if (this.isInspecting) {
      // 如果已經在檢視中，取消動畫
      this.cancelInspect();
      return;
    }

    this.isInspecting = true;
    this._inspectStartTime = performance.now();
    
    const animate = () => {
      if (!this.isInspecting || !this._weaponObject) return;
      
      const elapsed = (performance.now() - this._inspectStartTime) / 1000; // 轉換為秒
      const duration = 3.0; // 動畫總時長（秒）
      
      if (elapsed > duration) {
        this.cancelInspect();
        return;
      }

      // 使用正弦函數創建平滑的旋轉動畫
      const rotationAmount = Math.PI * 2; // 旋轉一圈
      const progress = elapsed / duration;
      const angle = Math.sin(progress * Math.PI * 2) * (rotationAmount / 4);
      
      // 儲存原始位置和旋轉
      const originalRotation = this._weaponObject.rotation.clone();
      const originalPosition = this._weaponObject.position.clone();
      
      // 應用動畫
      this._weaponObject.rotation.z = originalRotation.z + angle;
      this._weaponObject.position.y = originalPosition.y + Math.sin(progress * Math.PI * 4) * 0.1;
      
      this._inspectAnimationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  cancelInspect() {
    this.isInspecting = false;
    if (this._inspectAnimationFrame) {
      cancelAnimationFrame(this._inspectAnimationFrame);
      this._inspectAnimationFrame = null;
    }
    
    // 重置武器位置
    if (this._weaponObject) {
      const { pos, rot } = this._getViewModelParams();
      this._weaponObject.position.set(...pos);
      this._weaponObject.rotation.set(...rot);
    }
  }
}