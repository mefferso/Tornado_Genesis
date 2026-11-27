# Known limitations

- This release represents one prescribed, idealized supercell. The composites omit pressure and density evolution, thermodynamics, microphysics, friction and turbulent closure. The diagnostics express instantaneous procedural kinematics.
- The ground and cloud density, rain shafts, boundaries, condensation and debris are schematic. The tornado kernel uses a single circulation center, with no dynamically simulated subvortices, central downdraft, damage or entrainment.
- Stage times are instructional markers. The start of the near-surface vortex, onset of condensation and debris appearance occur on independent prescribed schedules.
- Flow markers trace frozen-time streamlines. They do not track the same air parcel between frames. Ground-relative wind adds a constant translation while the camera domain stays storm-centered.
- Only horizontal quantitative sections are available. Slice color limits vary by extent, and storm-scale sections deliberately undersample the tornado core. A 5 m derivative stencil does not imply that a 46 km raster resolves 5 m features.
- WebGL 2 is required. Performance depends on GPU, resolution, view and chosen overlays. Use the Low preset when ray marching in software. The fullscreen control depends on the browser's Fullscreen API.
