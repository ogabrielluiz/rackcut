<p align="center">
  <img src="public/favicon.svg" alt="rackcut logo" width="80" height="80" />
</p>

<h1 align="center">rackcut</h1>

<p align="center">
  Web-based Eurorack blank panel generator for laser cutting and 3D printing.<br />
  Add panels by HP and format, choose generative patterns, preview the sheet live, and download the SVG or STL files.
</p>

<p align="center">
  <a href="https://ogabrielluiz.github.io/rackcut/">Live Site</a> &middot;
  <a href="https://www.buymeacoffee.com/ogabrielluiz">Buy Me a Coffee</a>
</p>

---

## Features

- **3U, 1U Intellijel, and 1U Pulp Logic** formats with slot or circle mounting holes
- **21 generative engrave patterns** — Spirograph, Lissajous, Voronoi, Lorenz Attractor, Chladni Figures, Flow Field, Sacred Geometry, and more
- **16 patterns made for 3D printing** — eight surfaces (Damascus, Marble, Topo, Chladni Plate, Interference, Cells, Labyrinth, Ripple), each as sculpted relief or as two-tone bands
- **STL export with 3D preview** — one printable file per panel, with the pattern raised on the face
- **ModularGrid import** — paste a rack URL to auto-calculate needed blanks
- **Auto-splitting** — large blanks split into practical sizes (equal or fill-max)
- **Material preview** — see how panels look on MDF, birch plywood, walnut, black acrylic, aluminum, or as raw laser SVG
- **Reproducible patterns** — each panel has a seed number for exact reproduction
- **Per-panel customization** — edit HP, format, hole style, pattern, and seed inline
- **Picks up where you left off** — your panels and settings are saved in the browser and restored on your next visit; nothing is uploaded

## Usage

Visit the live site: [ogabrielluiz.github.io/rackcut](https://ogabrielluiz.github.io/rackcut/)

1. Set panel HP, format, and hole style, then click **Add**
2. Configure sheet settings (gap, max HP, split mode)
3. Choose an engrave pattern — browse the gallery to preview all 21
4. Edit any panel inline (size, format, pattern, seed)
5. Preview your cut sheet with different material views
6. Click **Download SVG** to get your laser-ready file

Downloaded SVGs use standard laser cutter color conventions: **red** (#FF0000) for cut lines, **blue** (#0000FF) for engrave lines.

### 3D printing

Switch **Mode** to **3D Print (STL)**, pick a filament colour, and **Download STL** gives you a ZIP with one STL per panel.

Panels are 2 mm thick by default, the thickness of real Eurorack module panels, so a printed blank sits level with the modules beside it. The download dialog also offers 1.6 mm (the thickness of PCB panels) and 3 mm (stiffer, but 1 mm proud), or any custom value, and shows the highest point of the print once the pattern is added.

The patterns under **Relief** and **Two-tone bands** are designed for a printer rather than a laser. They cover the whole panel at any width, and stay flat around the mounting holes so screw heads seat properly.

- **Relief** is a continuous sculpted surface in one colour. Printed face up, it is built in steps of one layer: the default 1 mm height gives 5 steps at 0.2 mm layers, and finer layers give a smoother surface.
- **Two-tone bands** are flat raised areas. Print the panel in one filament and switch to a second at the first layer above the panel thickness (2 mm by default). The download dialog shows the exact height.

Line-art patterns print too, as raised lines one nozzle width (0.45 mm) wide. In laser mode, the relief and band patterns engrave as outlines.

Panels print face up, with the back on the bed. The STL matches the 2D sheet: the top-left hole on screen is the top-left hole of the print.

### ModularGrid Import

Paste a ModularGrid rack URL to automatically calculate the blank panels you need. The tool detects each row's format (3U or 1U) and calculates the remaining HP.

## Development

```bash
pnpm install
pnpm dev          # Start dev server
pnpm vitest run   # Run unit tests
pnpm build        # Production build
```

### Cloudflare Worker (CORS proxy for ModularGrid)

```bash
cd worker
pnpm install
pnpm exec wrangler dev    # Local dev
pnpm exec wrangler deploy # Deploy to Cloudflare
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for notable changes.

## Related projects

- [**Voltpages**](https://ogabrielluiz.github.io/voltpages/) — quick-reference cheat sheets for eurorack modules (controls, I/O, behaviors, patch ideas).

## License

MIT
