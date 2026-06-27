/**
 * Camera modes: orbit, free, auto-follow.
 * @module renderer/CameraController
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** @typedef {'orbit'|'free'|'follow'} CameraMode */

/**
 * Manages viewport camera behaviour.
 */
export class CameraController {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} domElement
   */
  constructor(camera, domElement) {
    this.camera = camera;
    this.mode = 'orbit';
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.followSmoothing = 0.08;
    /** @type {THREE.Vector3} */
    this._target = new THREE.Vector3();
    this._home = { position: new THREE.Vector3(0.4, 0.3, 0.5), target: new THREE.Vector3(0, 0.05, 0) };
  }

  /**
   * @param {CameraMode} mode
   */
  setMode(mode) {
    this.mode = mode;
    this.controls.enabled = mode === 'orbit' || mode === 'free';
  }

  /**
   * @param {import('../utils/math.js').Vec3} position
   */
  follow(position) {
    if (this.mode !== 'follow') return;
    const desired = new THREE.Vector3(
      position.x + 0.25,
      position.y + 0.2,
      position.z + 0.35,
    );
    this.camera.position.lerp(desired, this.followSmoothing);
    this._target.lerp(new THREE.Vector3(position.x, position.y, position.z), this.followSmoothing);
    this.camera.lookAt(this._target);
  }

  reset() {
    this.camera.position.copy(this._home.position);
    this.controls.target.copy(this._home.target);
    this.controls.update();
  }

  update() {
    if (this.mode === 'orbit' || this.mode === 'free') {
      this.controls.update();
    }
  }

  dispose() {
    this.controls.dispose();
  }
}

export default CameraController;
