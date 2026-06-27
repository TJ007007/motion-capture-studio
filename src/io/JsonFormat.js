/**
 * JSON recording format import/export.
 * @module io/JsonFormat
 */

const JSON_MAGIC = 'MCS_JSON';

/**
 * @param {{ metadata: Object, samples: Array }} recording
 * @returns {Blob}
 */
export function exportJson(recording) {
  const payload = {
    magic: JSON_MAGIC,
    ...recording,
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

/**
 * @param {string} text
 * @returns {{ metadata: Object, samples: Array }}
 */
export function importJson(text) {
  const data = JSON.parse(text);
  if (!data.samples || !Array.isArray(data.samples)) {
    throw new Error('Invalid JSON recording: missing samples array.');
  }
  return { metadata: data.metadata ?? {}, samples: data.samples };
}

export default { exportJson, importJson };
