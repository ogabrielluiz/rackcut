# rackcut — Design Spec

## Overview

A web-based utility for generating laser-cut Eurorack blank panel SVGs. Users add panels by specifying HP, format, and quantity, see a live preview of the cut sheet, and download the SVG. An optional ModularGrid import feature auto-calculates needed blanks from a rack URL.

Hosted on GitHub Pages. No backend except a Cloudflare Worker proxy for ModularGrid fetching.

## Architecture

### Static Site (GitHub Pages)

- **Stack**: Vite + React + TypeScript + Tailwind CSS + shadcn/ui
- **Build/Deploy**: GitHub Actions builds on push to `main`, deploys to `gh-pages` branch
- **Routing**: Single page, no router needed

### Cloudflare Worker (ModularGrid Proxy)

- **Purpose**: Fetches ModularGrid rack pages server-side to bypass CORS
- **Input**: `GET /parse?url=https://modulargrid.net/e/racks/view/XXXXX`
- **Output**: Raw HTML proxied back to the frontend. The Worker is a pure CORS proxy — all HTML parsing happens client-side in `lib/modulargrid.ts`.
- **Deployment**: Separate `worker/` directory in the repo, deployed via `wrangler`
- **Graceful degradation**: The main app works fully without the worker (manual panel entry)
- **Environment variable**: `VITE_WORKER_URL` — set to the deployed Cloudflare Worker URL in production. In local dev, either run the worker locally via `wrangler dev` or skip the ModularGrid feature (it's optional).

#### Worker Security

- **URL allowlist**: Only accepts URLs matching `https://www.modulargrid.net/e/racks/view/*` or `https://modulargrid.net/e/racks/view/*`. All other URLs return 400.
- **CORS**: `Access-Control-Allow-Origin` restricted to the GitHub Pages origin only.
- **Rate limiting**: Cloudflare's built-in rate limiting — 30 requests/minute per IP.
- **Response size cap**: Abort fetch if response body exceeds 2MB.
- **No caching of user data**: Worker is stateless, responses are not stored.

## UI Design

### Layout

Top controls bar + full-width SVG preview below (Option B).

### Visual Style

Industrial / Eurorack aesthetic:
- Dark background (`#1a1917` base)
- Warm metallic gold accents (`#c8b870`)
- Monospace typography
- Sharp corners (minimal border-radius)
- shadcn/ui components restyled to match the industrial theme

### Controls Bar (Top)

Left section — **Add Panel form** (inline/horizontal):
- HP input (number, 1–128)
- Format dropdown: 3U, 1U Intellijel, 1U Pulp Logic
- Hole style dropdown: Slot, Circle
- Quantity input (number, default 1)
- "Add" button

Center section — **Panel List**:
- Each panel as a compact row: `8HP 3U ×2`
- +/- buttons to adjust quantity
- Remove (×) button per panel
- "Clear all" link when list is non-empty

Right section — **Actions**:
- Gap setting (mm, default 2.0)
- "Download SVG" button
- "Import from ModularGrid" button (opens a dialog)

### SVG Preview (Main Area)

- Live-updating SVG rendered inline in the page
- Dark canvas background to contrast with the red cut lines
- SVG uses same color conventions as the Python script:
  - Red (`#FF0000`) = cut lines
  - Blue (`#0000FF`) = engrave lines
- Auto-scales to fit the viewport with padding
- Empty state: centered message "Add panels to preview your cut sheet"

### ModularGrid Import Dialog

- Input field for ModularGrid rack URL
- "Import" button → calls Cloudflare Worker
- Loading state while fetching
- Results view: shows each row with format, used HP, blank HP needed
- User can select which blanks to add (checkboxes, all selected by default)
- "Add Selected" button populates the panel list
- Error state if URL is invalid or worker is unreachable (with fallback message suggesting manual entry)

## Core Logic (TypeScript)

### Panel Computation (`lib/panel.ts`)

Port of the Python script's mechanical constants and computation:

```typescript
interface PanelSpec {
  width: number;      // mm
  height: number;     // mm
  hp: number;
  format: Format;     // "3u" | "1u-intellijel" | "1u-pulplogic"
  holes: [number, number][];  // [x, y] centers
  holeStyle: HoleStyle;       // "slot" | "circle"
}
```

Constants (all in mm):
- `HP_MM = 5.08`
- `PANEL_WIDTH_CLEARANCE = 0.3`
- `PANEL_HEIGHT_3U = 128.5`
- `PANEL_HEIGHT_1U_INTELLIJEL = 39.65`
- `PANEL_HEIGHT_1U_PULPLOGIC = 43.18`
- `HOLE_DIAMETER = 3.2`
- `SLOT_WIDTH = 3.2`, `SLOT_HEIGHT = 3.5`
- `HOLE_EDGE_OFFSET_H = 7.5`, `HOLE_EDGE_OFFSET_V = 3.0`
- `FOUR_HOLE_THRESHOLD_HP = 10`

Input validation:
- HP: integer, 1–128. Values outside this range are rejected.
- Gap: 0.5–20mm. Values outside this range show inline validation errors (same as HP).

Functions:
- `computePanel(hp, format, holeStyle)` → `PanelSpec` — throws on invalid HP or unknown format
- `layoutPanels(panels, gap)` → `{ placed: PlacedPanel[], sheetWidth, sheetHeight }`

### Layout Algorithm

Panels are grouped by height (i.e. by format), then each group is laid out as a horizontal row:

1. Group panels by `height` (rounded to 0.01mm to handle float precision)
2. Within each group, place panels left-to-right with `gap` mm between them
3. Stack groups vertically with `gap` mm between rows
4. Sheet size grows to fit — no maximum (the user controls this by how many panels they add)
5. Panels are never rotated

```typescript
interface PlacedPanel {
  spec: PanelSpec;
  x: number;  // mm, top-left corner
  y: number;  // mm, top-left corner
  label: string;  // e.g. "8HP 3U"
}
```

### SVG Generation (`lib/svg.ts`)

- `generateSvg(placed, sheetWidth, sheetHeight, margin?)` → SVG string
- `margin` defaults to 5mm, not user-configurable (internal padding around the sheet)
- Generates valid SVG with mm units
- Cut lines in red (`#FF0000`), stroke width 0.1mm
- Engrave text in blue (`#0000FF`): each panel gets a centered label showing `"{hp}HP {FORMAT}"` (e.g. "8HP 3U")
- Rounded slot holes or circular holes
- Download uses `Blob` + `URL.createObjectURL()` with a programmatic anchor click. Filename: `rackcut.svg`

### ModularGrid Parser (`lib/modulargrid.ts`)

- `parseModularGridData(html: string)` → `RackData`
- Extracts rows, modules, HP values from the HTML
- Calculates blank HP per row
- Determines format per row (3U vs 1U Intellijel). ModularGrid does not distinguish Pulp Logic 1U — all 1U rows are treated as Intellijel. Users can manually change the format after import if needed.
- **Defensive parsing**: validates that expected structural elements exist in the HTML. If the page structure has changed or is unrecognizable, throws a descriptive error (e.g. "ModularGrid page structure not recognized — please report this issue") rather than returning incorrect data.

```typescript
interface RackData {
  rows: {
    format: Format;
    totalHp: number;
    modules: { name: string; hp: number }[];
    usedHp: number;
    blankHp: number;
  }[];
}
```

## State Management

React state only (no external state library). The state is simple:

```typescript
interface AppState {
  panels: PanelEntry[];      // { id, hp, format, holeStyle, quantity }
  gap: number;               // mm, 0.5–20, default 2.0
}
```

The hole style dropdown in the Add Panel form defaults to "slot" and is per-panel — each panel entry stores its own hole style.

The SVG is derived/computed from `panels` and `gap` on every render (memoized).

## Testing Strategy

### Unit Tests (Vitest)

**Panel computation** (`lib/panel.test.ts`):
- All three formats produce correct dimensions
- HP 1 through various sizes: correct width calculation
- Hole positions: 2-hole layout below threshold, 4-hole at/above threshold
- Edge case: HP=1 (holes overlap to single position)
- Edge case: very large HP values
- Slot vs circle hole style flag

**SVG generation** (`lib/svg.test.ts`):
- Valid SVG output (parseable XML)
- Correct dimensions in mm
- Cut lines use red stroke
- Engrave text uses blue stroke
- Correct number of hole elements per panel
- Multi-panel sheets: panels don't overlap
- Empty panel list: valid empty SVG

**Sheet layout** (`lib/panel.test.ts`):
- Single panel placed at origin (0,0)
- Multiple same-height panels: placed in a row
- Mixed heights: grouped by height into separate rows
- Gap applied correctly between panels
- Sheet dimensions match expected bounds

**ModularGrid parser** (`lib/modulargrid.test.ts`):
- Parses known rack HTML structure
- Correct module extraction (name, HP)
- Correct blank HP calculation per row
- Handles edge cases: full rows (0 blank HP), empty rows
- Format detection (3U vs 1U)
- Error handling for invalid/unexpected HTML

### Component Tests (Vitest + Testing Library)

**Panel form** (`components/PanelForm.test.tsx`):
- Adding a panel updates the list
- Validation: HP must be ≥ 1
- Format and hole style dropdowns work
- Quantity defaults to 1

**Panel list** (`components/PanelList.test.tsx`):
- Displays all added panels
- +/- buttons adjust quantity
- Remove button deletes panel
- Clear all removes everything

**SVG preview** (`components/SvgPreview.test.tsx`):
- Renders SVG when panels exist
- Shows empty state message when no panels
- Updates when panels change

**ModularGrid dialog** (`components/ModularGridDialog.test.tsx`):
- Opens/closes correctly
- Validates URL format
- Shows loading state
- Displays parsed results
- Selecting/deselecting blanks works
- "Add Selected" populates panel list
- Error state shown on failure

### Worker Tests (Vitest, in `worker/`)

- Rejects non-ModularGrid URLs with 400
- Returns proper CORS headers (only allows GitHub Pages origin)
- Handles ModularGrid returning errors (404, 500) — proxies error status
- Aborts on oversized responses (>2MB)
- Proxies HTML content with correct content-type

### E2E Tests (Playwright)

- Full workflow: add panels → preview updates → download SVG → verify file contents
- ModularGrid import: paste URL → blanks appear → add to sheet → download
- Responsive: controls usable on smaller viewports
- SVG download: file is valid SVG with correct dimensions

## File Structure

```
rackcut/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Build + deploy to GitHub Pages
├── worker/
│   ├── src/
│   │   ├── index.ts            # Cloudflare Worker entry
│   │   └── index.test.ts       # Worker tests
│   ├── wrangler.toml
│   ├── vitest.config.ts
│   └── package.json
├── src/
│   ├── lib/
│   │   ├── panel.ts            # Panel computation + layout
│   │   ├── panel.test.ts
│   │   ├── svg.ts              # SVG string generation
│   │   ├── svg.test.ts
│   │   ├── modulargrid.ts      # ModularGrid HTML parser
│   │   └── modulargrid.test.ts
│   ├── components/
│   │   ├── PanelForm.tsx
│   │   ├── PanelForm.test.tsx
│   │   ├── PanelList.tsx
│   │   ├── PanelList.test.tsx
│   │   ├── SvgPreview.tsx
│   │   ├── SvgPreview.test.tsx
│   │   ├── ModularGridDialog.tsx
│   │   ├── ModularGridDialog.test.tsx
│   │   └── ui/                 # shadcn components
│   ├── App.tsx
│   ├── App.test.tsx
│   ├── main.tsx
│   └── index.css               # Tailwind + industrial theme
├── e2e/
│   └── app.spec.ts             # Playwright E2E tests
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
└── README.md
```

## Deployment

### GitHub Pages
- GitHub Actions workflow triggers on push to `main`
- Runs `pnpm install && pnpm build`
- Deploys `dist/` to GitHub Pages

### Cloudflare Worker
- Deployed separately via `wrangler deploy` from `worker/` directory
- Could also be automated via GitHub Actions
- Worker URL configured via `VITE_WORKER_URL` environment variable in the Vite build
- Node.js >= 18, pnpm >= 9. `pnpm-lock.yaml` committed to the repo.

## Error Handling

- **Invalid inputs**: HP and gap fields are validated on change. Out-of-range values show inline validation errors via shadcn form components. `computePanel` throws `PanelValidationError` (with a user-facing message) on invalid HP or unknown format — the UI catches this and shows a toast.
- **SVG generation**: Pure computation — errors here indicate bugs. Uncaught errors show a generic error boundary.
- **ModularGrid import**: Network errors and parse failures show a clear message in the dialog with a suggestion to use manual entry. The parser throws descriptive errors when the HTML structure is unrecognized.
- **Worker unreachable**: The import dialog shows "Could not reach the import service. You can add panels manually instead." No retry loop.

## Browser Support

Modern evergreen browsers: Chrome, Firefox, Safari, Edge. No IE11.

## Out of Scope

- User accounts / saving configurations
- Panel customization beyond blanks (cutouts, graphics)
- Direct laser cutter integration
- DXF or other file format export (SVG only for now)
