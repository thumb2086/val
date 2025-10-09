// client/graphics/MaterialComposer.js
import * as THREE from 'three';

export class MaterialComposer {
    constructor(textureGen) {
        this.textureGen = textureGen;
        this._texLoader = new THREE.TextureLoader();
        this._cache = new Map();
    }
    
    // 生成特戰英豪風格的牆面材質
    createValorantWallMaterial(options = {}) {
        const {
            baseColor = 0xd4d4d4,
            roughness = 0.8,
            metalness = 0.1,
            hasStripes = false,
            stripeColor = 0x00d4aa,
            stripeWidth = 0.1
        } = options;

        const key = `valorant_wall_${baseColor}_${roughness}_${metalness}_${hasStripes}_${stripeColor}`;
        if (this._cache.has(key)) return this._cache.get(key);

        const material = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness,
            metalness,
            side: THREE.DoubleSide
        });

        if (hasStripes) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 512;
            const ctx = canvas.getContext('2d');

            // 填充基底顏色
            ctx.fillStyle = `#${baseColor.toString(16).padStart(6, '0')}`;
            ctx.fillRect(0, 0, 512, 512);

            // 繪製發光條紋
            ctx.fillStyle = `#${stripeColor.toString(16).padStart(6, '0')}`;
            const stripeHeight = Math.floor(512 * stripeWidth);
            ctx.fillRect(0, 512 - stripeHeight, 512, stripeHeight);

            material.map = new THREE.CanvasTexture(canvas);
            material.map.wrapS = material.map.wrapT = THREE.RepeatWrapping;
        }

        this._cache.set(key, material);
        return material;
    }

    // 生成傳送門特效材質
    createPortalMaterial(options = {}) {
        const {
            color = 0x00d4aa,
            pulseSpeed = 1.0,
            baseOpacity = 0.7
        } = options;

        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: baseOpacity,
            side: THREE.DoubleSide
        });

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const drawPortal = (time) => {
            ctx.clearRect(0, 0, 512, 512);
            
            // 繪製多重同心圓環
            for (let i = 0; i < 3; i++) {
                const phase = (time + i/3) % 1;
                const radius = 512 * 0.4 * (1 + 0.2 * Math.sin(phase * Math.PI * 2));
                const alpha = baseOpacity * (1 - phase);

                ctx.strokeStyle = `rgba(0, 212, 170, ${alpha})`;
                ctx.lineWidth = 3 + 2 * Math.sin(phase * Math.PI);
                ctx.beginPath();
                ctx.arc(256, 256, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        };

        material.map = new THREE.CanvasTexture(canvas);
        
        const animate = () => {
            const time = Date.now() * 0.001 * pulseSpeed;
            drawPortal(time);
            material.map.needsUpdate = true;
            requestAnimationFrame(animate);
        };
        animate();

        return material;
    }

    // 生成射擊特效材質
    createMuzzleFlashMaterial(options = {}) {
        const {
            color = 0xffaa00,
            intensity = 1.0
        } = options;

        return new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
    }

    // 生成彈道特效材質
    createBulletTrailMaterial(options = {}) {
        const {
            color = 0xffaa00,
            fadeLength = 0.5
        } = options;

        const material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(color) },
                fadeLength: { value: fadeLength }
            },
            vertexShader: `
                varying float vDistance;
                void main() {
                    vDistance = position.y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float fadeLength;
                varying float vDistance;
                void main() {
                    float opacity = 1.0 - smoothstep(0.0, fadeLength, abs(vDistance));
                    gl_FragColor = vec4(color, opacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        return material;
    }

    // 生成金屬材質
    generateMetalMaterial(options = {}) {
        const {
            baseColor = '#808080',
            roughness = 0.5,
            metalness = 0.8,
            normalStrength = 0.5,
            scratched = true
        } = options;

        const material = {
            // 基礎顏色貼圖
            albedoMap: this.textureGen.generateMetal(512, 512, baseColor),
            
            // 法線貼圖
            normalMap: this.textureGen.generateNoise(512, 512, normalStrength),
            
            // 粗糙度貼圖
            roughnessMap: this.textureGen.generateNoise(256, 256, roughness),
            
            // 金屬度貼圖
            metalnessMap: this.generateMetalnessMap(256, metalness),
            
            // 環境光遮蔽貼圖
            aoMap: this.generateAOMap(256)
        };

        // 如果需要添加刮痕
        if (scratched) {
            material.scratchMap = this.generateScratchMap(512);
        }

        return material;
    }

    // 生成皮革材質
    generateLeatherMaterial(options = {}) {
        const {
            color = '#8B4513',
            roughness = 0.9,
            wrinkleAmount = 0.7
        } = options;

        return {
            albedoMap: this.textureGen.generateLeather(512, 512, color),
            normalMap: this.generateLeatherNormal(512, wrinkleAmount),
            roughnessMap: this.textureGen.generateNoise(256, 256, roughness),
            aoMap: this.generateAOMap(256, 0.5)
        };
    }

    // 生成木材材質
    generateWoodMaterial(options = {}) {
        const {
            color = '#8B4513',
            grainIntensity = 0.8,
            roughness = 0.7
        } = options;

        return {
            albedoMap: this.generateWoodTexture(512, color, grainIntensity),
            normalMap: this.generateWoodNormal(512, grainIntensity),
            roughnessMap: this.textureGen.generateNoise(256, 256, roughness),
            aoMap: this.generateAOMap(256, 0.3)
        };
    }

    // 生成迷彩材質
    generateCamoMaterial(options = {}) {
        const {
            colors = ['#2d5a27', '#4a7c3c', '#1f3d1c'],
            roughness = 0.8
        } = options;

        return {
            albedoMap: this.textureGen.generateCamo(512, 512, colors),
            normalMap: this.generateCamoNormal(512),
            roughnessMap: this.textureGen.generateNoise(256, 256, roughness),
            aoMap: this.generateAOMap(256, 0.4)
        };
    }

    // 生成碳纖維材質
    generateCarbonFiberMaterial(options = {}) {
        const {
            color = '#222222',
            weaveSize = 32,
            roughness = 0.4
        } = options;

        return {
            albedoMap: this.generateCarbonFiberTexture(512, color, weaveSize),
            normalMap: this.generateCarbonFiberNormal(512, weaveSize),
            roughnessMap: this.generateCarbonFiberRoughness(256, weaveSize, roughness),
            aoMap: this.generateAOMap(256, 0.2)
        };
    }

    // 生成金屬度貼圖
    generateMetalnessMap(size, metalness = 0.8) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.height = size;

        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const value = Math.floor(metalness * 255);
            data[i] = value;     // R
            data[i + 1] = value; // G
            data[i + 2] = value; // B
            data[i + 3] = 255;   // A
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    }

    // 生成環境光遮蔽貼圖
    generateAOMap(size, intensity = 0.5) {
        return this.textureGen.generateNoise(size, size, intensity);
    }

    // 生成刮痕貼圖
    generateScratchMap(size) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.height = size;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);

        // 添加隨機刮痕
        ctx.strokeStyle = '#ffffff';
        for (let i = 0; i < 50; i++) {
            ctx.beginPath();
            const x = Math.random() * size;
            const y = Math.random() * size;
            const length = 10 + Math.random() * 30;
            const angle = Math.random() * Math.PI * 2;

            ctx.moveTo(x, y);
            ctx.lineTo(
                x + Math.cos(angle) * length,
                y + Math.sin(angle) * length
            );
            ctx.stroke();
        }

        return canvas.toDataURL();
    }

    // 生成皮革法線貼圖
    generateLeatherNormal(size, wrinkleAmount) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.height = size;

        // 生成基礎噪點
        const noise = this.textureGen.generateNoise(size, size, wrinkleAmount);
        
        // 添加方向性皺褶
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const length = 20 + Math.random() * 40;
            const angle = Math.random() * Math.PI;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(
                x + Math.cos(angle) * length,
                y + Math.sin(angle) * length
            );
            ctx.stroke();
        }

        return canvas.toDataURL();
    }

    // 生成木材紋理
    generateWoodTexture(size, color, intensity) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.height = size;

        // 基礎顏色
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size, size);

        // 生成木紋
        for (let i = 0; i < size; i += 4) {
            ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.2 * intensity})`;
            ctx.beginPath();
            ctx.moveTo(0, i);
            
            // 生成彎曲的木紋線
            let x = 0;
            while (x < size) {
                const y = i + Math.sin(x / 30) * 10;
                ctx.lineTo(x, y);
                x += 1;
            }
            
            ctx.stroke();
        }

        return canvas.toDataURL();
    }

    // 生成碳纖維紋理
    generateCarbonFiberTexture(size, color, weaveSize) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.height = size;

        // 基礎顏色
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size, size);

        // 生成編織圖案
        for (let y = 0; y < size; y += weaveSize) {
            for (let x = 0; x < size; x += weaveSize) {
                const isHorizontal = (Math.floor(y / weaveSize) % 2) === 0;
                ctx.fillStyle = `rgba(255,255,255,${isHorizontal ? 0.1 : 0.05})`;
                
                if (isHorizontal) {
                    ctx.fillRect(x, y, weaveSize, weaveSize/2);
                } else {
                    ctx.fillRect(x, y + weaveSize/2, weaveSize, weaveSize/2);
                }
            }
        }

        return canvas.toDataURL();
    }
}