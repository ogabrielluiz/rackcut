# rackcut

Web-based Eurorack blank panel SVG generator for laser cutting. Add panels by HP and format, preview the cut sheet live, and download the SVG.

Supports 3U, 1U Intellijel, and 1U Pulp Logic formats with slot or circle mounting holes.

## Usage

Visit the live site: [rackcut on GitHub Pages](https://ogabrielluiz.github.io/rackcut/)

1. Set panel HP, format, and hole style
2. Click "Add" to add panels to the sheet
3. Adjust quantities with +/- buttons
4. Preview updates live
5. Click "Download SVG" to get your cut file

### ModularGrid Import

Paste a ModularGrid rack URL to automatically calculate needed blank panels.

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

## License

MIT
