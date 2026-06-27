/**
 * Playback engine with timeline scrubbing and speed control.
 * @module playback/PlaybackEngine
 */

import { sampleAt } from './Interpolation.js';
import { clamp } from '../utils/math.js';

/** @typedef {'stopped'|'playing'|'paused'} PlaybackState */

/**
 * Controls playback of recorded motion data.
 */
export class PlaybackEngine {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    /** @type {PlaybackState} */
    this.state = 'stopped';
    this.speed = 1;
    this.direction = 1;
    /** @type {Array} */
    this.samples = [];
    this.currentTime = 0;
    this._raf = null;
    this._lastWall = 0;
    this.inMarker = 0;
    this.outMarker = Infinity;
    this.fps = 0;
    this._frameCount = 0;
    this._fpsTimer = 0;
  }

  /**
   * @param {Array} samples
   */
  setSamples(samples) {
    this.samples = samples;
    if (samples.length) {
      this.outMarker = samples[samples.length - 1].timestamp - samples[0].timestamp;
    }
    this.currentTime = 0;
    this.state = 'stopped';
  }

  /**
   * @param {number} speed 0.05 - 4
   */
  setSpeed(speed) {
    this.speed = clamp(speed, 0.05, 4);
  }

  play() {
    if (!this.samples.length) return;
    this.state = 'playing';
    this.direction = 1;
    this._lastWall = performance.now();
    this._tick();
    this.bus.emit('playback:play');
  }

  pause() {
    this.state = 'paused';
    if (this._raf) cancelAnimationFrame(this._raf);
    this.bus.emit('playback:pause');
  }

  stop() {
    this.state = 'stopped';
    if (this._raf) cancelAnimationFrame(this._raf);
    this.currentTime = this.inMarker;
    this._emitFrame();
    this.bus.emit('playback:stop');
  }

  reverse() {
    if (this.state === 'playing') {
      this.direction = -1;
    } else {
      this.state = 'playing';
      this.direction = -1;
      this._lastWall = performance.now();
      this._tick();
    }
    this.bus.emit('playback:reverse');
  }

  nextFrame() {
    if (!this.samples.length) return;
    const base = this.samples[0].timestamp;
    const avgDt = this._avgDt();
    this.currentTime = clamp(this.currentTime + avgDt, this.inMarker, this.outMarker);
    this._emitFrame();
  }

  prevFrame() {
    if (!this.samples.length) return;
    const avgDt = this._avgDt();
    this.currentTime = clamp(this.currentTime - avgDt, this.inMarker, this.outMarker);
    this._emitFrame();
  }

  _avgDt() {
    if (this.samples.length < 2) return 1 / 60;
    const span = this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp;
    return span / (this.samples.length - 1);
  }

  /**
   * @param {number} t Relative time ms from start
   */
  seek(t) {
    this.currentTime = clamp(t, this.inMarker, this.outMarker);
    this._emitFrame();
  }

  _tick = () => {
    if (this.state !== 'playing') return;
    const now = performance.now();
    const wallDt = now - this._lastWall;
    this._lastWall = now;
    this.currentTime += wallDt * this.speed * this.direction;

    if (this.currentTime >= this.outMarker) {
      this.currentTime = this.outMarker;
      this.pause();
    } else if (this.currentTime <= this.inMarker) {
      this.currentTime = this.inMarker;
      if (this.direction < 0) this.pause();
    }

    this._emitFrame();
    this._raf = requestAnimationFrame(this._tick);
  };

  _emitFrame() {
    if (!this.samples.length) return;
    const base = this.samples[0].timestamp;
    const absTime = base + this.currentTime;
    const frame = sampleAt(this.samples, absTime);
    this._frameCount++;
    const now = performance.now();
    if (now - this._fpsTimer > 1000) {
      this.fps = this._frameCount;
      this._frameCount = 0;
      this._fpsTimer = now;
    }
    this.bus.emit('playback:frame', {
      time: this.currentTime,
      absTime,
      frame,
      frameIndex: this._frameIndex(),
      state: this.state,
      fps: this.fps,
    });
  }

  _frameIndex() {
    if (!this.samples.length) return 0;
    const base = this.samples[0].timestamp;
    let best = 0, bestD = Infinity;
    const target = base + this.currentTime;
    for (let i = 0; i < this.samples.length; i++) {
      const d = Math.abs(this.samples[i].timestamp - target);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  get duration() {
    if (!this.samples.length) return 0;
    return this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp;
  }
}

export default PlaybackEngine;
