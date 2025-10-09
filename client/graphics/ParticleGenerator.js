// 粒子系統生成器
export class ParticleGenerator {
    constructor(gl) {
        this.gl = gl;
        this.particles = [];
    }

    // 生成彈道軌跡粒子
    generateBulletTrail(startPos, endPos, speed = 0.1) {
        const direction = {
            x: endPos.x - startPos.x,
            y: endPos.y - startPos.y,
            z: endPos.z - startPos.z
        };
        
        const length = Math.sqrt(
            direction.x * direction.x + 
            direction.y * direction.y + 
            direction.z * direction.z
        );
        
        const normalized = {
            x: direction.x / length,
            y: direction.y / length,
            z: direction.z / length
        };

        return {
            position: { ...startPos },
            velocity: {
                x: normalized.x * speed,
                y: normalized.y * speed,
                z: normalized.z * speed
            },
            color: [1.0, 0.8, 0.0, 1.0], // 黃色
            size: 2.0,
            life: 1.0,
            decay: 0.05
        };
    }

    // 生成爆炸效果粒子
    generateExplosion(position, particleCount = 50) {
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            // 隨機方向
            const angle = Math.random() * Math.PI * 2;
            const z = Math.random() * 2 - 1;
            const speed = 0.5 + Math.random() * 0.5;
            
            particles.push({
                position: { ...position },
                velocity: {
                    x: Math.cos(angle) * speed * Math.sqrt(1 - z * z),
                    y: Math.sin(angle) * speed * Math.sqrt(1 - z * z),
                    z: z * speed
                },
                color: [
                    1.0,  // R
                    0.3 + Math.random() * 0.4,  // G
                    0.0,  // B
                    1.0   // A
                ],
                size: 3.0 + Math.random() * 2.0,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02
            });
        }

        return particles;
    }

    // 生成射擊火花效果
    generateMuzzleFlash(position) {
        const particles = [];
        const particleCount = 20;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 0.2 + Math.random() * 0.3;
            
            particles.push({
                position: { ...position },
                velocity: {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed,
                    z: 0
                },
                color: [
                    1.0,  // R
                    0.7 + Math.random() * 0.3,  // G
                    0.0,  // B
                    1.0   // A
                ],
                size: 2.0 + Math.random() * 1.0,
                life: 0.2,
                decay: 0.1
            });
        }

        return particles;
    }

    // 生成煙霧效果
    generateSmoke(position, particleCount = 30) {
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.05 + Math.random() * 0.1;
            
            particles.push({
                position: { ...position },
                velocity: {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed,
                    z: 0.1 + Math.random() * 0.1
                },
                color: [
                    0.7,  // R
                    0.7,  // G
                    0.7,  // B
                    0.3 + Math.random() * 0.2   // A
                ],
                size: 5.0 + Math.random() * 5.0,
                life: 2.0,
                decay: 0.01,
                turbulence: 0.02
            });
        }

        return particles;
    }

    // 生成血液濺射效果
    generateBloodSpray(position, direction, particleCount = 20) {
        const particles = [];
        const spread = Math.PI / 4; // 45度擴散角

        for (let i = 0; i < particleCount; i++) {
            const angleOffset = (Math.random() - 0.5) * spread;
            const speed = 0.3 + Math.random() * 0.4;

            const velocity = {
                x: Math.cos(direction + angleOffset) * speed,
                y: Math.sin(direction + angleOffset) * speed,
                z: -0.1 - Math.random() * 0.2 // 略微向下
            };

            particles.push({
                position: { ...position },
                velocity: velocity,
                color: [
                    0.8,  // R
                    0.0,  // G
                    0.0,  // B
                    0.8 + Math.random() * 0.2   // A
                ],
                size: 2.0 + Math.random() * 2.0,
                life: 0.5 + Math.random() * 0.5,
                decay: 0.05,
                gravity: -0.2
            });
        }

        return particles;
    }

    // 更新粒子
    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // 更新生命週期
            particle.life -= particle.decay * deltaTime;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // 更新位置
            particle.position.x += particle.velocity.x * deltaTime;
            particle.position.y += particle.velocity.y * deltaTime;
            particle.position.z += particle.velocity.z * deltaTime;

            // 應用重力（如果有）
            if (particle.gravity) {
                particle.velocity.z += particle.gravity * deltaTime;
            }

            // 應用亂流（如果有）
            if (particle.turbulence) {
                particle.velocity.x += (Math.random() - 0.5) * particle.turbulence;
                particle.velocity.y += (Math.random() - 0.5) * particle.turbulence;
                particle.velocity.z += (Math.random() - 0.5) * particle.turbulence;
            }

            // 更新顏色 alpha
            particle.color[3] = particle.life;
        }
    }
}