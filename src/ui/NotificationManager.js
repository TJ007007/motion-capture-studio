/**
 * Toast notification system.
 * @module ui/NotificationManager
 */

/**
 * Displays transient toast messages.
 */
export class NotificationManager {
  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.container = container;
  }

  /**
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'} [type]
   * @param {number} [duration=4000]
   */
  show(message, type = 'info', duration = 4000) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    this.container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
}

export default NotificationManager;
