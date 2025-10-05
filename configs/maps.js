// configs/maps.js
export default {
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
