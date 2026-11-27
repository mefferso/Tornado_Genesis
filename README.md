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

- The initial view opens paused at 59:00, just before tornadogenesis. Restart to view the undisturbed ambient wind profile in 3D, or use the timeline to visit any of the 12 stages. Playback speed is expressed in simulated seconds per real second.
- Orbit with a left drag, pan with a right drag and zoom with the scroll wheel. In fly-through, drag to look. Use WASD to move, Q/E to descend or ascend, R to reset and F to enter fullscreen. Space toggles playback and the left/right arrows step the clock by ten seconds.
- Use the suggested layers for each stage or choose a preset. Camera AGL and horizontal-section AGL are independent. Toggle the scalar plane or horizontal vorticity vectors, change the slice extent, and use the plan-view cursor or arrow keys to inspect the displayed field.
- Look for the circulation at the genesis marker with the tornado-scale vorticity plane, then play forward until the condensation funnel forms. The cloud, funnel and debris switches operate independently.
- Start with Low graphics on a software renderer or older device. Select the ground-relative flow frame to add the fixed storm translation to the displayed streamlines. The rest of the scene remains storm-centered.

## Deployment

The [Pages workflow](.github/workflows/pages.yml) builds and verifies pull requests. A successful run on `main` publishes `dist/`. In repository **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. Use **Actions → Verify and deploy Pages → Run workflow** to rerun on `main` if the source setting was changed after a merge.

## Documentation

- [Science, field provenance, and research datasets](docs/SCIENCE.md)
- [Application and provider architecture](docs/ARCHITECTURE.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Development roadmap](docs/ROADMAP.md)
