<p align="center">
  <img src="public/favicon.svg" alt="rackcut logo" width="80" height="80" />
</p>

<h1 align="center">rackcut</h1>

<p align="center">
  Web-based Eurorack blank panel SVG generator for laser cutting.<br />
  Add panels by HP and format, choose generative engrave patterns, preview the cut sheet live, and download the SVG.
</p>

<p align="center">
  <a href="https://ogabrielluiz.github.io/rackcut/">Live Site</a> &middot;
  <a href="https://www.buymeacoffee.com/ogabrielluiz">Buy Me a Coffee</a>
</p>

---

## Features

- **3U, 1U Intellijel, and 1U Pulp Logic** formats with slot or circle mounting holes
- **21 generative engrave patterns** — Spirograph, Lissajous, Voronoi, Lorenz Attractor, Chladni Figures, Flow Field, Sacred Geometry, and more
- **ModularGrid import** — paste a rack URL to auto-calculate needed blanks
- **Auto-splitting** — large blanks split into practical sizes (equal or fill-max)
- **Material preview** — see how panels look on MDF, birch plywood, walnut, black acrylic, aluminum, or as raw laser SVG
- **Reproducible patterns** — each panel has a seed number for exact reproduction
- **Per-panel customization** — edit HP, format, hole style, pattern, and seed inline

## Usage

Visit the live site: [ogabrielluiz.github.io/rackcut](https://ogabrielluiz.github.io/rackcut/)

1. Set panel HP, format, and hole style, then click **Add**
2. Configure sheet settings (gap, max HP, split mode)
3. Choose an engrave pattern — browse the gallery to preview all 21
4. Edit any panel inline (size, format, pattern, seed)
5. Preview your cut sheet with different material views
6. Click **Download SVG** to get your laser-ready file

Downloaded SVGs use standard laser cutter color conventions: **red** (#FF0000) for cut lines, **blue** (#0000FF) for engrave lines.

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

## Related projects

- [**Voltpages**](https://ogabrielluiz.github.io/voltpages/) — quick-reference cheat sheets for eurorack modules (controls, I/O, behaviors, patch ideas).

## License

MIT
