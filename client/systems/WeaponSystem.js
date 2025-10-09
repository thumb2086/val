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
    const skin = weapon.skins?.[this.skinIndex];

    if (weapon.usesAmmo !== false) {
      this.ammoInMag--;
      this.ui?.updateAmmo?.(this.ammoInMag, weapon.magazineSize);
    }

    try {
      const cam = this.graphics?.getCamera?.();
      if (cam && this.effectManager) {
        cam.updateMatrixWorld(true);
        const from = cam.getWorldPosition(new THREE.Vector3());
        const direction = cam.getWorldDirection(new THREE.Vector3());
        const to = from.clone().add(direction.multiplyScalar(1000));

        // 生成槍口火焰
        if (this._weaponObject) {
          const muzzleFlashOptions = skin?.effects?.muzzleFlash || {
            color: 0xffaa00,
            size: 0.1,
            duration: 0.05
          };
          this.effectManager.createMuzzleFlash(this._weaponObject, muzzleFlashOptions);
        }

        // 生成彈道軌跡
        const bulletTrailOptions = skin?.effects?.bulletTrail || {
            color: 0xffaa00,
            width: 0.02,
            duration: 0.2,
            fadeLength: 0.5
        };
        this.effectManager.createBulletTrail(from, to, bulletTrailOptions);

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
}