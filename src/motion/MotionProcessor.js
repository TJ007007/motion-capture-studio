/**
 * Motion processing pipeline with swappable filters.
 * @module motion/MotionProcessor
 */

import { MadgwickFilter } from './MadgwickFilter.js';
import { RawIntegrator } from './RawIntegrator.js';
import { quatToEuler } from '../utils/math.js';

/** @typedef {'raw'|'madgwick'|'kalman'|'complementary'|'mahony'} FilterType */

/**
 * Processes sensor samples into pose, velocity, and derived metrics.
 */
export class MotionProcessor {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.filterType = 'madgwick';
    this.madgwick = new MadgwickFilter(60, 0.1);
    this.raw = new RawIntegrator();
    /** @type {import('../utils/math.js').Vec3} */
    this.lastAccel = { x: 0, y: 0, z: 0 };
    /** @type {import('../utils/math.js').Vec3} */
    this.lastGyro = { x: 0, y: 0, z: 0 };
    this.totalDistance = 0;
    /** @type {import('../utils/math.js').Vec3} */
    this._lastPos = { x: 0, y: 0, z: 0 };
  }

  /**
   * @param {FilterType} type
   */
  setFilter(type) {
    if (!['raw', 'madgwick'].includes(type)) {
      console.warn(`Filter ${type} not yet implemented, using madgwick`);
      type = 'madgwick';
    }
    this.filterType = type;
    this.reset();
    this.bus.emit('filter:changed', type);
  }

  /**
   * @param {number} rate
   */
  setSampleRate(rate) {
    this.madgwick.setSampleRate(rate);
  }

  /**
   * @param {number} smoothing
   */
  setSmoothing(smoothing) {
    this.madgwick.smoothing = smoothing;
  }

  reset() {
    this.madgwick.reset();
    this.raw.reset();
    this.totalDistance = 0;
    this._lastPos = { x: 0, y: 0, z: 0 };
  }

  /**
   * Process one sensor sample.
   * @param {Object} sample
   * @param {{ x: number, y: number, z: number }} sample.accel
   * @param {{ x: number, y: number, z: number }} sample.gyro
   * @param {number} sample.dt
   * @param {import('../utils/math.js').Quat} [sample.orientation]
   * @returns {ProcessedFrame}
   */
  process(sample) {
    const { accel, gyro, dt, orientation } = sample;
    this.lastAccel = { ...accel };
    this.lastGyro = { ...gyro };

    if (this.filterType === 'raw') {
      this.raw.update(accel, gyro, dt, orientation);
      const pos = this.raw.position;
      const dist = Math.hypot(pos.x - this._lastPos.x, pos.y - this._lastPos.y, pos.z - this._lastPos.z);
      this.totalDistance += dist;
      this._lastPos = { ...pos };
      return {
        position: { ...pos },
        velocity: { ...this.raw.velocity },
        quaternion: { ...this.raw.q },
        euler: quatToEuler(this.raw.q),
        linearAccel: { ...accel },
        rotationSpeed: Math.hypot(gyro.x, gyro.y, gyro.z),
        gForce: Math.hypot(accel.x, accel.y, accel.z) / 9.80665,
        distance: this.totalDistance,
      };
    }

    this.madgwick.update(gyro, accel, dt);
    const pos = this.madgwick.position;
    const dist = Math.hypot(pos.x - this._lastPos.x, pos.y - this._lastPos.y, pos.z - this._lastPos.z);
    this.totalDistance += dist;
    this._lastPos = { ...pos };
    const q = this.madgwick.getQuaternion();
    const lin = this.madgwick.linearAccel ?? accel;

    return {
      position: { ...pos },
      velocity: { ...this.madgwick.velocity },
      quaternion: q,
      euler: quatToEuler(q),
      linearAccel: { ...lin },
      rotationSpeed: Math.hypot(gyro.x, gyro.y, gyro.z),
      gForce: Math.hypot(accel.x, accel.y, accel.z) / 9.80665,
      distance: this.totalDistance,
    };
  }

  /**
   * Replay processed state from stored sample without re-integrating from zero.
   * @param {Object} sample
   * @param {ProcessedFrame} [cached]
   * @returns {ProcessedFrame}
   */
  processPlaybackSample(sample, cached) {
    if (cached) return cached;
    return this.process(sample);
  }
}

/**
 * @typedef {Object} ProcessedFrame
 * @property {import('../utils/math.js').Vec3} position
 * @property {import('../utils/math.js').Vec3} velocity
 * @property {import('../utils/math.js').Quat} quaternion
 * @property {import('../utils/math.js').Vec3} euler
 * @property {import('../utils/math.js').Vec3} linearAccel
 * @property {number} rotationSpeed
 * @property {number} gForce
 * @property {number} distance
 */

export default MotionProcessor;
