/**
 * Device motion sensor capture with permission handling.
 * @module sensors/SensorManager
 */

/** @typedef {30|60|120} SampleRateHz */

/**
 * Wraps DeviceMotion / DeviceOrientation APIs.
 */
export class SensorManager {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.active = false;
    /** @type {SampleRateHz} */
    this.targetRate = 60;
    this._lastTs = 0;
    this._interval = null;
    this._latest = null;
    this.availability = this._detectAvailability();
  }

  _detectAvailability() {
    const hasMotion = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
    const hasOrient = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return {
      accelerometer: hasMotion,
      gyroscope: hasMotion,
      orientation: hasOrient,
      permissionRequired: isIOS && typeof DeviceMotionEvent?.requestPermission === 'function',
      browser: navigator.userAgent,
      platform: navigator.platform,
    };
  }

  /**
   * Request sensor permissions (iOS).
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    try {
      if (this.availability.permissionRequired) {
        // @ts-ignore
        const r = await DeviceMotionEvent.requestPermission();
        return r === 'granted';
      }
      return this.availability.accelerometer;
    } catch (err) {
      this.bus.emit('error', { code: 'PERMISSION_DENIED', message: 'Sensor permission denied.', error: err });
      return false;
    }
  }

  /**
   * @param {SampleRateHz} rate
   */
  setSampleRate(rate) {
    this.targetRate = rate;
  }

  /**
   * Start capturing sensor data.
   * @returns {Promise<boolean>}
   */
  async start() {
    if (!this.availability.accelerometer) {
      this.bus.emit('error', { code: 'UNSUPPORTED', message: 'Device motion sensors are not available in this browser.' });
      return false;
    }
    const ok = await this.requestPermission();
    if (!ok) return false;

    this._onMotion = this._onMotion.bind(this);
    window.addEventListener('devicemotion', this._onMotion, { passive: true });
    this.active = true;
    this._lastTs = performance.now();
    this.bus.emit('sensors:started');
    return true;
  }

  stop() {
    if (!this.active) return;
    window.removeEventListener('devicemotion', this._onMotion);
    this.active = false;
    this.bus.emit('sensors:stopped');
  }

  /**
   * @param {DeviceMotionEvent} e
   * @private
   */
  _onMotion(e) {
    const now = performance.now();
    const dt = this._lastTs ? (now - this._lastTs) / 1000 : 1 / this.targetRate;
    this._lastTs = now;

    const acc = e.accelerationIncludingGravity ?? e.acceleration;
    const rot = e.rotationRate;
    if (!acc) return;

    const GRAVITY_MS2 = 9.80665;
    const accel = {
      x: (acc.x ?? 0) * GRAVITY_MS2,
      y: (acc.y ?? 0) * GRAVITY_MS2,
      z: (acc.z ?? 0) * GRAVITY_MS2,
    };
    const gyro = {
      x: ((rot?.alpha ?? 0) * Math.PI) / 180,
      y: ((rot?.beta ?? 0) * Math.PI) / 180,
      z: ((rot?.gamma ?? 0) * Math.PI) / 180,
    };

    let orientation = null;
    if (e.absolute && typeof e.alpha === 'number') {
      // Some browsers expose orientation on motion event
    }

    const sample = {
      timestamp: now,
      dt: Math.max(dt, 1e-6),
      accel,
      gyro,
      orientation,
      raw: { accel: { ...accel }, gyro: { ...gyro } },
    };
    this._latest = sample;
    this.bus.emit('sensor:sample', sample);
  }

  /** @returns {Object|null} */
  getLatest() {
    return this._latest;
  }
}

export default SensorManager;
