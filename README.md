# Field Atlas: Autzen LiDAR explorer

Interactive 3D browser map of a cropped PDAL Autzen airborne LiDAR sample. Built with React, Three.js and OrbitControls. Controls support mouse, touch and keyboard, elevation / source RGB / classification coloring, ground filtering and vertical exaggeration.

## Data

- Source: https://github.com/PDAL/data/blob/main/autzen/autzen.laz
- Direct LFS payload: https://media.githubusercontent.com/media/PDAL/data/main/autzen/autzen.laz
- PDAL source documentation: https://pdal.org/en/2.7.2/tutorial/clipping/index.html
- Source contains 10,653,336 returns. The viewer uses 650,000 seeded sampled returns in an approximately 850 x 800 meter crop near Autzen Stadium, Eugene, Oregon.
- WKT is read from the original liblas VLR; international feet are converted to meters. Source Z datum is not explicitly declared. The viewer is for exploration, not survey-grade measurements.
- Only ground (LAS class 2) and unclassified (class 1) occur in this sample. Tree and building classes are not inferred.
- Full provenance, source checksum, original WKT, local coordinate origin and binary layout are in `public/data/metadata.json`.
- Reproduce with `python scripts/prepare-data.py PATH_TO_AUTZEN_LAZ` after installing `laspy lazrs numpy pyproj`.

## Run

`npm install`, then `npm run dev`. `npm run build` produces a static export for hosting. No cloud data API, account, map token or runtime server is needed for the exported viewer.

## Interaction

Drag to orbit, right-drag to pan, scroll to zoom. Touch: one finger orbits; two fingers pan/pinch. Focus the map then use arrow keys to pan, + / - to zoom, or R to reset. Use 3D / Top to return to a fitted camera.

An optional feature-detected WebMCP `configure_lidar_view` tool uses the same UI state. No supported WebMCP validation context was available during implementation; its runtime contract has not been verified. Browsers without WebMCP retain the complete human interface.
