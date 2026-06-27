/**
 * Three.js scene renderer with grid, lighting, and phone animation.
 * @module renderer/SceneRenderer
 */

import * as THREE from 'three';
import { PhoneModel } from './PhoneModel.js';
import { TrailRenderer } from './TrailRenderer.js';
import { CameraController } from './CameraController.js';

/**
 * Main 3D workspace renderer.
 */
export class SceneRenderer {
  /**
   * @param {HTMLElement} container
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(container, bus) {
    this.bus = bus;
    this.container = container;
    this.renderTime = 0;
    this.fps = 60;

    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e14);
    this.scene.fog = new THREE.FogExp2(0x0a0e14, 0.35);

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.01, 100);
    this.camera.position.set(0.4, 0.3, 0.5);

    this.cameraCtrl = new CameraController(this.camera, this.renderer.domElement);
    this.phone = new PhoneModel(false);
    this.scene.add(this.phone.group);
    this.trails = new TrailRenderer();
    this.scene.add(this.trails.group);

    this._buildEnvironment();
    this._animate = this._animate.bind(this);
    this._raf = requestAnimationFrame(this._animate);
    this._frameCount = 0;
    this._fpsTimer = performance.now();

    window.addEventListener('resize', () => this._onResize());
  }

  _buildEnvironment() {
    const grid = new THREE.GridHelper(2, 40, 0x00e5ff, 0x1a2a3a);
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    grid.position.y = 0;
    this.grid = grid;
    this.scene.add(grid);

    const axes = new THREE.AxesHelper(0.15);
    axes.position.set(0, 0.001, 0);
    this.axes = axes;
    this.scene.add(axes);

    const amb = new THREE.AmbientLight(0x404860, 0.6);
    this.scene.add(amb);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 4, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.keyLight = key;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x00e5ff, 0.35);
    rim.position.set(-2, 1, -2);
    this.scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.MeshStandardMaterial({ color: 0x0d1219, roughness: 0.9, metalness: 0.1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.floor = floor;
    this.scene.add(floor);
  }

  /**
   * @param {Object} opts
   */
  applySettings(opts) {
    if (opts.gridVisible !== undefined) this.grid.visible = opts.gridVisible;
    if (opts.shadowsEnabled !== undefined) {
      this.renderer.shadowMap.enabled = opts.shadowsEnabled;
      this.keyLight.castShadow = opts.shadowsEnabled;
    }
    if (opts.trailMode) this.trails.setMode(opts.trailMode);
    if (opts.phoneWireframe !== undefined) this.phone.setWireframe(opts.phoneWireframe);
    if (opts.cameraMode) this.cameraCtrl.setMode(opts.cameraMode);
    if (opts.autoFollowSmoothing !== undefined) this.cameraCtrl.followSmoothing = opts.autoFollowSmoothing;
  }

  /**
   * @param {import('../utils/math.js').Vec3} position
   * @param {import('../utils/math.js').Quat} quaternion
   */
  updatePhone(position, quaternion) {
    this.phone.setPose(position, quaternion);
    this.cameraCtrl.follow(position);
  }

  /**
   * @param {Array} trailPoints
   * @param {number} [index]
   */
  updateTrail(trailPoints, index) {
    this.trails.update(trailPoints, index);
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate(now) {
    const t0 = performance.now();
    this.cameraCtrl.update();
    this.renderer.render(this.scene, this.camera);
    this.renderTime = performance.now() - t0;
    this._frameCount++;
    if (now - this._fpsTimer > 1000) {
      this.fps = this._frameCount;
      this._frameCount = 0;
      this._fpsTimer = now;
      this.bus.emit('renderer:stats', { fps: this.fps, renderTime: this.renderTime });
    }
    this._raf = requestAnimationFrame(this._animate);
  }

  /** Capture viewport screenshot. @returns {string} data URL */
  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this.phone.dispose();
    this.trails.dispose();
    this.cameraCtrl.dispose();
    this.renderer.dispose();
  }
}

export default SceneRenderer;
