/**
 * Unified import/export with format auto-detection.
 * @module io/ImportExport
 */

import { exportJson, importJson } from './JsonFormat.js';
import { exportBinary, importBinary } from './BinaryFormat.js';

/**
 * @param {{ metadata: Object, samples: Array }} recording
 * @param {'json'|'binary'} format
 * @returns {Promise<Blob>}
 */
export async function exportRecording(recording, format) {
  if (format === 'binary') return exportBinary(recording);
  return exportJson(recording);
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{ metadata: Object, samples: Array }>}
 */
export async function importRecording(file) {
  const name = file.name?.toLowerCase() ?? '';
  if (name.endsWith('.json')) {
    const text = await file.text();
    return importJson(text);
  }
  if (name.endsWith('.mcs') || name.endsWith('.bin')) {
    return importBinary(await file.arrayBuffer());
  }

  // Auto-detect
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);
  if (buf.byteLength >= 4 && view.getUint32(0, true) === 0x4D435300) {
    return importBinary(buf);
  }
  try {
    return importJson(new TextDecoder().decode(buf));
  } catch {
    throw new Error('Unable to detect file format. Use .json or .mcs files.');
  }
}

/**
 * Suggested filename for export.
 * @param {string} name
 * @param {'json'|'binary'} format
 */
export function suggestFilename(name, format) {
  const safe = name.replace(/[^\w\- ]+/g, '').trim() || 'recording';
  return format === 'binary' ? `${safe}.mcs` : `${safe}.json`;
}

export default { exportRecording, importRecording, suggestFilename };
