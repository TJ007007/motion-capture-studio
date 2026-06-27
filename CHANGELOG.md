# Changelog

All notable changes to Motion Capture Studio are documented in this file.

## [1.0.0] - 2026-06-27

### Added

- Initial release of Motion Capture Studio
- Live IMU recording from accelerometer and gyroscope (30/60/120 Hz target rates)
- Madgwick sensor fusion and raw integration playback modes
- Multi-step calibration wizard (gravity, drift, gyro bias)
- Three.js 3D workspace with procedural smartphone model
- Motion trails: line, ribbon, heat map, GPU-instanced ghost phones
- Camera modes: orbit, free, auto-follow with reset
- Professional timeline with zoom, pan, playhead, in/out markers
- Playback controls: play, pause, stop, reverse, frame step, speed 0.05×–4×
- Quaternion SLERP interpolation between samples
- Live graphs: acceleration, gyroscope, velocity, position, distance, rotation speed, g-force, FFT
- Statistics engine with motion quality and sensor quality scores
- JSON and binary (.mcs) import/export with CRC integrity checking
- Drag-and-drop and file picker import with format auto-detection
- Recording manager: new, rename, duplicate, delete, save, recent files
- IndexedDB auto-save recovery for large recordings
- Settings persistence via localStorage with theme support
- Command palette (Ctrl+Shift+P) and keyboard shortcuts
- Toast notifications, loading overlays, debug panel
- Screenshot export of 3D viewport
- Modular architecture with event bus and plugin API scaffold
- Single-file HTML build (Three.js CDN as sole external dependency)
- Comprehensive README and documentation

### Known Limitations

- Position estimation drifts without external reference (expected for IMU-only capture)
- iOS requires explicit motion permission via user gesture
- Desktop browsers may not expose live device motion sensors
- Binary compression uses packed floats; gzip/LZ4 reserved for future versions
