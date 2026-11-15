# Spec Delta

## Purpose

Entregar a quien investiga el Valle de Mexicali la malla y los vectores que el explorador ya mide, en archivos de escritorio, y decir en la misma entrega qué problemas publicados esos archivos no resuelven.

## ADDED Requirements

### Requirement: Research pack from published layers

The system SHALL publish a research pack for the mexicali region from the layers the manifest already includes. The pack SHALL contain an index, a line-of-sight displacement raster, a land-cover raster, and the canal, road, and river vectors when those layers exist. Each raster SHALL use the region grid and coordinate reference system. The index SHALL name every file, its units, its dates, and the source credits from the manifest.

#### Scenario: Published layers are exported

- **WHEN** the mexicali manifest includes subsidence, landcover, canals, roads, and rivers
- **THEN** the pack contains the displacement raster, the land-cover raster, those three vector files, and the index

#### Scenario: A missing layer is recorded, not invented

- **WHEN** one of those layers is absent from the manifest
- **THEN** the pack omits that file and the index marks it absent

### Requirement: Displacement rate is a trend, not a cause

The pack SHALL include a line-of-sight rate raster that is the linear trend of the published displacement series, in centimeters per year, on the same grid. The pack SHALL NOT label a cell as geothermal, tectonic, or seismic.

#### Scenario: Several dates produce a rate

- **WHEN** the displacement layer has at least two dates
- **THEN** the rate raster covers the same grid and the index gives its unit as centimeters per year

#### Scenario: One date cannot make a trend

- **WHEN** the displacement layer has fewer than two dates
- **THEN** the pack omits the rate raster and the index says the trend cannot be estimated

### Requirement: Infrastructure carries a rate sample

When a rate raster exists, the pack SHALL publish canal and road copies that add the sampled line-of-sight rate on each feature. The index SHALL describe that value as a sample of the rate, not as damage, hazard, or a repair priority.

#### Scenario: Canals and roads receive the sample

- **WHEN** canals, roads, and a rate raster all exist
- **THEN** each canal feature and each road feature in the pack copies includes the sampled rate or an explicit empty value where the rate has no data

#### Scenario: No rate leaves the vectors unchanged in meaning

- **WHEN** the rate raster is absent
- **THEN** the canal and road copies do not include a rate sample and the index says why

### Requirement: Cited gap note

The pack SHALL include a Spanish note that states what the files do not answer and cites the studies used for that statement.

#### Scenario: Note states the open limits and their sources

- **WHEN** the pack is published
- **THEN** the note states that the motion is not split into geothermal, tectonic, and seismic causes, that the pack is not a groundwater flow model, a salinity map, or a damage assessment, and that it does not include well levels, salt concentration, canal discharge, geothermal production, or water-delivery records
- **AND** the note includes the DOIs 10.1109/tgrs.2017.2704593, 10.1029/1999gl900062, 10.1016/j.jvolgeores.2011.03.004, 10.5194/piahs-372-243-2015, 10.22201/iiec.20078951e.2011.167.27749, 10.1080/24694452.2022.2162477, and 10.1016/j.gsd.2026.101643

### Requirement: Synthetic displacement stays labeled

When the displacement layer source is synthetic, the note and the index SHALL say those values are development data and not a NISAR measurement.

#### Scenario: Synthetic source is visible

- **WHEN** the subsidence layer source is synthetic
- **THEN** the note and the index say the displacement is not a NISAR measurement

### Requirement: Coherence is not invented

The pack SHALL include a coherence raster only when the manifest already has a disturbance layer. Otherwise the note SHALL say that this delivery has no coherence mask and that published work needs one because farmland decorrelates long interferograms.

#### Scenario: Disturbance layer is absent

- **WHEN** the mexicali manifest has no disturbance layer
- **THEN** the pack contains no coherence raster and the note says it is absent for that reason

### Requirement: Research page outside the map

The system SHALL serve the pack index and the same limits at `/investigacion`. Opening the explorer map SHALL NOT add a panel, dock item, or control for this pack.

#### Scenario: Visitor reads the pack

- **WHEN** a visitor opens `/investigacion` and the index exists
- **THEN** the page lists the files and shows the gap note

#### Scenario: Pack has not been generated

- **WHEN** a visitor opens `/investigacion` and the index is missing
- **THEN** the page says the pack has not been generated and shows no measured values

#### Scenario: Explorer map stays bare

- **WHEN** a visitor opens the explorer
- **THEN** the map does not show a research-pack panel or a new tool control for it
