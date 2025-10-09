// client/graphics/MapGenerator.js
import { TextureGenerator } from './TextureGenerator.js';
import { ModelGenerator } from './ModelGenerator.js';

export class MapGenerator {
    constructor(gl) {
        this.gl = gl;
        this.textureGen = new TextureGenerator();
    }

    // 生成地圖牆壁和地板的材質
    generateMapTextures() {
        return {
            // 地板材質
            floor: {
                diffuse: this.textureGen.generateGrid(512, 512, 32, 'rgba(50,50,50,0.2)'),
                normal: this.textureGen.generateNoise(512, 512, 0.1),
                roughness: this.textureGen.generateNoise(256, 256, 0.5)
            },
            // 牆壁材質
            wall: {
                diffuse: this.textureGen.generateMetal(512, 512, '#404040'),
                normal: this.textureGen.generateNoise(512, 512, 0.2),
                roughness: this.textureGen.generateNoise(256, 256, 0.7)
            },
            // 箱子材質
            crate: {
                diffuse: this.textureGen.generateGrid(256, 256, 16, 'rgba(139,69,19,0.3)'),
                normal: this.textureGen.generateNoise(256, 256, 0.15),
                roughness: this.textureGen.generateNoise(128, 128, 0.6)
            }
        };
    }

    // 生成基礎地圖結構
    generateBaseMap(width = 100, height = 100) {
        return {
            floor: {
                vertices: this.generateFloor(width, height),
                texture: this.textureGen.generateGrid(1024, 1024, 64, 'rgba(40,40,40,0.2)')
            },
            walls: this.generateWalls(width, height),
            spawns: this.generateSpawnPoints(width, height),
            colliders: this.generateColliders()
        };
    }

    // 生成地板網格
    generateFloor(width, height) {
        const vertices = [];
        const uvs = [];
        const normals = [];
        const indices = [];

        // 生成網格頂點
        for (let z = 0; z <= height; z++) {
            for (let x = 0; x <= width; x++) {
                vertices.push(x - width/2, 0, z - height/2);
                uvs.push(x/width, z/height);
                normals.push(0, 1, 0);
            }
        }

        // 生成索引
        for (let z = 0; z < height; z++) {
            for (let x = 0; x < width; x++) {
                const tl = z * (width + 1) + x;
                const tr = tl + 1;
                const bl = (z + 1) * (width + 1) + x;
                const br = bl + 1;

                indices.push(tl, bl, br);
                indices.push(tl, br, tr);
            }
        }

        return {
            vertices: new Float32Array(vertices),
            uvs: new Float32Array(uvs),
            normals: new Float32Array(normals),
            indices: new Uint16Array(indices)
        };
    }

    // 生成牆壁
    generateWalls(width, height) {
        const wallThickness = 1;
        const wallHeight = 5;
        
        const walls = [
            // 外圍牆
            { start: [-width/2, 0, -height/2], end: [width/2, 0, -height/2] }, // 北
            { start: [width/2, 0, -height/2], end: [width/2, 0, height/2] },   // 東
            { start: [width/2, 0, height/2], end: [-width/2, 0, height/2] },   // 南
            { start: [-width/2, 0, height/2], end: [-width/2, 0, -height/2] }, // 西
            
            // 內部牆壁
            { start: [-20, 0, -10], end: [20, 0, -10] },
            { start: [-10, 0, 10], end: [10, 0, 10] },
            { start: [-20, 0, -20], end: [-20, 0, 20] },
            { start: [20, 0, -20], end: [20, 0, 20] }
        ];

        return walls.map(wall => {
            const direction = {
                x: wall.end[0] - wall.start[0],
                z: wall.end[2] - wall.start[2]
            };
            const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
            const angle = Math.atan2(direction.z, direction.x);

            return {
                position: {
                    x: (wall.start[0] + wall.end[0]) / 2,
                    y: wallHeight / 2,
                    z: (wall.start[2] + wall.end[2]) / 2
                },
                rotation: { y: angle },
                scale: {
                    x: length,
                    y: wallHeight,
                    z: wallThickness
                },
                geometry: ModelGenerator.generateCube(1, 1, 1) // 將被縮放到實際大小
            };
        });
    }

    // 生成出生點
    generateSpawnPoints(width, height) {
        return {
            teamA: [
                { x: -width/2 + 5, y: 1, z: -height/2 + 5 },
                { x: -width/2 + 5, y: 1, z: -height/2 + 10 },
                { x: -width/2 + 10, y: 1, z: -height/2 + 5 }
            ],
            teamB: [
                { x: width/2 - 5, y: 1, z: height/2 - 5 },
                { x: width/2 - 5, y: 1, z: height/2 - 10 },
                { x: width/2 - 10, y: 1, z: height/2 - 5 }
            ]
        };
    }

    // 生成碰撞體
    generateColliders() {
        return [
            // 箱子碰撞體
            {
                type: 'box',
                position: { x: 0, y: 1, z: 0 },
                size: { x: 2, y: 2, z: 2 }
            },
            // 其他障礙物...
        ];
    }

    // 生成裝飾物
    generateProps() {
        return [
            // 箱子
            {
                type: 'crate',
                position: { x: 0, y: 1, z: 0 },
                rotation: { y: Math.random() * Math.PI * 2 },
                geometry: ModelGenerator.generateCube(2, 2, 2)
            },
            // 桶子
            {
                type: 'barrel',
                position: { x: 5, y: 1, z: 5 },
                geometry: ModelGenerator.generateCylinder(1, 2, 16)
            }
        ];
    }

    // 生成光源
    generateLights() {
        return [
            // 主光源
            {
                type: 'directional',
                direction: [-1, -1, -1],
                color: [1, 0.95, 0.8],
                intensity: 1.0
            },
            // 環境光
            {
                type: 'ambient',
                color: [0.2, 0.2, 0.3],
                intensity: 0.5
            },
            // 點光源
            {
                type: 'point',
                position: [0, 5, 0],
                color: [1, 0.9, 0.7],
                intensity: 0.8,
                distance: 20
            }
        ];
    }

    // 生成天空盒
    generateSkybox() {
        const gradientTop = this.textureGen.generateGradient(
            512, 512, 
            '#1a2a3f', 
            '#2c4b7c', 
            true
        );
        const gradientBottom = this.textureGen.generateGradient(
            512, 512, 
            '#2c4b7c', 
            '#1a2a3f', 
            true
        );

        return {
            top: gradientTop,
            bottom: gradientBottom,
            sides: Array(4).fill(this.textureGen.generateGradient(
                512, 512,
                '#1a2a3f',
                '#2c4b7c',
                true
            ))
        };
    }

    // 生成霧效
    generateFog() {
        return {
            color: [0.1, 0.1, 0.15],
            density: 0.03,
            start: 20,
            end: 100
        };
    }
}