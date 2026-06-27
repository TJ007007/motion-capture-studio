/**
 * Multi-step sensor calibration wizard.
 * @module calibration/CalibrationWizard
 */

/**
 * Guides users through gravity, drift, and sensor calibration.
 */
export class CalibrationWizard {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.step = 0;
    this.steps = [
      {
        id: 'gravity',
        title: 'Gravity Calibration',
        description: 'Place your device flat on a level surface, screen facing up. This establishes the gravity vector for orientation fusion.',
        when: 'Use before every session or when switching filter modes.',
        improvement: 'Improves tilt accuracy and gravity removal in filtered mode.',
      },
      {
        id: 'drift',
        title: 'Drift Calibration',
        description: 'Keep the device completely still for 5 seconds. The filter learns stationary bias to reduce position drift.',
        when: 'Use after gravity calibration and before recording motion.',
        improvement: 'Reduces velocity drift during slow movements.',
      },
      {
        id: 'sensor',
        title: 'Sensor Calibration',
        description: 'Rotate the device slowly through all axes for 10 seconds. Gyroscope bias is estimated.',
        when: 'Use when you notice rotation drift or after device temperature changes.',
        improvement: 'Improves quaternion stability and rotation tracking.',
      },
    ];
    this._samples = [];
    this._active = false;
    this._timer = null;
    this.results = { gravity: null, drift: null, gyroBias: null };
  }

  get currentStep() {
    return this.steps[this.step];
  }

  open() {
    this.step = 0;
    this._active = true;
    this.bus.emit('calibration:open', this.currentStep);
  }

  close() {
    this._active = false;
    clearTimeout(this._timer);
    this.bus.emit('calibration:close');
  }

  next() {
    if (this.step < this.steps.length - 1) {
      this.step++;
      this.bus.emit('calibration:step', this.currentStep);
    } else {
      this.bus.emit('calibration:complete', this.results);
      this.close();
    }
  }

  prev() {
    if (this.step > 0) {
      this.step--;
      this.bus.emit('calibration:step', this.currentStep);
    }
  }

  /**
   * Start collecting samples for current step.
   * @param {number} durationMs
   */
  startCapture(durationMs = 5000) {
    this._samples = [];
    const onSample = (sample) => this._samples.push(sample);
    this.bus.on('sensor:sample', onSample);
    this._timer = setTimeout(() => {
      this.bus.off('sensor:sample', onSample);
      this._processStep();
      this.next();
    }, durationMs);
    this.bus.emit('calibration:capturing', { step: this.currentStep.id, durationMs });
  }

  _processStep() {
    const id = this.currentStep.id;
    if (!this._samples.length) return;
    if (id === 'gravity') {
      const n = this._samples.length;
      const avg = this._samples.reduce((a, s) => ({
        x: a.x + s.accel.x, y: a.y + s.accel.y, z: a.z + s.accel.z,
      }), { x: 0, y: 0, z: 0 });
      this.results.gravity = { x: avg.x / n, y: avg.y / n, z: avg.z / n };
    } else if (id === 'drift') {
      this.results.drift = { stationary: true, sampleCount: this._samples.length };
    } else if (id === 'sensor') {
      const n = this._samples.length;
      const avg = this._samples.reduce((a, s) => ({
        x: a.x + s.gyro.x, y: a.y + s.gyro.y, z: a.z + s.gyro.z,
      }), { x: 0, y: 0, z: 0 });
      this.results.gyroBias = { x: avg.x / n, y: avg.y / n, z: avg.z / n };
    }
    this.bus.emit('calibration:result', { step: id, results: this.results });
  }
}

export default CalibrationWizard;
