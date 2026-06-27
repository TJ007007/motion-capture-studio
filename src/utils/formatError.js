/**
 * Format errors and event payloads for user-visible messages.
 * @module utils/formatError
 */

/**
 * @param {unknown} err
 * @returns {string}
 */
export function formatError(err) {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || 'An error occurred';
  if (typeof err === 'object') {
    const o = /** @type {Record<string, unknown>} */ (err);
    if (typeof o.message === 'string' && o.message) {
      return typeof o.code === 'string' ? `${o.message} (${o.code})` : o.message;
    }
    if (o.error instanceof Error) return o.error.message;
    if (typeof o.error === 'string') return o.error;
    if (typeof o.code === 'string') return o.code.replace(/_/g, ' ').toLowerCase();
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export default formatError;
