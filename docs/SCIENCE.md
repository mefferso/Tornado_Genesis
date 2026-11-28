# Science and provenance

## What this case represents

The lab follows an idealized Northern Hemisphere right-moving supercell in storm-relative east/north coordinates. Its 90-minute timeline is a teaching sequence. All amplitudes, timing, storm motion and spatial scales are prescribed. The application contains no observations or numerical weather-model output.

- **Mesocyclone aloft.** In a vertically sheared environment, updraft gradients tilt horizontal vorticity. When environmental vorticity has a substantial streamwise component, tilting can place cyclonic rotation within the right-moving updraft. A mesocyclone aloft can exist with weak rotation near the ground.
- **Near-ground sources.** Buoyancy gradients can generate horizontal vorticity in outflow. Reorientation in descending air and subsequent lifting is one pathway for concentrating vertical vorticity near the surface. Some turbulent simulations also show pre-existing streaks of vertical vorticity that amplify beneath the updraft. The lab places shallow cyclonic and anticyclonic patches in the wind field. It does not integrate their source or transport terms.
- **Low-level mesocyclone.** The forward-flank shear corridor illustrates a streamwise vorticity current (SVC), one possible contributor in some storms. The importance of storm-generated versus environmental streamwise vorticity depends on the case.
- **Convergence, stretching and tornado formation.** Persistent low-level lifting can concentrate near-surface vertical vorticity. In real storms an upward-directed perturbation pressure-gradient acceleration below a rotating updraft can contribute to that lifting. The lab prescribes coupled radial inflow and ascent and diagnoses the resulting local stretching term.
- **Vortex, condensation and debris.** The vortex strengthens near the ground beginning around minute 59. A distinct condensation schedule begins after minute 66, and conceptual debris has its own onset. A visible funnel can start above the ground even when rotation already reaches the surface. Whether condensation or debris is visible depends on humidity, pressure and available material.
- **Decay.** The teaching case depicts weakening convergence, vortex broadening and a wrapping rear-flank boundary. Occlusion is one possible pathway for decay.

## Visualization

Ray-marched optical density is illustrative. The forward- and rear-flank precipitation envelopes use the corresponding prescribed draft centers, and the wall cloud follows the low-level circulation. The overshooting dome and anvil relate to the prescribed cloud-top height. Cloud drift is an altitude-dependent visual approximation of storm-relative advection. Funnel profiles and helical texture rotations are qualitative. The spin phase follows the prescribed vortex intensity and the visual profiles leave the wind kernel unchanged. The wind-kernel switch removes only the compact tornado draft and rotation so they can be examined independently of the mesocyclone, funnel and debris.

Scientific layers sample the provider directly. Isosurfaces are signed level sets of analytic diagnostics on a regular sampling lattice. Vertical velocity distinguishes updrafts and downdrafts at equal-magnitude thresholds. Section and flow palettes use time-invariant physical scales at their selected extent. Streamwise vorticity is always defined using storm-relative horizontal wind. Forward paths use evolving velocity snapshots and are illustrative trajectories within this kinematic field. They do not establish the dynamical origin of vorticity.

## Field construction

The provider superposes an analytic veering environmental wind, five tilted Gaussian drafts, eight idealized rotations and a shallow wind anomaly along the forward flank. A draft's vertical shape vanishes at the ground. Its radial inflow/outflow is derived from the integral of the horizontal Gaussian times the vertical velocity gradient, using constant-density kinematic continuity for that draft. A horizontal tilt correction accounts for the height variation in the draft's center. The complete composite includes a prescribed shear corridor and does not enforce global mass, vorticity or energy conservation.

The analytic rotation kernel has tangential speed `2 V (r/R)/(1 + (r/R)^2)` times an altitude taper. `V` is the maximum tangential speed at reference height and `R` locates that maximum. Surface vortex vorticity can reach roughly 2.6 s⁻¹ at the prescribed core center in the mature example. This is an analytic derivative, with no connection to an EF rating, damage estimate or sampled radar gate.

Diagnostics use a centered 5 m finite difference except within 5 m of the surface, where the vertical derivative uses a second-order forward stencil. With `u,v,w` the ENU velocity components, the derived fields are:

| Field | Definition |
| --- | --- |
| East, north and vertical vorticity | `ξ = ∂w/∂y − ∂v/∂z`, `η = ∂u/∂z − ∂w/∂x`, `ζ = ∂v/∂x − ∂u/∂y` |
| Streamwise and crosswise | Dot products of `(ξ,η)` with the unit storm-relative horizontal wind and its leftward perpendicular |
| Horizontal convergence | `−∂u/∂x − ∂v/∂y` |
| Vertical tilting term | `ξ ∂w/∂x + η ∂w/∂y` |
| Vertical stretching term | `ζ ∂w/∂z` |

Tilting and stretching are instantaneous local diagnostics of the analytic wind. Their sum does not reproduce the prescribed evolution of vorticity. Numerical pressure, pressure-gradient acceleration, buoyancy, temperature, hydrometeor content and baroclinic generation are deferred. Outflow boundary locations are schematic. They do not delineate a diagnosed density current. No forecast or observation values are used.

## Selected references

- Davies-Jones (1984). Environmental streamwise vorticity and rotating updrafts. [JAS](https://doi.org/10.1175/1520-0469%281984%29041%3C2991%3ASVTOOU%3E2.0.CO%3B2)
- Markowski and Richardson (2009). Supercell tornadogenesis, downdrafts and environmental sensitivities. [Atmospheric Research](https://doi.org/10.1016/j.atmosres.2008.09.015)
- Coffer and Parker (2017). Simulated tornadic and nontornadic VORTEX2 storms, with differences in the organization of their low-level mesocyclones. [MWR](https://doi.org/10.1175/MWR-D-16-0226.1)
- Orf et al. (2017). High-resolution simulated supercell with an SVC and near-surface vorticity feeding the mature tornado. [BAMS](https://doi.org/10.1175/BAMS-D-15-00073.1)
- Investigating SVCs Produced by Outflow Surges (2023). Illustrates the role of outflow surges and in-storm shear. [MWR](https://doi.org/10.1175/MWR-D-22-0309.1)
- Markowski (2024). Near-surface vorticity streaks in a turbulent environment as a possible pathway. [JAS](https://doi.org/10.1175/JAS-D-23-0161.1)
- Fischer et al. (2024). Updated four-stage framework and questions about how pretornadic vorticity maxima organize. [BAMS](https://doi.org/10.1175/BAMS-D-23-0031.1)
- Rotunno and Bluestein (2024). Review of recent simulation and observational advances. [Reports on Progress in Physics](https://doi.org/10.1088/1361-6633/ad7f6a)
- Rapid-scan phased-array radar study (2025). Timing and height of observed tornadic signatures depend on case and sampling. [JTECH](https://doi.org/10.1175/JTECH-D-24-0104.1)
- Great Plains composite Doppler wind lidar study (2026). Near-ground streamwise and crosswise vorticity differed between the observed tornadic and nontornadic subsets. [MWR](https://doi.org/10.1175/MWR-D-25-0177.1)

## Numerical archives evaluated

| Archive | Verified availability and constraints | Use in this lab |
| --- | --- | --- |
| Markowski (2024) model output, Penn State | Public archive contains NetCDF directories, parcel and restart files and multiple individual ZIPs over 1 GB. The catalog grants local customization subject to terms. Redistribution of derived tiles, sample dimensions, cadence and field inventory still need confirmation. [Catalog](https://doi.org/10.26208/6DSC-TS33) | Strong candidate for a focused near-ground subset after confirming rights and inspecting headers. |
| Orf's above-anvil cirrus plume CM1 cases | Open research archive, separate from the 2017 violent-tornado case. Dataset README reports no restrictions, two 50 m simulations, full-volume states at 300 s cadence and 20 three-dimensional variables including winds, hydrometeors and perturbation pressure. The archive is 216.9 GB of ZFP-compressed NetCDF4 and parcel files. [Archive and README](https://zenodo.org/records/5523421) | Useful for storm-scale comparison and hydrometeor visualization. Five-minute volume cadence cannot resolve tornado spinup on the order of seconds. |
| Allen et al. (2026) lower-boundary-condition ensembles | Penn State lists three open-access 75 m ensembles that contain tornado-like vortices. Their terms explicitly cover local customization. Public redistribution and file cadence need checking before inclusion. [Metadata](https://www.datacommons.psu.edu/commonswizard/MetadataDisplay.aspx?Dataset=6504) | Candidate for comparing storm and vortex sensitivity to near-surface turbulence across cases. |
| Parker (2023) surface-vorticity study | Dryad lists 373 MB of CM1 namelists and input files needed to recreate the cases. [Dryad](https://doi.org/10.5061/dryad.mcvdnck4n) | Candidate for generating a compact controlled test case at a chosen output cadence in a future data-preparation workflow. |
| Orf et al. (2017) violent-tornado simulation | Paper and visualizations are available. A redistributable raw archive for that specific study was not verified. [Paper](https://doi.org/10.1175/BAMS-D-15-00073.1) | Scientific reference for this release. |

A full Orf volume has about 4.3 billion grid points, approximately 17 GB per uncompressed float32 field. GitHub Pages caps a published site at 1 GB and lists a soft 100 GB/month bandwidth limit. A practical integration needs offline decoding, subset selection and chunking, explicit attribution and licensing, bounded caches and level-of-detail selection. Start with a storm-scale downsample and a nested high-resolution near-ground window. Select a dataset with sufficient temporal resolution before doing trajectory or tendency analysis. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
