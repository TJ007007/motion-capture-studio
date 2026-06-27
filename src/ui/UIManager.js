/**
 * Main UI shell: panels, controls, menus, overlays.
 * @module ui/UIManager
 */

import { NotificationManager } from './NotificationManager.js';
import { CommandPalette } from './CommandPalette.js';
import { PanelManager } from './PanelManager.js';
import { KeyboardManager } from './KeyboardManager.js';
import { ContextMenu } from './ContextMenu.js';
import { GraphManager } from '../graphs/GraphManager.js';
import { Timeline } from '../timeline/Timeline.js';
import { StatisticsEngine } from '../statistics/StatisticsEngine.js';
import { CalibrationWizard } from '../calibration/CalibrationWizard.js';
import { formatError } from '../utils/formatError.js';

/**
 * Builds and wires the application UI.
 */
export class UIManager {
  /**
   * @param {import('../core/Application.js').Application} app
   */
  constructor(app) {
    this.app = app;
    this.bus = app.bus;
    this.root = document.getElementById('app');
    if (!this.root) throw new Error('App container #app not found.');
    this.viewportEl = null;
    this._buildShell();
    this.notify = new NotificationManager(document.getElementById('toasts'));
    this.palette = new CommandPalette(document.getElementById('cmd-palette'), this.bus);
    this.panels = new PanelManager();
    this.keyboard = new KeyboardManager();
    this.context = new ContextMenu(this.root);
    this.graphs = new GraphManager(document.getElementById('graph-panel'), this.bus);
    this.timeline = new Timeline(document.getElementById('timeline-canvas'), this.bus);
    this.stats = new StatisticsEngine();
    this.calibration = new CalibrationWizard(this.bus);

    this._wireEvents();
    this._registerCommands();
    this._registerShortcuts();
    this._setupDropZone();
    this._setupMobileSensorBanner();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _buildShell() {
    this.root.innerHTML = `
      <header class="menubar glass">
        <div class="logo">Motion Capture Studio</div>
        <nav class="menu">
          <button data-menu="file">File</button>
          <button data-menu="edit">Edit</button>
          <button data-menu="view">View</button>
          <button data-menu="record">Record</button>
          <button data-menu="playback">Playback</button>
          <button data-menu="tools">Tools</button>
          <button data-menu="help">Help</button>
        </nav>
        <span class="unsaved-indicator hidden" id="unsaved">● Unsaved</span>
      </header>
      <div class="toolbar glass" id="toolbar">
        <button class="tb-btn" data-action="new" title="New recording">New</button>
        <button class="tb-btn" data-action="open" title="Open file">Open</button>
        <button class="tb-btn" data-action="save" title="Save">Save</button>
        <span class="tb-sep"></span>
        <button class="tb-btn accent" data-action="record" title="Start/Stop recording">⏺ Record</button>
        <select id="sample-rate" title="Sample rate">
          <option value="30">30 Hz</option>
          <option value="60" selected>60 Hz</option>
          <option value="120">120 Hz</option>
        </select>
        <span class="tb-sep"></span>
        <button class="tb-btn" data-action="play">▶</button>
        <button class="tb-btn" data-action="pause">⏸</button>
        <button class="tb-btn" data-action="stop">⏹</button>
        <button class="tb-btn" data-action="reverse">◀</button>
        <button class="tb-btn" data-action="prev-frame">⏮</button>
        <button class="tb-btn" data-action="next-frame">⏭</button>
        <label class="tb-label">Speed <input type="range" id="playback-speed" min="0.05" max="4" step="0.05" value="1"></label>
        <span id="speed-label">1.00×</span>
      </div>
      <main class="workspace">
        <aside class="panel left glass" id="file-panel">
          <h3>File</h3>
          <div class="panel-body" id="file-list"></div>
          <div class="resize-handle" data-resize="#file-panel" data-side="left"></div>
        </aside>
        <section class="viewport-wrap">
          <div id="mcs-viewport"></div>
          <div class="viewport-overlay">
            <select id="camera-mode" title="Camera mode">
              <option value="orbit">Orbit</option>
              <option value="free">Free</option>
              <option value="follow">Auto Follow</option>
            </select>
            <select id="trail-mode">
              <option value="line">Line Trail</option>
              <option value="ribbon">Ribbon</option>
              <option value="heatmap">Heat Map</option>
              <option value="ghost">Ghost Phones</option>
            </select>
            <button class="tb-btn" data-action="reset-camera">Reset Camera</button>
            <button class="tb-btn" data-action="screenshot">Screenshot</button>
          </div>
        </section>
        <aside class="panel right glass" id="side-panel">
          <div class="tabs">
            <button class="tab active" data-tab="stats">Statistics</button>
            <button class="tab" data-tab="graphs">Graphs</button>
            <button class="tab" data-tab="settings">Settings</button>
            <button class="tab" data-tab="debug">Debug</button>
          </div>
          <div class="tab-panel active" id="tab-stats"><div id="stats-panel" class="stats-grid"></div></div>
          <div class="tab-panel" id="tab-graphs"><div id="graph-panel" class="graph-grid"></div></div>
          <div class="tab-panel" id="tab-settings"><div id="settings-panel" class="settings-form"></div></div>
          <div class="tab-panel" id="tab-debug"><pre id="debug-panel" class="debug-pre"></pre></div>
          <div class="resize-handle right" data-resize="#side-panel" data-side="right"></div>
        </aside>
      </main>
      <footer class="timeline-bar glass">
        <canvas id="timeline-canvas"></canvas>
      </footer>
      <footer class="statusbar glass">
        <span id="status-left">Ready</span>
        <span id="status-center"></span>
        <span id="status-right">FPS — | Samples —</span>
      </footer>
      <div id="loading" class="loading-overlay hidden"><div class="spinner"></div><p>Loading…</p></div>
      <div id="sensor-banner" class="sensor-banner glass hidden">
        <p><strong>Motion sensors required</strong> — Tap Enable, then allow sensor access when prompted.</p>
        <button class="tb-btn accent" type="button" data-action="enable-sensors">Enable Sensors</button>
      </div>
      <input type="file" id="file-input" accept=".json,.mcs,.bin" hidden>
    `;

    this.viewportEl = document.getElementById('mcs-viewport');
    if (!this.viewportEl) throw new Error('3D viewport element was not created.');

    document.getElementById('cmd-palette')?.remove();
    const palette = document.createElement('div');
    palette.id = 'cmd-palette';
    palette.className = 'cmd-palette';
    palette.innerHTML = `<div class="cmd-box glass"><input class="cmd-input" placeholder="Type a command…"><button class="cmd-close">×</button><div class="cmd-list"></div></div>`;
    this.root.appendChild(palette);

    this._buildSettingsForm();
    this._buildFilePanel();
  }

  _buildSettingsForm() {
    const el = document.getElementById('settings-panel');
    el.innerHTML = `
      <label>Filter Mode <select id="set-filter"><option value="madgwick">Madgwick (Filtered)</option><option value="raw">Raw Integration</option></select></label>
      <label>Theme <select id="set-theme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
      <label><input type="checkbox" id="set-grid" checked> Show Grid</label>
      <label><input type="checkbox" id="set-shadows" checked> Shadows</label>
      <label><input type="checkbox" id="set-bloom" checked> Bloom</label>
      <label><input type="checkbox" id="set-wireframe"> Phone Wireframe</label>
      <label>Motion Smoothing <input type="range" id="set-smoothing" min="0" max="1" step="0.01" value="0.15"></label>
      <label>Units <select id="set-units"><option value="ms2">m/s²</option><option value="g">g</option></select></label>
      <button class="tb-btn" id="set-reset">Reset Settings</button>
      <button class="tb-btn" id="set-calibrate">Calibration Wizard…</button>
    `;
  }

  _buildFilePanel() {
    const el = document.getElementById('file-list');
    el.innerHTML = `
      <button class="tb-btn block" data-action="new">New</button>
      <button class="tb-btn block" data-action="open">Open…</button>
      <button class="tb-btn block" data-action="save">Save</button>
      <button class="tb-btn block" data-action="save-as">Save As…</button>
      <button class="tb-btn block" data-action="duplicate">Duplicate</button>
      <button class="tb-btn block" data-action="rename">Rename</button>
      <button class="tb-btn block" data-action="delete">Delete</button>
      <h4>Recent</h4>
      <ul id="recent-list" class="recent-list"></ul>
      <h4>Export Format</h4>
      <select id="export-format"><option value="json">JSON</option><option value="binary">Binary (.mcs)</option></select>
    `;
  }

  _wireEvents() {
    const { bus, app } = this;

    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      this._handleAction(btn.dataset.action);
    });

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
        this.resize();
      });
    });

    document.getElementById('sample-rate')?.addEventListener('change', (e) => {
      const rate = Number(e.target.value);
      app.settings.set('sampleRate', rate);
      app.sensors.setSampleRate(rate);
    });

    document.getElementById('playback-speed')?.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      document.getElementById('speed-label').textContent = `${v.toFixed(2)}×`;
      app.playback.setSpeed(v);
      app.settings.set('playbackSpeed', v);
    });

    document.getElementById('camera-mode')?.addEventListener('change', (e) => {
      app.settings.set('cameraMode', e.target.value);
      app.renderer.applySettings({ cameraMode: e.target.value });
    });

    document.getElementById('trail-mode')?.addEventListener('change', (e) => {
      app.settings.set('trailMode', e.target.value);
      app.renderer.applySettings({ trailMode: e.target.value });
    });

    document.getElementById('set-filter')?.addEventListener('change', (e) => {
      app.motion.setFilter(e.target.value);
      app.settings.set('filterMode', e.target.value);
    });

    document.getElementById('set-theme')?.addEventListener('change', (e) => app.settings.set('theme', e.target.value));
    document.getElementById('set-grid')?.addEventListener('change', (e) => {
      app.settings.set('gridVisible', e.target.checked);
      app.renderer.applySettings({ gridVisible: e.target.checked });
    });
    document.getElementById('set-shadows')?.addEventListener('change', (e) => {
      app.settings.set('shadowsEnabled', e.target.checked);
      app.renderer.applySettings({ shadowsEnabled: e.target.checked });
    });
    document.getElementById('set-wireframe')?.addEventListener('change', (e) => {
      app.settings.set('phoneWireframe', e.target.checked);
      app.renderer.applySettings({ phoneWireframe: e.target.checked });
    });
    document.getElementById('set-smoothing')?.addEventListener('input', (e) => {
      app.settings.set('motionSmoothing', Number(e.target.value));
      app.motion.setSmoothing(Number(e.target.value));
    });
    document.getElementById('set-reset')?.addEventListener('click', () => app.settings.reset());
    document.getElementById('set-calibrate')?.addEventListener('click', () => this._showCalibration());

    document.getElementById('file-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) await this._importFile(file);
      e.target.value = '';
    });

    bus.on('sensor:sample', (sample) => this._onLiveSample(sample));
    bus.on('recording:sample', () => this._refreshUnsaved());
    bus.on('playback:frame', (f) => this._onPlaybackFrame(f));
    bus.on('timeline:seek', (t) => app.playback.seek(t));
    bus.on('recording:loaded', () => this._onRecordingLoaded());
    bus.on('renderer:stats', (s) => this._updateStatus(s));
    bus.on('error', (err) => this.notify.show(formatError(err), 'error', 8000));
    bus.on('calibration:open', (step) => this._showCalibration(step));
  }

  async _handleAction(action) {
    const { app } = this;
    switch (action) {
      case 'new': app.fileManager.newRecording(); break;
      case 'open': document.getElementById('file-input')?.click(); break;
      case 'save': await this._save(false); break;
      case 'save-as': await this._save(true); break;
      case 'duplicate': app.fileManager.duplicate(); break;
      case 'rename': {
        const name = prompt('Recording name:', app.recorder.metadata.name);
        if (name) app.fileManager.rename(name);
        break;
      }
      case 'delete': app.fileManager.deleteRecording(); break;
      case 'record': await app.toggleRecording(); break;
      case 'play': app.playback.play(); break;
      case 'pause': app.playback.pause(); break;
      case 'stop': app.playback.stop(); break;
      case 'reverse': app.playback.reverse(); break;
      case 'prev-frame': app.playback.prevFrame(); break;
      case 'next-frame': app.playback.nextFrame(); break;
      case 'reset-camera': app.renderer.cameraCtrl.reset(); break;
      case 'screenshot': this._screenshot(); break;
      case 'enable-sensors': this._enableSensors(); break;
      default: break;
    }
  }

  async _save(saveAs) {
    const format = document.getElementById('export-format')?.value === 'binary' ? 'binary' : 'json';
    const recording = this.app.recorder.getRecording();
    const blob = await exportRecording(recording, format);
    const name = suggestFilename(recording.metadata.name, format);
    await this.app.fileManager.saveAs(blob, name);
    this.notify.show('Recording saved.', 'success');
  }

  async _importFile(file) {
    this.showLoading(true);
    try {
      const data = await importRecording(file);
      this.app.loadRecording(data);
      this.notify.show(`Loaded ${file.name}`, 'success');
    } catch (err) {
      this.notify.show(err.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  _setupMobileSensorBanner() {
    const banner = document.getElementById('sensor-banner');
    const av = this.app.sensors.availability;
    if (!banner || !av.needsMobileEnable || !av.accelerometer) return;
    banner.classList.remove('hidden');
  }

  async _enableSensors() {
    const banner = document.getElementById('sensor-banner');
    const ok = await this.app.sensors.requestPermission();
    if (ok) {
      banner?.classList.add('hidden');
      this.notify.show('Motion sensors enabled. Tap Record to start capturing.', 'success', 5000);
    }
  }

  _setupDropZone() {
    const zone = this.root;
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file) await this._importFile(file);
    });
  }

  _onLiveSample(sample) {
    const processed = this.app.motion.process(sample);
    const enriched = { ...sample, processed };
    if (this.app.recorder.recording) {
      this.app.recorder.addSample(enriched);
    }
    this.graphs.updateLive(enriched);
    this._updateDebug(enriched, processed);
    if (processed.position && processed.quaternion) {
      this.app.renderer.updatePhone(processed.position, processed.quaternion);
    }
    this._updateTrail();
  }

  _onPlaybackFrame({ time, frame, fps }) {
    this.timeline.setPlayhead(time);
    if (!frame) return;
    const p = frame.processed;
    if (p?.position && p?.quaternion) {
      this.app.renderer.updatePhone(p.position, p.quaternion);
    }
    this.graphs.updateLive(frame);
    this._updateDebug(frame, p);
    this._updateTrail(Math.floor(time / (this.app.playback.duration || 1) * this.app.recorder.count));
    const stats = this.stats.compute(this.app.recorder.samples, fps);
    this._renderStats(stats);
  }

  _onRecordingLoaded() {
    const { recorder, playback } = this.app;
    playback.setSamples(recorder.samples);
    this.timeline.setData(recorder.metadata.duration, recorder.count);
    const stats = this.stats.compute(recorder.samples);
    this._renderStats(stats);
    this._updateTrail();
    this._refreshRecent();
    this._refreshUnsaved();
  }

  _updateTrail(upToIndex) {
    const points = this.app.recorder.samples
      .filter((s) => s.processed?.position)
      .map((s) => ({ position: s.processed.position, quaternion: s.processed.quaternion }));
    this.app.renderer.updateTrail(points, upToIndex);
  }

  _renderStats(stats) {
    const el = document.getElementById('stats-panel');
    el.innerHTML = this.stats.toDisplayRows().map((r) =>
      `<div class="stat-row"><span>${r.label}</span><strong>${r.value}</strong></div>`,
    ).join('');
  }

  _updateDebug(sample, processed) {
    const el = document.getElementById('debug-panel');
    if (!el) return;
    el.textContent = JSON.stringify({
      rawAccel: sample.accel,
      rawGyro: sample.gyro,
      filtered: processed?.linearAccel,
      quaternion: processed?.quaternion,
      euler: processed?.euler,
      dt: sample.dt,
      fps: this.app.renderer.fps,
      renderMs: this.app.renderer.renderTime.toFixed(2),
      frame: this.app.recorder.count ? Math.round((this.app.playback.currentTime / (this.app.playback.duration || 1)) * this.app.recorder.count) : 0,
    }, null, 2);
  }

  _updateStatus({ fps, renderTime }) {
    document.getElementById('status-right').textContent =
      `Render ${fps} FPS (${renderTime.toFixed(1)} ms) | Samples ${this.app.recorder.count}`;
  }

  _refreshUnsaved() {
    document.getElementById('unsaved')?.classList.toggle('hidden', !this.app.recorder.unsaved);
  }

  _refreshRecent() {
    const list = document.getElementById('recent-list');
    const recent = this.app.fileManager.getRecent();
    list.innerHTML = recent.map((r) => `<li>${r}</li>`).join('') || '<li class="muted">No recent files</li>';
  }

  _screenshot() {
    const url = this.app.renderer.screenshot();
    const a = document.createElement('a');
    a.href = url;
    a.download = 'viewport.png';
    a.click();
    this.notify.show('Screenshot saved.', 'success');
  }

  _showCalibration(step) {
    const s = step ?? this.calibration.currentStep;
    const dlg = document.createElement('div');
    dlg.className = 'modal glass';
    dlg.innerHTML = `
      <div class="modal-box">
        <h2>${s.title}</h2>
        <p>${s.description}</p>
        <p class="muted"><strong>When:</strong> ${s.when}</p>
        <p class="muted"><strong>Expected improvement:</strong> ${s.improvement}</p>
        <div class="modal-actions">
          <button id="cal-prev">Back</button>
          <button id="cal-capture" class="accent">Start Capture</button>
          <button id="cal-next">Next</button>
          <button id="cal-close">Close</button>
        </div>
      </div>`;
    this.root.appendChild(dlg);
    dlg.querySelector('#cal-capture')?.addEventListener('click', () => this.calibration.startCapture());
    dlg.querySelector('#cal-prev')?.addEventListener('click', () => this.calibration.prev());
    dlg.querySelector('#cal-next')?.addEventListener('click', () => this.calibration.next());
    dlg.querySelector('#cal-close')?.addEventListener('click', () => { dlg.remove(); this.calibration.close(); });
    this.calibration.open();
  }

  _registerCommands() {
    const a = this.app;
    this.palette.register([
      { id: 'new', label: 'New Recording', category: 'File', action: () => a.fileManager.newRecording() },
      { id: 'open', label: 'Open File', category: 'File', action: () => document.getElementById('file-input')?.click() },
      { id: 'save', label: 'Save', category: 'File', action: () => this._save(false) },
      { id: 'record', label: 'Toggle Record', category: 'Record', action: () => a.toggleRecording() },
      { id: 'play', label: 'Play', category: 'Playback', action: () => a.playback.play() },
      { id: 'pause', label: 'Pause', category: 'Playback', action: () => a.playback.pause() },
      { id: 'cal', label: 'Calibration Wizard', category: 'Tools', action: () => this._showCalibration() },
      { id: 'palette', label: 'Command Palette', category: 'View', action: () => this.palette.show() },
      { id: 'screenshot', label: 'Screenshot Viewport', category: 'View', action: () => this._screenshot() },
      { id: 'filter-m', label: 'Filter: Madgwick', category: 'Motion', action: () => a.motion.setFilter('madgwick') },
      { id: 'filter-r', label: 'Filter: Raw', category: 'Motion', action: () => a.motion.setFilter('raw') },
    ]);
  }

  _registerShortcuts() {
    const a = this.app;
    this.keyboard.register([
      { key: 'p', ctrl: true, shift: true, action: () => this.palette.toggle(), label: 'Command Palette' },
      { key: ' ', ctrl: false, shift: false, action: () => a.recorder.recording ? a.toggleRecording() : a.playback.play(), label: 'Play/Record' },
      { key: 's', ctrl: true, action: () => this._save(false), label: 'Save' },
      { key: 'o', ctrl: true, action: () => document.getElementById('file-input')?.click(), label: 'Open' },
      { key: 'ArrowLeft', action: () => a.playback.prevFrame(), label: 'Previous Frame' },
      { key: 'ArrowRight', action: () => a.playback.nextFrame(), label: 'Next Frame' },
    ]);
  }

  showLoading(show) {
    document.getElementById('loading')?.classList.toggle('hidden', !show);
  }

  resize() {
    this.timeline.resize();
    this.graphs.resizeAll();
  }

  setStatus(msg) {
    document.getElementById('status-left').textContent = msg;
  }
}

export default UIManager;
