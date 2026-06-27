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
    this._latest = null;
    this._onMotion = null;
    this._sampleReceived = false;
    this._watchdog = null;
    this.availability = this._detectAvailability();
  }

  _detectAvailability() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/i.test(ua);
    const hasMotion = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
    const hasOrient = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    const hasRequestMotion = typeof DeviceMotionEvent?.requestPermission === 'function';
    const hasRequestOrient = typeof DeviceOrientationEvent?.requestPermission === 'function';
    const secure = typeof window !== 'undefined' && window.isSecureContext;

    return {
      accelerometer: hasMotion,
      gyroscope: hasMotion,
      orientation: hasOrient,
      permissionRequired: isIOS && (hasRequestMotion || hasRequestOrient),
      needsMobileEnable: isAndroid || isIOS,
      isAndroid,
      isIOS,
      hasRequestMotion,
      hasRequestOrient,
      secure,
      browser: ua,
      platform: navigator.platform,
    };
  }

  /**
   * Query Permissions API where supported (Chrome Android).
   * @private
   */
  async _querySensorPermissions() {
    if (!navigator.permissions?.query) return { accelerometer: 'unknown', gyroscope: 'unknown' };
    const states = {};
    for (const name of ['accelerometer', 'gyroscope']) {
      try {
        // @ts-ignore — sensor permission names are not in all TS libs
        const result = await navigator.permissions.query({ name });
        states[name] = result.state;
      } catch {
        states[name] = 'unknown';
      }
    }
    return states;
  }

  /**
   * Request sensor permissions (iOS explicit prompt; Android primes listeners).
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    try {
      if (!this.availability.secure) {
        this.bus.emit('error', {
          code: 'INSECURE_CONTEXT',
          message: 'Motion sensors require HTTPS. Open this app via https:// or localhost.',
        });
        return false;
      }

      if (!this.availability.accelerometer) {
        this.bus.emit('error', {
          code: 'UNSUPPORTED',
          message: 'Device motion sensors are not available in this browser.',
        });
        return false;
      }

      // iOS 13+ explicit permission dialog
      if (this.availability.hasRequestMotion) {
        // @ts-ignore
        const motion = await DeviceMotionEvent.requestPermission();
        if (motion !== 'granted') {
          this.bus.emit('error', {
            code: 'PERMISSION_DENIED',
            message: 'Motion sensor permission was denied. Enable Motion & Orientation Access in Settings → Safari/Chrome.',
          });
          return false;
        }
      }

      if (this.availability.hasRequestOrient) {
        try {
          // @ts-ignore
          const orient = await DeviceOrientationEvent.requestPermission();
          if (orient !== 'granted') {
            this.bus.emit('error', {
              code: 'PERMISSION_DENIED',
              message: 'Orientation sensor permission was denied.',
            });
            return false;
          }
        } catch {
          // Optional on some devices
        }
      }

      if (this._sensorsPrimed) return true;

      const perm = await this._querySensorPermissions();
      if (perm.accelerometer === 'denied' || perm.gyroscope === 'denied') {
        this.bus.emit('error', {
          code: 'PERMISSION_DENIED',
          message: 'Sensor access is blocked. In Chrome: Site settings → Motion sensors → Allow.',
        });
        return false;
      }

      // Prime Android/Chrome — permission is granted when events flow after a user gesture
      const primed = await this._primeSensorAccess();
      if (primed) this._sensorsPrimed = true;
      return primed;
    } catch (err) {
      this.bus.emit('error', {
        code: 'PERMISSION_DENIED',
        message: err instanceof Error ? err.message : 'Sensor permission request failed.',
        error: err,
      });
      return false;
    }
  }

  /**
   * Wait briefly for a real motion event after user gesture (Android Chrome).
   * @returns {Promise<boolean>}
   * @private
   */
  _primeSensorAccess() {
    return new Promise((resolve) => {
      let resolved = false;
      const finish = (ok) => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener('devicemotion', onMotion);
        clearTimeout(timer);
        resolve(ok);
      };

      const onMotion = (e) => {
        const acc = e.accelerationIncludingGravity ?? e.acceleration;
        if (acc && (acc.x != null || acc.y != null || acc.z != null)) {
          finish(true);
        }
      };

      window.addEventListener('devicemotion', onMotion, { passive: true });
      const timer = setTimeout(() => finish(false), 2500);
    });
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
      this.bus.emit('error', {
        code: 'UNSUPPORTED',
        message: 'Device motion sensors are not available. Try Chrome on Android, or import a recording on desktop.',
      });
      return false;
    }

    const ok = await this.requestPermission();
    if (!ok) {
      this.bus.emit('error', {
        code: 'SENSOR_NOT_READY',
        message: this.availability.isAndroid
          ? 'Could not access motion sensors. Tap Record again, allow sensor access if prompted, and move the phone slightly.'
          : 'Could not access motion sensors. Check browser permissions and try again.',
      });
      return false;
    }

    this._sampleReceived = false;
    this._onMotion = this._onMotionHandler.bind(this);
    window.addEventListener('devicemotion', this._onMotion, { passive: true });
    this.active = true;
    this._lastTs = performance.now();
    this._startWatchdog();
    this.bus.emit('sensors:started');
    return true;
  }

  _startWatchdog() {
    clearTimeout(this._watchdog);
    this._watchdog = setTimeout(() => {
      if (this.active && !this._sampleReceived) {
        this.bus.emit('error', {
          code: 'NO_SENSOR_DATA',
          message: 'No motion data received. On Android Chrome: tap the lock icon → Site settings → Motion sensors → Allow, then try Record again.',
        });
      }
    }, 3000);
  }

  stop() {
    if (!this.active) return;
    window.removeEventListener('devicemotion', this._onMotion);
    this.active = false;
    clearTimeout(this._watchdog);
    this.bus.emit('sensors:stopped');
  }

  /**
   * @param {DeviceMotionEvent} e
   * @private
   */
  _onMotionHandler(e) {
    const now = performance.now();
    const dt = this._lastTs ? (now - this._lastTs) / 1000 : 1 / this.targetRate;
    this._lastTs = now;

    const acc = e.accelerationIncludingGravity ?? e.acceleration;
    const rot = e.rotationRate;

    if (!acc || (acc.x == null && acc.y == null && acc.z == null)) {
      return;
    }

    this._sampleReceived = true;

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

    const sample = {
      timestamp: now,
      dt: Math.max(dt, 1e-6),
      accel,
      gyro,
      orientation: null,
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
