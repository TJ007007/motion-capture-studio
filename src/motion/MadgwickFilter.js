/**
 * Madgwick AHRS sensor fusion filter.
 * @see http://www.x-io.co.uk/open-source-imu-and-ahrs-algorithms/
 * @module motion/MadgwickFilter
 */

import { quat, quatNormalize } from '../utils/math.js';

/**
 * Madgwick IMU fusion with gyro + accelerometer.
 */
export class MadgwickFilter {
  /**
   * @param {number} [sampleRate=60]
   * @param {number} [beta=0.1] Filter gain
   */
  constructor(sampleRate = 60, beta = 0.1) {
    this.sampleRate = sampleRate;
    this.beta = beta;
    /** @type {import('../utils/math.js').Quat} */
    this.q = quat(1, 0, 0, 0);
    this.gravityRef = { x: 0, y: 0, z: 1 };
    /** @type {import('../utils/math.js').Vec3|null} */
    this.linearAccel = null;
    this.smoothing = 0.15;
    /** @type {import('../utils/math.js').Vec3} */
    this._smoothVel = { x: 0, y: 0, z: 0 };
    /** @type {import('../utils/math.js').Vec3} */
    this.position = { x: 0, y: 0, z: 0 };
    /** @type {import('../utils/math.js').Vec3} */
    this.velocity = { x: 0, y: 0, z: 0 };
    this.driftCorrection = 0.002;
  }

  /**
   * @param {number} rate
   */
  setSampleRate(rate) {
    this.sampleRate = rate;
  }

  /**
   * @param {number} beta
   */
  setBeta(beta) {
    this.beta = beta;
  }

  reset() {
    this.q = quat(1, 0, 0, 0);
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this._smoothVel = { x: 0, y: 0, z: 0 };
  }

  /**
   * Update orientation from gyro (rad/s) and accel (m/s²).
   * @param {{ x: number, y: number, z: number }} gyro
   * @param {{ x: number, y: number, z: number }} accel
   * @param {number} dt
   */
  update(gyro, accel, dt) {
    const gx = gyro.x, gy = gyro.y, gz = gyro.z;
    let ax = accel.x, ay = accel.y, az = accel.z;
    const norm = Math.hypot(ax, ay, az);
    if (norm === 0) return;
    ax /= norm; ay /= norm; az /= norm;

    const q1 = this.q.w, q2 = this.q.x, q3 = this.q.y, q4 = this.q.z;
    const _2q1 = 2 * q1, _2q2 = 2 * q2, _2q3 = 2 * q3, _2q4 = 2 * q4;
    const _4q1 = 4 * q1, _4q2 = 4 * q2, _4q3 = 4 * q3;
    const _8q2 = 8 * q2, _8q3 = 8 * q3;
    const q1q1 = q1 * q1, q2q2 = q2 * q2, q3q3 = q3 * q3, q4q4 = q4 * q4;

    let s1 = _4q1 * q3q3 + _2q3 * ax + _4q1 * q2q2 - _2q2 * ay;
    let s2 = _4q2 * q4q4 - _2q4 * ax + 4 * q1q1 * q2 - _2q1 * ay - _4q2 + _8q2 * q2q2 + _8q2 * q3q3 + _4q2 * az;
    let s3 = 4 * q1q1 * q3 + _2q1 * ax + _4q3 * q4q4 - _2q4 * ay - _4q3 + _8q3 * q2q2 + _8q3 * q3q3 + _4q3 * az;
    let s4 = 4 * q2q2 * q4 - _2q2 * ax + 4 * q3q3 * q4 - _2q3 * ay;

    const sn = Math.hypot(s1, s2, s3, s4) || 1;
    s1 /= sn; s2 /= sn; s3 /= sn; s4 /= sn;

    const qDot1 = 0.5 * (-q2 * gx - q3 * gy - q4 * gz) - this.beta * s1;
    const qDot2 = 0.5 * (q1 * gx + q3 * gz - q4 * gy) - this.beta * s2;
    const qDot3 = 0.5 * (q1 * gy - q2 * gz + q4 * gx) - this.beta * s3;
    const qDot4 = 0.5 * (q1 * gz + q2 * gy - q3 * gx) - this.beta * s4;

    q1 += qDot1 * dt;
    q2 += qDot2 * dt;
    q3 += qDot3 * dt;
    q4 += qDot4 * dt;
    this.q = quatNormalize({ w: q1, x: q2, y: q3, z: q4 });

    // Gravity removal in world frame
    const gBody = this._estimateGravity();
    const lin = {
      x: accel.x - gBody.x * norm,
      y: accel.y - gBody.y * norm,
      z: accel.z - gBody.z * norm,
    };
    this.linearAccel = lin;

    // Drift-corrected integration
    this._smoothVel.x += (lin.x - this._smoothVel.x) * this.smoothing;
    this._smoothVel.y += (lin.y - this._smoothVel.y) * this.smoothing;
    this._smoothVel.z += (lin.z - this._smoothVel.z) * this.smoothing;

    this.velocity.x += this._smoothVel.x * dt;
    this.velocity.y += this._smoothVel.y * dt;
    this.velocity.z += this._smoothVel.z * dt;

    // ZUPT-style drift correction when nearly stationary
    const speed = Math.hypot(this.velocity.x, this.velocity.y, this.velocity.z);
    if (speed < 0.05 && norm > 8) {
      this.velocity.x *= 1 - this.driftCorrection;
      this.velocity.y *= 1 - this.driftCorrection;
      this.velocity.z *= 1 - this.driftCorrection;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;
  }

  /** @returns {import('../utils/math.js').Vec3} */
  _estimateGravity() {
    const q = this.q;
    return {
      x: 2 * (q.x * q.z - q.w * q.y),
      y: 2 * (q.w * q.x + q.y * q.z),
      z: q.w * q.w - q.x * q.x - q.y * q.y + q.z * q.z,
    };
  }

  /** @returns {import('../utils/math.js').Quat} */
  getQuaternion() {
    return { ...this.q };
  }
}

export default MadgwickFilter;
