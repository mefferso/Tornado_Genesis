# Tornadogenesis Laboratory

A browser-based 3D training case for exploring supercell structure and one idealized tornadogenesis lifecycle. The application combines an analytic, time-dependent velocity field with qualitative cloud, precipitation, condensation and debris volumes.

**GitHub Pages** · [Open the laboratory](https://mefferso.github.io/Tornado_Genesis/)

## Run locally

Requires Node 24 and a browser with WebGL 2.

```sh
npm ci
npm run dev
```

Open the printed URL. The production path is case-sensitive and starts with `/Tornado_Genesis/`.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Set `LAB_CHROMIUM` to use an existing Chromium binary or `LAB_TEST_URL` to run the browser suite against a deployed build. The browser tests write screenshots to `test-results/`.

## Use the laboratory

- Immersive opens paused at 59:00, just before tornadogenesis, with the diagnostic overlays off. Scientific and Hybrid switch the visible layers while retaining time, camera and tuning. Restart to view the undisturbed ambient wind profile in 3D, or use the timeline to visit any of the 12 stages. Playback speed is expressed in simulated seconds per real second.
- Orbit with a left drag, pan with a right drag and zoom with the scroll wheel. In fly-through, drag to look. Use WASD to move, Q/E to descend or ascend, R to reset and F to enter fullscreen. Space toggles playback and the left/right arrows step the clock by ten seconds.
- Use the suggested layers for each stage or choose a preset. Camera AGL and horizontal-section AGL are independent. Toggle the scalar plane or horizontal vorticity vectors, change the slice extent, and use the plan-view cursor or arrow keys to inspect the displayed field.
- Use the airflow display and color selectors to compare frozen-time direction, particles, moving dashes, wind vectors and ribbons with forward parcel paths. Set the ceiling to 500 m AGL for a boundary-layer view. Natural overlays attenuate through cloud, rain and debris. X-ray keeps the overlays visible through the scene.
- The 3D diagnostic panel uses the horizontal section's extent and its own threshold and ceiling. You can combine a vertical vorticity isosurface with horizontal vorticity vectors on the 50 m section.
- Open Camera tools for field of view, tracking, automatic orbit and saved views. The 2 m eye-level and 22 km above-anvil presets cover opposite ends of the camera range. Use Hide panels or H for an unobstructed view. Atmosphere playback and camera motion are independent.
- The guided demonstration has ten stops from environmental vorticity to occlusion. Use Next stop to advance manually or Play to progress through the prescribed lifecycle. The tornado wind kernel, circulation guide, funnel and debris switches operate independently.
- Start with Low graphics on a software renderer or older device. Balanced responds to measured frame rate by changing pixel resolution. Ground-relative instantaneous wind adds the fixed storm translation. The scene and forward parcel integrations use storm-relative coordinates.

## Deployment

The [Pages workflow](.github/workflows/pages.yml) builds and verifies pull requests. A successful run on `main` publishes `dist/`. In repository **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. Use **Actions → Verify and deploy Pages → Run workflow** to rerun on `main` if the source setting was changed after a merge.

## Documentation

- [Science, field provenance, and research datasets](docs/SCIENCE.md)
- [Application and provider architecture](docs/ARCHITECTURE.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Development roadmap](docs/ROADMAP.md)
