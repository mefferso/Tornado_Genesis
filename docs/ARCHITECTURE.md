# Architecture

| Entry point | Responsibility |
| --- | --- |
| `index.html`, `src/style.css` | Workstation layout, accessible controls and responsive panels |
| `src/main.js` | UI, active time, scene orchestration, diagnostic invalidation and overlays |
| `src/timeline.js` | Elapsed time, 12 instructional stages, stage references and deterministic playback |
| `src/atmosphere.js` | Provider, wind profile, analytic drafts and rotations, coordinate conversions and shared derivative calculations |
| `src/volume.js` | WebGL 2 ray-marched cloud and precipitation envelopes, 3D noise, terrain, adaptive funnel and dust sampling |
| `src/diagnostics.js` | Gridded plan views, 3D slice and arrows, streamline integration, circulation guides and outflow overlays |
| `src/navigation.js` | Orbit and fly controls, meter-resolution altitude and camera transitions |
| `tests/` | Mathematical, state and production browser checks |
| `.github/workflows/pages.yml` | Build, browser validation and Pages deployment |

Software dependencies are Three.js and Vite. The page runs on static hosting and makes no external data API calls.

The provider exposes `atTime(seconds)` and `velocity(east, north, altitude, snapshot, output?)`. The latter returns storm-relative `[u,v,w]` in m/s, with an optional scratch array. The analytic provider needs no spatial or temporal interpolation. `diagnose` accepts any provider with the velocity interface. The ray marcher uses additional visual parameters supplied by the procedural snapshot. A numerical provider should define its field availability, spatial and temporal interpolation, geometry metadata, native grid, missing-value behavior and provenance before wiring it to the renderer.

Computational positions are east, north and up in meters. Three.js positions are east, up and south in kilometers. This preserves handedness. The ground is at 0 m AGL, the camera is bounded at 3–15,000 m AGL, and the near-surface analysis plane can sample down to zero independent of the camera.

The application draws the volume before the diagnostic overlays. The overlays intentionally remain legible through cloud. The horizontal analysis canvas samples a north-up Cartesian raster and doubles as the texture for the 3D plane. Streamlines are midpoint-integrated in one frozen snapshot, then markers move along them at an illustrative animation rate. Time and settings deterministically restore the atmospheric state after rewinding. Overlay rebuilds are throttled during playback and refreshed immediately on an explicit seek or control change.
