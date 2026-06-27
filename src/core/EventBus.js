/**
 * Central publish/subscribe event dispatcher for decoupled subsystems.
 * @module core/EventBus
 */

/**
 * @typedef {Object} EventBusOptions
 * @property {number} [maxHistory=200] Max command history entries for undo/redo (future).
 */

/**
 * Typed event bus with wildcard support and one-shot listeners.
 */
export class EventBus {
  /** @param {EventBusOptions} [options] */
  constructor(options = {}) {
    /** @private @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @private @type {string[]} */
    this._history = [];
    this._maxHistory = options.maxHistory ?? 200;
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void} Unsubscribe function
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe once.
   * @param {string} event
   * @param {Function} handler
   */
  once(event, handler) {
    const wrap = (...args) => {
      this.off(event, wrap);
      handler(...args);
    };
    this.on(event, wrap);
  }

  /**
   * Unsubscribe handler.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /**
   * Emit event to listeners and wildcard subscribers.
   * @param {string} event
   * @param {*} [payload]
   */
  emit(event, payload) {
    this._history.push(event);
    if (this._history.length > this._maxHistory) this._history.shift();

    const targets = [event, '*'];
    for (const key of targets) {
      const set = this._listeners.get(key);
      if (!set) continue;
      for (const fn of [...set]) {
        try {
          fn(payload, event);
        } catch (err) {
          console.error(`EventBus handler error [${event}]:`, err);
          this.emit('error', { source: 'EventBus', event, error: err });
        }
      }
    }
  }

  /** Clear all listeners. */
  clear() {
    this._listeners.clear();
  }
}

export default EventBus;
