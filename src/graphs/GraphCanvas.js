/**
 * Canvas graph renderer for sensor and derived signals.
 * @module graphs/GraphCanvas
 */

/**
 * Single time-series graph with tooltip description.
 */
export class GraphCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string} title
   * @param {string} tooltip
   * @param {string} [color='#00e5ff']
   */
  constructor(canvas, title, tooltip, color = '#00e5ff') {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.title = title;
    this.tooltip = tooltip;
    this.color = color;
    /** @type {Float32Array} */
    this.data = new Float32Array(0);
    this.maxPoints = 512;
    canvas.title = tooltip;
  }

  /**
   * @param {number[]} values
   */
  push(values) {
    const merged = new Float32Array(Math.min(this.maxPoints, this.data.length + values.length));
    const start = Math.max(0, this.data.length + values.length - this.maxPoints);
    const oldStart = Math.max(0, this.data.length - (this.maxPoints - values.length));
    let o = 0;
    for (let i = oldStart; i < this.data.length; i++) merged[o++] = this.data[i];
    for (let i = 0; i < values.length && o < this.maxPoints; i++) merged[o++] = values[i];
    this.data = merged.subarray(0, o);
    this.draw();
  }

  setData(arr) {
    this.data = arr instanceof Float32Array ? arr : Float32Array.from(arr.slice(-this.maxPoints));
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
    ctx.fillStyle = 'rgba(16, 22, 32, 0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8b9cb3';
    ctx.font = '11px system-ui';
    ctx.fillText(this.title, 6, 14);

    if (!this.data.length) return;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < this.data.length; i++) {
      min = Math.min(min, this.data[i]);
      max = Math.max(max, this.data[i]);
    }
    const range = max - min || 1;
    const pad = 20;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    for (let i = 0; i < this.data.length; i++) {
      const x = pad + (i / (this.data.length - 1 || 1)) * (w - pad * 2);
      const y = h - pad - ((this.data[i] - min) / range) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#8b9cb3';
    ctx.fillText(`${max.toFixed(2)}`, w - 48, 14);
    ctx.fillText(`${min.toFixed(2)}`, w - 48, h - 6);
  }
}

export default GraphCanvas;
