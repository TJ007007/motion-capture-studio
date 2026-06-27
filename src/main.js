/**
 * Motion Capture Studio entry point.
 * @module main
 */

import { Application } from './core/Application.js';

const app = new Application();

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await app.init();
  } catch (err) {
    console.error('Failed to start Motion Capture Studio:', err);
    const el = document.getElementById('app');
    if (el) {
      el.innerHTML = `<div class="fatal-error glass"><h1>Startup Error</h1><p>${err.message}</p></div>`;
    }
  }
});

// Developer console hook
if (typeof window !== 'undefined') {
  window.MCS = app;
}

export default app;
