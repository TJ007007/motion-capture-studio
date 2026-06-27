/**
 * Recording session data model and capture logic.
 * @module recording/Recorder
 */

const FILE_VERSION = 1;

/**
 * @typedef {Object} MotionSample
 * @property {number} timestamp
 * @property {number} dt
 * @property {{ x: number, y: number, z: number }} accel
 * @property {{ x: number, y: number, z: number }} gyro
 * @property {import('../utils/math.js').Quat|null} [orientation]
 * @property {import('../motion/MotionProcessor.js').ProcessedFrame} [processed]
 */

/**
 * @typedef {Object} RecordingMetadata
 * @property {number} version
 * @property {string} name
 * @property {string} browser
 * @property {string} platform
 * @property {string} deviceModel
 * @property {number} sampleRate
 * @property {number} duration
 * @property {Object} sensorAvailability
 * @property {string} recordedAt
 * @property {string} filterMode
 */

/**
 * Captures and stores motion samples with metadata.
 */
export class Recorder {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    /** @type {MotionSample[]} */
    this.samples = [];
    /** @type {RecordingMetadata} */
    this.metadata = this._defaultMetadata();
    this.recording = false;
    this._startTime = 0;
    this.unsaved = false;
  }

  _defaultMetadata() {
    return {
      version: FILE_VERSION,
      name: 'Untitled Recording',
      browser: navigator.userAgent,
      platform: navigator.platform,
      deviceModel: navigator.userAgentData?.model ?? 'Unknown',
      sampleRate: 60,
      duration: 0,
      sensorAvailability: {},
      recordedAt: new Date().toISOString(),
      filterMode: 'madgwick',
    };
  }

  /**
   * @param {number} rate
   * @param {Object} availability
   * @param {string} filterMode
   */
  start(rate, availability, filterMode) {
    this.samples = [];
    this.metadata = {
      ...this._defaultMetadata(),
      sampleRate: rate,
      sensorAvailability: availability,
      filterMode,
      recordedAt: new Date().toISOString(),
    };
    this.recording = true;
    this._startTime = performance.now();
    this.unsaved = true;
    this.bus.emit('recording:started');
  }

  stop() {
    if (!this.recording) return;
    this.recording = false;
    this.metadata.duration = this.samples.length
      ? this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp
      : 0;
    this.bus.emit('recording:stopped', this.getRecording());
  }

  /**
   * @param {MotionSample} sample
   */
  addSample(sample) {
    if (!this.recording) return;
    this.samples.push(sample);
    this.metadata.duration = sample.timestamp - (this.samples[0]?.timestamp ?? sample.timestamp);
    this.bus.emit('recording:sample', sample);
  }

  /**
   * @returns {{ metadata: RecordingMetadata, samples: MotionSample[] }}
   */
  getRecording() {
    return { metadata: { ...this.metadata }, samples: this.samples };
  }

  /**
   * @param {{ metadata: RecordingMetadata, samples: MotionSample[] }} data
   */
  load(data) {
    this.metadata = { ...data.metadata };
    this.samples = data.samples;
    this.recording = false;
    this.unsaved = false;
    this.bus.emit('recording:loaded', this.getRecording());
  }

  clear() {
    this.samples = [];
    this.metadata = this._defaultMetadata();
    this.recording = false;
    this.unsaved = false;
    this.bus.emit('recording:cleared');
  }

  get duration() {
    return this.metadata.duration;
  }

  get count() {
    return this.samples.length;
  }
}

export default Recorder;
