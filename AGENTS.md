# Tornadogenesis Laboratory development

Inspect the live repository, current branch, recent changes, Actions and deployment before editing. Preserve the static GitHub Pages deployment under the exact case-sensitive `/Tornado_Genesis/` base.

- Keep atmospheric coordinates east/north/up in meters, velocity in m/s and elapsed time in seconds. Render coordinates are east/up/south in kilometers. Test new conversions.
- Put velocity and time-dependent features behind the atmospheric provider. Derive diagnostics from that velocity. Keep camera altitude separate from meteorological slice altitude.
- Preserve deterministic seeking and camera navigation during pause. Keep physical circulation, condensation and debris separately controllable.
- Label real numerical data, derived numerical data, procedural quantitative data and qualitative geometry distinctly. Verify references and data rights. Keep raw research volumes out of Git.
- Run `npm test`, `npm run build`, and `npm run test:browser` for changes to the lab. Inspect screenshots of storm and vortex scales. Verify Actions and the live page before calling a deployment complete.
- Update the relevant documents under `docs/` when changing science, assumptions or architecture.
