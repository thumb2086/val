// configs/maps.js
const MAPS = {
  valorant_training: {
    name: '特戰英豪訓練場',
    description: '模仿特戰英豪風格的射擊訓練場地，包含多種靶子和射擊平台',
    targetCount: 15,
    features: ['射擊平台', '多種靶子', '移動靶', '青綠色裝飾']
  },
  valorant_haven: {
    name: 'Haven - 三點地圖',
    description: '模仿特戰英豪Haven地圖的三點對戰場地',
    sites: ['A點', 'B點', 'C點'],
    features: ['三個爆破點', '多層掩體', '戰術位置']
  },
  valorant_bind: {
    name: 'Bind - 雙點地圖',
    description: '模仿特戰英豪Bind地圖的雙點對戰場地，包含傳送門',
    sites: ['A點', 'B點'],
    features: ['傳送門系統', '雙點布局', '戰略通道']
  },
  valorant_split: {
    name: 'Split - 雙點地圖',
    description: '模仿特戰英豪Split地圖的雙點對戰場地，具有高低差和狹窄通道',
    sites: ['A點', 'B點'],
    features: ['高低差', '狹窄通道', '中央控制']
  },
  valorant_ascent: {
    name: 'Ascent - 中庭地圖',
    description: '以義大利小鎮為主題的中型地圖，具有開放式中庭',
    sites: ['A點', 'B點'],
    features: ['開放中庭', '可破壞門', '複雜地形']
  },
  valorant_icebox: {
    name: 'Icebox - 極地設施',
    description: '位於北極的研究設施，垂直空間豐富',
    sites: ['A點', 'B點'],
    features: ['垂直戰場', '拉索系統', '複雜高台']
  },
  valorant_breeze: {
    name: 'Breeze - 熱帶海島',
    description: '位於加勒比海的開放式地圖',
    sites: ['A點', 'B點'],
    features: ['寬敞空間', '長距離戰', '地下通道']
  },
  valorant_pearl: {
    name: 'Pearl - 水下城市',
    description: '位於水下的未來城市地圖',
    sites: ['A點', 'B點'],
    features: ['三層結構', '複雜通道', '水下景觀']
  },
  valorant_fracture: {
    name: 'Fracture - 裂變設施',
    description: '被裂谷分割的高科技設施',
    sites: ['A點', 'B點'],
    features: ['H型布局', '拉索系統', '分裂spawns']
  },
  // 保留舊版本兼容性
  training_range: {
    name: '經典訓練場',
    description: '基礎射擊訓練場地',
    redirect: 'valorant_training'
  },
  valorant_arena: {
    name: '經典競技場',
    description: '基礎多人對戰場地',
    redirect: 'valorant_haven'
  }
};

export default MAPS;
