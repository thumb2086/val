# Tactical Combat Game

A web-based tactical first-person shooter inspired by VALORANT, built with Three.js, Node.js, and Socket.IO.

## 🚀 Quick Start

1. **Environment Setup:**
   ```bash
   cp .env.example .env  # Copy and configure environment variables
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Development Mode:**
   ```bash
   npm run dev  # Start development server with nodemon
   ```

4. **Production Mode:**
   ```bash
   npm run build  # Bundle frontend assets
   npm start      # Start server
   ```

5. **Testing:**
   ```bash
   npm run test   # Run unit tests
   npm run lint   # Run code linting
   ```

## 🎮 Features

-   **3D First-Person Controls:** Smooth 3D rendering and movement using Three.js and PointerLockControls.
-   **Game Modes:**
    -   🎯 **Training Range:** Practice shooting in a VALORANT-style training facility.
    -   🤖 **Bot Match:** Experience 5v5 tactical combat scenarios.
    -   🌐 **Multiplayer:** Create or join rooms for online matches.
-   **Weapon System:**
    -   Switch between rifles, pistols, and melee weapons (Keys 1/2/3).
    -   ADS (Aim Down Sights) for precise shooting.
    -   Reload and ammo management system.
    -   Optimized pistol model scaling for better visuals.
-   **Modern UI:** Clean and functional menus and in-game HUD.

## 🗺️ Map System

-   **VALORANT Training Range (`valorant_training`)**
    -   Custom designed for target practice with VALORANT-style aesthetics.
    -   Multiple target types (head targets, body targets, moving targets).
    -   Cyan decorative stripes and clean wall designs.
    -   Configurable target count (default: 15).

-   **Haven - Three Sites (`valorant_haven`)**
    -   Inspired by VALORANT's Haven map layout.
    -   Features A, B, and C bomb sites.
    -   Multi-level cover and tactical positions.

-   **Bind - Two Sites (`valorant_bind`)**
    -   Based on VALORANT's Bind map layout.
    -   Features A and B bomb sites.
    -   Teleporter system with cyan glow effects.
    -   Strategic corridors and cover placement.

## 🕹️ Controls

-   **W/A/S/D:** Move
-   **Mouse:** Look
-   **Spacebar:** Jump
-   **Left Click:** Shoot
-   **Right Click:** Toggle ADS
-   **R:** Reload
-   **1:** Rifle
-   **2:** Pistol
-   **3:** Knife
-   **ESC:** Pause/Unlock Mouse

## 🛠️ Project Status (December 2024 Update)

### ✅ Implemented Features

-   **Core Movement & Shooting:** Player movement, jumping, looking, and shooting.
-   **Weapon Mechanics:** Weapon switching, reloading, and ADS functionality.
-   **Game Modes:** Training range, bot matches, and multiplayer modes.
-   **Multiplayer:** Room creation, joining, and player position synchronization.
-   **Collision Detection:** Basic map collision system to prevent wall clipping.
-   **UI:** Main menu, settings, pause menu, and weapon skin selection interface.
-   **VALORANT-style Maps:** New training facility and combat maps with signature visual elements.
-   **Weapon Models:** Fixed rifle texture loading, optimized pistol scaling.
-   **Weapon Skin System:** 
    - Complete material generation system supporting metal and emissive effects
    - Gaia Vandal skin with special green glow effects
    - Custom inspection animations
    - Unique weapon effects (muzzle flash, bullet trails)

### 🚧 Known Issues & Todo

-   **Multiplayer Logic:** While players can connect and move, server-side game state logic (round wins, health sync, bomb planting) needs improvement.
-   **Bot AI:** Basic bot movement and shooting, but lacks advanced behaviors.
-   **Sound System:** Currently no sound effects implemented.
-   **Visual Enhancements:** 
    - Need more particle effects and impact effects
    - Planning to add more signature weapon skins
    - Weapon inspection animations can be more detailed

## 📁 Project Structure

```
/
├── index.html          # Main HTML file
├── style.css          # Stylesheet
├── server.js          # Main server entry
├── package.json       # Project config and dependencies
├── webpack.config.js  # Webpack bundling config
├── client/
│   ├── systems/
│   │   ├── MapSystem.js      # Map system (VALORANT-style maps)
│   │   ├── WeaponSystem.js   # Weapon system (fixed textures)
│   │   ├── BulletSystem.js   # Bullet system
│   │   ├── CrosshairSystem.js # Crosshair system
│   │   └── ...
│   ├── WeaponManager.js
│   ├── graphics.js    # Graphics initialization
│   ├── input.js       # Input handling
│   └── network.js     # Network handling
├── server/
│   ├── server.js      # Node.js + Socket.IO server logic
│   ├── game.js        # Server-side game logic
│   ├── systems/
│   │   ├── AuthSystem.js     # Authentication system
│   │   ├── GameState.js      # Game state management
│   │   └── WeaponSystem.js   # Server-side weapon system
│   └── models/
│       └── User.js    # User model
├── configs/
│   ├── maps.js        # Map configurations (updated VALORANT maps)
│   ├── weapons.js     # Weapon configurations (adjusted pistol scale)
│   └── crosshairs.js  # Crosshair configurations
└── public/
    ├── assets/
    │   ├── models/    # 3D model files
    │   └── textures/  # Texture files
    ├── sounds/        # Sound files
    └── bundle.js      # Bundled client code
```

## 🔧 Technical Improvements

### Weapon System Optimization
- Fixed rifle model texture loading issues
- Adjusted pistol viewmodel scale (increased from 0.085 to 0.12)
- Improved GLTF model loader URL correction logic

### Map System Overhaul
- Complete map system redesign with VALORANT aesthetics
- Three map types: Training Range, Haven, and Bind
- Implemented moving target animations
- Added cyan decorative stripes and modern visual design

### Multiplayer Support
- Server-side game state management
- Team assignment and balancing system
- Deathmatch and round-based mode support
- Basic bomb plant/defuse mechanics infrastructure