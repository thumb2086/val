export const WEAPONS = {
  pistol: {
    name: 'Standard Pistol',
    damage: 15,
    fireRate: 0.2, // 秒/發
    magazineSize: 12,
    reloadTime: 1.5, // 秒
    modelPath: 'assets/models/pistol/stylized_pistol_low_poly_rigged/scene.gltf',
    sound_fire: 'assets/sounds/pistol_fire.wav',
    skins: [
      {
        name: 'Default',
        modelPath: 'assets/models/pistol/stylized_pistol_low_poly_rigged/scene.gltf',
        // 個別可調：手槍預設視圖縮放
        viewModel: {
          // 初始沿用武器級預設，之後可逐皮膚微調
          scale: 0.15,
          position: [0.62, -0.54, -0.9],
          rotation: [-0.1, Math.PI, 0.06],
          muzzleOffset: [0.0, -0.18, -2.2]
        }
      }
    ],
    // 視圖模型（第一人稱顯示）設定：調整為自然的FPS持槍位置
    viewModel: {
      scale: 0.15,  // FPS 習慣視覺
      position: [0.62, -0.54, -0.9],  // 右下角、拉遠一些避免近裁面
      rotation: [-0.1, Math.PI, 0.06],  // 修正Y轴旋转，确保枪口朝向准心
      // 槍口本地偏移：以群組本地座標，會乘上 group 的 scale 轉成世界座標
      // 以 scale=0.15 設定，沿 -Z 約 2.2、Y 微向下
      muzzleOffset: [0.0, -0.18, -2.2]
    }
  },
  rifle: {
    name: 'Assault Rifle',
    damage: 30,
    fireRate: 0.1,
    magazineSize: 30,
    reloadTime: 2.5,
    modelPath: 'assets/models/rifle/prime_vandal_blue__valorant/scene.gltf',
    sound_fire: 'assets/sounds/rifle_fire.wav',
    skins: [
      {
        name: 'Prime Vandal (Blue)',
        modelPath: 'assets/models/rifle/prime_vandal_blue__valorant/scene.gltf',
        // 個別可調：藍色 Prime Vandal 預設視圖縮放
        viewModel: {
          // 初始沿用武器級預設，之後可逐皮膚微調
          scale: 0.05,
          position: [0.58, -0.98, -1.55],
          rotation: [-0.05, Math.PI / 2, 0.0],
          muzzleOffset: [0.0, -0.4, -7.0]
        }
      },
      {
        name: 'Phantom',
        modelPath: 'assets/models/rifle/valorant_-_phantom_-_fan_art/scene.gltf',
        // 個別可調：Phantom 預設視圖縮放（可依實測再調）
        viewModel: {
          // 初始沿用武器級預設，之後可逐皮膚微調
          scale: 0.05,
          position: [0.58, -0.98, -1.55],
          rotation: [-0.05, Math.PI / 2, 0.0],
          muzzleOffset: [0.0, -0.4, -7.0]
        }
      },
      {
        name: 'Gaia Vandal (Red)',
        modelPath: 'assets/models/rifle/gaia_vandal_red/scene.gltf',
        // 該皮膚模型偏小，單獨放大顯示比例
        viewModel: {
          // 初始沿用武器級預設位置/角度/槍口偏移，但放大至 0.08
          scale: 0.08,
          position: [0.58, -0.98, -1.55],
          rotation: [-0.05, Math.PI / 2, 0.0],
          muzzleOffset: [0.0, -0.4, -7.0]
        }
      }
    ],
    // 視圖模型（第一人稱）參數：讓步槍在畫面可見且不穿鏡
    viewModel: {
      // 放大到約 0.05，實測較符合當前模型單位
      scale: 0.05,
      // 右下角並略為拉遠，避免近裁面裁切與遮擋畫面
      position: [0.58, -0.98, -1.55],
      // 調整朝向：使群組本地 -Z 朝向相機前方，確保 muzzleOffset 沿前方投射
      rotation: [-0.05, Math.PI / 2, 0.0],  // 調整為 +90°（將模型 +X 對齊群組 -Z）
      // 槍口本地偏移（配合 WeaponSystem 的 _getMuzzleWorldPosition 使用）
      // 以群組本地座標，會自動經由 group 的 scale 轉成世界座標；
      // 目標世界前推約 0.35m、微向下 0.02m → 在 scale=0.05 下換算為：z≈-7.0, y≈-0.4
      muzzleOffset: [0.0, -0.4, -7.0],
      // 使用螢幕座標指定槍口位置（優先於 muzzleOffset）
      // NDC: x 右為正、y 上為正，[-1,1] 範圍；深度為沿視線前推的世界距離（公尺）
      muzzleSpace: 'screen',
      muzzleScreen: [0.35, -0.25],
      muzzleDepth: 0.6
    }
  },
  // 近戰：不消耗彈藥，使用冷卻（fireRate）限制出刀頻率
  knife: {
    name: 'Knife',
    type: 'melee',
    damage: 50,
    fireRate: 0.6, // 秒/次 揮刀
    usesAmmo: false,
    magazineSize: 1, // 佔位，不使用
    reloadTime: 0,
    // 使用現有的刀模型；預設使用 Valorant 風格的刀
    modelPath: 'assets/models/knife/valorant-knife/valorant-knife.gltf',
    skins: [
      {
        name: 'Valorant Knife',
        modelPath: 'assets/models/knife/valorant-knife/valorant-knife.gltf',
        // 一般刀：微調角度避免「朝右」，可再依實際觀感微調
        viewModel: {
          scale: 0.2,
          position: [0.6, -0.42, -0.85],
          rotation: [0.0, Math.PI, 0.0]  // 简化旋转，确保朝向一致
        }
      },
      {
        name: 'Karambit',
        modelPath: 'assets/models/knife/karambit-knife/karambit-knife.gltf',
        // 爪刀：沿用目前適合的角度
        viewModel: {
          // 使用 X 軸鏡像以修正朝向，再搭配輕微旋轉微調
          scale: [-0.2, 0.2, 0.2],
          position: [0.6, -0.42, -0.85],
          rotation: [0.0, Math.PI, 0.0]  // 统一朝向设置
        }
      }
    ],
    viewModel: {
      // 依據模型單位調整；若覺得過大/過小可再微調
      scale: 0.2,
      // 右下角持刀姿勢，稍微遠離鏡頭避免近裁面
      position: [0.6, -0.42, -0.85],
      rotation: [0.0, Math.PI, 0.0]  // 统一朝向设置
    }
  }
};
