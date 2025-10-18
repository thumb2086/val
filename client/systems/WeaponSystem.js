import * as THREE from 'three';
import { WEAPONS } from '@configs/weapons.js';
import { createClassic, createGhost, createVandal, createPhantom, createKnife } from '../models/ProceduralWeapons.js';

import { EffectManager } from '../graphics/EffectManager.js';

export default class WeaponSystem {
  constructor({ network, graphics, ui, bulletSystem, materialComposer } = {}) {
    this.network = network;
    this.graphics = graphics;
    this.ui = ui;
    this.bullets = bulletSystem;
    this.materialComposer = materialComposer;
    
    // 初始化特效管理器
    if (graphics?.scene) {
        this.effectManager = new EffectManager(graphics.scene, materialComposer);
    }

    // 初始化屬性
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
    
    // 武器切換動畫相關
    this.isSwitching = false;
    this._switchStartTime = 0;
    this._switchDuration = 0.35; // 武器切換動畫持續時間（秒）
    
    // 開鏡相關屬性
    this.isAiming = false;
    this._defaultFOV = 75;  // 預設視野角度
    this._aimingFOV = 45;   // 開鏡時的視野角度
    this._aimTransitionDuration = 0.2;  // 開鏡動畫持續時間
    this._aimTransitionStart = 0;
    this._defaultWeaponPosition = null;  // 儲存武器的預設位置

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

    // 如果武器相同且皮膚相同，只更新 UI
    if (this.currentWeaponId === weaponId && this.skinIndex === skinIndex && this._weaponObject) {
      this.ui?.updateAmmo?.(this.ammoInMag, WEAPONS[weaponId].magazineSize);
      this.ui?.updateWeapon?.(this.currentWeaponId, this.skinIndex);
      return;
    }

    // 開始切換武器
    console.log('[WeaponSystem] Switching weapon to:', weaponId);

    // 取消開鏡
    if (this.isAiming) {
      this.stopAiming();
    }

    // 取消檢視動作
    if (this.isInspecting) {
      this.cancelInspect();
    }

    this._clearModel();

    // 儲存之前的武器資訊
    const prevWeaponId = this.currentWeaponId;

    // 更新新武器資訊
    this.currentWeaponId = weaponId;
    this.skinIndex = skinIndex;
    this.ammoInMag = WEAPONS[weaponId].magazineSize;

    // 開始切換動畫
    this.isSwitching = true;
    this._switchStartTime = performance.now();
    
    // 載入新武器模型
    this._loadAndAttachModel();
    
    if (this._weaponObject) {
      // 初始化切換動畫的起始位置
      this._weaponObject.position.y -= 0.5; // 開始時武器在下方
      this._weaponObject.rotation.x += Math.PI / 6; // 稍微傾斜
      this._weaponObject.scale.setScalar(0.8); // 稍微縮小
    }

    // 更新 UI
    this.ui?.updateAmmo?.(this.ammoInMag, WEAPONS[weaponId].magazineSize);
    this.ui?.updateWeapon?.(this.currentWeaponId, this.skinIndex);
    
    // 開始武器切換動畫
    this._updateSwitchAnimation();
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
    const skin = weapon.skins?.[this.skinIndex];

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
        
        // 計算射程
        const range = weapon.range || 1000;
        const to = from.clone().add(direction.multiplyScalar(range));

        // 生成槍口火焰
        if (this._weaponObject && this.effectManager) {
          const muzzleFlashOptions = skin?.effects?.muzzleFlash || {
            color: 0xffee88,
            size: 0.15,
            duration: 0.05
          };
          this.effectManager.createMuzzleFlash(this._weaponObject, muzzleFlashOptions);
        }

        // 生成彈道軌跡
        this.bullets.spawnTracer(from, to, {
          color: 0xffee88,
          duration: 0.15,
          width: 0.05
        });

        // 檢查射線碰撞
        const raycaster = new THREE.Raycaster(from, direction.normalize());
        const intersects = raycaster.intersectObjects(this.graphics.scene.children, true);
        
        if (intersects.length > 0) {
          const hit = intersects[0];
          // 生成擊中特效
          const hitEffectOptions = skin?.effects?.hitEffect || {
            color: 0xffaa00,
            size: 0.2,
            duration: 0.2,
            particleCount: 8
          };
          this.effectManager.createHitEffect(hit.point, hit.face.normal, hitEffectOptions);
        }
      }
    } catch (e) {
      console.warn('[WeaponSystem] Error creating effects:', e);
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
    const materials = skin?.materials || weapon.materials || {};

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
      this.cancelInspect();
      return;
    }

    const weapon = WEAPONS[this.currentWeaponId];
    const skin = weapon.skins?.[this.skinIndex];

    this.isInspecting = true;
    this._inspectStartTime = performance.now();

    if (skin?.animations?.inspect) {
      // 使用皮膚定義的自定義檢視動畫
      const animationOptions = {
        duration: skin.animations.inspect.duration || 3.0,
        keyframes: skin.animations.inspect.keyframes || []
      };

      this.effectManager.createInspectAnimation(this._weaponObject, animationOptions);

      // 如果皮膚有呼吸發光效果
      if (skin?.materials?.accents?.type === 'emissive') {
        this._weaponObject.traverse(node => {
          if (node.isMesh && node.material && node.material.emissiveIntensity !== undefined) {
            this.effectManager.createBreathingEffect(node.material, {
              minIntensity: 0.3,
              maxIntensity: 1.0,
              speed: 2.0
            });
          }
        });
      }
    } else {
      // 使用預設檢視動畫
      this.effectManager.createInspectAnimation(this._weaponObject, {
        duration: 3.0,
        rotationAmount: Math.PI * 2,
        positionOffset: 0.1
      });
    }
  }

  cancelInspect() {
    this.isInspecting = false;
    
    // 重置武器位置
    if (this._weaponObject) {
      const { pos, rot } = this._getViewModelParams();
      this._weaponObject.position.set(...pos);
      this._weaponObject.rotation.set(...rot);
      
      // 重置所有發光效果
      this._weaponObject.traverse(node => {
        if (node.isMesh && node.material && node.material.emissiveIntensity !== undefined) {
          node.material.emissiveIntensity = node.material.userData.originalEmissiveIntensity || 0.5;
        }
      });
    }
  }

  // 切換開鏡狀態
  toggleAim() {
    if (this.isReloading || this.isInspecting) return;
    
    if (this.isAiming) {
      this.stopAiming();
    } else {
      this.startAiming();
    }
  }

  // 開始開鏡
  startAiming() {
    if (this.isAiming || !this._weaponObject) return;

    this.isAiming = true;
    this._aimTransitionStart = performance.now();
    
    // 儲存預設位置
    if (!this._defaultWeaponPosition) {
      this._defaultWeaponPosition = {
        position: this._weaponObject.position.clone(),
        rotation: this._weaponObject.rotation.clone()
      };
    }

    // 開始過渡動畫
    this._updateAimTransition();
  }

  // 停止開鏡
  stopAiming() {
    if (!this.isAiming) return;

    this.isAiming = false;
    this._aimTransitionStart = performance.now();
    
    // 開始過渡動畫
    this._updateAimTransition();
  }

  // 更新開鏡過渡動畫
  _updateSwitchAnimation() {
    if (!this._weaponObject || !this.isSwitching) return;

    const now = performance.now();
    const elapsed = (now - this._switchStartTime) / 1000;
    const progress = Math.min(elapsed / this._switchDuration, 1);

    // 使用 easeOutBack 緩動函數來創造彈性效果
    const easeOutBack = (x) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    };

    const eased = easeOutBack(progress);

    // 更新武器位置和旋轉
    const { pos, rot } = this._getViewModelParams();
    if (this._weaponObject) {
      // Y 軸位置動畫
      this._weaponObject.position.y = pos[1] - 0.5 * (1 - eased);
      
      // 旋轉動畫
      this._weaponObject.rotation.x = rot[0] + (Math.PI / 6) * (1 - eased);
      
      // 縮放動畫
      const scale = 0.8 + 0.2 * eased;
      this._weaponObject.scale.setScalar(scale);
    }

    // 如果動畫還沒結束，繼續更新
    if (progress < 1) {
      requestAnimationFrame(() => this._updateSwitchAnimation());
    } else {
      this.isSwitching = false;
      if (this._weaponObject) {
        this._weaponObject.position.set(...pos);
        this._weaponObject.rotation.set(...rot);
        const { scaleVec } = this._getViewModelParams();
        this._weaponObject.scale.copy(scaleVec);
      }
    }
  }

  _updateAimTransition() {
    if (!this._weaponObject || !this.graphics?.getCamera()) return;

    const now = performance.now();
    const elapsed = (now - this._aimTransitionStart) / 1000;
    const progress = Math.min(elapsed / this._aimTransitionDuration, 1);
    
    // 使用 easeInOutQuad 緩動函數
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    const camera = this.graphics.getCamera();
    const weapon = WEAPONS[this.currentWeaponId];
    
    if (this.isAiming) {
      // 調整 FOV
      camera.fov = this._defaultFOV + (this._aimingFOV - this._defaultFOV) * eased;
      
      // 調整武器位置
      if (this._defaultWeaponPosition) {
        const aimPosition = weapon.aimPosition || { x: 0, y: -0.3, z: -0.5 };
        const aimRotation = weapon.aimRotation || { x: 0, y: 0, z: 0 };
        
        this._weaponObject.position.lerp(new THREE.Vector3(aimPosition.x, aimPosition.y, aimPosition.z), eased);
        this._weaponObject.rotation.x = THREE.MathUtils.lerp(this._defaultWeaponPosition.rotation.x, aimRotation.x, eased);
        this._weaponObject.rotation.y = THREE.MathUtils.lerp(this._defaultWeaponPosition.rotation.y, aimRotation.y, eased);
        this._weaponObject.rotation.z = THREE.MathUtils.lerp(this._defaultWeaponPosition.rotation.z, aimRotation.z, eased);
      }
    } else {
      // 恢復預設 FOV
      camera.fov = this._aimingFOV + (this._defaultFOV - this._aimingFOV) * eased;
      
      // 恢復武器預設位置
      if (this._defaultWeaponPosition) {
        this._weaponObject.position.lerp(this._defaultWeaponPosition.position, eased);
        this._weaponObject.rotation.x = THREE.MathUtils.lerp(this._weaponObject.rotation.x, this._defaultWeaponPosition.rotation.x, eased);
        this._weaponObject.rotation.y = THREE.MathUtils.lerp(this._weaponObject.rotation.y, this._defaultWeaponPosition.rotation.y, eased);
        this._weaponObject.rotation.z = THREE.MathUtils.lerp(this._weaponObject.rotation.z, this._defaultWeaponPosition.rotation.z, eased);
      }
    }

    // 更新投影矩陣
    camera.updateProjectionMatrix();
    
    // 如果動畫還沒結束，繼續更新
    if (progress < 1) {
      requestAnimationFrame(() => this._updateAimTransition());
    }
  }
}