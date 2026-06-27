/**
 * Compressed binary recording format with CRC and chunk structure.
 * @module io/BinaryFormat
 */

import { crc32 } from '../utils/crc32.js';

const MAGIC = 0x4D435300; // 'MCS\0'
const VERSION = 1;
const CHUNK_META = 0x4D455441; // 'META'
const CHUNK_DATA = 0x44415441; // 'DATA'

/**
 * Encode recording to compressed binary blob.
 * @param {{ metadata: Object, samples: Array }} recording
 * @returns {Promise<Blob>}
 */
export async function exportBinary(recording) {
  const metaBytes = new TextEncoder().encode(JSON.stringify(recording.metadata));
  const n = recording.samples.length;
  const dataSize = n * 16 * 4; // 16 floats per sample
  const buf = new ArrayBuffer(32 + metaBytes.length + 12 + dataSize + 4);
  const view = new DataView(buf);
  let off = 0;

  view.setUint32(off, MAGIC, true); off += 4;
  view.setUint16(off, VERSION, true); off += 2;
  view.setUint16(off, 0, true); off += 2; // flags — reserved for gzip/LZ4
  view.setUint32(off, n, true); off += 4;
  view.setFloat64(off, recording.samples[0]?.timestamp ?? 0, true); off += 8;

  // META chunk
  view.setUint32(off, CHUNK_META, true); off += 4;
  view.setUint32(off, metaBytes.length, true); off += 4;
  new Uint8Array(buf, off, metaBytes.length).set(metaBytes);
  off += metaBytes.length;

  // DATA chunk — packed floats: ts, dt, ax,ay,az, gx,gy,gz, qw,qx,qy,qz, px,py,pz, dist
  view.setUint32(off, CHUNK_DATA, true); off += 4;
  view.setUint32(off, dataSize, true); off += 4;
  for (let i = 0; i < n; i++) {
    const s = recording.samples[i];
    const p = s.processed;
    view.setFloat32(off, s.timestamp, true); off += 4;
    view.setFloat32(off, s.dt, true); off += 4;
    view.setFloat32(off, s.accel.x, true); off += 4;
    view.setFloat32(off, s.accel.y, true); off += 4;
    view.setFloat32(off, s.accel.z, true); off += 4;
    view.setFloat32(off, s.gyro.x, true); off += 4;
    view.setFloat32(off, s.gyro.y, true); off += 4;
    view.setFloat32(off, s.gyro.z, true); off += 4;
    const q = p?.quaternion ?? { w: 1, x: 0, y: 0, z: 0 };
    view.setFloat32(off, q.w, true); off += 4;
    view.setFloat32(off, q.x, true); off += 4;
    view.setFloat32(off, q.y, true); off += 4;
    view.setFloat32(off, q.z, true); off += 4;
    const pos = p?.position ?? { x: 0, y: 0, z: 0 };
    view.setFloat32(off, pos.x, true); off += 4;
    view.setFloat32(off, pos.y, true); off += 4;
    view.setFloat32(off, pos.z, true); off += 4;
    view.setFloat32(off, p?.distance ?? 0, true); off += 4;
  }

  const body = new Uint8Array(buf, 0, off);
  const checksum = crc32(body);
  const finalBuf = new ArrayBuffer(off + 4);
  new Uint8Array(finalBuf).set(body);
  new DataView(finalBuf).setUint32(off, checksum, true);

  return new Blob([finalBuf], { type: 'application/octet-stream' });
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{ metadata: Object, samples: Array }>}
 */
export async function importBinary(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20) throw new Error('File too small to be a valid MCS binary recording.');

  const magic = view.getUint32(0, true);
  if (magic !== MAGIC) throw new Error('Unknown binary format (invalid magic).');

  const version = view.getUint16(4, true);
  if (version > VERSION) throw new Error(`Unsupported binary version: ${version}`);

  const checksumStored = view.getUint32(buffer.byteLength - 4, true);
  const body = new Uint8Array(buffer, 0, buffer.byteLength - 4);
  if (crc32(body) !== checksumStored) throw new Error('Corrupt file: CRC mismatch.');

  const sampleCount = view.getUint32(8, true);
  let off = 20;
  let metadata = {};

  while (off < buffer.byteLength - 4) {
    const chunkId = view.getUint32(off, true); off += 4;
    const chunkLen = view.getUint32(off, true); off += 4;
    if (chunkId === CHUNK_META) {
      metadata = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, off, chunkLen)));
      off += chunkLen;
    } else if (chunkId === CHUNK_DATA) {
      const samples = [];
      const floatsPer = 16;
      for (let i = 0; i < sampleCount; i++) {
        const base = off + i * floatsPer * 4;
        const ts = view.getFloat32(base, true);
        const dt = view.getFloat32(base + 4, true);
        const accel = { x: view.getFloat32(base + 8, true), y: view.getFloat32(base + 12, true), z: view.getFloat32(base + 16, true) };
        const gyro = { x: view.getFloat32(base + 20, true), y: view.getFloat32(base + 24, true), z: view.getFloat32(base + 28, true) };
        const q = { w: view.getFloat32(base + 32, true), x: view.getFloat32(base + 36, true), y: view.getFloat32(base + 40, true), z: view.getFloat32(base + 44, true) };
        const pos = { x: view.getFloat32(base + 48, true), y: view.getFloat32(base + 52, true), z: view.getFloat32(base + 56, true) };
        const dist = view.getFloat32(base + 60, true);
        samples.push({
          timestamp: ts, dt, accel, gyro,
          processed: { position: pos, quaternion: q, distance: dist, velocity: { x: 0, y: 0, z: 0 }, euler: { x: 0, y: 0, z: 0 }, linearAccel: accel, rotationSpeed: 0, gForce: 0 },
        });
      }
      return { metadata, samples };
    } else {
      off += chunkLen;
    }
  }
  throw new Error('Invalid binary file: missing DATA chunk.');
}

export default { exportBinary, importBinary };
