export const WEAPONS = {
  classic: {
    name: 'Classic',
    type: 'pistol',
    damage: 26, // 78 headshot at close range
    fireRate: 0.148, // 6.75 rounds/sec
    magazineSize: 12,
    reloadTime: 1.75,
    price: 0,
    skins: [
      {
        name: 'Default',
        viewModel: {
          scale: 0.15,
          position: [0.6, -0.5, -0.9],
          rotation: [-0.1, Math.PI, 0.05],
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
    skins: [
      {
        name: 'Default',
        viewModel: {
          scale: 0.05,
          position: [0.5, -0.5, -1.0],
          rotation: [-0.05, Math.PI, 0.0],
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
        name: 'Gaia Vandal (Red)',
        viewModel: {
          scale: 0.08,
          position: [0.5, -0.5, -1.0],
          rotation: [-0.05, Math.PI, 0.0],
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