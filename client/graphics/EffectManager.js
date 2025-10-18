// client/graphics/EffectManager.js
import * as THREE from 'three';

export class EffectManager {
    constructor(scene, materialComposer) {
        this.scene = scene;
        this.materialComposer = materialComposer;
        this.effects = new Map();
    }

    // 生成槍口火焰特效
    createMuzzleFlash(weapon, options = {}) {
        const {
            color = 0xffee88,
            size = 0.15,
            duration = 0.05
        } = options;

        // 建立火焰幾何體 - 使用多層次的平面來創造更豐富的視覺效果
        const group = new THREE.Group();
        
        // 主要火焰
        const mainFlash = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            this.materialComposer.createMuzzleFlashMaterial({ 
                color: color,
                opacity: 0.8 
            })
        );
        
        // 內部較亮的核心
        const coreFlash = new THREE.Mesh(
            new THREE.PlaneGeometry(size * 0.6, size * 0.6),
            this.materialComposer.createMuzzleFlashMaterial({ 
                color: 0xffffff,
                opacity: 1.0 
            })
        );
        
        // 外部光暈
        const glowFlash = new THREE.Mesh(
            new THREE.PlaneGeometry(size * 1.5, size * 1.5),
            this.materialComposer.createMuzzleFlashMaterial({ 
                color: color,
                opacity: 0.4 
            })
        );
        
        [mainFlash, coreFlash, glowFlash].forEach(flash => {
            flash.renderOrder = 999;
            flash.material.depthTest = false;
            flash.material.depthWrite = false;
            flash.material.blending = THREE.AdditiveBlending;
            group.add(flash);
        });

        // 根據武器類型調整位置
        const muzzlePosition = new THREE.Vector3();
        const muzzleOffset = new THREE.Vector3(0, 0.05, -0.6); // 調整這些值以符合武器型態
        weapon.localToWorld(muzzlePosition.copy(muzzleOffset));
        group.position.copy(muzzlePosition);

        this.scene.add(group);

        // 設定自動移除和淡出動畫
        const startTime = performance.now();
        const animate = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > duration) {
                this.scene.remove(group);
                group.traverse(object => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) object.material.dispose();
                });
                return;
            }

            const progress = elapsed / duration;
            group.children.forEach(flash => {
                flash.material.opacity *= (1 - progress);
                flash.scale.setScalar(1 + progress * 0.5);
            });

            requestAnimationFrame(animate);
        };
        animate();

        return group;
    }

    // 生成彈道軌跡
    createBulletTrail(from, to, options = {}) {
        const {
            color = 0xffaa00,
            width = 0.02,
            duration = 0.2,
            fadeLength = 0.5
        } = options;

        // 建立彈道幾何體
        const direction = to.clone().sub(from);
        const length = direction.length();
        const geometry = new THREE.CylinderGeometry(width/2, width/2, length, 8, 1);
        geometry.translate(0, length/2, 0);

        const material = this.materialComposer.createBulletTrailMaterial({
            color,
            fadeLength
        });

        const trail = new THREE.Mesh(geometry, material);
        trail.position.copy(from);
        trail.lookAt(to);
        
        this.scene.add(trail);

        // 設定淡出動畫
        const startTime = performance.now();
        const animate = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > duration) {
                this.scene.remove(trail);
                geometry.dispose();
                material.dispose();
                return;
            }

            const opacity = 1 - (elapsed / duration);
            material.opacity = opacity;
            
            requestAnimationFrame(animate);
        };
        animate();

        return trail;
    }

    // 生成擊中特效
    createHitEffect(position, normal, options = {}) {
        const {
            color = 0xffaa00,
            size = 0.2,
            duration = 0.2,
            particleCount = 8
        } = options;

        const group = new THREE.Group();
        group.position.copy(position);

        // 創建圓形閃光
        const flashGeo = new THREE.CircleGeometry(size/2, 16);
        const flashMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.lookAt(position.clone().add(normal));
        group.add(flash);

        // 創建散射粒子
        for (let i = 0; i < particleCount; i++) {
            const particleGeo = new THREE.SphereGeometry(size/8, 4, 4);
            const particleMat = new THREE.MeshBasicMaterial({ color });
            const particle = new THREE.Mesh(particleGeo, particleMat);

            // 隨機方向
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 0.5 + Math.random() * 0.5;
            particle.velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                Math.random() * speed
            );

            group.add(particle);
        }

        this.scene.add(group);

        // 動畫
        const startTime = performance.now();
        const animate = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > duration) {
                this.scene.remove(group);
                group.traverse(object => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) object.material.dispose();
                });
                return;
            }

            const progress = elapsed / duration;
            flash.material.opacity = 1 - progress;
            flash.scale.setScalar(1 + progress);

            // 更新粒子位置
            group.children.forEach(child => {
                if (child !== flash && child.velocity) {
                    child.position.add(child.velocity.clone().multiplyScalar(0.016));
                    child.velocity.y -= 9.8 * 0.016; // 重力
                }
            });

            requestAnimationFrame(animate);
        };
        animate();

        return group;
    }

    // 生成檢視動畫
    createInspectAnimation(weapon, options = {}) {
        const {
            duration = 3.0,
            rotationAmount = Math.PI * 2,
            positionOffset = 0.1
        } = options;

        const startPosition = weapon.position.clone();
        const startRotation = weapon.rotation.clone();
        const startTime = performance.now();

        const animate = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > duration) {
                // 重置到原始位置
                weapon.position.copy(startPosition);
                weapon.rotation.copy(startRotation);
                return;
            }

            const progress = elapsed / duration;
            const angle = Math.sin(progress * Math.PI * 2) * (rotationAmount / 4);
            
            // 旋轉動畫
            weapon.rotation.z = startRotation.z + angle;
            
            // 位置動畫
            weapon.position.y = startPosition.y + Math.sin(progress * Math.PI * 4) * positionOffset;
            
            requestAnimationFrame(animate);
        };

        animate();
    }

    // 生成發光材質的呼吸效果
    createBreathingEffect(material, options = {}) {
        const {
            minIntensity = 0.3,
            maxIntensity = 1.0,
            speed = 1.0
        } = options;

        const startTime = performance.now();
        
        const animate = () => {
            const time = performance.now() - startTime;
            const intensity = minIntensity + (Math.sin(time * 0.001 * speed) * 0.5 + 0.5) * (maxIntensity - minIntensity);
            
            if (material.emissiveIntensity !== undefined) {
                material.emissiveIntensity = intensity;
            }
            
            requestAnimationFrame(animate);
        };

        animate();
    }
}