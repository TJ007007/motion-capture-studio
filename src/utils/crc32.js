/**
 * CRC-32 integrity checking for binary recordings.
 * @module utils/crc32
 */

/** @type {Uint32Array} */
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

/**
 * Compute CRC-32 over byte array.
 * @param {Uint8Array} data
 * @param {number} [seed=0xffffffff]
 * @returns {number}
 */
export function crc32(data, seed = 0xffffffff) {
  let crc = seed;
  for (let i = 0; i < data.length; i++) {
    crc = TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export default crc32;
