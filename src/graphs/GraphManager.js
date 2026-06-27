/**
 * Manages all live data visualisation graphs.
 * @module graphs/GraphManager
 */

import { GraphCanvas } from './GraphCanvas.js';
import { fft, nextPow2 } from '../utils/math.js';

/** @type {Record<string, { title: string, tip: string, color: string }>} */
const GRAPH_DEFS = {
  accelX: { title: 'Accel X', tip: 'Linear acceleration along the device X axis (m/s²), including gravity unless filtered.', color: '#00e5ff' },
  accelY: { title: 'Accel Y', tip: 'Linear acceleration along the device Y axis (m/s²).', color: '#00ffc8' },
  accelZ: { title: 'Accel Z', tip: 'Linear acceleration along the device Z axis (m/s²).', color: '#4d9fff' },
  gyroX: { title: 'Gyro X', tip: 'Angular velocity around X (rad/s).', color: '#ff6b9d' },
  gyroY: { title: 'Gyro Y', tip: 'Angular velocity around Y (rad/s).', color: '#ffb347' },
  gyroZ: { title: 'Gyro Z', tip: 'Angular velocity around Z (rad/s).', color: '#c77dff' },
  velocity: { title: 'Velocity', tip: 'Estimated speed magnitude from integrated acceleration (m/s).', color: '#00e5ff' },
  position: { title: 'Position', tip: 'Estimated displacement magnitude from origin (m). Subject to drift.', color: '#7fff7f' },
  distance: { title: 'Distance', tip: 'Cumulative path length travelled (m).', color: '#ffd700' },
  rotationSpeed: { title: 'Rotation Speed', tip: 'Combined angular velocity magnitude (rad/s).', color: '#ff8c69' },
  gForce: { title: 'G-Force', tip: 'Total acceleration magnitude in g units (1 g ≈ 9.81 m/s²).', color: '#ff4444' },
  fft: { title: 'FFT Spectrum', tip: 'Frequency spectrum of acceleration magnitude — useful for vibration analysis.', color: '#9b59b6' },
};

/**
 * Graph panel coordinator.
 */
export class GraphManager {
  /**
   * @param {HTMLElement} container
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(container, bus) {
    this.bus = bus;
    this.container = container;
    /** @type {Map<string, GraphCanvas>} */
    this.graphs = new Map();
    this._fftBuffer = new Float32Array(256);
    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    for (const [id, def] of Object.entries(GRAPH_DEFS)) {
      const wrap = document.createElement('div');
      wrap.className = 'graph-cell';
      wrap.dataset.graph = id;
      const canvas = document.createElement('canvas');
      wrap.appendChild(canvas);
      this.container.appendChild(wrap);
      this.graphs.set(id, new GraphCanvas(canvas, def.title, def.tip, def.color));
    }
  }

  /**
   * @param {Object} frame Processed frame or sample
   */
  updateLive(frame) {
    const a = frame.accel ?? frame.linearAccel;
    const g = frame.gyro ?? { x: 0, y: 0, z: 0 };
    const p = frame.processed ?? frame;
    this.graphs.get('accelX')?.push([a.x]);
    this.graphs.get('accelY')?.push([a.y]);
    this.graphs.get('accelZ')?.push([a.z]);
    this.graphs.get('gyroX')?.push([g.x]);
    this.graphs.get('gyroY')?.push([g.y]);
    this.graphs.get('gyroZ')?.push([g.z]);
    const vel = p.velocity ? Math.hypot(p.velocity.x, p.velocity.y, p.velocity.z) : 0;
    const pos = p.position ? Math.hypot(p.position.x, p.position.y, p.position.z) : 0;
    this.graphs.get('velocity')?.push([vel]);
    this.graphs.get('position')?.push([pos]);
    this.graphs.get('distance')?.push([p.distance ?? 0]);
    this.graphs.get('rotationSpeed')?.push([p.rotationSpeed ?? 0]);
    this.graphs.get('gForce')?.push([p.gForce ?? 0]);

    const mag = Math.hypot(a.x, a.y, a.z);
    this._fftBuffer.copyWithin(0, 1);
    this._fftBuffer[this._fftBuffer.length - 1] = mag;
    this._updateFft();
  }

  _updateFft() {
    const n = nextPow2(this._fftBuffer.length);
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let i = 0; i < this._fftBuffer.length; i++) re[i] = this._fftBuffer[i];
    fft(re, im);
    const half = n >> 1;
    const mags = new Float32Array(half);
    for (let i = 0; i < half; i++) mags[i] = Math.hypot(re[i], im[i]);
    this.graphs.get('fft')?.setData(mags);
  }

  /**
   * @param {Record<string, boolean>} visibility
   */
  setVisibility(visibility) {
    for (const [id, visible] of Object.entries(visibility)) {
      const cell = this.container.querySelector(`[data-graph="${id}"]`);
      if (cell) cell.style.display = visible ? '' : 'none';
    }
  }

  resizeAll() {
    for (const g of this.graphs.values()) g.resize();
  }

  clear() {
    for (const g of this.graphs.values()) g.setData(new Float32Array(0));
  }
}

export default GraphManager;
