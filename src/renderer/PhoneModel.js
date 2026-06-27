/**
 * Procedural low-poly smartphone model.
 * @module renderer/PhoneModel
 */

import * as THREE from 'three';

/**
 * Builds a beveled smartphone mesh with screen, camera bump, and buttons.
 */
export class PhoneModel {
  /**
   * @param {boolean} [wireframe=false]
   */
  constructor(wireframe = false) {
    this.wireframe = wireframe;
    this.group = new THREE.Group();
    this._build();
  }

  _build() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a2332,
      metalness: 0.6,
      roughness: 0.35,
      wireframe: this.wireframe,
    });
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x0a1628,
      emissive: 0x003344,
      emissiveIntensity: 0.4,
      metalness: 0.1,
      roughness: 0.2,
      wireframe: this.wireframe,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.15,
      metalness: 0.8,
      roughness: 0.2,
      wireframe: this.wireframe,
    });

    // Body — rounded box approximation with bevels via scaled box + chamfer feel
    const w = 0.07, h = 0.14, d = 0.008;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 2, 4, 1), bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Screen inset
    const screen = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, h * 0.82, d * 0.3), screenMat);
    screen.position.z = d * 0.45;
    this.group.add(screen);

    // Camera bump
    const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 16), accentMat);
    cam.rotation.x = Math.PI / 2;
    cam.position.set(w * 0.25, h * 0.38, -d * 0.55);
    this.group.add(cam);

    // Side buttons
    const btnGeo = new THREE.BoxGeometry(0.002, 0.02, 0.004);
    const volUp = new THREE.Mesh(btnGeo, accentMat);
    volUp.position.set(-w * 0.52, h * 0.15, 0);
    const volDn = new THREE.Mesh(btnGeo, accentMat);
    volDn.position.set(-w * 0.52, h * 0.05, 0);
    const power = new THREE.Mesh(btnGeo, accentMat);
    power.position.set(w * 0.52, h * 0.2, 0);
    this.group.add(volUp, volDn, power);

    // Front speaker / notch hint
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.002), accentMat);
    notch.position.set(0, h * 0.4, d * 0.4);
    this.group.add(notch);

    this.body = body;
    this.materials = [bodyMat, screenMat, accentMat];
  }

  /**
   * @param {import('../utils/math.js').Vec3} position
   * @param {import('../utils/math.js').Quat} quaternion
   */
  setPose(position, quaternion) {
    this.group.position.set(position.x, position.y, position.z);
    this.group.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }

  /**
   * @param {boolean} wf
   */
  setWireframe(wf) {
    this.wireframe = wf;
    for (const m of this.materials) m.wireframe = wf;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}

export default PhoneModel;
