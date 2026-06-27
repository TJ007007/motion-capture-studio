/**
 * Global keyboard shortcuts.
 * @module ui/KeyboardManager
 */

/**
 * @typedef {Object} Shortcut
 * @property {string} key
 * @property {boolean} [ctrl]
 * @property {boolean} [shift]
 * @property {boolean} [alt]
 * @property {() => void} action
 * @property {string} label
 */

/**
 * Registers and handles keyboard shortcuts.
 */
export class KeyboardManager {
  constructor() {
    /** @type {Shortcut[]} */
    this.shortcuts = [];
    document.addEventListener('keydown', (e) => this._onKey(e));
  }

  /**
   * @param {Shortcut[]} list
   */
  register(list) {
    this.shortcuts.push(...list);
  }

  _onKey(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      if (!(e.ctrlKey && e.shiftKey && e.key === 'P')) return;
    }
    for (const s of this.shortcuts) {
      const ctrl = s.ctrl ? e.ctrlKey || e.metaKey : !(e.ctrlKey || e.metaKey);
      const shift = s.shift ? e.shiftKey : !e.shiftKey;
      const alt = s.alt ? e.altKey : !e.altKey;
      if (ctrl && shift && alt && e.key.toLowerCase() === s.key.toLowerCase()) {
        e.preventDefault();
        s.action();
        return;
      }
    }
  }

  /** @returns {Array<{ label: string, key: string }>} */
  listForEditor() {
    return this.shortcuts.map((s) => ({
      label: s.label,
      key: `${s.ctrl ? 'Ctrl+' : ''}${s.shift ? 'Shift+' : ''}${s.alt ? 'Alt+' : ''}${s.key.toUpperCase()}`,
    }));
  }
}

export default KeyboardManager;
