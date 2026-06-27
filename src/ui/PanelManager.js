/**
 * Resizable dockable panel layout manager.
 * @module ui/PanelManager
 */

/**
 * Handles panel resize handles and collapse state.
 */
export class PanelManager {
  constructor() {
    this._initResizers();
  }

  _initResizers() {
    document.querySelectorAll('[data-resize]').forEach((handle) => {
      const target = document.querySelector(handle.dataset.resize);
      if (!target) return;
      let startX = 0, startW = 0;
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startW = target.getBoundingClientRect().width;
        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          const side = handle.dataset.side === 'left' ? 1 : -1;
          target.style.width = `${Math.max(180, startW + dx * side)}px`;
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }
}

export default PanelManager;
