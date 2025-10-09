import { getWeaponIconUrl } from '../client/WeaponIcons';

export const WEAPONS = {
  spectre: {
    name: 'Spectre',
    type: 'smg',
    damage: 22,
    fireRate: 0.089,  // 11.25 rounds/sec
    magazineSize: 30,
    reloadTime: 2.25,
    price: 1600,
    silenced: true,
    iconUrl: () => getWeaponIconUrl('spectre'),
    skins: [
      {
        name: 'Default',
        viewModel: {
          scale: 0.06,
          position: [0.5, -0.5, -0.95],
          rotation: [-0.05, Math.PI, 0.0],
        },
        materials: {
          base: {
            type: 'metal',
            color: '#2a2a2a',
            roughness: 0.7,
            metalness: 0.3
          }
        }
      }
    ]
  },
  classic: {
    name: 'Classic',
    type: 'pistol',
    damage: 26, // 78 headshot at close range
    fireRate: 0.148, // 6.75 rounds/sec
    magazineSize: 12,
    reloadTime: 1.75,
    price: 0,
    iconUrl: () => getWeaponIconUrl('classic'),
    skins: [
      {
        name: 'Default',
        viewModel: {
          scale: 0.15,
          position: [0.6, -0.5, -0.9],
          rotation: [-0.1, Math.PI, 0.05],
        },
        materials: {
          base: {
            type: 'metal',
            color: '#1a1a1a',
            roughness: 0.8,
            metalness: 0.4
          },
          details: {
            type: 'metal',
            color: '#333333',
            roughness: 0.6,
            metalness: 0.7
          }
        }
      }
    ],
  },
  ghost: {
    name: 'Ghost',
    type: 'pistol',
    damage: 30, // 105 headshot at close range
    fireRate: 0.148, // 6.75 rounds/sec
    magazineSize: 15,
    reloadTime: 1.5,
    price: 500,
    silenced: true,
    iconUrl: () => getWeaponIconUrl('ghost'),
    skins: [
      {
        name: 'Default',
        viewModel: {
          scale: 0.16,
          position: [0.6, -0.5, -0.9],
          rotation: [-0.1, Math.PI, 0.05],
        }
      }
    ],
  },
  vandal: {
    name: 'Vandal',
    type: 'rifle',
    damage: 40, // 160 headshot, no falloff
    fireRate: 0.102, // 9.75 rounds/sec
    magazineSize: 25,
    reloadTime: 2.5,
    price: 2900,
    iconUrl: () => getWeaponIconUrl('vandal'),
    skins: [
      {
        name: 'Default',
        viewModel: {
          scale: 0.05,
          position: [0.5, -0.5, -1.0],
          rotation: [-0.05, Math.PI, 0.0],
        },
        materials: {
          base: {
            type: 'metal',
            color: '#2a2a2a',  // 深灰色基底
            roughness: 0.6,
            metalness: 0.8
          },
          barrel: {
            type: 'metal',
            color: '#1a1a1a',  // 更深的槍管顏色
            roughness: 0.4,
            metalness: 0.9
          },
          details: {
            type: 'metal',
            color: '#3a3a3a',  // 稍亮的金屬細節
            roughness: 0.5,
            metalness: 0.85
          }
        }
      },
      {
        name: 'Prime Vandal (Blue)',
        viewModel: {
          scale: 0.05,
          position: [0.5, -0.5, -1.0],
          rotation: [-0.05, Math.PI, 0.0],
        }
      },
      {
        name: 'Gaia Vandal',
        viewModel: {
          scale: 0.08,
          position: [0.5, -0.5, -1.0],
          rotation: [-0.05, Math.PI, 0.0],
        },
        materials: {
          base: {
            type: 'custom',
            color: '#2d3640',  // 深藍灰色基底
            roughness: 0.4,
            metalness: 0.7,
            normalScale: 1.2   // 增強凹凸感
          },
          vines: {
            type: 'custom',
            color: '#3a4654',  // 稍亮的藍灰色藤蔓
            roughness: 0.5,
            metalness: 0.8,
            normalMap: 'vine_pattern'  // 藤蔓紋理
          },
          accents: {
            type: 'emissive',
            color: '#ff3333',  // 紅色點綴
            emissiveIntensity: 0.4,
            roughness: 0.3,
            metalness: 0.9
          },
          details: {
            type: 'metal',
            color: '#4d5c6f',  // 金屬細節
            roughness: 0.2,
            metalness: 1.0
          }
        },
        animations: {
          inspect: {
            duration: 1.2,
            keyframes: [
              {
                time: 0,
                position: [0.5, -0.5, -1.0],
                rotation: [-0.05, Math.PI, 0.0]
              },
              {
                time: 0.3,
                position: [0.7, -0.3, -0.8],
                rotation: [-0.2, Math.PI + 0.3, 0.1]
              },
              {
                time: 0.6,
                position: [0.6, -0.4, -0.9],
                rotation: [-0.1, Math.PI - 0.3, -0.1]
              },
              {
                time: 1.2,
                position: [0.5, -0.5, -1.0],
                rotation: [-0.05, Math.PI, 0.0]
              }
            ]
          }
        },
        effects: {
          muzzleFlash: {
            color: '#4aff8f',
            size: 1.2,
            duration: 0.1
          },
          bulletTrail: {
            color: '#4aff8f',
            width: 0.05,
            duration: 0.2
          }
        }
      },
      {
        name: 'Sakura Vandal (Pink)',
        viewModel: {
          scale: 0.06,
          position: [0.5, -0.5, -1.0],
          rotation: [-0.05, Math.PI, 0.0],
        }
      },
      {
        name: 'Reaver Vandal (Purple)',
        viewModel: {
          scale: 0.05,
          position: [0.5, -0.5, -1.0],
          rotation: [-0.05, Math.PI, 0.0],
        }
      }
    ],
  },
  phantom: {
    name: 'Phantom',
    type: 'rifle',
    damage: 35, // 140 headshot at 15m, has falloff
    fireRate: 0.09, // 11 rounds/sec
    magazineSize: 30,
    reloadTime: 2.5,
    price: 2900,
    silenced: true,
    skins: [
      {
        name: 'Default',
        viewModel: {
          scale: 0.05,
          position: [0.5, -0.5, -1.0],
          rotation: [-0.05, Math.PI, 0.0],
        },
        materials: {
          base: {
            type: 'metal',
            color: '#232323',  // 深灰色基底
            roughness: 0.7,
            metalness: 0.7
          },
          silencer: {
            type: 'metal',
            color: '#1a1a1a',  // 消音器部分
            roughness: 0.4,
            metalness: 0.9
          },
          details: {
            type: 'metal',
            color: '#2d2d2d',  // 細節部分
            roughness: 0.6,
            metalness: 0.8
          }
        }
      }
    ],
  },
  knife: {
    name: 'Knife',
    type: 'melee',
    damage: 50,
    fireRate: 0.6,
    usesAmmo: false,
    magazineSize: 1,
    reloadTime: 0,
    skins: [
      {
        name: 'Valorant Knife',
        viewModel: {
          scale: 0.2,
          position: [0.6, -0.4, -0.8],
          rotation: [0, Math.PI, 0],
        }
      },
      {
        name: 'Karambit',
        viewModel: {
          scale: [-0.2, 0.2, 0.2],
          position: [0.6, -0.4, -0.8],
          rotation: [0, Math.PI, 0],
        }
      }
    ],
    viewModel: {
      scale: 0.2,
      position: [0.6, -0.4, -0.8],
      rotation: [0, Math.PI, 0],
    }
  }
};