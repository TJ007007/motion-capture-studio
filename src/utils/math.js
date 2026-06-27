/**
 * Math utilities for motion capture: vectors, quaternions, interpolation.
 * @module utils/math
 */

/** @typedef {{ x: number, y: number, z: number }} Vec3 */
/** @typedef {{ w: number, x: number, y: number, z: number }} Quat */

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const GRAVITY = 9.80665;

/**
 * @param {number} [x]
 * @param {number} [y]
 * @param {number} [z]
 * @returns {Vec3}
 */
export function vec3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {Vec3}
 */
export function vec3Add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * @param {Vec3} a
 * @param {number} s
 * @returns {Vec3}
 */
export function vec3Scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {number}
 */
export function vec3Dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * @param {Vec3} a
 * @returns {number}
 */
export function vec3Length(a) {
  return Math.hypot(a.x, a.y, a.z);
}

/**
 * @param {Vec3} a
 * @returns {Vec3}
 */
export function vec3Normalize(a) {
  const len = vec3Length(a) || 1;
  return vec3Scale(a, 1 / len);
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {Vec3}
 */
export function vec3Sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * @param {number} [w]
 * @param {number} [x]
 * @param {number} [y]
 * @param {number} [z]
 * @returns {Quat}
 */
export function quat(w = 1, x = 0, y = 0, z = 0) {
  return { w, x, y, z };
}

/**
 * @param {Quat} q
 * @returns {Quat}
 */
export function quatNormalize(q) {
  const len = Math.hypot(q.w, q.x, q.y, q.z) || 1;
  return { w: q.w / len, x: q.x / len, y: q.y / len, z: q.z / len };
}

/**
 * Spherical linear interpolation between quaternions.
 * @param {Quat} a
 * @param {Quat} b
 * @param {number} t
 * @returns {Quat}
 */
export function quatSlerp(a, b, t) {
  let dot = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  if (dot < 0) {
    dot = -dot;
    bx = -bx; by = -by; bz = -bz; bw = -bw;
  }
  if (dot > 0.9995) {
    return quatNormalize({
      w: a.w + t * (bw - a.w),
      x: a.x + t * (bx - a.x),
      y: a.y + t * (by - a.y),
      z: a.z + t * (bz - a.z),
    });
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return {
    w: wa * a.w + wb * bw,
    x: wa * a.x + wb * bx,
    y: wa * a.y + wb * by,
    z: wa * a.z + wb * bz,
  };
}

/**
 * Rotate vector by quaternion.
 * @param {Quat} q
 * @param {Vec3} v
 * @returns {Vec3}
 */
export function quatRotateVec(q, v) {
  const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
  const ix = qw * v.x + qy * v.z - qz * v.y;
  const iy = qw * v.y + qz * v.x - qx * v.z;
  const iz = qw * v.z + qx * v.y - qy * v.x;
  const iw = -qx * v.x - qy * v.y - qz * v.z;
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

/**
 * Quaternion to Euler angles (XYZ order) in radians.
 * @param {Quat} q
 * @returns {Vec3}
 */
export function quatToEuler(q) {
  const sinr = 2 * (q.w * q.x + q.y * q.z);
  const cosr = 1 - 2 * (q.x * q.x + q.y * q.y);
  const roll = Math.atan2(sinr, cosr);
  const sinp = 2 * (q.w * q.y - q.z * q.x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);
  const siny = 2 * (q.w * q.z + q.x * q.y);
  const cosy = 1 - 2 * (q.y * q.y + q.z * q.z);
  const yaw = Math.atan2(siny, cosy);
  return { x: roll, y: pitch, z: yaw };
}

/**
 * Linear interpolation.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Catmull-Rom spline interpolation for smooth paths.
 * @param {Vec3} p0
 * @param {Vec3} p1
 * @param {Vec3} p2
 * @param {Vec3} p3
 * @param {number} t
 * @returns {Vec3}
 */
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (i) => ({
    x: 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3),
    y: 0,
    z: 0,
  });
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
}

/**
 * In-place radix-2 Cooley-Tukey FFT (real input).
 * @param {Float32Array} re
 * @param {Float32Array} im
 */
export function fft(re, im) {
  const n = re.length;
  if (n <= 1) return;
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) { j -= m; m >>= 1; }
    j += m;
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k], uIm = im[i + k];
        const vRe = re[i + k + len / 2] * wRe - im[i + k + len / 2] * wIm;
        const vIm = re[i + k + len / 2] * wIm + im[i + k + len / 2] * wRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nwRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nwRe;
      }
    }
  }
}

/**
 * Next power of two >= n.
 * @param {number} n
 * @returns {number}
 */
export function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Clamp value.
 * @param {number} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Format bytes for display.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}
