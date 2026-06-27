/**
 * Motion trail rendering: line, ribbon, heatmap, ghost phones.
 * @module renderer/TrailRenderer
 */

import * as THREE from 'three';

/** @typedef {'line'|'ribbon'|'heatmap'|'ghost'} TrailMode */

/**
 * GPU-efficient motion trail visualisation.
 */
export class TrailRenderer {
  constructor() {
    this.mode = 'line';
    this.group = new THREE.Group();
    /** @type {THREE.Line|null} */
    this.line = null;
    /** @type {THREE.Mesh|null} */
    this.ribbon = null;
    /** @type {THREE.Points|null} */
    this.heatmap = null;
    /** @type {THREE.InstancedMesh|null} */
    this.ghosts = null;
    this._positions = [];
    this._maxPoints = 50000;
    this._ghostGeo = new THREE.BoxGeometry(0.07, 0.14, 0.008);
    this._ghostMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.25,
      metalness: 0.5,
      roughness: 0.4,
    });
  }

  /**
   * @param {TrailMode} mode
   */
  setMode(mode) {
    this.mode = mode;
    this._rebuild();
  }

  /**
   * @param {Array<{ position: import('../utils/math.js').Vec3, quaternion?: import('../utils/math.js').Quat }>} points
   * @param {number} [upToIndex]
   */
  update(points, upToIndex) {
    const end = upToIndex !== undefined ? upToIndex + 1 : points.length;
    this._positions = points.slice(0, end);
    this._rebuild();
  }

  _clear() {
    while (this.group.children.length) {
      const c = this.group.children[0];
      this.group.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
    this.line = null;
    this.ribbon = null;
    this.heatmap = null;
    this.ghosts = null;
  }

  _rebuild() {
    this._clear();
    const pts = this._positions;
    if (!pts.length) return;

    if (this.mode === 'line') {
      const verts = new Float32Array(pts.length * 3);
      for (let i = 0; i < pts.length; i++) {
        verts[i * 3] = pts[i].position.x;
        verts[i * 3 + 1] = pts[i].position.y;
        verts[i * 3 + 2] = pts[i].position.z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85 }));
      this.group.add(this.line);
    } else if (this.mode === 'ribbon') {
      const width = 0.02;
      const positions = [];
      const indices = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i].position, b = pts[i + 1].position;
        const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(width);
        const base = positions.length / 3;
        positions.push(a.x + side.x, a.y + side.y, a.z + side.z);
        positions.push(a.x - side.x, a.y - side.y, a.z - side.z);
        positions.push(b.x + side.x, b.y + side.y, b.z + side.z);
        positions.push(b.x - side.x, b.y - side.y, b.z - side.z);
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      this.ribbon = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0x00e5ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
      }));
      this.group.add(this.ribbon);
    } else if (this.mode === 'heatmap') {
      const verts = new Float32Array(pts.length * 3);
      const colors = new Float32Array(pts.length * 3);
      let maxSpeed = 0;
      const speeds = pts.map((p, i) => {
        if (i === 0) return 0;
        const a = pts[i - 1].position, b = p.position;
        const s = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        maxSpeed = Math.max(maxSpeed, s);
        return s;
      });
      for (let i = 0; i < pts.length; i++) {
        verts[i * 3] = pts[i].position.x;
        verts[i * 3 + 1] = pts[i].position.y;
        verts[i * 3 + 2] = pts[i].position.z;
        const t = maxSpeed > 0 ? speeds[i] / maxSpeed : 0;
        colors[i * 3] = t;
        colors[i * 3 + 1] = 1 - t * 0.5;
        colors[i * 3 + 2] = 1 - t;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      this.heatmap = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.015, vertexColors: true, transparent: true, opacity: 0.9,
      }));
      this.group.add(this.heatmap);
    } else if (this.mode === 'ghost') {
      const step = Math.max(1, Math.floor(pts.length / 40));
      const count = Math.min(40, Math.ceil(pts.length / step));
      this.ghosts = new THREE.InstancedMesh(this._ghostGeo, this._ghostMat, count);
      const dummy = new THREE.Object3D();
      let idx = 0;
      for (let i = 0; i < pts.length && idx < count; i += step) {
        const p = pts[i];
        dummy.position.set(p.position.x, p.position.y, p.position.z);
        if (p.quaternion) dummy.quaternion.set(p.quaternion.x, p.quaternion.y, p.quaternion.z, p.quaternion.w);
        dummy.updateMatrix();
        this.ghosts.setMatrixAt(idx++, dummy.matrix);
      }
      this.ghosts.instanceMatrix.needsUpdate = true;
      this.group.add(this.ghosts);
    }
  }

  dispose() {
    this._clear();
    this._ghostGeo.dispose();
    this._ghostMat.dispose();
  }
}

export default TrailRenderer;
