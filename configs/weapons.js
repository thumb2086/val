export const WEAPONS = {
  pistol: {
    name: 'Standard Pistol',
    type: 'pistol',
    damage: 15,
    fireRate: 0.2,
    magazineSize: 12,
    reloadTime: 1.5,
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
    viewModel: {
      scale: 0.15,
      position: [0.6, -0.5, -0.9],
      rotation: [-0.1, Math.PI, 0.05],
    }
  },
  rifle: {
    name: 'Assault Rifle',
    type: 'rifle',
    damage: 30,
    fireRate: 0.1,
    magazineSize: 30,
    reloadTime: 2.5,
    skins: [
      {
        name: 'Prime Vandal (Blue)',
        viewModel: {
          scale: 0.05,
          position: [0.5, -0.5, -1.0],
          rotation: [-0.05, Math.PI, 0.0],
        }
      },
      {
        name: 'Phantom',
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
      }
    ],
    viewModel: {
      scale: 0.05,
      position: [0.5, -0.5, -1.0],
      rotation: [-0.05, Math.PI, 0.0],
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