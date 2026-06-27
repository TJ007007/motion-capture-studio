/**
 * Future-ready plugin registration API.
 * @module core/PluginAPI
 */

/**
 * @typedef {Object} PluginDescriptor
 * @property {string} id
 * @property {string} name
 * @property {string} version
 * @property {(app: import('./Application.js').Application) => void} [onRegister]
 * @property {() => void} [onUnregister]
 */

export class PluginAPI {
  constructor() {
    /** @type {Map<string, PluginDescriptor>} */
    this._plugins = new Map();
  }

  /**
   * @param {PluginDescriptor} plugin
   * @param {import('./Application.js').Application} app
   */
  register(plugin, app) {
    if (this._plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }
    this._plugins.set(plugin.id, plugin);
    plugin.onRegister?.(app);
  }

  /**
   * @param {string} id
   */
  unregister(id) {
    const p = this._plugins.get(id);
    p?.onUnregister?.();
    this._plugins.delete(id);
  }

  /** @returns {PluginDescriptor[]} */
  list() {
    return [...this._plugins.values()];
  }
}

export default PluginAPI;
