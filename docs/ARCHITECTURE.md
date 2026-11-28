# Architecture

| Entry point | Responsibility |
| --- | --- |
| `index.html`, `src/style.css` | Workstation layout, accessible controls and responsive panels |
| `src/main.js` | UI, active time, scene orchestration, diagnostic invalidation and overlays |
| `src/timeline.js` | Elapsed time, 12 instructional stages, stage references and deterministic playback |
| `src/atmosphere.js` | Provider, wind profile, analytic drafts and rotations, coordinate conversions and shared derivative calculations |
| `src/volume.js` | WebGL 2 volume rendering, GPU cloud density and sunlight cache, terrain, optical-depth compositing, and separate vortex-scale sampling |
| `src/diagnostics.js` | Gridded sections, horizontal vorticity vectors, isosurface materials, circulation guides and outflow overlays |
| `src/flow.js`, `src/fieldGeometry.js` | Shared-field wind glyphs, midpoint integration, projected parcel paths, and signed marching-tetrahedra isosurfaces |
| `src/navigation.js` | Orbit and fly controls, meter-resolution altitude and camera transitions |
| `tests/` | Mathematical, state and production browser checks |
| `.github/workflows/pages.yml` | Build, browser validation and Pages deployment |

Software dependencies are Three.js and Vite. The page runs on static hosting and makes no external data API calls.

The provider exposes `atTime(seconds)` and `velocity(east, north, altitude, snapshot, output?)`. The latter returns storm-relative `[u,v,w]` in m/s, with an optional scratch array. The analytic provider needs no spatial or temporal interpolation. `diagnose` accepts any provider with the velocity interface. The ray marcher uses additional visual parameters supplied by the procedural snapshot. A numerical provider should define its field availability, spatial and temporal interpolation, geometry metadata, native grid, missing-value behavior and provenance before wiring it to the renderer.

Computational positions are east, north and up in meters. Three.js positions are east, up and south in kilometers. This preserves handedness. The ground is at 0 m AGL, the camera is bounded at 2–27,000 m AGL, and the near-surface analysis plane can sample down to zero independent of the camera.

The renderer evaluates the domain-warped density model and short sunlight paths into a 128 × 96 × 48 atlas on the GPU. The screen-space ray marcher interpolates atlas layers, adds nearby surface detail, and samples precipitation and the vortex directly. The atlas refreshes after five simulated seconds during playback and at the exact time on pauses and explicit seeks. In between refreshes it applies a bounded drift with height-dependent shear. Sampling steps depend on the cloud envelope, with a separate bounded interval and finer steps around the vortex. Each sample contributes Beer–Lambert transmittance and approximate direct, ambient and multiple-scattered light. Balanced can reduce framebuffer resolution based on measured frame rate.

Natural overlays use a depth prepass and a color pass at the closest diagnostic depth per pixel. The volume integrates extinction up to that depth before inserting the diagnostic. X-ray renders the diagnostics after the volume. The 128² north-up section canvas doubles as the texture for the 3D plane. Isosurfaces use the same field selector semantics and independently adjustable physical thresholds. They sample a 25 × 25 × 16 ENU lattice over the selected extent. Expensive meshes and slices update at a bounded cadence during playback and refresh at the current time on pause or seek.

Instantaneous streamlines use a fixed snapshot and can include constant storm translation. The moving markers and dashes along those streamlines indicate direction. Forward parcel paths sample future provider snapshots with a midpoint integrator in the storm-relative frame and stop at the ceiling, ground or case endpoint.

Camera navigation, workspace layer preferences and instructional progression are managed separately from provider time. Camera bookmarks store position, target and field of view in local browser storage.
