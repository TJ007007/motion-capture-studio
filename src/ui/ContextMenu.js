/**
 * Right-click context menus.
 * @module ui/ContextMenu
 */

/**
 * Simple context menu helper.
 */
export class ContextMenu {
  /**
   * @param {HTMLElement} root
   */
  constructor(root) {
    this.root = root;
    this.menu = document.createElement('div');
    this.menu.className = 'context-menu hidden';
    root.appendChild(this.menu);
    document.addEventListener('click', () => this.hide());
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {Array<{ label: string, action: () => void, disabled?: boolean }>} items
   */
  show(x, y, items) {
    this.menu.innerHTML = items.map((it, i) =>
      `<button class="ctx-item" data-i="${i}" ${it.disabled ? 'disabled' : ''}>${it.label}</button>`,
    ).join('');
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;
    this.menu.classList.remove('hidden');
    this.menu.querySelectorAll('.ctx-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = items[Number(btn.dataset.i)];
        if (!item.disabled) item.action();
        this.hide();
      });
    });
  }

  hide() {
    this.menu.classList.add('hidden');
  }
}

export default ContextMenu;
