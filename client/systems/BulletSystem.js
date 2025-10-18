// client/systems/BulletSystem.js
import * as THREE from 'three';

export default class BulletSystem {
  constructor(graphics) {
    this.graphics = graphics; // 需要 scene 以新增/移除物件
    this.tracers = []; // { line, age, duration }
  }

  spawnTracer(from, to, { color = 0xffee88, duration = 0.15, width = 0.1 } = {}) {
    if (!this.graphics?.scene) return;
    // 生成一條線段作為彈道軌跡，使用 MeshLine 來獲得更好的視覺效果
    const points = [
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z)
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      depthTest: true,
      depthWrite: false,
      linewidth: width
    });
    const line = new THREE.Line(geom, mat);
    line.renderOrder = 998; // 讓武器(999)在最前
    // 確保彈道軌跡始終可見
    line.frustumCulled = false;
    line.userData.isTracer = true; // 標記為 tracer，供射線測試時排除
    this.graphics.scene.add(line);
    this.tracers.push({ line, age: 0, duration });
  }

  update(dt) {
    if (!this.tracers.length) return;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.age += dt;
      const k = 1 - (t.age / t.duration);
      if (t.line?.material) t.line.material.opacity = Math.max(0, Math.min(1, k));
      if (t.age >= t.duration) {
        // 從場景移除並釋放資源
        if (t.line) {
          t.line.parent && t.line.parent.remove(t.line);
          if (t.line.geometry) t.line.geometry.dispose?.();
          if (t.line.material) t.line.material.dispose?.();
        }
        this.tracers.splice(i, 1);
      }
    }
  }
}
