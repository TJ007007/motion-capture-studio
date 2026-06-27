/**
 * Application root — orchestrates all subsystems.
 * @module core/Application
 */

import { EventBus } from './EventBus.js';
import { PluginAPI } from './PluginAPI.js';
import { SettingsManager } from '../settings/SettingsManager.js';
import { SensorManager } from '../sensors/SensorManager.js';
import { MotionProcessor } from '../motion/MotionProcessor.js';
import { Recorder } from '../recording/Recorder.js';
import { RecordingManager } from '../recording/RecordingManager.js';
import { PlaybackEngine } from '../playback/PlaybackEngine.js';
import { SceneRenderer } from '../renderer/SceneRenderer.js';
import { UIManager } from '../ui/UIManager.js';

/**
 * Main application controller.
 */
export class Application {
  constructor() {
    this.bus = new EventBus();
    this.plugins = new PluginAPI();
    this.settings = new SettingsManager(this.bus);
    this.sensors = new SensorManager(this.bus);
    this.motion = new MotionProcessor(this.bus);
    this.recorder = new Recorder(this.bus);
    this.fileManager = new RecordingManager(this.bus, this.recorder);
    this.playback = new PlaybackEngine(this.bus);
    this.renderer = null;
    this.ui = null;
    this._liveMode = false;
  }

  /**
   * Bootstrap DOM-dependent systems.
   */
  async init() {
    this.ui = new UIManager(this);

    const viewport = document.getElementById('viewport');
    if (!viewport) throw new Error('Viewport element not found.');

    this.renderer = new SceneRenderer(viewport, this.bus);

    const s = this.settings.settings;
    this.motion.setFilter(s.filterMode);
    this.motion.setSampleRate(s.sampleRate);
    this.motion.setSmoothing(s.motionSmoothing);
    this.sensors.setSampleRate(s.sampleRate);
    this.renderer.applySettings({
      gridVisible: s.gridVisible,
      shadowsEnabled: s.shadowsEnabled,
      trailMode: s.trailMode,
      phoneWireframe: s.phoneWireframe,
      cameraMode: s.cameraMode,
      autoFollowSmoothing: s.autoFollowSmoothing,
    });

    this.playback.setSpeed(s.playbackSpeed);
    this.fileManager.startAutosave();
    await this._checkRecovery();
    this._checkBrowserSupport();
    this.ui.setStatus('Ready — use Record on a motion-capable device');
    this.bus.emit('app:ready');
  }

  _checkBrowserSupport() {
    const av = this.sensors.availability;
    if (!av.accelerometer) {
      this.bus.emit('error', {
        code: 'UNSUPPORTED',
        message: 'Device motion sensors unavailable. You can still import recordings for playback and analysis.',
      });
    }
  }

  async _checkRecovery() {
    const saved = await this.fileManager.recoverAutosave();
    if (saved?.samples?.length) {
      if (confirm('Recover unsaved recording from auto-save?')) {
        this.loadRecording(saved);
        this.ui.notify.show('Recording recovered from auto-save.', 'success');
      } else {
        await this.fileManager.clearAutosave();
      }
    }
  }

  /**
   * @param {{ metadata: Object, samples: Array }} data
   */
  loadRecording(data) {
    this.motion.reset();
    this.motion.setFilter(data.metadata.filterMode ?? 'madgwick');
    this.recorder.load(data);
    this.playback.setSamples(this.recorder.samples);
    this.ui.timeline.setData(this.recorder.metadata.duration, this.recorder.count);
    this.ui.stats.compute(this.recorder.samples);
    this.ui._onRecordingLoaded();
  }

  /** Toggle live recording. */
  async toggleRecording() {
    if (this.recorder.recording) {
      this.recorder.stop();
      this.sensors.stop();
      this._liveMode = false;
      this.ui.setStatus('Recording stopped');
      this.ui.stats.compute(this.recorder.samples);
      this.ui._renderStats(this.ui.stats.stats);
      this.playback.setSamples(this.recorder.samples);
      this.ui.timeline.setData(this.recorder.metadata.duration, this.recorder.count);
      return;
    }

    const rate = this.settings.get('sampleRate');
    const filter = this.settings.get('filterMode');
    this.motion.reset();
    this.motion.setFilter(filter);
    const ok = await this.sensors.start();
    if (!ok) return;

    this.recorder.start(rate, this.sensors.availability, filter);
    this._liveMode = true;
    this.ui.setStatus('Recording…');
    this.ui.notify.show('Recording started', 'success');
  }
}

export default Application;
