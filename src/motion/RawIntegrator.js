/**
 * Raw acceleration integration with realistic drift.
 * @module motion/RawIntegrator
 */

/**
 * Direct double-integration of accelerometer data.
 */
export class RawIntegrator {
  constructor() {
    /** @type {import('../utils/math.js').Vec3} */
    this.position = { x: 0, y: 0, z: 0 };
    /** @type {import('../utils/math.js').Vec3} */
    this.velocity = { x: 0, y: 0, z: 0 };
    /** @type {import('../utils/math.js').Quat} */
    this.q = { w: 1, x: 0, y: 0, z: 0 };
  }

  reset() {
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.q = { w: 1, x: 0, y: 0, z: 0 };
  }

  /**
   * @param {{ x: number, y: number, z: number }} accel m/s²
   * @param {{ x: number, y: number, z: number }} gyro rad/s
   * @param {number} dt
   * @param {import('../utils/math.js').Quat} [orientation]
   */
  update(accel, gyro, dt, orientation) {
    if (orientation) {
      this.q = { ...orientation };
    } else {
      // Simple gyro integration for orientation
      const gx = gyro.x * dt * 0.5;
      const gy = gyro.y * dt * 0.5;
      const gz = gyro.z * dt * 0.5;
      const q = this.q;
      this.q = {
        w: q.w - q.x * gx - q.y * gy - q.z * gz,
        x: q.w * gx + q.x + q.y * gz - q.z * gy,
        y: q.w * gy - q.x * gz + q.y + q.z * gx,
        z: q.w * gz + q.x * gy - q.y * gx + q.z,
      };
      const len = Math.hypot(this.q.w, this.q.x, this.q.y, this.q.z) || 1;
      this.q.w /= len; this.q.x /= len; this.q.y /= len; this.q.z /= len;
    }

    this.velocity.x += accel.x * dt;
    this.velocity.y += accel.y * dt;
    this.velocity.z += accel.z * dt;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;
  }
}

export default RawIntegrator;
