// client/systems/MapSystem.js
import * as THREE from 'three';

export default class MapSystem {
  constructor(graphics) {
    this.graphics = graphics; // 需要 graphics.scene 來掛載物件
    this.loaded = false;
    this.objects = [];
    this._texLoader = new THREE.TextureLoader();
    // 追蹤靶子，提供命中/重生邏輯
    this.targets = [];
    // 地面高度（供重生時使用）
    this._groundY = -1;
  }

  clear() {
    if (!this.graphics?.scene) return;
    this.objects.forEach(obj => {
      this.graphics.scene.remove(obj);
      // 嘗試釋放資源
      obj.traverse?.(n => {
        if (n.isMesh) {
          n.geometry?.dispose?.();
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach(m => m?.dispose?.());
        }
      });
    });
    this.objects.length = 0;
    this.targets.length = 0;
    this.loaded = false;
  }

  async load(mapKey = 'training_range', options = {}) {
    if (!this.graphics?.scene) {
      console.warn('[MapSystem] graphics 或 scene 不存在');
      return;
    }
    console.log('[MapSystem] 開始載入地圖:', mapKey, options);
    this.clear();

    const scene = this.graphics.scene;

    // 根據地圖類型載入不同風格
    if (mapKey === 'valorant_training') {
      await this._loadValorantTrainingRange(scene, options);
    } else if (mapKey === 'valorant_haven') {
      await this._loadValorantHaven(scene, options);
    } else if (mapKey === 'valorant_bind') {
      await this._loadValorantBind(scene, options);
    } else {
      // 預設載入訓練場
      await this._loadValorantTrainingRange(scene, options);
    }

    this.loaded = true;
    console.log('[MapSystem] 地圖載入完成');
  }

  // 特戰英豪風格的訓練場
  async _loadValorantTrainingRange(scene, options) {
    // --- 材質定義 ---
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d4,
      roughness: 0.8,
      metalness: 0.1
    });
    
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x00d4aa, // 特戰英豪青綠色
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0x003322,
      emissiveIntensity: 0.1
    });

    // 場地參數
    const arenaSize = 60;
    const wallHeight = 4;
    const wallThickness = 0.3;
    const groundY = -1;
    // 保存地面高度供靶子重生使用
    this._groundY = groundY;
    const wallY = groundY + wallHeight / 2;

    // 主要外牆 - 特戰英豪風格的簡潔設計
    this._createWall(scene, wallThickness, wallHeight, arenaSize, -arenaSize/2, wallY, 0, wallMat); // 西牆
    this._createWall(scene, wallThickness, wallHeight, arenaSize, arenaSize/2, wallY, 0, wallMat);  // 東牆
    this._createWall(scene, arenaSize, wallHeight, wallThickness, 0, wallY, -arenaSize/2, wallMat); // 北牆
    this._createWall(scene, arenaSize, wallHeight, wallThickness, 0, wallY, arenaSize/2, wallMat);  // 南牆

    // 青綠色裝飾條紋
    this._createAccentStripe(scene, arenaSize, 0.1, 0.2, 0, groundY + wallHeight - 0.1, -arenaSize/2 + 0.05, accentMat);
    this._createAccentStripe(scene, arenaSize, 0.1, 0.2, 0, groundY + wallHeight - 0.1, arenaSize/2 - 0.05, accentMat);

    // 訓練場特色：射擊平台和靶位區域
    this._createShootingPlatforms(scene, groundY, wallMat, accentMat);
    
    // 生成特戰英豪風格的靶子
    const targetCount = Math.max(1, Math.min(50, parseInt(options.targetCount ?? 15, 10) || 15));
    this._createValorantTargets(scene, targetCount, groundY);
  }

  // 特戰英豪風格的Haven地圖（三點地圖）
  async _loadValorantHaven(scene, options) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xc8b99c, roughness: 0.7, metalness: 0.1 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xff4655, roughness: 0.3, metalness: 0.2 });
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8, metalness: 0.0 });
    
    const arenaSize = 70;
    const wallHeight = 4;
    const groundY = -1;
    
    // 創建Haven風格的三點布局
    this._createHavenLayout(scene, arenaSize, wallHeight, groundY, wallMat, accentMat, coverMat);
  }

  // 特戰英豪風格的Bind地圖（雙點地圖）
  async _loadValorantBind(scene, options) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.8, metalness: 0.1 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x00d4aa, roughness: 0.3, metalness: 0.2 });
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9, metalness: 0.0 });
    
    const arenaSize = 65;
    const wallHeight = 4;
    const groundY = -1;
    
    // 創建Bind風格的雙點布局
    this._createBindLayout(scene, arenaSize, wallHeight, groundY, wallMat, accentMat, coverMat);
  }

  // 輔助方法：創建牆體
  _createWall(scene, width, height, depth, x, y, z, material) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    this.objects.push(wall);
    return wall;
  }

  // 輔助方法：創建裝飾條紋
  _createAccentStripe(scene, width, height, depth, x, y, z, material) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    stripe.position.set(x, y, z);
    scene.add(stripe);
    this.objects.push(stripe);
    return stripe;
  }

  // 創建射擊平台
  _createShootingPlatforms(scene, groundY, wallMat, accentMat) {
    // 主射擊平台
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(25, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6, metalness: 0.1 })
    );
    platform.position.set(15, groundY + 0.1, 0);
    scene.add(platform);
    this.objects.push(platform);

    // 平台護欄
    for (let i = 0; i < 3; i++) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.2, 8),
        accentMat
      );
      rail.position.set(15 + (i - 1) * 12, groundY + 0.6, 0);
      scene.add(rail);
      this.objects.push(rail);
    }
  }

  // 創建紅色圓形靶子
  _createValorantTargets(scene, targetCount, groundY) {
    console.log('[MapSystem] 生成球形靶子數量:', targetCount);
    
    // 靶子位置配置
    const targetPositions = [
      { x: -20, y: groundY + 1.7, z: -15 },
      { x: -25, y: groundY + 1.5, z: -10 },
      { x: -18, y: groundY + 1.8, z: -5 },
      { x: -22, y: groundY + 1.6, z: 0 },
      { x: -26, y: groundY + 1.7, z: 5 },
      { x: -19, y: groundY + 1.4, z: 10 },
      { x: -24, y: groundY + 1.9, z: 15 },
      { x: -15, y: groundY + 1.6, z: -12 },
      { x: -15, y: groundY + 1.6, z: 8 },
      { x: -28, y: groundY + 2.0, z: -8 },
      { x: -17, y: groundY + 1.3, z: 3 },
      { x: -23, y: groundY + 1.8, z: -3 },
      { x: -21, y: groundY + 1.5, z: 12 },
      { x: -27, y: groundY + 1.6, z: -5 },
      { x: -16, y: groundY + 1.9, z: -8 }
    ];

    // 如果需要更多靶子，自動生成額外位置
    while (targetPositions.length < targetCount) {
      const angle = (targetPositions.length / targetCount) * Math.PI * 2;
      const radius = 15 + Math.random() * 10;
      targetPositions.push({
        x: -20 + Math.cos(angle) * radius,
        y: groundY + 1.2 + Math.random() * 0.8,
        z: Math.sin(angle) * radius
      });
    }

    for (let i = 0; i < Math.min(targetCount, targetPositions.length); i++) {
      const pos = targetPositions[i];
      this._createSphereTarget(scene, pos.x, pos.y, pos.z, i + 1);
    }
  }

  // 創建紅色圓形靶子
  _createRedCircularTarget(scene, x, y, z, id) {
    const group = new THREE.Group();
    
    // 外圈 - 白色
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.4, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        side: THREE.DoubleSide
      })
    );
    group.add(outerRing);
    
    // 中圈 - 紅色
    const middleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.35, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        side: THREE.DoubleSide
      })
    );
    group.add(middleRing);
    
    // 內圈 - 白色
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.25, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        side: THREE.DoubleSide
      })
    );
    group.add(innerRing);
    
    // 靶心 - 紅色
    const bullseye = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        side: THREE.DoubleSide
      })
    );
    group.add(bullseye);
    
    // 支架
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, Math.abs(y - (-1)), 8),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8, metalness: 0.3 })
    );
    post.position.y = (y + (-1)) / 2 - y;
    group.add(post);
    
    // 背景板
    const backPlate = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 32),
      new THREE.MeshStandardMaterial({ 
        color: 0x222222,
        side: THREE.DoubleSide
      })
    );
    backPlate.position.z = -0.02;
    group.add(backPlate);
    
    group.position.set(x, y, z);
    
    // 添加輕微的搖擺動畫
    const originalRotation = { x: 0, y: 0, z: 0 };
    const animate = () => {
      const time = Date.now() * 0.0005;
      group.rotation.x = originalRotation.x + Math.sin(time + id * 0.5) * 0.02;
      group.rotation.z = originalRotation.z + Math.cos(time * 1.2 + id * 0.3) * 0.01;
      requestAnimationFrame(animate);
    };
    animate();
    
    scene.add(group);
    this.objects.push(group);
    console.log('[MapSystem] 紅色圓形靶', id, '位置:', x.toFixed(2), y.toFixed(2), z.toFixed(2));
  }

  // 創建球形靶子
  _createSphereTarget(scene, x, y, z, id) {
    const radius = 0.35;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 16),
      new THREE.MeshStandardMaterial({
        color: 0xff3344,
        metalness: 0.1,
        roughness: 0.6,
        emissive: 0x220000,
        emissiveIntensity: 0.05
      })
    );
    sphere.position.set(x, y, z);
    sphere.castShadow = true;
    sphere.receiveShadow = false;
    // 標記為靶子，供射線命中處理
    sphere.userData.isTarget = true;
    sphere.userData.targetId = id;
    sphere.name = `aimlab_sphere_target_${id}`;
    scene.add(sphere);
    this.objects.push(sphere);
    this.targets.push(sphere);
    console.log('[MapSystem] 球形靶', id, '位置:', x.toFixed(2), y.toFixed(2), z.toFixed(2));
  }

  // 供命中時呼叫：命中效果 + 重生
  onTargetHit(hitObject) {
    if (!hitObject) return;
    // 往上找到被標記為 isTarget 的節點
    let node = hitObject;
    while (node && !node.userData?.isTarget) node = node.parent;
    if (!node || !node.userData?.isTarget) return;
    // 避免重入
    if (node.userData._hitAnimating) return;
    node.userData._hitAnimating = true;

    const scene = this.graphics?.scene;
    if (!scene) return;

    // 命中視覺：短暫發光 + 輕微放大
    const mat = Array.isArray(node.material) ? node.material[0] : node.material;
    const original = {
      color: mat?.color?.clone?.(),
      emissive: mat?.emissive?.clone?.(),
      emissiveIntensity: mat?.emissiveIntensity
    };
    try {
      if (mat) {
        mat.emissive = new THREE.Color(0x22ff88);
        mat.emissiveIntensity = 0.8;
      }
    } catch (_) {}

    const baseScale = node.scale.clone();
    const start = performance.now();
    const duration = 120; // ms
    const animate = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const s = 1 + 0.25 * t;
      node.scale.set(baseScale.x * s, baseScale.y * s, baseScale.z * s);
      if (t < 1) requestAnimationFrame(animate);
      else finish();
    };
    const finish = () => {
      // 還原材質（避免影響下一個新球）
      try {
        if (mat && original.color) mat.color.copy(original.color);
        if (mat && original.emissive) mat.emissive.copy(original.emissive);
        if (mat && typeof original.emissiveIntensity === 'number') mat.emissiveIntensity = original.emissiveIntensity;
      } catch (_) {}

      // 從場景與集合移除
      scene.remove(node);
      const oi = this.objects.indexOf(node);
      if (oi >= 0) this.objects.splice(oi, 1);
      const ti = this.targets.indexOf(node);
      if (ti >= 0) this.targets.splice(ti, 1);
      try {
        node.geometry?.dispose?.();
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(m => m?.dispose?.());
      } catch (_) {}

      // 重生於隨機位置
      const id = node.userData?.targetId ?? (this.targets.length + 1);
      const p = this._randomTargetPosition(this._groundY);
      this._createSphereTarget(scene, p.x, p.y, p.z, id);
    };
    requestAnimationFrame(animate);
  }

  // 生成隨機靶子位置（靠左牆、不同高度與深度）
  _randomTargetPosition(groundY) {
    const xCenter = -20;
    const radius = 12 + Math.random() * 10; // 與現有分佈相近
    const angle = Math.random() * Math.PI * 2;
    const x = xCenter + Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = groundY + 1.2 + Math.random() * 0.9;
    return { x, y, z };
  }

  // 創建Haven布局
  _createHavenLayout(scene, arenaSize, wallHeight, groundY, wallMat, accentMat, coverMat) {
    const wallY = groundY + wallHeight / 2;
    
    // 外牆
    this._createWall(scene, 0.3, wallHeight, arenaSize, -arenaSize/2, wallY, 0, wallMat);
    this._createWall(scene, 0.3, wallHeight, arenaSize, arenaSize/2, wallY, 0, wallMat);
    this._createWall(scene, arenaSize, wallHeight, 0.3, 0, wallY, -arenaSize/2, wallMat);
    this._createWall(scene, arenaSize, wallHeight, 0.3, 0, wallY, arenaSize/2, wallMat);
    
    // A點區域
    this._createCover(scene, 3, 1.5, 1, -20, groundY + 0.75, -15, coverMat);
    this._createCover(scene, 2, 1.2, 1.5, -25, groundY + 0.6, -10, coverMat);
    
    // B點區域  
    this._createCover(scene, 3, 1.5, 1, 20, groundY + 0.75, -15, coverMat);
    this._createCover(scene, 2, 1.2, 1.5, 25, groundY + 0.6, -10, coverMat);
    
    // C點區域（Haven特色的第三個點）
    this._createCover(scene, 4, 1.8, 1, 0, groundY + 0.9, 20, coverMat);
    this._createCover(scene, 2.5, 1.3, 1, -8, groundY + 0.65, 25, coverMat);
    this._createCover(scene, 2.5, 1.3, 1, 8, groundY + 0.65, 25, coverMat);
  }

  // 創建Bind布局
  _createBindLayout(scene, arenaSize, wallHeight, groundY, wallMat, accentMat, coverMat) {
    const wallY = groundY + wallHeight / 2;
    
    // 外牆
    this._createWall(scene, 0.3, wallHeight, arenaSize, -arenaSize/2, wallY, 0, wallMat);
    this._createWall(scene, 0.3, wallHeight, arenaSize, arenaSize/2, wallY, 0, wallMat);
    this._createWall(scene, arenaSize, wallHeight, 0.3, 0, wallY, -arenaSize/2, wallMat);
    this._createWall(scene, arenaSize, wallHeight, 0.3, 0, wallY, arenaSize/2, wallMat);
    
    // 中央分隔牆（Bind特色的傳送門區域）
    this._createWall(scene, 0.3, wallHeight, 15, 0, wallY, -15, wallMat);
    this._createWall(scene, 0.3, wallHeight, 15, 0, wallY, 15, wallMat);
    
    // 傳送門效果（青綠色發光）
    const portalMat = new THREE.MeshStandardMaterial({ 
      color: 0x00d4aa, 
      emissive: 0x00d4aa, 
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.7
    });
    const portal1 = new THREE.Mesh(new THREE.RingGeometry(1, 2, 16), portalMat);
    portal1.position.set(-15, groundY + 2, 0);
    portal1.rotation.y = Math.PI / 2;
    scene.add(portal1);
    this.objects.push(portal1);
    
    const portal2 = new THREE.Mesh(new THREE.RingGeometry(1, 2, 16), portalMat);
    portal2.position.set(15, groundY + 2, 0);
    portal2.rotation.y = -Math.PI / 2;
    scene.add(portal2);
    this.objects.push(portal2);
    
    // A點和B點掩體
    this._createCover(scene, 3, 1.5, 1, -20, groundY + 0.75, -10, coverMat);
    this._createCover(scene, 2.5, 1.3, 1, 20, groundY + 0.65, 10, coverMat);
  }

  // 創建掩體
  _createCover(scene, width, height, depth, x, y, z, material) {
    const cover = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    cover.position.set(x, y, z);
    cover.castShadow = true;
    cover.receiveShadow = true;
    scene.add(cover);
    this.objects.push(cover);
    return cover;
  }
}
