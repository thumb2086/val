// client/graphics/ResourceManager.js
import { TextureGenerator } from './TextureGenerator';
import { ModelGenerator } from './ModelGenerator';
import { MaterialComposer } from './MaterialComposer';
import { HUDGenerator } from './HUDGenerator';
import { MapGenerator } from './MapGenerator';
import { ParticleGenerator } from './ParticleGenerator';

export class ResourceManager {
    constructor(gl) {
        this.gl = gl;
        this.textureGen = new TextureGenerator();
        this.modelGen = new ModelGenerator();
        this.materialComposer = new MaterialComposer(this.textureGen);
        this.hudGen = new HUDGenerator();
        this.mapGen = new MapGenerator(gl);
        this.particleGen = new ParticleGenerator(gl);

        // 資源快取
        this.textures = new Map();
        this.models = new Map();
        this.materials = new Map();
        this.hudElements = new Map();
        this.particles = new Map();
    }

    // 初始化所有遊戲資源
    async initializeResources() {
        console.log('開始初始化遊戲資源...');

        // 生成 HUD 資源
        this.generateHUDResources();
        console.log('HUD 資源生成完成');

        // 生成武器資源
        this.generateWeaponResources();
        console.log('武器資源生成完成');

        // 生成地圖資源
        this.generateMapResources();
        console.log('地圖資源生成完成');

        // 生成粒子效果
        this.generateParticleResources();
        console.log('粒子效果生成完成');

        console.log('所有遊戲資源初始化完成');
    }

    // 生成 HUD 資源
    generateHUDResources() {
        // 準心
        this.hudElements.set('crosshair', this.hudGen.generateCrosshair({
            size: 10,
            thickness: 2,
            gap: 4,
            color: '#00ff00'
        }));

        // 血量條
        this.hudElements.set('healthBar', this.hudGen.generateHealthBar({
            width: 200,
            height: 20,
            gradient: ['#ff0000', '#00ff00']
        }));

        // 彈藥圖示
        this.hudElements.set('ammoIcon', this.hudGen.generateAmmoIcon({
            width: 30,
            height: 10,
            color: '#ffcc00'
        }));

        // 擊殺確認標記
        this.hudElements.set('killMarker', this.hudGen.generateKillMarker({
            size: 40,
            color: '#ff0000'
        }));

        // 計分板背景
        this.hudElements.set('scoreboardBg', this.hudGen.generateScoreboardBackground({
            width: 400,
            height: 300
        }));
    }

    // 生成武器資源
    generateWeaponResources() {
        // Classic 手槍
        this.generateWeaponSet('classic', {
            metal: '#707070',
            grip: '#303030'
        });

        // Ghost 手槍
        this.generateWeaponSet('ghost', {
            metal: '#505050',
            grip: '#252525'
        });

        // Vandal 步槍
        this.generateWeaponSet('vandal', {
            metal: '#606060',
            body: '#404040',
            accent: '#808080'
        });

        // Phantom 步槍
        this.generateWeaponSet('phantom', {
            metal: '#555555',
            body: '#353535',
            accent: '#707070'
        });

        // Operator 狙擊槍
        this.generateWeaponSet('operator', {
            metal: '#404040',
            body: '#202020',
            scope: '#303030'
        });
    }

    // 為特定武器生成所有需要的資源
    generateWeaponSet(weaponId, colors) {
        // 生成模型
        this.models.set(weaponId, this.modelGen.generateWeaponModel(weaponId));

        // 生成基礎材質
        this.materials.set(`${weaponId}_base`, this.materialComposer.generateMetalMaterial({
            baseColor: colors.metal,
            roughness: 0.5,
            metalness: 0.8
        }));

        // 生成特殊材質（如果需要）
        if (colors.grip) {
            this.materials.set(`${weaponId}_grip`, this.materialComposer.generateLeatherMaterial({
                color: colors.grip
            }));
        }

        if (colors.body) {
            this.materials.set(`${weaponId}_body`, this.materialComposer.generateMetalMaterial({
                baseColor: colors.body,
                roughness: 0.3,
                metalness: 0.9
            }));
        }
    }

    // 生成地圖資源
    generateMapResources() {
        // 訓練場地圖
        const trainingMap = this.mapGen.generateBaseMap(100, 100);
        this.models.set('map_training', trainingMap);

        // 競技場地圖
        const arenaMap = this.mapGen.generateBaseMap(80, 80);
        this.models.set('map_arena', arenaMap);

        // 生成地圖材質
        const mapTextures = this.mapGen.generateMapTextures();
        Object.entries(mapTextures).forEach(([name, texture]) => {
            this.textures.set(`map_${name}`, texture);
        });

        // 生成天空盒
        const skybox = this.mapGen.generateSkybox();
        this.textures.set('skybox', skybox);

        // 生成裝飾物
        const props = this.mapGen.generateProps();
        props.forEach((prop, index) => {
            this.models.set(`prop_${index}`, prop);
        });
    }

    // 生成粒子效果資源
    generateParticleResources() {
        // 預設粒子位置
        const defaultPos = { x: 0, y: 0, z: 0 };

        // 射擊火花
        this.particles.set('muzzleFlash', 
            this.particleGen.generateMuzzleFlash(defaultPos)
        );

        // 彈道軌跡
        this.particles.set('bulletTrail',
            this.particleGen.generateBulletTrail(
                defaultPos,
                { x: 1, y: 0, z: 0 }
            )
        );

        // 爆炸效果
        this.particles.set('explosion',
            this.particleGen.generateExplosion(defaultPos)
        );

        // 煙霧效果
        this.particles.set('smoke',
            this.particleGen.generateSmoke(defaultPos)
        );

        // 血液濺射
        this.particles.set('blood',
            this.particleGen.generateBloodSpray(
                defaultPos,
                0
            )
        );
    }

    // 獲取資源
    getTexture(id) {
        return this.textures.get(id);
    }

    getModel(id) {
        return this.models.get(id);
    }

    getMaterial(id) {
        return this.materials.get(id);
    }

    getHUDElement(id) {
        return this.hudElements.get(id);
    }

    getParticleEffect(id) {
        return this.particles.get(id);
    }

    // 更新粒子效果
    updateParticles(deltaTime) {
        this.particleGen.updateParticles(deltaTime);
    }
}