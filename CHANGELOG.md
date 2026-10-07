# Changelog

Notable changes to rackcut, newest first.

rackcut is continuously deployed — merging to `main` publishes to
[ogabrielluiz.github.io/rackcut](https://ogabrielluiz.github.io/rackcut/) — so entries are
dated by the day they went live rather than grouped into version numbers.

## 2026-10-07

### Added

- **Patterns made for 3D printing.** Eight surfaces (Damascus, Marble, Topo, Chladni Plate,
  Interference, Cells, Labyrinth, Ripple), each available as sculpted relief or as two-tone
  bands. They cover the whole panel at any width, 1 HP and 2 HP included, and stay flat around
  the mounting holes so screw heads seat properly. Pattern menus are now grouped into line art,
  relief and two-tone bands.
- **Two-colour panels without a multi-material printer.** Bands are raised above the panel
  face, so switching filament at the first layer above the panel thickness prints them in a
  second colour. The download dialog shows that height, and a second colour picker previews it.
- **Print-accurate preview.** In 3D Print mode the 2D sheet shows relief lit from the upper
  left and bands in both filament colours, and the pattern gallery includes the new patterns.
- **Relief height setting**, separate from the height of raised lines and bands, defaulting
  to 1 mm. Printed face up, that is 5 steps at 0.2 mm layers; finer layers give a smoother
  surface.
- In laser mode, the new patterns engrave as the outlines of their bands.
- **Your sheet is remembered.** Panels, with their patterns and seeds, and the settings around
  them (mode, material, colours, default pattern, gap and split) are saved in the browser's
  local storage and restored on the next visit. Nothing is sent anywhere; "Clear all" empties
  the saved sheet too.
- **Panel thickness presets** in the download dialog: 1.6 mm (PCB panels), 2 mm (Eurorack
  standard) and 3 mm (sturdy), next to the custom value. The dialog also shows the highest
  point of the print, panel plus pattern.

### Changed

- **Printed panels are 2 mm thick by default instead of 3 mm.** 2 mm is what module panels
  measure (Doepfer specifies 2 mm aluminium), so a printed blank now sits level with its
  neighbours. The old hint called 3 mm "standard"; it is still available as a preset.
- Raised lines and bands default to 0.6 mm high (three 0.2 mm layers) instead of 0.5 mm.

### Fixed

- **Printed panels were the mirror image of the 2D sheet.** The STL was built in the sheet's
  top-down coordinates without flipping, so holes landed on the opposite diagonal from the
  laser-cut version. Prints now match the sheet.
- **Raised line patterns were too thin to print.** Lines were 0.25 mm wide, narrower than a
  0.4 mm nozzle can lay down, and slicers dropped most of them. They are now 0.45 mm wide.
- **Some STL files were not closed solids.** Overlapping line segments were stacked instead of
  merged, which left about half of the line patterns with open meshes on wide panels.
- **Exporting many panels at once could fail** with a "memory access out of bounds" error,
  because the 3D engine's memory was never released between panels.

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
