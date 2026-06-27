/**
 * Persistent application settings via localStorage with CSS variable theming.
 * @module settings/SettingsManager
 */

/** @typedef {Object} AppSettings */
/** @typedef {'dark'|'light'} ThemeName */
/** @typedef {'line'|'ribbon'|'heatmap'|'ghost'} TrailMode */
/** @typedef {'orbit'|'free'|'follow'} CameraMode */
/** @typedef {'raw'|'madgwick'} FilterMode */
/** @typedef {'ms2'|'g'} AccelUnits */

const STORAGE_KEY = 'mcs_settings_v1';

/** @type {AppSettings} */
const DEFAULTS = {
  theme: 'dark',
  gridVisible: true,
  shadowsEnabled: true,
  bloomEnabled: true,
  trailMode: 'line',
  phoneWireframe: false,
  playbackSpeed: 1,
  sampleRate: 60,
  cameraMode: 'orbit',
  motionSmoothing: 0.15,
  filterMode: 'madgwick',
  accelUnits: 'ms2',
  graphVisibility: {
    accelX: true, accelY: true, accelZ: true,
    gyroX: true, gyroY: true, gyroZ: true,
    velocity: true, position: true, distance: true,
    rotationSpeed: true, gForce: true, fft: true,
  },
  panelLayout: {},
  shortcuts: {},
  autoFollowSmoothing: 0.08,
  highDpi: true,
};

export class SettingsManager {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    /** @type {AppSettings} */
    this.settings = this._load();
    this._applyTheme();
  }

  /** @returns {AppSettings} */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULTS);
      return { ...structuredClone(DEFAULTS), ...JSON.parse(raw) };
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  /** Persist settings. */
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    this.bus.emit('settings:changed', this.settings);
  }

  /**
   * @template {keyof AppSettings} K
   * @param {K} key
   * @returns {AppSettings[K]}
   */
  get(key) {
    return this.settings[key];
  }

  /**
   * @template {keyof AppSettings} K
   * @param {K} key
   * @param {AppSettings[K]} value
   */
  set(key, value) {
    this.settings[key] = value;
    if (key === 'theme') this._applyTheme();
    this.save();
  }

  /** Apply CSS custom properties for active theme. */
  _applyTheme() {
    const root = document.documentElement;
    const dark = this.settings.theme !== 'light';
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.setProperty('--accent', '#00e5ff');
    root.style.setProperty('--accent-dim', '#00b8cc');
    root.style.setProperty('--bg-deep', dark ? '#0a0e14' : '#e8ecf0');
    root.style.setProperty('--bg-panel', dark ? 'rgba(16, 22, 32, 0.72)' : 'rgba(255,255,255,0.85)');
    root.style.setProperty('--text', dark ? '#e6edf5' : '#1a2332');
    root.style.setProperty('--text-muted', dark ? '#8b9cb3' : '#5a6a7a');
    root.style.setProperty('--border', dark ? 'rgba(0, 229, 255, 0.18)' : 'rgba(0, 120, 140, 0.2)');
    root.style.setProperty('--glow', dark ? '0 0 24px rgba(0, 229, 255, 0.35)' : 'none');
  }

  reset() {
    this.settings = structuredClone(DEFAULTS);
    this._applyTheme();
    this.save();
  }
}

export default SettingsManager;
