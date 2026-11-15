# Design

## Context

See proposal.md for why. The published manifest (`schemaVersion` 2) already describes Mexicali: grid 960×754, cell about 117 m, CRS `EPSG:32611`, `bboxProjected`, and layers `subsidence`, `landcover`, plus overlays `canals`, `roads`, `rivers`. Cubes are raw integers (`int16-le` or `uint8`) with `scale` and `nodata`. Overlay points are fractional column/row on that grid, not longitude/latitude (`public/data/mexicali/canals.json`). The displacement series in the current manifest is `source: synthetic` and its credit says it is not a NISAR measurement. `regions.yaml` lists a `disturbance` extra; the manifest on disk does not have that layer. The web rate is the least-squares trend in `velocityField` (`src/features/explorer/lib/stats.ts`): scaled samples, time in years from the first date, NaN when fewer than two valid samples. `Grid` (`pipeline/src/nisar_pipeline/grid.py`) already has the affine and the lon/lat transform. The explorer route is the map; tool panels were removed.

## Goals / Non-Goals

**Goals:**

- Write the pack from the manifest and the files it points at, after a build or against the current `public/data`.
- Put physical units in the rasters so a desktop GIS does not have to apply `scale`.
- Turn canal and road vertices into WGS84 and attach one rate sample.
- Put the literature limits in `nota.md`, including the synthetic-source warning when the manifest says so.

**Non-Goals:**

- Recomputing NISAR, fitting a groundwater model, or scraping CONAGUA, SAGARPA, CILA, or CFE production.
- Exporting slope, population, or the crop cubes that are not in the manifest.
- A coherence raster until `disturbance` is actually in the manifest.
- A control on the map. `/investigacion` is a separate route with no dock entry.

## Decisions

### 1. Pack path and trigger

Write `public/data/mexicali/research-pack/` from the manifest after `write_manifest`, and also from a function that reads an existing `manifest.json`. The pack is a duplicate for desktop use, so it does not enter `check_budget`. Its bytes are a pure function of the manifest and the cubes: no clock of its own. `test_run_synthetic_end_to_end` requires a second `run` to leave every file identical.

Alternative: extend `schemaVersion`. Rejected. The web contract stays as it is; the pack is a sibling folder named by convention.

### 2. Rasters in physical units, one file per product

- `displacement.tif`: one float32 band per displacement date, values already multiplied by `scale`, nodata as NaN, band description equal to the ISO date. CRS and affine come from the manifest grid (`west`/`north` = `bboxProjected` minX/maxY, cell = `cellSizeM`, row 0 at the north). Unit is the layer unit (`cm` today).
- `rate.tif`: one float32 band, centimeters per year, same trend as `velocityField`. Omit the file when the series has fewer than two dates.
- `landcover.tif`: the integer classes and names from the manifest, not a float rescaling.

Alternative: ship the raw `.bin` plus a sidecar. Rejected. The point of the pack is a file a GIS opens without the web decoder.

### 3. Vectors in WGS84, one sample per feature

Convert each overlay point with the inverse of `Grid.lonlat_to_colrow` (projected x = west + col × cell, y = north − row × cell, then to longitude/latitude). Write GeoJSON. For canals and roads, set `losRateCmPerYear` from the nearest rate cell to the middle vertex. If that cell is nodata, the property is null. Rivers are copied with no rate. The index text says the property is a sample of the rate, not damage.

Alternative: minimum rate along every vertex. Rejected for this pack. One declared sample is easier to test and harder to misread as a damage score.

### 4. Note content

`nota.md` is Spanish prose, and the page shows it as plain text. It must include the DOIs required by the spec and these points, which are the claims read from the papers:

- If `subsidence.source` is `synthetic`, say first that the displacement file is development data, not a NISAR measurement, and quote the manifest credit.
- The series is only the manifest dates (in the current file, 2025-10-01 through 2026-10-20). It is not the leveling that started in the 1970s nor the REDECVAM network.
- Motion is not split by cause. The 2017 IEEE TGRS paper (doi:10.1109/tgrs.2017.2704593) reports sparse GPS, agricultural decorrelation beyond a few months, 160 mm/year of subsidence from geothermal extraction, and about 40 mm/year across the near ends of the Imperial, Cerro Prieto, and Indiviso faults. Carnec and Fabriol 1999 (doi:10.1029/1999gl900062) say agriculture limited the interferograms; five elastic point sources fit the fringes, three of them compatible with the reservoir. Sarychikhina, Glowacka, Mellors, and Suárez Vidal 2011 (doi:10.1016/j.jvolgeores.2011.03.004) find C-band pairs longer than 3 months (105 days) decorrelate over vegetation; their 2003–2006 stack peaks near 16 cm/year in the recharge zone and near 10 cm/year in the production zone, and faults bound the subsiding area. Glowacka et al. 2015 (doi:10.5194/piahs-372-243-2015) estimate that in the high-seismicity window 2006–2009 about 80% of subsidence was anthropogenic; the local network is four creepmeters and nine tiltmeters on faults, sampled every 1–20 minutes; they say denser, higher-frequency instruments are still needed to separate local slip. The rate file does not repeat those percents.
- The aquifer is unsolved as a flow model. Lozano Hernández et al. 2026 (doi:10.1016/j.gsd.2026.101643) publish a conceptual model only: 2011–2021 drawdown about 8–12 m in the northeast and 3–6 m in the center and southeast, and a 2021 deficit of about 135–140 mm/year. Recharge is mainly irrigation return, seepage from unlined canals, and lateral inflow, which can salinize groundwater. Rubio-Velázquez, Loáiciga, and López-Carr 2023 (doi:10.1080/24694452.2022.2162477) tie pumping that makes up a short Colorado allocation to seawater intrusion, falling levels, brackish upwelling, subsidence, ecosystem loss, and farmers leaving. The pack has no wells and no water balance.
- Salinity remains open. Cortez Lara 2011 (doi:10.22201/iiec.20078951e.2011.167.27749) writes that after Minute 242 the problem continues: CILA’s annual salinity averages miss daily and monthly peaks that accumulate in Mexicali soils. Sediment and All-American Canal seepage are the other management conflicts in that paper. The pack has no salt concentration and no discharge.
- Canals, roads, and fields are where subsidence and fault slip do damage (Sarychikhina et al. 2011; Glowacka et al. 2015). The sampled rate is not a damage judgment. The same 2015 paper cites a CICESE report on the zero-subsidence line for irrigation-district 014 modules 10, 11, and 12; this pack does not draw that line.
- When `disturbance` is absent, say there is no coherence mask, and that the 2011 and 2017 papers needed one because farmland destroys long interferograms.
- Name the series this project does not hold and that those studies used: leveling benchmarks, REDECVAM, geothermal production, CONAGUA deliveries, and SAGARPA crop area. A 2009 agricultural water-demand model (OpenAlex, 20 citations, no DOI on the record) estimated Mexicali’s marginal water value at least 2.6 times the price farmers pay, using CONAGUA deliveries and SAGARPA area and costs. Cite it by that title, without inventing authors.

Papers that showed up in the search and stay out of the note: air quality, green roofs, fig growth regulators, and workplace studies. They are not about these grids.

### 5. Page

`src/routes/investigacion.tsx` fetches `/data/mexicali/research-pack/index.json` and `nota.md`. It lists files, units, dates, and credits, and shows the note. A missing index renders the empty state from the spec and no numbers. The explorer component does not link to this route.

### 6. Index shape

`index.json` fields: `regionId`, `generatedFrom` (manifest `generatedAt`), `displacementSource`, `files[]` with `id`, `path`, `role`, `units`, `dates`, `absent` (boolean), `note`, and `credits`. Absent products stay in the list with `absent: true` and no path. The rate-sample sentence lives on the canal and road entries.

## Risks / Trade-offs

- [A reader treats the synthetic cube as Cerro Prieto’s real rate] → The note and the index repeat the manifest source before any paper number. Paper rates stay in the note as published results, not as values in the rasters.
- [A one-year trend is compared with the multi-year cm/year figures in the papers] → The note states the manifest date window next to those figures.
- [One vertex sample is a poor summary of a long canal] → The index calls it a sample. A min-along-line product is a later change.
- [Float32 displacement is ~50 MB for the current 18 dates] → One GeoTIFF, outside the web budget, downloaded only from the research page.
- [Grid points converted with a rebuilt `Grid` drift from the file] → Build the affine from the manifest’s `bboxProjected`, `cellSizeM`, `width`, and `height`, not from a fresh `make_grid`.

## Migration Plan

Add the writer and the route. Generating the pack creates `research-pack/` and does not rewrite cubes or `manifest.json`. Rollback is deleting that folder and the route. No data migration.
