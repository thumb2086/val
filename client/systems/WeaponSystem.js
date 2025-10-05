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

    // Hands 模型管理
    this._handsLoader = new GLTFLoader();
    this._handsObject = null; // 目前掛在相機下的手部物件
    this._handsGltfCache = new Map();
    this._handsLoadingPath = null;
    // 預設手部模型路徑（可視需要抽到設定檔）
    this._handsModelPath = 'assets/models/hands/fps_hands_rigged_by_evolvegames/scene.gltf';

    // 載入請求序號：避免快速切換武器時舊的載入結果覆蓋新武器
    this._loadRequestId = 0;

    // Debug：槍口標記
    this._debugMuzzle = { enabled: false, obj: null };
    // Hands 顯示開關（預設關閉）
    this.handsEnabled = false;

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
    
    // 依設定決定是否載入手部模型
    if (this.handsEnabled) {
      this._ensureHandsModel().then(() => this._applyHandsTransform()).catch(() => {});
    } else {
      this._clearHandsModel();
    }
    
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
      // 輕量除錯：輸出無法開火原因（冷卻/彈藥/重裝）
      try {
        const w = WEAPONS[this.currentWeaponId];
        const usesAmmo = w?.usesAmmo !== false;
        const intervalMs = (w?.fireRate || 0) * 1000;
        const cd = now - this.lastShotAt;
        if (this.isReloading) console.debug('[WeaponSystem] 無法開火：正在換彈');
        else if (usesAmmo && this.ammoInMag <= 0) console.debug('[WeaponSystem] 無法開火：彈匣為 0');
        else if (cd < intervalMs) console.debug('[WeaponSystem] 無法開火：冷卻中', { cd: Math.round(cd), need: Math.round(intervalMs) });
      } catch {}
      return false;
    }

    this.lastShotAt = now;
    const weapon = WEAPONS[this.currentWeaponId];
    const usesAmmo = weapon?.usesAmmo !== false;
    if (usesAmmo) this.ammoInMag -= 1;

    // 播放音效/特效（之後接）
    // this.audio?.play(WEAPONS[this.currentWeaponId].sound_fire);
    // this.graphics?.playMuzzleFlash();

    if (usesAmmo) this.ui?.updateAmmo?.(this.ammoInMag, WEAPONS[this.currentWeaponId].magazineSize);

    // 產生子彈軌跡（tracer）
    try {
      const cam = this.graphics?.getCamera?.();
      if (cam && this.bullets) {
        // 確保矩陣為最新，避免位置/朝向延遲
        cam.updateMatrixWorld(true);
        this._weaponObject?.updateMatrixWorld(true);
        // 優先使用槍口位置作為發射點，若不可得再回退到相機前方
        const dir = cam.getWorldDirection(new THREE.Vector3()).normalize();
        const camPos = cam.getWorldPosition(new THREE.Vector3());
        const near = Math.max(0.01, cam.near || 0.1);
        const muzzle = this._getMuzzleWorldPosition?.();
        let from = muzzle ? muzzle.clone() : camPos.clone().add(dir.clone().multiplyScalar(Math.max(0.2, near * 2)));
        // 若槍口在相機後方或太靠近近裁面，回退到相機前方
        const vecCamToFrom = from.clone().sub(camPos);
        if (vecCamToFrom.dot(dir) <= 0 || vecCamToFrom.length() < near * 1.2) {
          from = camPos.clone().add(dir.clone().multiplyScalar(Math.max(0.2, near * 2)));
        }
        // 目標點
        let to = aimPoint
          ? new THREE.Vector3(aimPoint.x, aimPoint.y, aimPoint.z)
          : from.clone().add(dir.clone().multiplyScalar(1000));
        // 保險：避免零長度/NaN
        if (!isFinite(from.x) || !isFinite(from.y) || !isFinite(from.z)) from = camPos.clone().add(dir.clone().multiplyScalar(Math.max(0.2, near * 2)));
        if (!isFinite(to.x) || !isFinite(to.y) || !isFinite(to.z)) to = from.clone().add(dir.clone().multiplyScalar(1000));
        if (to.clone().sub(from).lengthSq() < 1e-6) to.add(dir.clone().multiplyScalar(1));
        // 輕量除錯：一次性輸出起迄點距離
        try {
          const dist = to.clone().sub(from).length();
          console.debug('[WeaponSystem] spawnTracer', { dist: Math.round(dist), from: { x: from.x.toFixed(2), y: from.y.toFixed(2), z: from.z.toFixed(2) } });
        } catch {}
        this.bullets.spawnTracer(from, to);
      }
    } catch (e) {
      console.warn('[WeaponSystem] 產生 tracer 發生例外:', e);
    }

    // 通知伺服器（射擊事件）
    this.network?.emit?.('shoot', { roomId, point: aimPoint, weaponId: this.currentWeaponId });
    return true;
  }

  // 估算武器槍口世界座標：
  // 以目前掛在相機下的武器群組（this._weaponObject）為基礎，
  // 取包圍盒中心 worldCenter 與世界朝前向量 worldForward（群組 -Z），
  // 沿前向量推 sizeZ/2 的距離即視為槍口位置。
  _getMuzzleWorldPosition() {
    const group = this._weaponObject;
    if (!group) return null;
    try {
      // 保險：確保矩陣為最新（即使由非 fire() 的呼叫點觸發）
      try { this.graphics?.getCamera?.()?.updateMatrixWorld(true); } catch {}
      try { group.updateMatrixWorld(true); } catch {}
      // 讀取配置 + 覆寫
      const baseVM = WEAPONS[this.currentWeaponId]?.viewModel || {};
      const skin = WEAPONS[this.currentWeaponId]?.skins?.[this.skinIndex];
      const skinVM = (skin && skin.viewModel) ? skin.viewModel : {};
      let merged = { ...baseVM, ...skinVM };
      try {
        const ov = this._readViewOverride?.(this.currentWeaponId, this.skinIndex);
        if (ov && typeof ov === 'object') merged = { ...merged, ...ov };
      } catch {}
      const vm = merged;

      // 先計算「預設槍口」：以群組（已自動置中）之包圍盒中心與大小，沿世界前向（-Z）推出半長度
      const box = new THREE.Box3().setFromObject(group);
      if (!box || !isFinite(box.min.x) || !isFinite(box.max.x)) return null;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const worldForward = new THREE.Vector3(0, 0, -1).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const baseWorld = center.clone().add(worldForward.clone().multiplyScalar(size.z * 0.5));

      // 先處理螢幕空間（不依賴 muzzleOffset）
      const cam = this.graphics?.getCamera?.();
      const space = vm.muzzleSpace || 'local'; // 'local' | 'camera' | 'world' | 'screen'
      if (space === 'screen' && cam) {
        let ndc2;
        if (Array.isArray(vm.muzzleScreenPx) && vm.muzzleScreenPx.length === 2) {
          const w = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1;
          const h = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 1;
          const x = (vm.muzzleScreenPx[0] / w) * 2 - 1;           // 左-1 右+1
          const y = - (vm.muzzleScreenPx[1] / h) * 2 + 1;         // 上+1 下-1
          ndc2 = new THREE.Vector2(x, y);
        } else {
          const x = (Array.isArray(vm.muzzleScreen) && vm.muzzleScreen.length === 2) ? vm.muzzleScreen[0] : 0;
          const y = (Array.isArray(vm.muzzleScreen) && vm.muzzleScreen.length === 2) ? vm.muzzleScreen[1] : 0;
          ndc2 = new THREE.Vector2(x, y); // 直接使用 NDC (-1..1)
        }
        const rc = new THREE.Raycaster();
        rc.setFromCamera(ndc2, cam);
        const camOrigin = cam.getWorldPosition(new THREE.Vector3());
        const forward = rc.ray.direction.clone().normalize();
        const depth = (typeof vm.muzzleDepth === 'number') ? vm.muzzleDepth : Math.max(0.2, (cam.near || 0.1) * 2);
        return camOrigin.clone().add(forward.multiplyScalar(depth));
      }

      // 若提供 muzzleOffset，依 muzzleSpace 決定套用座標空間
      if (Array.isArray(vm.muzzleOffset) && vm.muzzleOffset.length === 3) {
        const offset = new THREE.Vector3(vm.muzzleOffset[0], vm.muzzleOffset[1], vm.muzzleOffset[2]);

        if (space === 'camera' && cam) {
          // 相機座標：不受武器自身旋轉影響，調整更穩定，仍會跟著視角
          const camOrigin = cam.getWorldPosition(new THREE.Vector3());
          const offsetWorld = cam.localToWorld(offset.clone()).sub(camOrigin);
          return camOrigin.clone().add(offsetWorld);
        }
        if (space === 'world' && cam) {
          // 世界軸偏移：以世界 XYZ 偏移相機位置（不隨相機/武器旋轉）
          const camOrigin = cam.getWorldPosition(new THREE.Vector3());
          return camOrigin.clone().add(offset);
        }

        // 預設：武器本地座標（原行為）—會隨武器群組旋轉
        const originWorld = group.getWorldPosition(new THREE.Vector3());
        const offsetWorld = group.localToWorld(offset.clone()).sub(originWorld);
        return baseWorld.clone().add(offsetWorld);
      }

      // 否則直接回傳預設槍口位置
      return baseWorld;
    } catch (e) {
      return null;
    }
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

  // 取得手部視圖模型參數（可被每把武器的 viewHands 覆寫）
  _getHandsParams() {
    const weapon = WEAPONS[this.currentWeaponId] || {};
    const vm = weapon.viewHands || {};
    // 调整手部模型的默认位置和旋转，使其更自然
    const defaultScale = 0.15;
    const defaultPos = [0.5, -0.7, -1.0];
    const defaultRot = [-0.1, Math.PI, 0.05];

    let scaleVec;
    if (Array.isArray(vm.scale) && vm.scale.length === 3) {
      scaleVec = new THREE.Vector3(vm.scale[0], vm.scale[1], vm.scale[2]);
    } else {
      const s = typeof vm.scale === 'number' ? vm.scale : defaultScale;
      scaleVec = new THREE.Vector3(s, s, s);
    }
    
    // 确保位置和旋转数组有效
    const pos = (Array.isArray(vm.position) && vm.position.length === 3) ? 
      [...vm.position] : [...defaultPos];
    const rot = (Array.isArray(vm.rotation) && vm.rotation.length === 3) ? 
      [...vm.rotation] : [...defaultRot];
      
    // 确保手部模型不会穿模
    if (weapon.type === 'melee') {
      // 近战武器时手部位置微调
      pos[0] = pos[0] ?? 0.5;
      pos[1] = pos[1] ?? -0.6;
      pos[2] = pos[2] ?? -0.9;
    }
    return { scaleVec, pos, rot };
  }

  async _ensureHandsModel() {
    if (!this.handsEnabled) return;
    if (!this.graphics?.getCamera) return;
    const cam = this.graphics.getCamera();
    if (!cam) return;
    if (this._handsObject) return; // 已載入

    const modelPath = this._handsModelPath;
    if (!modelPath) return;

    if (this._handsLoadingPath === modelPath) return;
    this._handsLoadingPath = modelPath;

    // 與武器相同的路徑修正策略
    const needsFix = modelPath?.startsWith('assets/models/');
    const localManager = needsFix ? new THREE.LoadingManager() : null;
    if (localManager && needsFix) {
      localManager.setURLModifier((url) => {
        if (!url) return url;
        if (url.startsWith('data:')) return url;
        if (url.startsWith('blob:')) return url;
        if (url.startsWith('http')) return url;
        if (url === modelPath || /(\.gltf|\.glb)(\?.*)?$/i.test(url)) return url;
        let fixedUrl = url;
        if (fixedUrl.includes('textures/')) fixedUrl = fixedUrl.replace(/.*textures\//, '');
        const hasExt = /\.[a-z0-9]{2,5}(\?.*)?$/i.test(fixedUrl);
        if (!hasExt) fixedUrl += '.png';
        const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
        if (!fixedUrl.startsWith(modelDir)) fixedUrl = modelDir + fixedUrl;
        console.log('[WeaponSystem][Hands] URL修正:', url, '->', fixedUrl);
        return fixedUrl;
      });
    }
    const loader = localManager ? new GLTFLoader(localManager) : this._handsLoader;

    try {
      // 快取
      if (this._handsGltfCache.has(modelPath)) {
        const cached = this._handsGltfCache.get(modelPath);
        const src = cached.scene || cached.scenes?.[0];
        if (src) {
          const obj = src.clone(true);
          obj.traverse(n => {
            if (n.isMesh) {
              n.castShadow = false;
              n.receiveShadow = false;
              n.frustumCulled = false;
              n.renderOrder = 998; // 先於場景、略低於武器
              const mats = Array.isArray(n.material) ? n.material : [n.material];
              mats.forEach(m => { if (m) { m.depthTest = false; m.depthWrite = false; m.side = THREE.DoubleSide; } });
            }
          });

          const box = new THREE.Box3().setFromObject(obj);
          const center = box.getCenter(new THREE.Vector3());
          const group = new THREE.Group();
          group.add(obj);
          obj.position.sub(center);
          group.userData.isHands = true;
          group.matrixAutoUpdate = true;
          group.frustumCulled = false;

          // 套用手部視圖參數
          const { scaleVec, pos, rot } = this._getHandsParams();
          group.scale.set(scaleVec.x, scaleVec.y, scaleVec.z);
          group.position.set(pos[0], pos[1], pos[2]);
          group.rotation.set(rot[0], rot[1], rot[2]);

          cam.add(group);
          this._handsObject = group;
          cam.updateMatrixWorld(true);
          group.updateMatrixWorld(true);
          console.log('[WeaponSystem] Hands attached to camera:', {
            camUUID: cam.uuid,
            parentUUID: group.parent?.uuid,
            isParentCamera: group.parent === cam
          });
          console.log('[WeaponSystem] 手部模型已從快取掛載');
          return;
        }
      }

      const gltf = await new Promise((resolve, reject) => loader.load(modelPath, resolve, undefined, reject));
      try { this._handsGltfCache.set(modelPath, gltf); } catch {}
      const obj = gltf.scene || gltf.scenes?.[0];
      if (!obj) { this._handsLoadingPath = null; return; }

      obj.traverse(n => {
        if (n.isMesh) {
          n.castShadow = false;
          n.receiveShadow = false;
          n.frustumCulled = false;
          n.renderOrder = 998;
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach(m => { if (m) { m.depthTest = false; m.depthWrite = false; m.side = THREE.DoubleSide; } });
        }
      });

      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      const group = new THREE.Group();
      group.add(obj);
      obj.position.sub(center);
      group.userData.isHands = true;
      group.matrixAutoUpdate = true;
      group.frustumCulled = false;

      const { scaleVec, pos, rot } = this._getHandsParams();
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

      cam.add(group);
      this._handsObject = group;
      try {
        cam.updateMatrixWorld(true);
        group.updateMatrixWorld(true);
        console.log('[WeaponSystem] Hands attached to camera:', {
          camUUID: cam.uuid,
          parentUUID: group.parent?.uuid,
          isParentCamera: group.parent === cam
        });
      } catch {}
      this._handsLoadingPath = null;
      console.log('[WeaponSystem] 手部模型已掛載到相機');
    } catch (e) {
      console.error('[WeaponSystem] 手部模型載入失敗:', modelPath, e);
      this._handsLoadingPath = null;
    }
  }

  _applyHandsTransform() {
    if (!this._handsObject) return;
    const { scaleVec, pos, rot } = this._getHandsParams();
    
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
    this._handsObject.scale.set(safeScaleX, safeScaleY, safeScaleZ);
    this._handsObject.position.set(safePosX, safePosY, safePosZ);
    this._handsObject.rotation.set(safeRotX, safeRotY, safeRotZ);
  }

  // ===== 視圖覆寫：伺服器 API 與緩存 =====
  _initViewModelOverrides() {
    try {
      const p = this._ensureOverridesLoaded();
      if (p && typeof p.then === 'function') {
        p.then(() => { try { this.applyCurrentViewModelTransform(); } catch {} })
         .catch(() => {});
      }
    } catch {}
  }

  async _ensureOverridesLoaded(force = false) {
    if (this._vmFetchPromise) return this._vmFetchPromise;
    if (this._vmOverridesLoaded && !force) return;
    this._vmFetchPromise = (async () => {
      try {
        const res = await fetch('/api/viewmodel-overrides', { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this._vmOverrides = (data && typeof data === 'object') ? data : {};
        this._vmOverridesLoaded = true;
      } catch (e) {
        console.warn('[WeaponSystem] 載入 viewmodel overrides 失敗：', e?.message || e);
      } finally {
        this._vmFetchPromise = null;
      }
    })();
    return this._vmFetchPromise;
  }

  // ===== 視圖覆寫：localStorage 層（每把武器/每個皮膚） =====
  _getViewOverrideKey(weaponId, skinIndex) {
    return `ws.vm.${weaponId}.${skinIndex}`;
  }

  _readViewOverride(weaponId, skinIndex) {
    // 改為從伺服器緩存讀取；若未載入則觸發背景載入並回傳 null（同步路徑）
    if (!this._vmOverridesLoaded) {
      try { const p = this._ensureOverridesLoaded(); if (p && typeof p.then === 'function') { p.then(() => { try { this.applyCurrentViewModelTransform(); } catch {} }); } } catch {}
    }
    try {
      const all = this._vmOverrides || {};
      const byWeapon = all[weaponId] || null;
      if (!byWeapon) return null;
      const keyStr = String(skinIndex);
      const ov = byWeapon[keyStr] ?? byWeapon[skinIndex] ?? null;
      return (ov && typeof ov === 'object') ? ov : null;
    } catch { return null; }
  }

  _writeViewOverride(weaponId, skinIndex, data) {
    // 不再寫入 localStorage；保留方法以相容舊代碼，僅更新客戶端緩存
    try {
      if (!data || typeof data !== 'object') return;
      this._vmOverrides = this._vmOverrides || {};
      const weaponMap = this._vmOverrides[weaponId] || {};
      weaponMap[String(skinIndex)] = { ...(weaponMap[String(skinIndex)] || {}), ...data };
      this._vmOverrides[weaponId] = weaponMap;
      this._vmOverridesLoaded = true;
    } catch {}
  }

  getCurrentViewModelOverride() {
    return this._readViewOverride(this.currentWeaponId, this.skinIndex);
  }

  async setCurrentViewModelOverride(partial) {
    if (!partial || typeof partial !== 'object') return;
    const allow = ['scale', 'position', 'rotation', 'muzzleOffset', 'muzzleSpace', 'muzzleScreen', 'muzzleScreenPx', 'muzzleDepth'];
    const filtered = {};
    allow.forEach(k => { if (k in partial) filtered[k] = partial[k]; });

    try {
      await this._ensureOverridesLoaded();
      const res = await fetch('/api/viewmodel-overrides/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weaponId: this.currentWeaponId, skinIndex: this.skinIndex, partial: filtered })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json && json.overrides && typeof json.overrides === 'object') {
        this._vmOverrides = json.overrides;
        this._vmOverridesLoaded = true;
      } else {
        // 後備：更新本地緩存
        this._writeViewOverride(this.currentWeaponId, this.skinIndex, filtered);
      }
    } catch (e) {
      console.warn('[WeaponSystem] 設定 viewmodel override 失敗，改為本地緩存：', e?.message || e);
      this._writeViewOverride(this.currentWeaponId, this.skinIndex, filtered);
    }

    // 立即應用到當前武器
    this.applyCurrentViewModelTransform();
  }

  async clearCurrentViewModelOverride(keys) {
    // keys 可選：若提供則清除指定鍵，否則清除此武器該皮膚的所有覆寫
    try {
      await this._ensureOverridesLoaded();
      const payload = { weaponId: this.currentWeaponId, skinIndex: this.skinIndex };
      if (Array.isArray(keys) && keys.length) payload.keys = keys;
      const res = await fetch('/api/viewmodel-overrides/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json && json.overrides && typeof json.overrides === 'object') {
        this._vmOverrides = json.overrides;
        this._vmOverridesLoaded = true;
      } else {
        // 後備：本地緩存清除
        if (this._vmOverrides && this._vmOverrides[this.currentWeaponId]) {
          const m = { ...this._vmOverrides[this.currentWeaponId] };
          const key = String(this.skinIndex);
          if (Array.isArray(keys) && keys.length) {
            const cur = { ...(m[key] || {}) };
            keys.forEach(k => { delete cur[k]; });
            if (Object.keys(cur).length === 0) delete m[key]; else m[key] = cur;
          } else {
            delete m[key];
          }
          if (Object.keys(m).length === 0) delete this._vmOverrides[this.currentWeaponId];
          else this._vmOverrides[this.currentWeaponId] = m;
        }
      }
    } catch (e) {
      console.warn('[WeaponSystem] 清除 viewmodel override 失敗（以本地緩存為準）：', e?.message || e);
      if (this._vmOverrides && this._vmOverrides[this.currentWeaponId]) {
        const m = { ...this._vmOverrides[this.currentWeaponId] };
        const key = String(this.skinIndex);
        if (Array.isArray(keys) && keys.length) {
          const cur = { ...(m[key] || {}) };
          keys.forEach(k => { delete cur[k]; });
          if (Object.keys(cur).length === 0) delete m[key]; else m[key] = cur;
        } else {
          delete m[key];
        }
        if (Object.keys(m).length === 0) delete this._vmOverrides[this.currentWeaponId];
        else this._vmOverrides[this.currentWeaponId] = m;
      }
    }
    this.applyCurrentViewModelTransform();
  }

  // 立即將覆寫套用到當前武器群組（不重新載入）
  applyCurrentViewModelTransform() {
    const w = this._weaponObject;
    if (!w) return;
    const { scaleVec, pos, rot } = this._getViewModelParams({ placeholder: false });
    // 安全值限制
    const safeScaleX = Math.max(0.001, Math.min(10, Math.abs(scaleVec.x))) * Math.sign(scaleVec.x || 1);
    const safeScaleY = Math.max(0.001, Math.min(10, Math.abs(scaleVec.y))) * Math.sign(scaleVec.y || 1);
    const safeScaleZ = Math.max(0.001, Math.min(10, Math.abs(scaleVec.z))) * Math.sign(scaleVec.z || 1);
    const safePosX = Math.max(-2, Math.min(2, pos[0] || 0));
    const safePosY = Math.max(-2, Math.min(2, pos[1] || 0));
    const safePosZ = Math.max(-5, Math.min(0, pos[2] || 0));
    const safeRotX = Math.max(-Math.PI, Math.min(Math.PI, rot[0] || 0));
    const safeRotY = Math.max(-Math.PI, Math.min(Math.PI, rot[1] || 0));
    const safeRotZ = Math.max(-Math.PI, Math.min(Math.PI, rot[2] || 0));
    try {
      w.scale.set(safeScaleX, safeScaleY, safeScaleZ);
      w.position.set(safePosX, safePosY, safePosZ);
      w.rotation.set(safeRotX, safeRotY, safeRotZ);
      this.graphics?.getCamera?.()?.updateMatrixWorld(true);
      w.updateMatrixWorld(true);
      // 可開關的除錯輸出（在瀏覽器主控台輸入 `window.VM_DEBUG = true` 開啟）
      if (typeof window !== 'undefined' && window.VM_DEBUG) {
        try {
          const muzzle = this._getMuzzleWorldPosition?.();
          const muzzleArr = muzzle && muzzle.toArray ? muzzle.toArray() : null;
          console.debug('[WeaponSystem][VM]', {
            scale: [safeScaleX, safeScaleY, safeScaleZ],
            position: [safePosX, safePosY, safePosZ],
            rotation: [safeRotX, safeRotY, safeRotZ],
            muzzle: muzzleArr,
          });
        } catch {}
      }
    } catch {}
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

    // 若沒有提供模型路徑（例如 knife），使用簡易幾何生成視圖模型
    if (!modelPath) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.02, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.2, roughness: 0.6 })
      );
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.06, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.1, roughness: 0.9 })
      );
      handle.position.set(0, -0.04, 0.15);
      const group = new THREE.Group();
      group.add(mesh);
      group.add(handle);
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

    // 校正手部
    const h = this._handsObject;
    if (!this.handsEnabled) {
      if (h) {
        try { h.parent && h.parent.remove(h); } catch {}
        this._handsObject = null;
      }
    } else if (h) {
      if (h.parent !== cam) {
        try {
          // 先從舊父節點移除
          if (h.parent) {
            h.parent.remove(h);
          }
          cam.add(h);
          console.log('[WeaponSystem] 偵測到手部脫離，已重新掛載到相機');
        } catch (_) {}
      }
      try {
        h.frustumCulled = false;
        h.matrixAutoUpdate = true;
        h.updateMatrixWorld(true);
        
        h.traverse(n => {
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

  // 開關：槍口 debug 標記
  setMuzzleDebug(enabled) {
    this._debugMuzzle = this._debugMuzzle || { enabled: false, obj: null };
    this._debugMuzzle.enabled = !!enabled;
    if (!enabled && this._debugMuzzle.obj) {
      try {
        this._debugMuzzle.obj.visible = false;
      } catch {}
    }
  }

  // 切換手部模型顯示
  setHandsEnabled(enabled) {
    const next = !!enabled;
    if (this.handsEnabled === next) return;
    this.handsEnabled = next;
    if (next) {
      try {
        const p = this._ensureHandsModel();
        if (p && typeof p.then === 'function') {
          p.then(() => this._applyHandsTransform()).catch(() => {});
        } else {
          this._applyHandsTransform();
        }
      } catch (_) {}
    } else {
      this._clearHandsModel();
    }
  }

  // 安全移除相機/場景中的手部模型
  _clearHandsModel() {
    try {
      const cam = this.graphics?.getCamera?.();
      if (cam) {
        const toRemove = [];
        cam.children?.forEach(ch => { if (ch?.userData?.isHands) toRemove.push(ch); });
        toRemove.forEach(ch => cam.remove(ch));
        if (toRemove.length) console.log('[WeaponSystem] 從相機移除殘留手部數量:', toRemove.length);
      }
    } catch {}
    try {
      const scene = this.graphics?.scene;
      if (scene) {
        const toRemoveScene = [];
        scene.children?.forEach(ch => { if (ch?.userData?.isHands) toRemoveScene.push(ch); });
        toRemoveScene.forEach(ch => scene.remove(ch));
        if (toRemoveScene.length) console.log('[WeaponSystem] 從場景移除殘留手部數量:', toRemoveScene.length);
      }
    } catch {}
    if (this._handsObject) {
      try {
        const obj = this._handsObject;
        this._handsObject = null;
        obj.parent && obj.parent.remove(obj);
      } catch {}
    }
    this._handsLoadingPath = null;
  }

  isMuzzleDebugEnabled() {
    return !!(this._debugMuzzle && this._debugMuzzle.enabled);
  }
}
