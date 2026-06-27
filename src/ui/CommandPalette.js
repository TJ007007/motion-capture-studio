/**
 * Command palette (Ctrl+Shift+P).
 * @module ui/CommandPalette
 */

/**
 * @typedef {Object} Command
 * @property {string} id
 * @property {string} label
 * @property {string} [category]
 * @property {() => void} action
 * @property {string} [shortcut]
 */

/**
 * Searchable command palette overlay.
 */
export class CommandPalette {
  /**
   * @param {HTMLElement} overlay
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(overlay, bus) {
    this.overlay = overlay;
    this.bus = bus;
    /** @type {Command[]} */
    this.commands = [];
    this.input = overlay.querySelector('.cmd-input');
    this.list = overlay.querySelector('.cmd-list');
    this.visible = false;

    overlay.querySelector('.cmd-close')?.addEventListener('click', () => this.hide());
    this.input?.addEventListener('input', () => this._filter());
    this.input?.addEventListener('keydown', (e) => this._onKey(e));
  }

  /**
   * @param {Command[]} commands
   */
  register(commands) {
    this.commands = commands;
  }

  show() {
    this.visible = true;
    this.overlay.classList.add('visible');
    this.input.value = '';
    this._filter();
    this.input.focus();
  }

  hide() {
    this.visible = false;
    this.overlay.classList.remove('visible');
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  _filter() {
    const q = this.input.value.toLowerCase();
    const matches = this.commands.filter((c) =>
      c.label.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q),
    );
    this.list.innerHTML = matches.map((c, i) =>
      `<button class="cmd-item" data-idx="${i}"><span class="cmd-label">${c.label}</span><span class="cmd-cat">${c.category ?? ''}</span><span class="cmd-key">${c.shortcut ?? ''}</span></button>`,
    ).join('');
    this._matches = matches;
    this.list.querySelectorAll('.cmd-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = this._matches[Number(btn.dataset.idx)];
        cmd?.action();
        this.hide();
      });
    });
  }

  _onKey(e) {
    if (e.key === 'Escape') this.hide();
    if (e.key === 'Enter' && this._matches?.length) {
      this._matches[0].action();
      this.hide();
    }
  }
}

export default CommandPalette;
