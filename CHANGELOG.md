# Changelog

Notable changes to rackcut, newest first.

rackcut is continuously deployed — merging to `main` publishes to
[ogabrielluiz.github.io/rackcut](https://ogabrielluiz.github.io/rackcut/) — so entries are
dated by the day they went live rather than grouped into version numbers.

## 2026-09-14

### Fixed

- **Mounting holes fell outside 1 HP panels.** Holes were placed at a fixed 7.5 mm from the
  left edge regardless of panel width, so on a 4.78 mm wide 1 HP blank they landed past the
  right edge — visibly outside the outline in the SVG, STL, and preview. Holes now step left
  by whole HP increments until they fit. Each step lands on the same rack thread grid, so
  panels still bolt up; a 1 HP blank simply uses the previous rail position. Panels of 3 HP
  and wider are unchanged.
- **Slots on very narrow panels left unusable material.** A 4 mm slot cannot fit a 1 HP panel
  at all, and on 2 HP it left 0.36 mm of material at the edge — thin enough to snap off in
  MDF or acrylic. Those panels now fall back to a round hole, shown as a `→ round` hint next
  to the hole style selector.

## 2026-03-25

### Added

- **3D print mode** — export panels as STL files with raised engrave patterns instead of
  laser-cut lines, preview them in 3D, and pick a filament color.

## 2026-03-23

### Added

- **Mobile and responsive support** across the whole app.

### Fixed

- Slot mounting holes are now horizontal (wider than tall), so panels can be shifted for
  alignment once mounted.
- Slot dimensions and the pattern dropdown width.
- Download button overflowing on narrow screens.

## 2026-03-22

Initial release.

### Added

- Blank panel generation for **3U, 1U Intellijel, and 1U Pulp Logic** formats, with slot or
  circle mounting holes.
- **21 generative engrave patterns** — Spirograph, Lissajous, Voronoi, Lorenz Attractor,
  Chladni Figures, Flow Field, Sacred Geometry, and more.
- **ModularGrid import** — paste a rack URL to auto-calculate the blanks you need, via a
  Cloudflare Worker CORS proxy.
- **Auto-splitting** of large blanks into practical sizes (equal or fill-max).
- **Material preview** — MDF, birch plywood, walnut, black acrylic, aluminum, or raw laser SVG.
- **Reproducible patterns** — every panel carries a seed for exact reproduction.
- **Per-panel inline editing** of HP, format, hole style, pattern, and seed.
- SVG export using standard laser conventions: red (#FF0000) cut lines, blue (#0000FF)
  engrave lines.
