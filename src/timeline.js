export const stages = [
  [0, 'Preconvective environment', 'Before the storm', 'Storm-relative inflow turns with height. Vertical shear produces horizontal vorticity. In the undisturbed environment, its streamwise component is parallel to the local storm-relative horizontal wind.', 'Compare horizontal vorticity with storm-relative flow. The sign of the crosswise component depends on the chosen perpendicular direction.', 'environment', 'davies'],
  [7, 'Initial convection', 'The first rising tower', 'Deep ascent develops above the developing cloud base. At the flanks of the ascent, vertical-velocity gradients tilt horizontal vortex lines.', 'Center a 2–3 km slice on the nascent updraft and compare vertical velocity with tilting. Cloud onset follows a prescribed schedule.', 'tilting', 'davies'],
  [14, 'Updraft intensification', 'Shear becomes rotation', 'Stronger ascent increases horizontal gradients in vertical velocity. Streamwise vorticity in inflow favors tilting that places cyclonic rotation within the right-moving updraft.', 'Look for both signs of tilting. A local tilting rate describes one term in the vorticity equation and is distinct from accumulated vertical vorticity.', 'tilting', 'davies'],
  [21, 'Midlevel mesocyclone', 'A rotating updraft', 'Cyclonic rotation now overlaps the midlevel updraft. A broad, weaker anticyclonic counterpart lies to its northwest in this conceptual right mover.', 'Compare a 3–5 km slice with a 100 m slice. Strong midlevel rotation alone provides little information about an existing surface vortex.', 'tilting', 'review'],
  [30, 'Supercell maturation', 'The storm organizes', 'The tilted tower rises to the tropopause and spreads into a downshear anvil. Rain occupies the forward flank northeast of the low-level updraft, leaving a relatively rain-free sector to its southeast.', 'Orbit from the southeast inflow to the northeast precipitation core. Cloud and rain appearance are qualitative.', 'classic', 'review'],
  [39, 'Downdrafts and outflow', 'Outflow meets inflow', 'Forward- and rear-flank downdrafts spread near the ground. Horizontal buoyancy gradients along real outflow boundaries can generate horizontal vorticity, and strongly negatively buoyant outflow can resist lifting.', 'Compare the 250 m vertical-velocity and convergence slices. Boundary lines locate idealized outflow interfaces. The lab does not calculate buoyancy.', 'outflow', 'markowski09'],
  [46, 'Near-surface vorticity', 'Rotation near the ground', 'Patches of vertical vorticity appear near the rear and forward flanks. In real storms, downdraft-related reorientation of vorticity and tilting by boundary-layer turbulent eddies are among the possible pathways.', 'Use the 25 m mesocyclone-centered slice. The patches here are prescribed features of the wind field. Their origins vary among storms.', 'surface', 'markowski24'],
  [52, 'Low-level mesocyclone', 'Rotation beneath the tower', 'Storm-relative inflow feeds a tightening low-level mesocyclone. A corridor of enhanced streamwise vorticity along the forward flank illustrates one possible contributor to low-level rotation.', 'Try the streamwise vorticity preset at 250 m. An organized low-level mesocyclone can also draw much of its vorticity from environmental inflow.', 'svc', 'svc'],
  [59, 'Convergence and stretching', 'The near-ground vortex tightens', 'Horizontal convergence and rising motion focus existing cyclonic vorticity. In a real storm, the vertical perturbation pressure gradient beneath a mesocyclone can help accelerate air upward even where buoyancy is small or negative.', 'Compare convergence, vertical vorticity and stretching in the lowest 100 m. The pressure-gradient mechanism is described here and is outside the wind-field calculation.', 'surface', 'review'],
  [64, 'Tornadogenesis', 'Circulation precedes condensation', 'A surface-connected vortex contracts and intensifies beneath the updraft. A debris or dust signature can appear with sufficient surface wind and available material. Condensation depends on local thermodynamic conditions.', 'Compare the tornado-scale vorticity slice with the cloud image. The circulation, condensation and debris have independent visibility controls.', 'tornado', 'radar'],
  [70, 'Mature tornado', 'A surface-connected vortex', 'A compact, tilted vortex and a broader low-level mesocyclone coexist. A condensation funnel marks locally saturated air, and debris traces material lifted at the surface.', 'Use the tornado-scale slice and near-ground view. Real tornadoes can have a central downdraft and subvortices, which this vortex does not resolve.', 'tornado', 'rotunno'],
  [79, 'Occlusion and dissipation', 'The vortex loses its inflow', 'The wrapped rear-flank boundary overtakes the circulation. Near-ground convergence weakens, the vortex broadens and decays, and its visible condensation retracts on a separate schedule.', 'Play the last minutes from close range. Occlusion is one decay pathway and the timing of visible funnel loss varies.', 'surface', 'review'],
];

export const duration = 90 * 60;
export const stageAt = seconds => stages.findLastIndex(([minute]) => minute * 60 <= seconds);
export const boundedTime = seconds => Math.max(0, Math.min(duration, seconds));
export function advanceTime(seconds, elapsed, loop) {
  const next = seconds + Math.max(0, elapsed);
  return loop && next > duration ? next % duration : boundedTime(next);
}
export function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return [Math.floor(whole / 60), whole % 60].map(value => String(value).padStart(2, '0')).join(':');
}

export const references = {
  davies: ['Davies-Jones (1984)', '10.1175/1520-0469%281984%29041%3C2991%3ASVTOOU%3E2.0.CO%3B2'],
  review: ['Fischer et al. (2024)', '10.1175/BAMS-D-23-0031.1'],
  markowski09: ['Markowski and Richardson (2009)', '10.1016/j.atmosres.2008.09.015'],
  markowski24: ['Markowski (2024)', '10.1175/JAS-D-23-0161.1'],
  svc: ['Orf et al. (2017)', '10.1175/BAMS-D-15-00073.1'],
  radar: ['Rapid-scan radar study (2025)', '10.1175/JTECH-D-24-0104.1'],
  rotunno: ['Rotunno and Bluestein (2024)', '10.1088/1361-6633/ad7f6a'],
};
