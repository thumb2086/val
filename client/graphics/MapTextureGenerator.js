// client/graphics/MapTextureGenerator.js
import { TextureGenerator } from './TextureGenerator.js';
import { MaterialComposer } from './MaterialComposer.js';
import * as THREE from 'three';

export class MapTextureGenerator {
    constructor() {
        this.textureGen = new TextureGenerator();
        this.materialComposer = new MaterialComposer(this.textureGen);
    }

    // 生成特戰英豪訓練場材質
    createTrainingRangeMaterials() {
        return {
            wall: this.materialComposer.createValorantWallMaterial({
                baseColor: 0xd4d4d4,
                roughness: 0.8,
                metalness: 0.1,
                hasStripes: true,
                stripeColor: 0x00d4aa
            }),

            accent: this.materialComposer.createEmissiveMaterial({
                color: 0x00d4aa,
                emissiveIntensity: 0.5,
                pulseSpeed: 0.5
            }),

            floor: this.materialComposer.createFloorMaterial({
                baseColor: 0xcccccc,
                roughness: 0.9,
                metalness: 0.1,
                gridSize: 32
            }),

            target: this.materialComposer.createTargetMaterial({
                baseColor: 0xff3344,
                glowColor: 0x220000,
                glowIntensity: 0.05
            })
        };
    }

    // 生成 Haven 地圖材質
    createHavenMaterials() {
        return {
            wall: this.materialComposer.createValorantWallMaterial({
                baseColor: 0xc8b99c,
                roughness: 0.7,
                metalness: 0.1
            }),

            cover: this.materialComposer.createMetalMaterial({
                color: 0x8b7355,
                roughness: 0.8,
                metalness: 0.2
            }),

            accent: this.materialComposer.createEmissiveMaterial({
                color: 0x00d4aa,
                emissiveIntensity: 0.3
            })
        };
    }

    // 生成 Bind 地圖材質
    createBindMaterials() {
        return {
            wall: this.materialComposer.createValorantWallMaterial({
                baseColor: 0xa67c52,
                roughness: 0.8,
                metalness: 0.1
            }),

            cover: this.materialComposer.createMetalMaterial({
                color: 0x6b4423,
                roughness: 0.9,
                metalness: 0.0
            }),

            portal: this.materialComposer.createPortalMaterial({
                color: 0x00d4aa,
                pulseSpeed: 1.0,
                baseOpacity: 0.7
            })
        };
    }

    // 生成 Split 地圖材質
    createSplitMaterials() {
        return {
            wall: this.materialComposer.createValorantWallMaterial({
                baseColor: 0x999999,
                roughness: 0.7,
                metalness: 0.1
            }),

            cover: this.materialComposer.createMetalMaterial({
                color: 0x555555,
                roughness: 0.8,
                metalness: 0.2
            }),

            accent: this.materialComposer.createEmissiveMaterial({
                color: 0xff3333,
                emissiveIntensity: 0.4
            })
        };
    }

    // 生成 Ascent 地圖材質
    createAscentMaterials() {
        return {
            wall: this.materialComposer.createValorantWallMaterial({
                baseColor: 0xe0d5c0,
                roughness: 0.7,
                metalness: 0.1
            }),

            cover: this.materialComposer.createMetalMaterial({
                color: 0x8b7355,
                roughness: 0.8,
                metalness: 0.2
            }),

            door: this.materialComposer.createMetalMaterial({
                color: 0x4d4d4d,
                roughness: 0.4,
                metalness: 0.9
            })
        };
    }

    // 生成 Icebox 地圖材質
    createIceboxMaterials() {
        return {
            wall: this.materialComposer.createValorantWallMaterial({
                baseColor: 0xcccccc,
                roughness: 0.6,
                metalness: 0.2
            }),

            snow: this.materialComposer.createCustomMaterial({
                baseColor: 0xffffff,
                roughness: 0.9,
                metalness: 0.0,
                normalScale: 0.5
            }),

            metal: this.materialComposer.createMetalMaterial({
                color: 0x666666,
                roughness: 0.4,
                metalness: 0.8
            })
        };
    }

    // 生成 Breeze 地圖材質
    createBreezeMaterials() {
        return {
            wall: this.materialComposer.createValorantWallMaterial({
                baseColor: 0xffd700,
                roughness: 0.7,
                metalness: 0.1
            }),

            sand: this.materialComposer.createCustomMaterial({
                baseColor: 0xcd853f,
                roughness: 0.9,
                metalness: 0.0
            }),

            water: this.materialComposer.createCustomMaterial({
                baseColor: 0x4169e1,
                roughness: 0.2,
                metalness: 0.8,
                transparent: true,
                opacity: 0.8
            })
        };
    }

    // 生成 Pearl 地圖材質
    createPearlMaterials() {
        return {
            wall: this.materialComposer.createValorantWallMaterial({
                baseColor: 0x4169e1,
                roughness: 0.7,
                metalness: 0.2
            }),

            water: this.materialComposer.createCustomMaterial({
                baseColor: 0x1e90ff,
                roughness: 0.2,
                metalness: 0.8,
                transparent: true,
                opacity: 0.6
            }),

            glow: this.materialComposer.createEmissiveMaterial({
                color: 0x00ffff,
                emissiveIntensity: 0.5,
                pulseSpeed: 0.8
            })
        };
    }

    // 生成 Fracture 地圖材質
    createFractureMaterials() {
        return {
            wall: this.materialComposer.createValorantWallMaterial({
                baseColor: 0xff4500,
                roughness: 0.7,
                metalness: 0.1
            }),

            rock: this.materialComposer.createCustomMaterial({
                baseColor: 0x8b0000,
                roughness: 0.9,
                metalness: 0.0
            }),

            energy: this.materialComposer.createEmissiveMaterial({
                color: 0xff0000,
                emissiveIntensity: 0.7,
                pulseSpeed: 1.2
            })
        };
    }
}