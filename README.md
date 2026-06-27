# Motion Capture Studio

Professional motion capture and analysis application using device IMU sensors. Built as a modular ES6+ codebase that bundles into a **single self-contained HTML file** for offline deployment.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Live recording** from accelerometer and gyroscope at 30, 60, or 120 Hz
- **Motion processing** — Madgwick sensor fusion (filtered) or raw integration with realistic drift
- **3D workspace** — procedural smartphone model, ground grid, axes, shadows, orbit controls
- **Motion trails** — line, ribbon, heat map, GPU-instanced ghost phones
- **Timeline** — Blender/Unity-inspired scrubbing, zoom, pan, in/out markers
- **Playback** — play/pause/stop/reverse, frame step, speed 0.05×–4×, quaternion SLERP
- **Graphs** — acceleration, gyro, velocity, position, distance, g-force, FFT spectrum
- **Statistics** — peaks, drift estimate, motion quality score, memory estimate
- **Calibration wizard** — gravity, drift, and gyro bias steps with guidance
- **Import/Export** — JSON and binary `.mcs` with CRC integrity and chunk structure
- **File manager** — rename, duplicate, recent files, IndexedDB auto-save recovery
- **Professional UI** — dark glassmorphism, dockable panels, command palette, shortcuts

## Live Demo

After publishing to GitHub Pages, the app is available at:

**https://TJ007007.github.io/motion-capture-studio/**

(User site repo `TJ007007.github.io` would serve at `https://TJ007007.github.io/` instead.)

## Quick Start

### Using the bundled app

1. Open `index.html` in a modern browser (or serve locally for module development).
2. On a **mobile device**, grant motion sensor permission when prompted.
3. Tap **Record** to capture motion while the 3D phone animates live.
4. Use playback controls and the timeline to review captured data.
5. **Save** as JSON or binary `.mcs` for offline analysis later.

> **Note:** Desktop browsers typically lack live device motion APIs. Import saved recordings for full playback and analysis on desktop.

### Development

Source lives in `src/` with styles in `styles/`. Rebuild the standalone HTML after changes:

```bash
node scripts/build.mjs
```

This produces `index.html` with all CSS and JavaScript inlined. **Three.js** is the only external dependency, loaded via CDN import map.

## Architecture

```
src/
├── core/           Application, EventBus, PluginAPI
├── sensors/        DeviceMotion capture
├── motion/         Madgwick filter, raw integrator, MotionProcessor
├── recording/      Recorder, RecordingManager (IndexedDB)
├── playback/       PlaybackEngine, interpolation (SLERP)
├── io/             JSON + binary formats, import/export
├── renderer/       Three.js scene, phone model, trails, camera
├── timeline/       Virtualized canvas timeline
├── graphs/         Live chart panels + FFT
├── statistics/     Quality metrics and peaks
├── calibration/    Multi-step wizard
├── settings/       localStorage persistence
└── ui/             Shell, panels, command palette, notifications
```

### Design principles

- **Event-driven** — subsystems communicate via `EventBus`
- **No globals** — single `window.MCS` dev hook only
- **Future-ready** — plugin API, filter slots for Kalman/Mahony, chunk-based binary format
- **Performance** — decimated timeline rendering, graph ring buffers, instanced ghosts

## Browser Compatibility

| Browser            | Live Recording | Playback/Import |
|--------------------|----------------|-----------------|
| Android Chrome     | ✅             | ✅              |
| Android Edge       | ✅             | ✅              |
| Desktop Chrome     | ⚠️ Limited     | ✅              |
| Desktop Edge       | ⚠️ Limited     | ✅              |
| Desktop Firefox    | ⚠️ Limited     | ✅              |
| iOS Safari         | ✅ (permission)| ✅              |

Motion sensors require HTTPS or `localhost`. iOS 13+ requires `DeviceMotionEvent.requestPermission()` via user gesture.

## Sensor Limitations

IMU-only capture **cannot** provide absolute position over long durations. Velocity and position are integrated from acceleration and will drift. The Madgwick filter improves orientation and gravity removal but does not replace GPS or visual odometry.

## Motion Calculations

### Raw Integration

Direct double-integration of accelerometer readings. Orientation from gyro integration. Realistic drift is preserved for educational comparison.

### Madgwick Filter

Gradient-descent fusion of gyroscope and accelerometer data produces a stable quaternion orientation. Linear acceleration is computed by removing the estimated gravity vector. Velocity integration includes smoothing and zero-velocity updates when stationary.

**Beta** (filter gain) defaults to 0.1. Higher values trust accelerometer more (faster correction, more noise sensitivity).

## Calibration Guide

1. **Gravity** — device flat, screen up; establishes down vector.
2. **Drift** — device still 5 seconds; reduces velocity bias.
3. **Sensor** — slow rotation through all axes; estimates gyro bias.

Run calibration before important recordings. Results apply to the active filter pipeline.

## File Formats

### JSON (`.json`)

Human-readable, larger files. Schema:

```json
{
  "magic": "MCS_JSON",
  "metadata": { "name", "sampleRate", "duration", "filterMode", ... },
  "samples": [{ "timestamp", "dt", "accel", "gyro", "processed" }]
}
```

### Binary (`.mcs`)

Compact packed floats with:

- Magic `MCS\0`, version, sample count
- **META** chunk — JSON metadata
- **DATA** chunk — float32 sample records
- **CRC-32** trailing checksum

Flags byte reserved for future gzip/LZ4 compression.

## Keyboard Shortcuts

| Shortcut        | Action              |
|-----------------|---------------------|
| Ctrl+Shift+P    | Command palette     |
| Ctrl+S          | Save                |
| Ctrl+O          | Open file           |
| Space           | Play / Record toggle|
| ← / →           | Previous / next frame|

## Performance Notes

- Target: 60 FPS viewport, hundreds of thousands of samples
- Timeline draws decimated waveform bars (not per-sample) for large recordings
- Graphs retain last 512 points for live display
- IndexedDB stores full recordings for crash recovery
- FFT runs on a 256-sample ring buffer of acceleration magnitude

## Future Extension Ideas

- Side-by-side recording comparison
- Undo/redo command history
- Kalman, complementary, and Mahony filters
- Additional export formats (BVH, glTF animation)
- Plugin marketplace via `PluginAPI`
- gzip/LZ4 binary compression
- Web Worker offload for bulk statistics

## Known Limitations

- No GPS, video export, or recording edit/trim/merge
- Single recording loaded at a time
- Loop playback not supported (by design)
- Sample rate is target — actual rate depends on device/browser

## Development Guidelines

1. Keep modules focused; use `EventBus` for cross-cutting events.
2. Add JSDoc types for public APIs.
3. Run `node scripts/build.mjs` before distributing `index.html`.
4. Do not add build-time dependencies to the shipped HTML.
5. Match existing naming and panel patterns when adding UI.

## License

MIT — see [LICENSE](LICENSE).
