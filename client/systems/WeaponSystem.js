// Client-side WeaponSystem
// 職責：讀取 configs/weapons、管理當前武器狀態、處理開火/換彈/切換武器、
// 播放音效與動效（此處先留介面，之後接三維與音效系統）、
// 透過 network 傳遞 shoot 指令給伺服器，並載入/掛載武器 3D 模型到相機。

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WEAPONS } from '@configs/weapons.js';

export default class WeaponSystem {
  constructor({ network, audio, graphics, ui, bulletSystem } = {}) {
    this.network = network; // 對應 client/network.js 提供的 socket 介面（之後接）
    this.audio = audio;     // howler 或自製音效管理器（之後接）
    this.graphics = graphics; // Three.js 或特效系統（之後接）
    this.ui = ui;           // UI 更新（之後接）
    this.bullets = bulletSystem; // 子彈軌跡系統

    this.currentWeaponId = 'pistol';
    this.skinIndex = 0;
    this.ammoInMag = WEAPONS[this.currentWeaponId].magazineSize;
    this.isReloading = false;
    this.lastShotAt = 0;

    // 3D 模型管理
    this._loader = new GLTFLoader();
    this._weaponObject = null; // 目前掛在相機下的武器物件

    // GLTF 載入快取與載入中鎖
    THREE.Cache && (THREE.Cache.enabled = true);
    this._gltfCache = new Map(); // modelPath -> gltf
    this._loadingModelPath = null; // 當前載入中的模型路徑

    // 載入請求序號：避免快速切換武器時舊的載入結果覆蓋新武器
    this._loadRequestId = 0;

    // Debug：槍口標記
    this._debugMuzzle = { enabled: false, obj: null };

    // 視圖覆寫：客戶端緩存與首次載入
    this._vmOverrides = null;           // 伺服器返回的 overrides 對象：{ [weaponId]: { [skinIndex]: partial } }
    this._vmOverridesLoaded = false;    // 是否已成功載入
    this._vmFetchPromise = null;        // 進行中的載入 Promise（避免重複請求）
    this._initViewModelOverrides();     // 啟動背景載入並在完成時應用到當前模型
  }

  setWeapon(weaponId, skinIndex = 0) {
    if (!WEAPONS[weaponId]) {
      console.warn('[WeaponSystem] 武器不存在:', weaponId);
      return;
    }
    
    // 防止刀具自動切換回來的問題
    if (this.currentWeaponId === weaponId && this.skinIndex === skinIndex && this._weaponObject) {
      // 僅重置彈藥 UI，但不重新載入模型
      this.ui?.updateAmmo?.(this.ammoInMag, WEAPONS[weaponId].magazineSize);
      return;
    }

    console.log('[WeaponSystem] 設定武器:', weaponId, 'skin:', skinIndex);
    
    // 先清除舊武器
    this._clearModel();
    
    this.currentWeaponId = weaponId;
    this.skinIndex = skinIndex;
    this.ammoInMag = WEAPONS[weaponId].magazineSize;
    
    // 載入並掛載對應模型
    const skin = WEAPONS[weaponId].skins?.[skinIndex];
    const modelPath = (skin && skin.modelPath) || WEAPONS[weaponId].modelPath;
    console.log('[WeaponSystem] 模型路徑:', modelPath);
    
    this._loadAndAttachModel(modelPath).then(() => {
      // 確保模型正確掛載到相機
      this.updateAttachment();
    }).catch(err => {
      console.error('[WeaponSystem] 無法載入模型:', modelPath, err);
    });

    this.ui?.updateAmmo?.(this.ammoInMag, WEAPONS[weaponId].magazineSize);
  }

  canFire(now = performance.now()) {
    const weapon = WEAPONS[this.currentWeaponId];
    if (!weapon) return false;
    if (this.isReloading) return false;
    // 近戰（或 usesAmmo=false）不檢查彈藥
    const usesAmmo = weapon.usesAmmo !== false;
    if (usesAmmo && this.ammoInMag <= 0) return false;
    const intervalMs = weapon.fireRate * 1000;
    return now - this.lastShotAt >= intervalMs;
  }

  fire({ roomId, aimPoint }) {
    const now = performance.now();
    if (!this.canFire(now)) {
      return false;
    }

    this.lastShotAt = now;
    const weapon = WEAPONS[this.currentWeaponId];
    const usesAmmo = weapon?.usesAmmo !== false;
    if (usesAmmo) {
      this.ammoInMag -= 1;
    }

    if (usesAmmo) {
      this.ui?.updateAmmo?.(this.ammoInMag, WEAPONS[this.currentWeaponId].magazineSize);
    }

    // --- New Bullet Trajectory Logic ---
    try {
      const cam = this.graphics?.getCamera?.();
      if (cam && this.bullets) {
        cam.updateMatrixWorld(true);

        // The bullet should always originate from the camera's position
        const from = cam.getWorldPosition(new THREE.Vector3());

        // The bullet should always travel straight forward from the camera's center
        const direction = cam.getWorldDirection(new THREE.Vector3());
        const to = from.clone().add(direction.multiplyScalar(1000));

        this.bullets.spawnTracer(from, to);
      }
    } catch (e) {
      console.warn('[WeaponSystem] Error spawning tracer:', e);
    }

    // Notify the server about the shot. `aimPoint` is now derived from the camera's direction.
    this.network?.emit?.('shoot', { roomId, point: aimPoint, weaponId: this.currentWeaponId });
    return true;
  }

  // 融合武器/皮膚的 viewModel 設定並正規化為可直接套用於 Three.js 的數值
  // 支援：
  // - 皮膚層級 viewModel 覆寫（skins[i].viewModel）
  // - scale 可為 number（等比）或 [sx, sy, sz]（可用於鏡像/翻轉）
  // - 依據不同載入情境提供合適的預設值（placeholder 與 gltf 有不同 fallback）
  _getViewModelParams({ placeholder = false } = {}) {
    const weapon = WEAPONS[this.currentWeaponId] || {};
    const baseVM = weapon.viewModel || {};
    const skin = weapon.skins?.[this.skinIndex];
    const skinVM = (skin && skin.viewModel) ? skin.viewModel : {};
    // 皮膚覆寫優先於基礎設定，最後套用持久化覆寫
    let vm = { ...baseVM, ...skinVM };
    try {
      const ov = this._readViewOverride?.(this.currentWeaponId, this.skinIndex);
      if (ov && typeof ov === 'object') vm = { ...vm, ...ov };
    } catch {}

    // 調整默認值，使武器模型更自然地顯示在視圖中
    let defaultScale, defaultPos, defaultRot;
    
    if (placeholder) {
      // 佔位模型的默認值
      defaultScale = 1.0;
      defaultPos = [0.5, -0.4, -0.7];
      defaultRot = [0.0, Math.PI, 0.0];
    } else {
      // 根據武器類型設置不同的默認值
      switch(weapon.type) {
        case 'melee':
          defaultScale = 0.2;
          defaultPos = [0.6, -0.4, -0.8];
          defaultRot = [0.0, Math.PI, 0.0];
          break;
        case 'pistol':
          defaultScale = 0.15;
          defaultPos = [0.6, -0.5, -0.9];
          defaultRot = [-0.1, Math.PI, 0.1];
          break;
        default: // 步槍等長槍
          defaultScale = 0.05;
          defaultPos = [0.5, -0.5, -1.0];
          defaultRot = [-0.05, Math.PI, 0.05];
      }
    }

    // scale 處理：數值 -> 等比；陣列 -> 三軸（可帶負值以鏡像）
    let scaleVec;
    if (Array.isArray(vm.scale) && vm.scale.length === 3) {
      scaleVec = new THREE.Vector3(vm.scale[0], vm.scale[1], vm.scale[2]);
    } else {
      const s = typeof vm.scale === 'number' ? vm.scale : defaultScale;
      scaleVec = new THREE.Vector3(s, s, s);
    }

    const pos = (Array.isArray(vm.position) && vm.position.length === 3) ? vm.position : defaultPos;
    const rot = (Array.isArray(vm.rotation) && vm.rotation.length === 3) ? vm.rotation : defaultRot;

    return { scaleVec, pos, rot };
  }

  reload() {
    if (this.isReloading) return;
    const weapon = WEAPONS[this.currentWeaponId];
    if (!weapon) return;
    // 近戰無需換彈
    if (weapon.usesAmmo === false) return;

    this.isReloading = true;
    setTimeout(() => {
      this.ammoInMag = weapon.magazineSize;
      this.isReloading = false;
      this.ui?.updateAmmo?.(this.ammoInMag, weapon.magazineSize);
    }, weapon.reloadTime * 1000);
  }

  // 與舊輸入層相容的別名
  startReload() {
    this.reload();
  }

  // ========== 內部：載入與掛載武器模型 ==========
  async _loadAndAttachModel(modelPath) {
    if (!this.graphics?.getCamera) {
      console.warn('[WeaponSystem] graphics 或 getCamera 不存在');
      return;
    }
    const cam = this.graphics.getCamera();
    if (!cam) {
      console.warn('[WeaponSystem] 相機不存在');
      return;
    }

    // 本次載入請求編號，用以忽略過期結果
    const reqId = ++this._loadRequestId;

    console.log('[WeaponSystem] 開始載入模型:', modelPath);
    // 先移除舊模型
    this._clearModel();

    // 載入中鎖，避免重複觸發同路徑載入
    if (this._loadingModelPath === modelPath) {
      console.log('[WeaponSystem] 已在載入同一模型，忽略重複請求');
      return;
    }
    this._loadingModelPath = modelPath || '';

    // 若沒有提供模型路徑，使用簡易幾何生成視圖模型
    if (!modelPath) {
      const weaponConf = WEAPONS[this.currentWeaponId] || {};
      const group = new THREE.Group();
      let mainGeom, mainMat, handleGeom, handleMat;

      // 根據武器類型創建不同的幾何形狀
      switch (weaponConf.type) {
        case 'melee':
          mainGeom = new THREE.BoxGeometry(0.02, 0.04, 0.3); // Blade
          mainMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.4 });
          handleGeom = new THREE.BoxGeometry(0.03, 0.03, 0.1); // Handle
          handleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
          const blade = new THREE.Mesh(mainGeom, mainMat);
          const handle_knife = new THREE.Mesh(handleGeom, handleMat);
          handle_knife.position.set(0, 0, 0.15);
          group.add(blade);
          group.add(handle_knife);
          break;
        case 'pistol':
          mainGeom = new THREE.BoxGeometry(0.04, 0.05, 0.18); // Slide
          mainMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 });
          handleGeom = new THREE.BoxGeometry(0.04, 0.1, 0.05); // Grip
          handleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
          const slide = new THREE.Mesh(mainGeom, mainMat);
          const grip_pistol = new THREE.Mesh(handleGeom, handleMat);
          grip_pistol.position.set(0, -0.05, 0.03);
          group.add(slide);
          group.add(grip_pistol);
          break;
        default: // Default to rifle
          mainGeom = new THREE.BoxGeometry(0.05, 0.06, 0.6); // Body
          mainMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7 });
          handleGeom = new THREE.BoxGeometry(0.04, 0.1, 0.06); // Grip
          handleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
          const body = new THREE.Mesh(mainGeom, mainMat);
          const grip_rifle = new THREE.Mesh(handleGeom, handleMat);
          grip_rifle.position.set(0, -0.05, -0.1);
          group.add(body);
          group.add(grip_rifle);
          break;
      }

      group.userData.isWeapon = true;
      group.userData.isPlaceholder = true;
      group.name = `weapon_${this.currentWeaponId}`;
      group.matrixAutoUpdate = true;
      group.frustumCulled = false;

      // 材質設定避免被場景遮擋
      group.traverse(n => {
        if (n.isMesh) {
          n.castShadow = false;
          n.receiveShadow = false;
          n.frustumCulled = false;
          n.renderOrder = 999;
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach(m => { if (m) { m.depthTest = false; m.depthWrite = false; m.side = THREE.DoubleSide; } });
        }
      });

      const { scaleVec, pos, rot } = this._getViewModelParams({ placeholder: true });
      // 确保缩放值合理
      const safeScaleX = Math.max(0.001, Math.min(10, Math.abs(scaleVec.x))) * Math.sign(scaleVec.x || 1);
      const safeScaleY = Math.max(0.001, Math.min(10, Math.abs(scaleVec.y))) * Math.sign(scaleVec.y || 1);
      const safeScaleZ = Math.max(0.001, Math.min(10, Math.abs(scaleVec.z))) * Math.sign(scaleVec.z || 1);
      
      // 确保位置在合理范围内
      const safePosX = Math.max(-2, Math.min(2, pos[0] || 0));
      const safePosY = Math.max(-2, Math.min(2, pos[1] || 0));
      const safePosZ = Math.max(-5, Math.min(0, pos[2] || 0));
      
      // 确保旋转在合理范围内
      const safeRotX = Math.max(-Math.PI, Math.min(Math.PI, rot[0] || 0));
      const safeRotY = Math.max(-Math.PI, Math.min(Math.PI, rot[1] || 0));
      const safeRotZ = Math.max(-Math.PI, Math.min(Math.PI, rot[2] || 0));
      
      // 应用安全值
      group.scale.set(safeScaleX, safeScaleY, safeScaleZ);
      group.position.set(safePosX, safePosY, safePosZ);
      group.rotation.set(safeRotX, safeRotY, safeRotZ);

      // 若在載入過程中發生了新請求，忽略本次結果
      if (reqId !== this._loadRequestId) {
        this._loadingModelPath = null;
        return;
      }
      cam.add(group);
      this._weaponObject = group;
      try {
        cam.updateMatrixWorld(true);
        group.updateMatrixWorld(true);
        console.log('[WeaponSystem] Weapon attached (placeholder) to camera:', {
          camUUID: cam.uuid,
          parentUUID: group.parent?.uuid,
          isParentCamera: group.parent === cam
        });
      } catch {}
      console.log('[WeaponSystem] 已建立 knife 幾何模型並掛載');
      this._loadingModelPath = null;
      return;
    }

    // 若快取中已有，直接 clone 使用（避免 I/O 與解析延遲）
    if (this._gltfCache.has(modelPath)) {
      try {
        const cached = this._gltfCache.get(modelPath);
        const src = cached.scene || cached.scenes?.[0];
        if (src) {
          const obj = src.clone(true);
          // 同下方 traverse 設定
          obj.traverse(n => {
            if (n.isMesh) {
              n.castShadow = false;
              n.receiveShadow = false;
              n.frustumCulled = false;
              n.renderOrder = 999;
              const mats = Array.isArray(n.material) ? n.material : [n.material];
              mats.forEach(m => { if (m) { m.depthTest = false; m.depthWrite = false; m.side = THREE.DoubleSide; } });
            }
          });

          const { scaleVec, pos, rot } = this._getViewModelParams({ placeholder: false });
          // 自動置中：以包圍盒中心為基準，把模型移到原點
          const box = new THREE.Box3().setFromObject(obj);
          const center = box.getCenter(new THREE.Vector3());
          const group = new THREE.Group();
          group.add(obj);
          obj.position.sub(center);
          group.userData.isWeapon = true;
          group.name = `weapon_${this.currentWeaponId}`;
          group.matrixAutoUpdate = true;
          group.frustumCulled = false;

          // 將視圖參數套在外層 group（避免破壞置中）
          group.scale.set(scaleVec.x, scaleVec.y, scaleVec.z);
          group.position.set(pos[0], pos[1], pos[2]);
          group.rotation.set(rot[0], rot[1], rot[2]);

          // 若在載入過程中發生了新請求，忽略本次結果
          if (reqId !== this._loadRequestId) {
            this._loadingModelPath = null;
            return;
          }
          cam.add(group);
          this._weaponObject = group;
          try {
            cam.updateMatrixWorld(true);
            group.updateMatrixWorld(true);
            console.log('[WeaponSystem] Weapon attached (from cache) to camera:', {
              camUUID: cam.uuid,
              parentUUID: group.parent?.uuid,
              isParentCamera: group.parent === cam
            });
          } catch {}
          this._loadingModelPath = null;
          console.log('[WeaponSystem] 從快取掛載模型');
          return;
        }
      } catch (e) {
        console.warn('[WeaponSystem] 快取掛載失敗，改為重新載入:', e);
      }
    }

    // 統一修正：對 assets/models/ 內的 GLTF 將紋理路徑的 'textures/' 前綴移除
    // 以便支援「紋理與 gltf 同層」的資源結構。
    const needsFix = modelPath?.startsWith('assets/models/');
    const localManager = needsFix ? new THREE.LoadingManager() : null;
    if (localManager && needsFix) {
      localManager.setURLModifier((url) => {
        if (!url) return url;
        if (url.startsWith('data:')) return url; // 跳過 data URI
        if (url.startsWith('blob:')) return url; // 跳過 blob URI
        if (url.startsWith('http')) return url;  // 跳過絕對URL
        // 不修改主 GLTF/GLB 載入路徑，避免重複前綴造成 404
        if (url === modelPath || /\.(gltf|glb)(\?.*)?$/i.test(url)) return url;
        
        // 修正相對路徑：移除 textures/ 前綴，並確保正確的基礎路徑
        let fixedUrl = url;
        
        // 如果包含 textures/ 前綴，移除它
        if (fixedUrl.includes('textures/')) {
          fixedUrl = fixedUrl.replace(/.*textures\//, '');
        }

        // 若無副檔名，預設補 .png，並處理 metallicRough -> metallicRoughness
        const hasExt = /\.[a-z0-9]{2,5}(\?.*)?$/i.test(fixedUrl);
        if (!hasExt) {
          // 特例：有些資源命名為 metallicRough，實際檔案為 metallicRoughness.png
          if (/metallicRough(\b|$)/i.test(fixedUrl)) {
            fixedUrl = fixedUrl.replace(/metallicRough(\b|$)/i, 'metallicRoughness');
          }
          fixedUrl += '.png';
        }
        
        // 確保使用正確的模型目錄基礎路徑
        const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
        // 若已包含 modelDir 前綴則不再重複添加
        if (!fixedUrl.startsWith(modelDir)) {
          fixedUrl = modelDir + fixedUrl;
        }
        
        console.log('[WeaponSystem] URL修正:', url, '->', fixedUrl);
        return fixedUrl;
      });
    }
    const loader = localManager ? new GLTFLoader(localManager) : new GLTFLoader();
    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(modelPath, resolve, undefined, reject);
      });

      console.log('[WeaponSystem] 模型載入成功:', gltf);
      // 存入快取（保留原始 gltf 結構供 clone）
      try { this._gltfCache.set(modelPath, gltf); } catch {}
      const obj = gltf.scene || gltf.scenes?.[0];
      if (!obj) {
        console.warn('[WeaponSystem] 沒有找到場景物件');
        this._loadingModelPath = null;
        return;
      }

      // 基本縮放/位置（可依模型調整）
      obj.traverse(n => {
        if (n.isMesh) {
          n.castShadow = false;
          n.receiveShadow = false;
          n.frustumCulled = false; // 避免因相機近剪裁/視錐導致消失
          n.renderOrder = 999; // 優先於場景其他物件繪製
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach(m => {
            if (!m) return;
            m.depthTest = false;  // 不與場景深度比較，避免被牆體遮擋
            m.depthWrite = false; // 不寫入深度，避免影響場景
            m.side = THREE.DoubleSide; // 處理鏡像縮放導致的背面裁切
          });
        }
      });

      // 從配置讀取視圖模型參數（可在 configs/weapons.js 中調整）
      const { scaleVec, pos, rot } = this._getViewModelParams({ placeholder: false });
      // 自動置中：以包圍盒中心為基準，把模型移到原點
      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      const group = new THREE.Group();
      group.add(obj);
      obj.position.sub(center);
      group.userData.isWeapon = true;
      group.name = `weapon_${this.currentWeaponId}`;
      group.matrixAutoUpdate = true;
      group.frustumCulled = false;

      // 將視圖參數套在外層 group（避免破壞置中）
      // 确保缩放值合理
      const safeScaleX = Math.max(0.001, Math.min(10, Math.abs(scaleVec.x))) * Math.sign(scaleVec.x || 1);
      const safeScaleY = Math.max(0.001, Math.min(10, Math.abs(scaleVec.y))) * Math.sign(scaleVec.y || 1);
      const safeScaleZ = Math.max(0.001, Math.min(10, Math.abs(scaleVec.z))) * Math.sign(scaleVec.z || 1);
      
      // 确保位置在合理范围内
      const safePosX = Math.max(-2, Math.min(2, pos[0] || 0));
      const safePosY = Math.max(-2, Math.min(2, pos[1] || 0));
      const safePosZ = Math.max(-5, Math.min(0, pos[2] || 0));
      
      // 确保旋转在合理范围内
      const safeRotX = Math.max(-Math.PI, Math.min(Math.PI, rot[0] || 0));
      const safeRotY = Math.max(-Math.PI, Math.min(Math.PI, rot[1] || 0));
      const safeRotZ = Math.max(-Math.PI, Math.min(Math.PI, rot[2] || 0));
      
      // 应用安全值
      group.scale.set(safeScaleX, safeScaleY, safeScaleZ);
      group.position.set(safePosX, safePosY, safePosZ);
      group.rotation.set(safeRotX, safeRotY, safeRotZ);

      // 若在載入過程中發生了新請求，忽略本次結果
      if (reqId !== this._loadRequestId) {
        this._loadingModelPath = null;
        return;
      }
      cam.add(group); // 掛在相機座標系
      this._weaponObject = group;
      try {
        cam.updateMatrixWorld(true);
        group.updateMatrixWorld(true);
        console.log('[WeaponSystem] Weapon attached to camera:', {
          camUUID: cam.uuid,
          parentUUID: group.parent?.uuid,
          isParentCamera: group.parent === cam
        });
      } catch {}
      console.log('[WeaponSystem] 武器模型已掛載到相機');
      this._loadingModelPath = null;
    } catch (err) {
      console.error('[WeaponSystem] 載入模型失敗:', modelPath, err);
      this._loadingModelPath = null;
    }
  }

  _clearModel() {
    // 盡可能從相機下清掉所有殘留的武器群組
    try {
      const cam = this.graphics?.getCamera?.();
      if (cam) {
        const toRemove = [];
        cam.children?.forEach(ch => {
          if (ch?.userData?.isWeapon) toRemove.push(ch);
        });
        toRemove.forEach(ch => cam.remove(ch));
        if (toRemove.length) console.log('[WeaponSystem] 從相機移除殘留武器數量:', toRemove.length);
      }
    } catch {}
    // 也從場景根節點清理（避免曾經被加到 scene 的殘留物件）
    try {
      const scene = this.graphics?.scene;
      if (scene) {
        const toRemoveScene = [];
        scene.children?.forEach(ch => {
          if (ch?.userData?.isWeapon) toRemoveScene.push(ch);
        });
        toRemoveScene.forEach(ch => scene.remove(ch));
        if (toRemoveScene.length) console.log('[WeaponSystem] 從場景移除殘留武器數量:', toRemoveScene.length);
      }
    } catch {}

    if (!this._weaponObject) return;
    const obj = this._weaponObject;
    this._weaponObject = null;
    obj.parent && obj.parent.remove(obj);

    // 僅釋放佔位幾何（knife），避免 GLTF 快取共用資源被 dispose 影響之後 clone
    if (obj?.userData?.isPlaceholder) {
      obj.traverse(n => {
        if (n.isMesh) {
          n.geometry && n.geometry.dispose && n.geometry.dispose();
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach(m => m && m.dispose && m.dispose());
        }
      });
    }
  }

  // 每幀檢查與校正：確保武器與手部仍掛在相機上並更新矩陣
  updateAttachment() {
    const cam = this.graphics?.getCamera?.();
    if (!cam) return;

    // 強制更新相機矩陣
    cam.updateMatrixWorld(true);

    // 校正武器
    const w = this._weaponObject;
    if (w) {
      // 確保武器始終跟隨相機，但避免重複添加
      if (w.parent !== cam) {
        try {
          // 先從舊父節點移除
          if (w.parent) {
            w.parent.remove(w);
          }
          cam.add(w);
          console.log('[WeaponSystem] 偵測到武器脫離，已重新掛載到相機');
        } catch (_) {}
      }
      
      // 更新武器矩陣，但不強制重置位置
      try {
        w.frustumCulled = false;
        w.matrixAutoUpdate = true;
        w.updateMatrixWorld(true);
        
        w.traverse(n => {
          if (n.isMesh) {
            n.frustumCulled = false;
            n.matrixAutoUpdate = true;
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach(m => { if (m) { m.depthTest = false; m.depthWrite = false; } });
          }
        });
      } catch (_) {}
    }

    // Debug：更新槍口標記位置
    try {
      if (this._debugMuzzle?.enabled) {
        const scene = this.graphics?.scene;
        if (scene) {
          if (!this._debugMuzzle.obj) {
            const g = new THREE.SphereGeometry(0.01, 12, 12);
            const m = new THREE.MeshBasicMaterial({ color: 0xff3366 });
            const s = new THREE.Mesh(g, m);
            s.userData.isTracer = true; // 射線忽略
            s.renderOrder = 1000;
            s.frustumCulled = false;
            scene.add(s);
            this._debugMuzzle.obj = s;
          }
          const p = this._getMuzzleWorldPosition?.();
          if (p) {
            this._debugMuzzle.obj.visible = true;
            this._debugMuzzle.obj.position.copy(p);
          } else if (this._debugMuzzle.obj) {
            this._debugMuzzle.obj.visible = false;
          }
        }
      } else if (this._debugMuzzle?.obj) {
        this._debugMuzzle.obj.visible = false;
      }
    } catch (_) {}
  }

}
