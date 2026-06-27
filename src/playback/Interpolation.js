/**
 * Sample interpolation utilities for playback.
 * @module playback/Interpolation
 */

import { lerp, quatSlerp } from '../utils/math.js';

/**
 * Find bracketing indices for timestamp.
 * @param {Array<{ timestamp: number }>} samples
 * @param {number} t
 * @returns {{ i0: number, i1: number, alpha: number }}
 */
export function findBracket(samples, t) {
  if (!samples.length) return { i0: 0, i1: 0, alpha: 0 };
  if (t <= samples[0].timestamp) return { i0: 0, i1: 0, alpha: 0 };
  const last = samples.length - 1;
  if (t >= samples[last].timestamp) return { i0: last, i1: last, alpha: 0 };

  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].timestamp <= t) lo = mid;
    else hi = mid;
  }
  const s0 = samples[lo], s1 = samples[hi];
  const span = s1.timestamp - s0.timestamp || 1;
  const alpha = (t - s0.timestamp) / span;
  return { i0: lo, i1: hi, alpha };
}

/**
 * Interpolate between two motion samples.
 * @param {Object} a
 * @param {Object} b
 * @param {number} t
 * @returns {Object}
 */
export function interpolateSamples(a, b, t) {
  const l = (ka, kb) => lerp(a[ka], b[kb], t);
  const lv = (v) => ({
    x: lerp(a[v].x, b[v].x, t),
    y: lerp(a[v].y, b[v].y, t),
    z: lerp(a[v].z, b[v].z, t),
  });

  let orientation = null;
  if (a.orientation && b.orientation) {
    orientation = quatSlerp(a.orientation, b.orientation, t);
  } else if (a.processed?.quaternion && b.processed?.quaternion) {
    orientation = quatSlerp(a.processed.quaternion, b.processed.quaternion, t);
  }

  return {
    timestamp: lerp(a.timestamp, b.timestamp, t),
    dt: lerp(a.dt, b.dt, t),
    accel: lv('accel'),
    gyro: lv('gyro'),
    orientation,
    processed: a.processed && b.processed ? {
      position: {
        x: lerp(a.processed.position.x, b.processed.position.x, t),
        y: lerp(a.processed.position.y, b.processed.position.y, t),
        z: lerp(a.processed.position.z, b.processed.position.z, t),
      },
      velocity: {
        x: lerp(a.processed.velocity.x, b.processed.velocity.x, t),
        y: lerp(a.processed.velocity.y, b.processed.velocity.y, t),
        z: lerp(a.processed.velocity.z, b.processed.velocity.z, t),
      },
      quaternion: orientation ?? quatSlerp(a.processed.quaternion, b.processed.quaternion, t),
      euler: {
        x: lerp(a.processed.euler.x, b.processed.euler.x, t),
        y: lerp(a.processed.euler.y, b.processed.euler.y, t),
        z: lerp(a.processed.euler.z, b.processed.euler.z, t),
      },
      linearAccel: {
        x: lerp(a.processed.linearAccel.x, b.processed.linearAccel.x, t),
        y: lerp(a.processed.linearAccel.y, b.processed.linearAccel.y, t),
        z: lerp(a.processed.linearAccel.z, b.processed.linearAccel.z, t),
      },
      rotationSpeed: lerp(a.processed.rotationSpeed, b.processed.rotationSpeed, t),
      gForce: lerp(a.processed.gForce, b.processed.gForce, t),
      distance: lerp(a.processed.distance, b.processed.distance, t),
    } : null,
  };
}

/**
 * Get interpolated sample at timestamp.
 * @param {Array} samples
 * @param {number} timestamp
 * @returns {Object|null}
 */
export function sampleAt(samples, timestamp) {
  if (!samples.length) return null;
  const { i0, i1, alpha } = findBracket(samples, timestamp);
  if (i0 === i1) return samples[i0];
  return interpolateSamples(samples[i0], samples[i1], alpha);
}

export default { findBracket, interpolateSamples, sampleAt };
