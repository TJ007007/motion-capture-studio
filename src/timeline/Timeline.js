/**
 * Virtualized timeline inspired by professional DAW/NLE tools.
 * @module timeline/Timeline
 */

import { clamp } from '../utils/math.js';

/**
 * Canvas-based timeline with zoom, pan, playhead, in/out markers.
 */
export class Timeline {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(canvas, bus) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bus = bus;
    this.duration = 0;
    this.currentTime = 0;
    this.zoom = 1;
    this.pan = 0;
    this.inMarker = 0;
    this.outMarker = 0;
    this.sampleCount = 0;
    this._dragging = false;
    this._panning = false;
    this._lastX = 0;

    canvas.addEventListener('mousedown', (e) => this._onDown(e));
    canvas.addEventListener('mousemove', (e) => this._onMove(e));
    canvas.addEventListener('mouseup', () => { this._dragging = false; this._panning = false; });
    canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    canvas.addEventListener('dblclick', (e) => this._onDblClick(e));
  }

  /**
   * @param {number} duration ms
   * @param {number} samples
   */
  setData(duration, samples) {
    this.duration = duration;
    this.sampleCount = samples;
    this.outMarker = duration;
    this.draw();
  }

  /**
   * @param {number} t
   */
  setPlayhead(t) {
    this.currentTime = t;
    this.draw();
  }

  _timeToX(t) {
    const w = this.canvas.width;
    const visible = this.duration / this.zoom;
    const start = this.pan;
    return ((t - start) / visible) * w;
  }

  _xToTime(x) {
    const w = this.canvas.width;
    const visible = this.duration / this.zoom;
    const start = this.pan;
    return start + (x / w) * visible;
  }

  _onDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    if (e.button === 1 || e.shiftKey) {
      this._panning = true;
      this._lastX = x;
    } else {
      this._dragging = true;
      const t = clamp(this._xToTime(x), 0, this.duration);
      this.bus.emit('timeline:seek', t);
    }
  }

  _onMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    if (this._panning) {
      const dx = x - this._lastX;
      const visible = this.duration / this.zoom;
      this.pan -= (dx / this.canvas.width) * visible;
      this.pan = clamp(this.pan, 0, Math.max(0, this.duration - visible));
      this._lastX = x;
      this.draw();
    } else if (this._dragging) {
      const t = clamp(this._xToTime(x), 0, this.duration);
      this.bus.emit('timeline:seek', t);
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = clamp(this.zoom * factor, 1, 500);
    this.draw();
  }

  _onDblClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const t = clamp(this._xToTime(x), 0, this.duration);
    if (e.altKey) this.inMarker = t;
    else if (e.ctrlKey) this.outMarker = t;
    else this.bus.emit('timeline:seek', t);
    this.draw();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(10, 14, 20, 0.95)';
    ctx.fillRect(0, 0, w, h);

    const visible = this.duration / this.zoom || 1;
    const tickStep = this._niceStep(visible / 10);

    // Ticks
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
    ctx.fillStyle = '#8b9cb3';
    ctx.font = '10px system-ui';
    const startTick = Math.floor(this.pan / tickStep) * tickStep;
    for (let t = startTick; t < this.pan + visible; t += tickStep) {
      const x = this._timeToX(t);
      if (x < 0 || x > w) continue;
      ctx.beginPath();
      ctx.moveTo(x, h - 18);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.fillText(`${(t / 1000).toFixed(2)}s`, x + 2, h - 4);
    }

    // Waveform proxy — decimated amplitude bars
    if (this.sampleCount > 0) {
      const bars = Math.min(800, Math.floor(w));
      const barW = w / bars;
      ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
      for (let i = 0; i < bars; i++) {
        const t0 = this.pan + (i / bars) * visible;
        const amp = 0.3 + 0.7 * Math.abs(Math.sin(t0 * 0.003 + i * 0.1));
        const bh = amp * (h - 24) * 0.5;
        ctx.fillRect(i * barW, h - 20 - bh, barW - 0.5, bh);
      }
    }

    // In/out markers
    ctx.fillStyle = 'rgba(0, 200, 120, 0.35)';
    ctx.fillRect(this._timeToX(this.inMarker), 0, this._timeToX(this.outMarker) - this._timeToX(this.inMarker), h);
    ctx.strokeStyle = '#00c878';
    ctx.strokeRect(this._timeToX(this.inMarker), 0, this._timeToX(this.outMarker) - this._timeToX(this.inMarker), h);

    // Playhead
    const px = this._timeToX(this.currentTime);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;

    // Frame label
    const frame = Math.round((this.currentTime / (this.duration || 1)) * this.sampleCount);
    ctx.fillStyle = '#e6edf5';
    ctx.fillText(`Frame ${frame} / ${this.sampleCount}`, 8, 14);
    ctx.fillText(`${(this.currentTime / 1000).toFixed(3)}s`, 8, 28);
  }

  _niceStep(rough) {
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / pow;
    const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return nice * pow;
  }
}

export default Timeline;
