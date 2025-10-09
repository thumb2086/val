// client/graphics.js
import * as THREE from 'three';
import { ResourceManager } from './graphics/ResourceManager.js';

// 簡易 Three.js 渲染骨架
export class Graphics {
  constructor() {
    this.initialized = false;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this._onResize = null;
    this.resourceManager = null;
  }

  init() {
    if (this.initialized) return;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.zIndex = '0'; // 讓 HUD/選單覆蓋在上
    document.body.appendChild(this.renderer.domElement);

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.6, 5);
    // 關鍵：把相機加入場景，確保掛在相機上的子物件（如武器模型）能被渲染
    this.scene.add(this.camera);

    // 簡單環境光與參考物
    const light = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(light);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3399ff });
    const cube = new THREE.Mesh(geo, mat);
    this.scene.add(cube);

    // 初始化資源管理器
    this.resourceManager = new ResourceManager(this.renderer.getContext());
    
    // 加載所有遊戲資源
    this.resourceManager.initializeResources().then(() => {
      console.log('遊戲資源載入完成');
      this.dispatchEvent({ type: 'resourcesReady' });
    });

    // Resize handler
    this._onResize = () => {
      if (!this.renderer || !this.camera) return;
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this._onResize);

    this.initialized = true;
  }

  getCamera() { return this.camera; }

  getResourceManager() { return this.resourceManager; }

  render() {
    if (!this.initialized) return;
    
    // 更新粒子系統
    if (this.resourceManager) {
      this.resourceManager.updateParticles(1/60); // 假設 60fps
    }

    this.renderer.render(this.scene, this.camera);
  }

  // 事件系統
  addEventListener(type, listener) {
    if (!this._listeners) this._listeners = {};
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(listener);
  }

  removeEventListener(type, listener) {
    if (!this._listeners) return;
    if (!this._listeners[type]) return;
    const index = this._listeners[type].indexOf(listener);
    if (index !== -1) this._listeners[type].splice(index, 1);
  }

  dispatchEvent(event) {
    if (!this._listeners) return;
    const listeners = this._listeners[event.type];
    if (!listeners) return;
    listeners.forEach(listener => listener(event));
  }
}