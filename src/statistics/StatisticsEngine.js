/**
 * Motion statistics and quality scoring engine.
 * @module statistics/StatisticsEngine
 */

import { formatBytes } from '../utils/math.js';

/**
 * Computes recording and playback statistics.
 */
export class StatisticsEngine {
  constructor() {
    this.stats = this._empty();
  }

  _empty() {
    return {
      duration: 0,
      sampleCount: 0,
      actualSampleRate: 0,
      peakAcceleration: 0,
      peakRotationSpeed: 0,
      peakGForce: 0,
      averageGForce: 0,
      distanceTravelled: 0,
      maxVelocity: 0,
      averageVelocity: 0,
      driftEstimate: 0,
      sensorQualityScore: 0,
      playbackFps: 0,
      memoryUsageEstimate: 0,
      motionQualityScore: 0,
      peakImpacts: 0,
    };
  }

  /**
   * @param {Array} samples
   * @param {number} [playbackFps]
   */
  compute(samples, playbackFps = 0) {
    if (!samples.length) {
      this.stats = this._empty();
      return this.stats;
    }

    let peakAcc = 0, peakRot = 0, peakG = 0, sumG = 0;
    let maxVel = 0, sumVel = 0, velCount = 0;
    let dist = 0;
    let gaps = 0;
    let impacts = 0;
    const duration = samples[samples.length - 1].timestamp - samples[0].timestamp;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const acc = Math.hypot(s.accel.x, s.accel.y, s.accel.z);
      peakAcc = Math.max(peakAcc, acc);
      const rot = Math.hypot(s.gyro.x, s.gyro.y, s.gyro.z);
      peakRot = Math.max(peakRot, rot);
      const g = acc / 9.80665;
      peakG = Math.max(peakG, g);
      sumG += g;
      if (g > 3) impacts++;

      const p = s.processed;
      if (p) {
        const v = Math.hypot(p.velocity.x, p.velocity.y, p.velocity.z);
        maxVel = Math.max(maxVel, v);
        sumVel += v;
        velCount++;
        dist = Math.max(dist, p.distance ?? 0);
      }
      if (i > 0) {
        const expected = 1000 / (samples[0].dt ? 1 / samples[0].dt : 60);
        const actual = samples[i].timestamp - samples[i - 1].timestamp;
        if (actual > expected * 2) gaps++;
      }
    }

    const actualRate = duration > 0 ? (samples.length / duration) * 1000 : 0;
    const mem = samples.length * 200; // rough bytes per sample estimate

    // Drift: distance when device likely stationary at end
    const tail = samples.slice(-Math.min(30, samples.length));
    let drift = 0;
    if (tail.length > 1) {
      const p0 = tail[0].processed?.position, p1 = tail[tail.length - 1].processed?.position;
      if (p0 && p1) drift = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
    }

    const gapPenalty = gaps / samples.length;
    const sensorQuality = Math.max(0, Math.min(100, 100 - gapPenalty * 500 - drift * 10));
    const motionQuality = Math.max(0, Math.min(100, sensorQuality * 0.6 + (peakG < 10 ? 20 : 0) + (actualRate > 25 ? 20 : 0)));

    this.stats = {
      duration,
      sampleCount: samples.length,
      actualSampleRate: actualRate,
      peakAcceleration: peakAcc,
      peakRotationSpeed: peakRot,
      peakGForce: peakG,
      averageGForce: sumG / samples.length,
      distanceTravelled: dist,
      maxVelocity: maxVel,
      averageVelocity: velCount ? sumVel / velCount : 0,
      driftEstimate: drift,
      sensorQualityScore: sensorQuality,
      playbackFps,
      memoryUsageEstimate: mem,
      motionQualityScore: motionQuality,
      peakImpacts: impacts,
    };
    return this.stats;
  }

  /**
   * @returns {Array<{ label: string, value: string }>}
   */
  toDisplayRows() {
    const s = this.stats;
    return [
      { label: 'Duration', value: `${(s.duration / 1000).toFixed(2)} s` },
      { label: 'Samples', value: String(s.sampleCount) },
      { label: 'Sample Rate', value: `${s.actualSampleRate.toFixed(1)} Hz` },
      { label: 'Peak Acceleration', value: `${s.peakAcceleration.toFixed(2)} m/s²` },
      { label: 'Peak Rotation', value: `${s.peakRotationSpeed.toFixed(2)} rad/s` },
      { label: 'Peak G-Force', value: `${s.peakGForce.toFixed(2)} g` },
      { label: 'Average G-Force', value: `${s.averageGForce.toFixed(2)} g` },
      { label: 'Distance', value: `${s.distanceTravelled.toFixed(3)} m` },
      { label: 'Max Velocity', value: `${s.maxVelocity.toFixed(3)} m/s` },
      { label: 'Avg Velocity', value: `${s.averageVelocity.toFixed(3)} m/s` },
      { label: 'Drift Estimate', value: `${s.driftEstimate.toFixed(3)} m` },
      { label: 'Sensor Quality', value: `${s.sensorQualityScore.toFixed(0)} / 100` },
      { label: 'Motion Quality', value: `${s.motionQualityScore.toFixed(0)} / 100` },
      { label: 'Playback FPS', value: String(s.playbackFps) },
      { label: 'Memory Est.', value: formatBytes(s.memoryUsageEstimate) },
      { label: 'Impact Events', value: String(s.peakImpacts) },
    ];
  }
}

export default StatisticsEngine;
