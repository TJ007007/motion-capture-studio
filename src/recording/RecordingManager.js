/**
 * Recording file management: save, recent files, auto-recovery.
 * @module recording/RecordingManager
 */

import { idbPut, idbGet, idbDelete } from '../utils/idb.js';

const RECENT_KEY = 'mcs_recent_files';
const AUTOSAVE_KEY = 'autosave';
const MAX_RECENT = 12;

/**
 * Manages one active recording with persistence helpers.
 */
export class RecordingManager {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {import('./Recorder.js').Recorder} recorder
   */
  constructor(bus, recorder) {
    this.bus = bus;
    this.recorder = recorder;
    this.currentPath = null;
    this._autosaveTimer = null;
  }

  /** @returns {string[]} */
  getRecent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
      return [];
    }
  }

  /**
   * @param {string} name
   */
  _addRecent(name) {
    const list = this.getRecent().filter((n) => n !== name);
    list.unshift(name);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  }

  /**
   * @param {string} name
   */
  rename(name) {
    this.recorder.metadata.name = name;
    this.recorder.unsaved = true;
    this.bus.emit('recording:renamed', name);
  }

  duplicate() {
    const copy = structuredClone(this.recorder.getRecording());
    copy.metadata.name += ' (Copy)';
    this.recorder.load(copy);
    this.currentPath = null;
    this.recorder.unsaved = true;
    this.bus.emit('recording:duplicated');
  }

  newRecording() {
    if (this.recorder.unsaved && !confirm('Discard unsaved changes?')) return false;
    this.recorder.clear();
    this.currentPath = null;
    return true;
  }

  deleteRecording() {
    if (!confirm('Delete current recording?')) return;
    this.recorder.clear();
    this.currentPath = null;
    idbDelete(AUTOSAVE_KEY);
    this.bus.emit('recording:deleted');
  }

  /**
   * @param {Blob} blob
   * @param {string} filename
   */
  async saveAs(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    this.currentPath = filename;
    this.recorder.unsaved = false;
    this._addRecent(filename);
    this.bus.emit('recording:saved', filename);
  }

  startAutosave(intervalMs = 15000) {
    this.stopAutosave();
    this._autosaveTimer = setInterval(() => this._autosave(), intervalMs);
  }

  stopAutosave() {
    if (this._autosaveTimer) clearInterval(this._autosaveTimer);
  }

  async _autosave() {
    if (!this.recorder.samples.length) return;
    try {
      await idbPut(AUTOSAVE_KEY, this.recorder.getRecording());
      this.bus.emit('recording:autosaved');
    } catch (err) {
      console.warn('Autosave failed', err);
    }
  }

  /** @returns {Promise<Object|null>} */
  async recoverAutosave() {
    return idbGet(AUTOSAVE_KEY);
  }

  async clearAutosave() {
    await idbDelete(AUTOSAVE_KEY);
  }
}

export default RecordingManager;
