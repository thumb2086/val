export const WEAPONS = {
  pistol: {
    name: 'Standard Pistol',
    damage: 15,
    fireRate: 0.2, // 秒/發
    magazineSize: 12,
    reloadTime: 1.5, // 秒
    skins: [
      {
        name: 'Default',
        viewModel: {
          scale: 0.15,
          position: [0.62, -0.54, -0.9],
          rotation: [-0.1, Math.PI, 0.06],
          muzzleOffset: [0.0, -0.18, -2.2]
        }
      }
    ],
    viewModel: {
      scale: 0.15,
      position: [0.62, -0.54, -0.9],
      rotation: [-0.1, Math.PI, 0.06],
      muzzleOffset: [0.0, -0.18, -2.2]
    }
  },
  rifle: {
    name: 'Assault Rifle',
    damage: 30,
    fireRate: 0.1,
    magazineSize: 30,
    reloadTime: 2.5,
    skins: [
      {
        name: 'Prime Vandal (Blue)',
        viewModel: {
          scale: 0.05,
          position: [0.58, -0.98, -1.55],
          rotation: [-0.05, Math.PI / 2, 0.0],
          muzzleOffset: [0.0, -0.4, -7.0]
        }
      },
      {
        name: 'Phantom',
        viewModel: {
          scale: 0.05,
          position: [0.58, -0.98, -1.55],
          rotation: [-0.05, Math.PI / 2, 0.0],
          muzzleOffset: [0.0, -0.4, -7.0]
        }
      },
      {
        name: 'Gaia Vandal (Red)',
        viewModel: {
          scale: 0.08,
          position: [0.58, -0.98, -1.55],
          rotation: [-0.05, Math.PI / 2, 0.0],
          muzzleOffset: [0.0, -0.4, -7.0]
        }
      }
    ],
    viewModel: {
      scale: 0.05,
      position: [0.58, -0.98, -1.55],
      rotation: [-0.05, Math.PI / 2, 0.0],
      muzzleOffset: [0.0, -0.4, -7.0],
      muzzleSpace: 'screen',
      muzzleScreen: [0.35, -0.25],
      muzzleDepth: 0.6
    }
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
          position: [0.6, -0.42, -0.85],
          rotation: [0.0, Math.PI, 0.0]
        }
      },
      {
        name: 'Karambit',
        viewModel: {
          scale: [-0.2, 0.2, 0.2],
          position: [0.6, -0.42, -0.85],
          rotation: [0.0, Math.PI, 0.0]
        }
      }
    ],
    viewModel: {
      scale: 0.2,
      position: [0.6, -0.42, -0.85],
      rotation: [0.0, Math.PI, 0.0]
    }
  }
};