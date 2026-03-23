# rackcut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based Eurorack blank panel SVG generator with live preview, hosted on GitHub Pages, with an optional ModularGrid import via Cloudflare Worker.

**Architecture:** Client-side React app with pure-function core logic (panel math, layout, SVG generation). All computation happens in the browser. A separate Cloudflare Worker acts as a CORS proxy for ModularGrid HTML fetching. The frontend parses the HTML client-side.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS v4, shadcn/ui, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-03-22-rackcut-design.md`

---

## File Structure

```
rackcut/
├── .github/workflows/deploy.yml       # GitHub Pages CI/CD
├── worker/
│   ├── src/index.ts                    # Cloudflare Worker — CORS proxy
│   ├── src/index.test.ts               # Worker unit tests
│   ├── wrangler.toml                   # Worker config
│   ├── vitest.config.ts                # Worker test config
│   ├── tsconfig.json
│   └── package.json
├── src/
│   ├── lib/
│   │   ├── constants.ts                # Mechanical constants (HP_MM, heights, offsets)
│   │   ├── types.ts                    # Shared types (Format, HoleStyle, PanelSpec, etc.)
│   │   ├── panel.ts                    # computePanel + layoutPanels
│   │   ├── panel.test.ts
│   │   ├── svg.ts                      # generateSvg + downloadSvg
│   │   ├── svg.test.ts
│   │   ├── modulargrid.ts              # parseModularGridData
│   │   └── modulargrid.test.ts
│   ├── components/
│   │   ├── ui/                         # shadcn components (Button, Input, Select, Dialog, etc.)
│   │   ├── PanelForm.tsx               # Add panel form (HP, format, hole style, qty)
│   │   ├── PanelForm.test.tsx
│   │   ├── PanelList.tsx               # Panel list with +/- qty, remove, clear all
│   │   ├── PanelList.test.tsx
│   │   ├── SvgPreview.tsx              # Live SVG preview area
│   │   ├── SvgPreview.test.tsx
│   │   ├── ModularGridDialog.tsx       # Import dialog with URL input + results
│   │   └── ModularGridDialog.test.tsx
│   ├── App.tsx                         # Main app — state + composition
│   ├── App.test.tsx                    # Integration tests
│   ├── main.tsx                        # Entry point
│   └── index.css                       # Tailwind base + industrial theme
├── e2e/
│   └── app.spec.ts                     # Playwright E2E tests
├── index.html
├── components.json                     # shadcn config
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── .gitignore
└── README.md
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tailwind.config.ts`, `vitest.config.ts`, `index.html`, `src/main.tsx`, `src/index.css`, `src/App.tsx`, `components.json`, `.gitignore`

- [ ] **Step 1: Scaffold Vite + React + TypeScript project**

```bash
cd /Users/ogabrielluiz/Projects/rackcut
pnpm create vite@latest . --template react-ts
```

Select: React, TypeScript

- [ ] **Step 2: Install core dependencies**

```bash
pnpm add tailwindcss @tailwindcss/vite
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom happy-dom
```

- [ ] **Step 3: Configure Tailwind in Vite**

In `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

In `src/index.css`, replace contents with:
```css
@import "tailwindcss";
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

Create `src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest'
```

Add to `tsconfig.app.json` compilerOptions:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

Add to `vite.config.ts`:
```typescript
import path from 'path'
// inside defineConfig:
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
},
```

- [ ] **Step 5: Initialize shadcn/ui**

```bash
pnpm dlx shadcn@latest init
```

Choose: New York style, Zinc base color, CSS variables: yes.

Then install needed components:
```bash
pnpm dlx shadcn@latest add button input select dialog label toast sonner
```

- [ ] **Step 6: Set up industrial theme**

Update `src/index.css` with the industrial dark theme:
```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: #1a1917;
  --color-foreground: #e8e4d9;
  --color-card: #222019;
  --color-card-foreground: #e8e4d9;
  --color-popover: #222019;
  --color-popover-foreground: #e8e4d9;
  --color-primary: #c8b870;
  --color-primary-foreground: #1a1917;
  --color-secondary: #2a2820;
  --color-secondary-foreground: #e8e4d9;
  --color-muted: #2a2820;
  --color-muted-foreground: #8a8470;
  --color-accent: #2a2820;
  --color-accent-foreground: #c8b870;
  --color-destructive: #dc2626;
  --color-destructive-foreground: #fef2f2;
  --color-border: #3a3830;
  --color-input: #3a3830;
  --color-ring: #c8b870;
  --radius: 0.125rem;
  --font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace;
}

body {
  font-family: var(--font-mono);
  background-color: var(--color-background);
  color: var(--color-foreground);
}
```

- [ ] **Step 7: Create minimal App.tsx placeholder**

```tsx
function App() {
  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <h1 className="text-primary text-2xl p-4">rackcut</h1>
    </div>
  )
}

export default App
```

- [ ] **Step 8: Verify dev server and build work**

```bash
pnpm dev &
sleep 3
curl -s http://localhost:5173 | head -20
kill %1
pnpm build
```

Expected: Dev server responds with HTML, build completes without errors.

- [ ] **Step 9: Verify test runner works**

Create `src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders app title', () => {
  render(<App />)
  expect(screen.getByText('rackcut')).toBeInTheDocument()
})
```

```bash
pnpm vitest run
```

Expected: 1 test passes.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + shadcn project"
```

---

### Task 2: Types and Constants

**Files:**
- Create: `src/lib/types.ts`, `src/lib/constants.ts`

- [ ] **Step 1: Create shared types**

Create `src/lib/types.ts`:
```typescript
export type Format = "3u" | "1u-intellijel" | "1u-pulplogic";

export type HoleStyle = "slot" | "circle";

export interface PanelSpec {
  width: number;
  height: number;
  hp: number;
  format: Format;
  holes: [number, number][];
  holeStyle: HoleStyle;
}

export interface PlacedPanel {
  spec: PanelSpec;
  x: number;
  y: number;
  label: string;
}

export interface PanelEntry {
  id: string;
  hp: number;
  format: Format;
  holeStyle: HoleStyle;
  quantity: number;
}

export interface RackRow {
  format: Format;
  totalHp: number;
  modules: { name: string; hp: number }[];
  usedHp: number;
  blankHp: number;
}

export interface RackData {
  rows: RackRow[];
}

export class PanelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanelValidationError";
  }
}
```

- [ ] **Step 2: Create constants**

Create `src/lib/constants.ts`:
```typescript
// All values in mm — based on Doepfer A-100 and Intellijel specs

export const HP_MM = 5.08;
export const PANEL_WIDTH_CLEARANCE = 0.3;

export const PANEL_HEIGHT_3U = 128.5;
export const PANEL_HEIGHT_1U_INTELLIJEL = 39.65;
export const PANEL_HEIGHT_1U_PULPLOGIC = 43.18;

export const HOLE_DIAMETER = 3.2;
export const SLOT_WIDTH = 3.2;
export const SLOT_HEIGHT = 3.5;

export const HOLE_EDGE_OFFSET_H = 7.5;
export const HOLE_EDGE_OFFSET_V = 3.0;

export const FOUR_HOLE_THRESHOLD_HP = 10;

export const CUT_COLOR = "#FF0000";
export const ENGRAVE_COLOR = "#0000FF";
export const CUT_STROKE_WIDTH = 0.1;

export const FORMAT_PARAMS = {
  "3u": {
    height: PANEL_HEIGHT_3U,
    holeEdgeV: HOLE_EDGE_OFFSET_V,
  },
  "1u-intellijel": {
    height: PANEL_HEIGHT_1U_INTELLIJEL,
    holeEdgeV: HOLE_EDGE_OFFSET_V,
  },
  "1u-pulplogic": {
    height: PANEL_HEIGHT_1U_PULPLOGIC,
    holeEdgeV: HOLE_EDGE_OFFSET_V,
  },
} as const;

export const MIN_HP = 1;
export const MAX_HP = 128;
export const MIN_GAP = 0.5;
export const MAX_GAP = 20;
export const DEFAULT_GAP = 2.0;
export const SVG_MARGIN = 5.0;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add shared types and mechanical constants"
```

---

### Task 3: Panel Computation (TDD)

**Files:**
- Create: `src/lib/panel.ts`, `src/lib/panel.test.ts`

- [ ] **Step 1: Write failing tests for computePanel**

Create `src/lib/panel.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computePanel, layoutPanels } from "./panel";
import { HP_MM, PANEL_WIDTH_CLEARANCE, PANEL_HEIGHT_3U, PANEL_HEIGHT_1U_INTELLIJEL, PANEL_HEIGHT_1U_PULPLOGIC, HOLE_EDGE_OFFSET_H, HOLE_EDGE_OFFSET_V, FOUR_HOLE_THRESHOLD_HP } from "./constants";

describe("computePanel", () => {
  describe("dimensions", () => {
    it("calculates correct width for 8HP 3U", () => {
      const panel = computePanel(8, "3u", "slot");
      expect(panel.width).toBeCloseTo(8 * HP_MM - PANEL_WIDTH_CLEARANCE, 2);
      expect(panel.height).toBe(PANEL_HEIGHT_3U);
    });

    it("calculates correct width for 1HP", () => {
      const panel = computePanel(1, "3u", "slot");
      expect(panel.width).toBeCloseTo(1 * HP_MM - PANEL_WIDTH_CLEARANCE, 2);
    });

    it("calculates correct height for 1U Intellijel", () => {
      const panel = computePanel(8, "1u-intellijel", "slot");
      expect(panel.height).toBe(PANEL_HEIGHT_1U_INTELLIJEL);
    });

    it("calculates correct height for 1U Pulp Logic", () => {
      const panel = computePanel(8, "1u-pulplogic", "slot");
      expect(panel.height).toBe(PANEL_HEIGHT_1U_PULPLOGIC);
    });

    it("calculates correct width for large HP (128)", () => {
      const panel = computePanel(128, "3u", "slot");
      expect(panel.width).toBeCloseTo(128 * HP_MM - PANEL_WIDTH_CLEARANCE, 2);
    });
  });

  describe("hole positions", () => {
    it("places 2 holes for panels below threshold (8HP)", () => {
      const panel = computePanel(8, "3u", "slot");
      expect(panel.holes).toHaveLength(2);
    });

    it("places 4 holes for panels at threshold (10HP)", () => {
      const panel = computePanel(10, "3u", "slot");
      expect(panel.holes).toHaveLength(4);
    });

    it("places 4 holes for panels above threshold (20HP)", () => {
      const panel = computePanel(20, "3u", "slot");
      expect(panel.holes).toHaveLength(4);
    });

    it("2-hole layout: top-left and bottom-right diagonal", () => {
      const panel = computePanel(8, "3u", "slot");
      const [h1, h2] = panel.holes;
      // First hole at top
      expect(h1[1]).toBeCloseTo(HOLE_EDGE_OFFSET_V, 2);
      // Second hole at bottom
      expect(h2[1]).toBeCloseTo(PANEL_HEIGHT_3U - HOLE_EDGE_OFFSET_V, 2);
    });

    it("4-hole layout: all four corners", () => {
      const panel = computePanel(12, "3u", "slot");
      const topY = HOLE_EDGE_OFFSET_V;
      const bottomY = PANEL_HEIGHT_3U - HOLE_EDGE_OFFSET_V;
      const leftX = HOLE_EDGE_OFFSET_H;
      const rightX = HOLE_EDGE_OFFSET_H + (12 - 3) * HP_MM;

      expect(panel.holes).toContainEqual([leftX, topY]);
      expect(panel.holes).toContainEqual([rightX, topY]);
      expect(panel.holes).toContainEqual([leftX, bottomY]);
      expect(panel.holes).toContainEqual([rightX, bottomY]);
    });

    it("HP=1 collapses holes to same X position", () => {
      const panel = computePanel(1, "3u", "slot");
      expect(panel.holes[0][0]).toBe(panel.holes[1][0]);
    });
  });

  describe("hole style", () => {
    it("stores slot hole style", () => {
      const panel = computePanel(8, "3u", "slot");
      expect(panel.holeStyle).toBe("slot");
    });

    it("stores circle hole style", () => {
      const panel = computePanel(8, "3u", "circle");
      expect(panel.holeStyle).toBe("circle");
    });
  });

  describe("metadata", () => {
    it("stores hp and format", () => {
      const panel = computePanel(8, "1u-intellijel", "slot");
      expect(panel.hp).toBe(8);
      expect(panel.format).toBe("1u-intellijel");
    });
  });

  describe("validation", () => {
    it("throws PanelValidationError for HP < 1", () => {
      expect(() => computePanel(0, "3u", "slot")).toThrow("HP must be between 1 and 128");
    });

    it("throws PanelValidationError for HP > 128", () => {
      expect(() => computePanel(129, "3u", "slot")).toThrow("HP must be between 1 and 128");
    });

    it("throws PanelValidationError for unknown format", () => {
      expect(() => computePanel(8, "invalid" as any, "slot")).toThrow("Unknown format");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/lib/panel.test.ts
```

Expected: All tests FAIL — module `./panel` not found.

- [ ] **Step 3: Implement computePanel**

Create `src/lib/panel.ts`:
```typescript
import {
  HP_MM, PANEL_WIDTH_CLEARANCE, HOLE_EDGE_OFFSET_H, HOLE_EDGE_OFFSET_V,
  FOUR_HOLE_THRESHOLD_HP, FORMAT_PARAMS, MIN_HP, MAX_HP,
} from "./constants";
import { Format, HoleStyle, PanelSpec, PlacedPanel, PanelValidationError } from "./types";

export function computePanel(hp: number, format: Format, holeStyle: HoleStyle): PanelSpec {
  if (hp < MIN_HP || hp > MAX_HP || !Number.isInteger(hp)) {
    throw new PanelValidationError(`HP must be between ${MIN_HP} and ${MAX_HP}`);
  }

  const params = FORMAT_PARAMS[format];
  if (!params) {
    throw new PanelValidationError(`Unknown format '${format}'. Options: ${Object.keys(FORMAT_PARAMS).join(", ")}`);
  }

  const width = hp * HP_MM - PANEL_WIDTH_CLEARANCE;
  const height = params.height;
  const topY = params.holeEdgeV;
  const bottomY = height - params.holeEdgeV;

  const leftX = HOLE_EDGE_OFFSET_H;
  let rightX = HOLE_EDGE_OFFSET_H + (hp - 3) * HP_MM;
  if (rightX <= leftX) {
    rightX = leftX;
  }

  let holes: [number, number][];
  if (hp < FOUR_HOLE_THRESHOLD_HP) {
    if (rightX > leftX) {
      holes = [[leftX, topY], [rightX, bottomY]];
    } else {
      holes = [[leftX, topY], [leftX, bottomY]];
    }
  } else {
    holes = [
      [leftX, topY], [rightX, topY],
      [leftX, bottomY], [rightX, bottomY],
    ];
  }

  return { width, height, hp, format, holes, holeStyle };
}
```

- [ ] **Step 4: Run tests to verify computePanel passes**

```bash
pnpm vitest run src/lib/panel.test.ts
```

Expected: All computePanel tests PASS.

- [ ] **Step 5: Write failing tests for layoutPanels**

Append to `src/lib/panel.test.ts`:
```typescript
describe("layoutPanels", () => {
  it("returns empty result for no panels", () => {
    const result = layoutPanels([], 2);
    expect(result.placed).toHaveLength(0);
    expect(result.sheetWidth).toBe(0);
    expect(result.sheetHeight).toBe(0);
  });

  it("places single panel at origin (0,0)", () => {
    const spec = computePanel(8, "3u", "slot");
    const result = layoutPanels([{ spec, label: "8HP 3U" }], 2);
    expect(result.placed).toHaveLength(1);
    expect(result.placed[0].x).toBe(0);
    expect(result.placed[0].y).toBe(0);
  });

  it("places same-height panels left-to-right with gap", () => {
    const s1 = computePanel(8, "3u", "slot");
    const s2 = computePanel(10, "3u", "slot");
    const result = layoutPanels([
      { spec: s1, label: "8HP 3U" },
      { spec: s2, label: "10HP 3U" },
    ], 2);

    expect(result.placed[0].x).toBe(0);
    expect(result.placed[1].x).toBeCloseTo(s1.width + 2, 2);
  });

  it("groups different-height panels into separate rows", () => {
    const s3u = computePanel(8, "3u", "slot");
    const s1u = computePanel(8, "1u-intellijel", "slot");
    const result = layoutPanels([
      { spec: s3u, label: "8HP 3U" },
      { spec: s1u, label: "8HP 1U" },
    ], 2);

    // They should be on different rows (different Y)
    const y0 = result.placed.find(p => p.spec.format === "3u")!.y;
    const y1 = result.placed.find(p => p.spec.format === "1u-intellijel")!.y;
    expect(y0).not.toBe(y1);
  });

  it("applies gap between rows", () => {
    const s3u = computePanel(8, "3u", "slot");
    const s1u = computePanel(8, "1u-intellijel", "slot");
    const gap = 3;
    const result = layoutPanels([
      { spec: s3u, label: "8HP 3U" },
      { spec: s1u, label: "8HP 1U" },
    ], gap);

    const placed3u = result.placed.find(p => p.spec.format === "3u")!;
    const placed1u = result.placed.find(p => p.spec.format === "1u-intellijel")!;

    // Second row starts after first row height + gap
    const expectedY = Math.min(placed3u.y, placed1u.y) +
      (placed3u.y < placed1u.y ? s3u.height : s1u.height) + gap;
    const actualY = Math.max(placed3u.y, placed1u.y);
    expect(actualY).toBeCloseTo(expectedY, 2);
  });

  it("calculates correct sheet dimensions", () => {
    const s1 = computePanel(8, "3u", "slot");
    const s2 = computePanel(10, "3u", "slot");
    const gap = 2;
    const result = layoutPanels([
      { spec: s1, label: "8HP 3U" },
      { spec: s2, label: "10HP 3U" },
    ], gap);

    expect(result.sheetWidth).toBeCloseTo(s1.width + gap + s2.width, 2);
    expect(result.sheetHeight).toBeCloseTo(s1.height, 2);
  });
});
```

- [ ] **Step 6: Run tests to verify layout tests fail**

```bash
pnpm vitest run src/lib/panel.test.ts
```

Expected: layoutPanels tests FAIL.

- [ ] **Step 7: Implement layoutPanels**

Append to `src/lib/panel.ts`:
```typescript
export function layoutPanels(
  panels: { spec: PanelSpec; label: string }[],
  gap: number
): { placed: PlacedPanel[]; sheetWidth: number; sheetHeight: number } {
  if (panels.length === 0) {
    return { placed: [], sheetWidth: 0, sheetHeight: 0 };
  }

  // Group by height
  const groups = new Map<number, { spec: PanelSpec; label: string }[]>();
  for (const panel of panels) {
    const key = Math.round(panel.spec.height * 100) / 100;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(panel);
  }

  const placed: PlacedPanel[] = [];
  let sheetWidth = 0;
  let yCursor = 0;

  for (const [, group] of groups) {
    let xCursor = 0;
    let rowHeight = 0;

    for (const { spec, label } of group) {
      placed.push({ spec, x: xCursor, y: yCursor, label });
      rowHeight = Math.max(rowHeight, spec.height);
      xCursor += spec.width + gap;
    }

    sheetWidth = Math.max(sheetWidth, xCursor - gap);
    yCursor += rowHeight + gap;
  }

  const sheetHeight = yCursor - gap;
  return { placed, sheetWidth, sheetHeight };
}
```

- [ ] **Step 8: Run all panel tests**

```bash
pnpm vitest run src/lib/panel.test.ts
```

Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/panel.ts src/lib/panel.test.ts
git commit -m "feat: add panel computation and layout algorithm with tests"
```

---

### Task 4: SVG Generation (TDD)

**Files:**
- Create: `src/lib/svg.ts`, `src/lib/svg.test.ts`

- [ ] **Step 1: Write failing tests for generateSvg**

Create `src/lib/svg.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generateSvg } from "./svg";
import { computePanel, layoutPanels } from "./panel";
import { CUT_COLOR, ENGRAVE_COLOR, SVG_MARGIN } from "./constants";

function parseSvg(svgString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(svgString, "image/svg+xml");
}

describe("generateSvg", () => {
  it("returns valid SVG with xml declaration", () => {
    const svg = generateSvg([], 0, 0);
    expect(svg).toContain('<?xml version="1.0"');
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("sets dimensions in mm", () => {
    const svg = generateSvg([], 100, 50);
    expect(svg).toMatch(/width="[\d.]+mm"/);
    expect(svg).toMatch(/height="[\d.]+mm"/);
  });

  it("includes margin in viewBox", () => {
    const svg = generateSvg([], 100, 50, 5);
    // viewBox should be 0 0 110 60
    expect(svg).toContain('viewBox="0 0 110.00 60.00"');
  });

  it("renders panel outline as red rect", () => {
    const spec = computePanel(8, "3u", "slot");
    const placed = [{ spec, x: 0, y: 0, label: "8HP 3U" }];
    const svg = generateSvg(placed, spec.width, spec.height);
    const doc = parseSvg(svg);
    const rects = doc.querySelectorAll("rect");
    const outlineRect = Array.from(rects).find(
      (r) => r.getAttribute("stroke") === CUT_COLOR &&
        parseFloat(r.getAttribute("width") || "0") > 10
    );
    expect(outlineRect).toBeDefined();
  });

  it("renders engrave label in blue", () => {
    const spec = computePanel(8, "3u", "slot");
    const placed = [{ spec, x: 0, y: 0, label: "8HP 3U" }];
    const svg = generateSvg(placed, spec.width, spec.height);
    const doc = parseSvg(svg);
    const texts = doc.querySelectorAll("text");
    const engraveText = Array.from(texts).find(
      (t) => t.getAttribute("stroke") === ENGRAVE_COLOR
    );
    expect(engraveText).toBeDefined();
    expect(engraveText?.textContent).toBe("8HP 3U");
  });

  it("renders correct number of slot holes", () => {
    const spec = computePanel(8, "3u", "slot");
    const placed = [{ spec, x: 0, y: 0, label: "8HP 3U" }];
    const svg = generateSvg(placed, spec.width, spec.height);
    const doc = parseSvg(svg);
    // Slot holes are small rects with rounded corners (rx > 0)
    const rects = doc.querySelectorAll("rect");
    const holeRects = Array.from(rects).filter(
      (r) => r.getAttribute("stroke") === CUT_COLOR &&
        parseFloat(r.getAttribute("rx") || "0") > 0 &&
        parseFloat(r.getAttribute("width") || "999") < 5
    );
    expect(holeRects).toHaveLength(spec.holes.length);
  });

  it("renders circle holes when style is circle", () => {
    const spec = computePanel(8, "3u", "circle");
    const placed = [{ spec, x: 0, y: 0, label: "8HP 3U" }];
    const svg = generateSvg(placed, spec.width, spec.height);
    const doc = parseSvg(svg);
    const circles = doc.querySelectorAll("circle");
    expect(circles).toHaveLength(spec.holes.length);
  });

  it("renders 4 holes for 12HP panel", () => {
    const spec = computePanel(12, "3u", "slot");
    const placed = [{ spec, x: 0, y: 0, label: "12HP 3U" }];
    const svg = generateSvg(placed, spec.width, spec.height);
    const doc = parseSvg(svg);
    const rects = doc.querySelectorAll("rect");
    const holeRects = Array.from(rects).filter(
      (r) => r.getAttribute("stroke") === CUT_COLOR &&
        parseFloat(r.getAttribute("rx") || "0") > 0 &&
        parseFloat(r.getAttribute("width") || "999") < 5
    );
    expect(holeRects).toHaveLength(4);
  });

  it("multi-panel sheet: panels don't overlap", () => {
    const s1 = computePanel(8, "3u", "slot");
    const s2 = computePanel(10, "3u", "slot");
    const { placed, sheetWidth, sheetHeight } = layoutPanels([
      { spec: s1, label: "8HP 3U" },
      { spec: s2, label: "10HP 3U" },
    ], 2);

    // Ensure second panel starts after first panel ends
    expect(placed[1].x).toBeGreaterThanOrEqual(placed[0].x + s1.width);

    // SVG should render without error
    const svg = generateSvg(placed, sheetWidth, sheetHeight);
    expect(svg).toContain("</svg>");
  });

  it("empty panel list produces valid SVG", () => {
    const svg = generateSvg([], 0, 0);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/lib/svg.test.ts
```

Expected: FAIL — module `./svg` not found.

- [ ] **Step 3: Implement generateSvg**

Create `src/lib/svg.ts`:
```typescript
import {
  CUT_COLOR, ENGRAVE_COLOR, CUT_STROKE_WIDTH,
  SLOT_WIDTH, SLOT_HEIGHT, HOLE_DIAMETER, SVG_MARGIN,
} from "./constants";
import { PlacedPanel } from "./types";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function svgSlot(cx: number, cy: number, w: number, h: number): string {
  const r = Math.min(w, h) / 2;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return `      <rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" rx="${r.toFixed(3)}" ry="${r.toFixed(3)}" fill="none" stroke="${CUT_COLOR}" stroke-width="${CUT_STROKE_WIDTH}" />\n`;
}

function svgCircle(cx: number, cy: number, r: number): string {
  return `      <circle cx="${cx.toFixed(3)}" cy="${cy.toFixed(3)}" r="${r.toFixed(3)}" fill="none" stroke="${CUT_COLOR}" stroke-width="${CUT_STROKE_WIDTH}" />\n`;
}

function renderPanel(pp: PlacedPanel): string {
  const s = pp.spec;
  const lines: string[] = [];

  lines.push(`    <!-- ${pp.label} : ${s.width.toFixed(2)} x ${s.height.toFixed(2)} mm -->\n`);
  lines.push(`    <g transform="translate(${pp.x.toFixed(3)},${pp.y.toFixed(3)})">\n`);

  // Panel outline
  lines.push(
    `      <rect x="0" y="0" width="${s.width.toFixed(3)}" height="${s.height.toFixed(3)}" rx="0.5" ry="0.5" fill="none" stroke="${CUT_COLOR}" stroke-width="${CUT_STROKE_WIDTH}" />\n`
  );

  // Engraved label
  const lx = s.width / 2;
  const ly = s.height / 2;
  const fs = Math.min(4, s.width * 0.08, s.height * 0.08);
  lines.push(
    `      <text x="${lx.toFixed(3)}" y="${ly.toFixed(3)}" text-anchor="middle" dominant-baseline="central" font-family="monospace" font-size="${fs.toFixed(2)}" fill="none" stroke="${ENGRAVE_COLOR}" stroke-width="0.05">${escapeXml(pp.label)}</text>\n`
  );

  // Mounting holes
  for (const [cx, cy] of s.holes) {
    if (s.holeStyle === "circle") {
      lines.push(svgCircle(cx, cy, HOLE_DIAMETER / 2));
    } else {
      lines.push(svgSlot(cx, cy, SLOT_WIDTH, SLOT_HEIGHT));
    }
  }

  lines.push("    </g>\n");
  return lines.join("");
}

export function generateSvg(
  placed: PlacedPanel[],
  sheetW: number,
  sheetH: number,
  margin: number = SVG_MARGIN
): string {
  const vw = sheetW + 2 * margin;
  const vh = sheetH + 2 * margin;

  const parts: string[] = [];
  parts.push(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg"\n` +
    `     width="${vw.toFixed(2)}mm" height="${vh.toFixed(2)}mm"\n` +
    `     viewBox="0 0 ${vw.toFixed(2)} ${vh.toFixed(2)}">\n\n` +
    `  <!-- Generated by rackcut -->\n` +
    `  <!-- Units: mm | Red (#FF0000) = cut | Blue (#0000FF) = engrave -->\n` +
    `  <!-- Sheet: ${sheetW.toFixed(1)} x ${sheetH.toFixed(1)} mm | Panels: ${placed.length} -->\n\n` +
    `  <g transform="translate(${margin},${margin})">\n\n`
  );

  for (const pp of placed) {
    parts.push(renderPanel(pp));
    parts.push("\n");
  }

  parts.push("  </g>\n</svg>\n");
  return parts.join("");
}

export function downloadSvg(svgString: string, filename: string = "rackcut.svg"): void {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/lib/svg.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/svg.ts src/lib/svg.test.ts
git commit -m "feat: add SVG generation and download with tests"
```

---

### Task 5: ModularGrid Parser (TDD)

**Files:**
- Create: `src/lib/modulargrid.ts`, `src/lib/modulargrid.test.ts`, `src/lib/__fixtures__/modulargrid-rack.html`

This task has an **investigation phase** before TDD can begin. The implementer must fetch a known rack page and reverse-engineer the HTML structure to identify the correct DOM selectors.

- [ ] **Step 1: Fetch and save a known rack page as fixture**

```bash
curl -s "https://www.modulargrid.net/e/racks/view/3086973" > src/lib/__fixtures__/modulargrid-rack.html
```

Then open the saved HTML and identify:
- **Row containers**: look for elements grouping each rack row (3U or 1U). Common patterns: `<div class="rack-row">`, `<table>` structures, or similar.
- **Module entries**: within each row, find elements representing individual modules. Look for data attributes like `data-hp`, `data-width`, or inline styles with pixel widths that can be converted to HP.
- **Module names**: typically in a title attribute, inner text, or alt text of module images.
- **Row format**: look for class names or height indicators distinguishing 3U from 1U rows.
- **Total HP capacity**: often in a row header or data attribute.

Document the discovered selectors in a comment at the top of the parser file.

**Known rack 3086973 expected output (for test validation):**
- Row 1 (3U, 104HP): 11 modules totaling 103HP → 1HP blank
- Row 2 (1U Intellijel, 104HP): 6 modules totaling 96HP → 8HP blank
- Row 3 (3U, 104HP): 12 modules totaling 94HP → 10HP blank

- [ ] **Step 2: Write failing tests using discovered structure**

Create `src/lib/modulargrid.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseModularGridData } from "./modulargrid";

const fixtureHtml = readFileSync(
  join(__dirname, "__fixtures__", "modulargrid-rack.html"),
  "utf-8"
);

describe("parseModularGridData", () => {
  it("extracts 3 rows from known rack", () => {
    const data = parseModularGridData(fixtureHtml);
    expect(data.rows).toHaveLength(3);
  });

  it("extracts correct module count per row", () => {
    const data = parseModularGridData(fixtureHtml);
    expect(data.rows[0].modules.length).toBe(11);
    expect(data.rows[1].modules.length).toBe(6);
    expect(data.rows[2].modules.length).toBe(12);
  });

  it("extracts module names and HP values", () => {
    const data = parseModularGridData(fixtureHtml);
    for (const row of data.rows) {
      for (const mod of row.modules) {
        expect(mod.name).toBeTruthy();
        expect(mod.hp).toBeGreaterThan(0);
      }
    }
  });

  it("calculates correct usedHp per row", () => {
    const data = parseModularGridData(fixtureHtml);
    expect(data.rows[0].usedHp).toBe(103);
    expect(data.rows[1].usedHp).toBe(96);
    expect(data.rows[2].usedHp).toBe(94);
  });

  it("calculates correct blankHp per row", () => {
    const data = parseModularGridData(fixtureHtml);
    expect(data.rows[0].blankHp).toBe(1);
    expect(data.rows[1].blankHp).toBe(8);
    expect(data.rows[2].blankHp).toBe(10);
  });

  it("detects row format (3U vs 1U)", () => {
    const data = parseModularGridData(fixtureHtml);
    expect(data.rows[0].format).toBe("3u");
    expect(data.rows[1].format).toBe("1u-intellijel");
    expect(data.rows[2].format).toBe("3u");
  });

  it("sets totalHp to 104 for all rows", () => {
    const data = parseModularGridData(fixtureHtml);
    for (const row of data.rows) {
      expect(row.totalHp).toBe(104);
    }
  });

  it("throws descriptive error for unrecognized HTML structure", () => {
    expect(() => parseModularGridData("<html><body>Not a rack</body></html>")).toThrow(
      /ModularGrid page structure not recognized/
    );
  });

  it("throws for empty HTML", () => {
    expect(() => parseModularGridData("")).toThrow();
  });
});
```

**Note:** The expected values above are based on the known rack. If the fixture HTML differs slightly (e.g., ModularGrid changed since the spec was written), adjust the expected values to match the actual fixture content.

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm vitest run src/lib/modulargrid.test.ts
```

Expected: FAIL — module `./modulargrid` not found.

- [ ] **Step 4: Implement parseModularGridData**

Create `src/lib/modulargrid.ts` using the selectors discovered in Step 1:
```typescript
import { RackData, Format } from "./types";

export class ModularGridParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModularGridParseError";
  }
}

export function parseModularGridData(html: string): RackData {
  if (!html || !html.trim()) {
    throw new ModularGridParseError("Empty HTML received");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // --- SELECTORS: Update these based on Step 1 investigation ---
  // The implementer MUST replace the placeholder selectors below
  // with the actual selectors discovered from the ModularGrid HTML.
  //
  // Example discovery pattern:
  //   Row containers:  doc.querySelectorAll(".rack-row")
  //   Modules per row: row.querySelectorAll(".module")
  //   Module name:     module.getAttribute("data-name") or module.querySelector(".module-name")?.textContent
  //   Module HP:       parseInt(module.getAttribute("data-hp") || module.style.width / pixelsPerHP)
  //   Row format:      row.classList.contains("1u") ? "1u-intellijel" : "3u"
  //   Total HP:        parseInt(row.getAttribute("data-hp")) or parsed from header text
  // ---

  // Validate structure exists
  // (replace with actual validation for discovered selectors)
  const rowElements = doc.querySelectorAll("REPLACE_WITH_ROW_SELECTOR");
  if (rowElements.length === 0) {
    throw new ModularGridParseError(
      "ModularGrid page structure not recognized — please report this issue"
    );
  }

  const rows = Array.from(rowElements).map((rowEl) => {
    // REPLACE: Extract format from row element
    const format: Format = "3u"; // determine from row attributes/classes

    // REPLACE: Extract total HP from row
    const totalHp = 104; // parse from row data

    // REPLACE: Extract modules
    const moduleEls = rowEl.querySelectorAll("REPLACE_WITH_MODULE_SELECTOR");
    const modules = Array.from(moduleEls).map((modEl) => ({
      name: "REPLACE", // extract module name
      hp: 0,           // extract module HP width
    }));

    const usedHp = modules.reduce((sum, m) => sum + m.hp, 0);

    return {
      format,
      totalHp,
      modules,
      usedHp,
      blankHp: totalHp - usedHp,
    };
  });

  return { rows };
}
```

The selectors above are placeholders. **The implementer must replace all `REPLACE_WITH_*` values** with the actual selectors found in Step 1. This is the core investigative work of this task.

- [ ] **Step 5: Iterate until all tests pass**

Run tests, adjust selectors and parsing logic until all pass:

```bash
pnpm vitest run src/lib/modulargrid.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/modulargrid.ts src/lib/modulargrid.test.ts src/lib/__fixtures__/
git commit -m "feat: add ModularGrid HTML parser with tests"
```

---

### Task 6: PanelForm Component (TDD)

**Files:**
- Create: `src/components/PanelForm.tsx`, `src/components/PanelForm.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/PanelForm.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PanelForm } from "./PanelForm";

describe("PanelForm", () => {
  it("renders HP input, format select, hole style select, quantity input, and add button", () => {
    render(<PanelForm onAdd={vi.fn()} />);
    expect(screen.getByLabelText(/hp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/format/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hole/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });

  it("calls onAdd with correct values when form is submitted", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<PanelForm onAdd={onAdd} />);

    const hpInput = screen.getByLabelText(/hp/i);
    await user.clear(hpInput);
    await user.type(hpInput, "8");

    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        hp: 8,
        format: "3u",
        holeStyle: "slot",
        quantity: 1,
      })
    );
  });

  it("defaults quantity to 1", () => {
    render(<PanelForm onAdd={vi.fn()} />);
    const qtyInput = screen.getByLabelText(/quantity/i);
    expect(qtyInput).toHaveValue(1);
  });

  it("shows validation error for HP < 1", async () => {
    const user = userEvent.setup();
    render(<PanelForm onAdd={vi.fn()} />);

    const hpInput = screen.getByLabelText(/hp/i);
    await user.clear(hpInput);
    await user.type(hpInput, "0");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByText(/hp must be between/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/components/PanelForm.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement PanelForm**

Create `src/components/PanelForm.tsx`:
```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Format, HoleStyle } from "@/lib/types";
import { MIN_HP, MAX_HP } from "@/lib/constants";

interface PanelFormProps {
  onAdd: (panel: { hp: number; format: Format; holeStyle: HoleStyle; quantity: number }) => void;
}

export function PanelForm({ onAdd }: PanelFormProps) {
  const [hp, setHp] = useState(8);
  const [format, setFormat] = useState<Format>("3u");
  const [holeStyle, setHoleStyle] = useState<HoleStyle>("slot");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (hp < MIN_HP || hp > MAX_HP || !Number.isInteger(hp)) {
      setError(`HP must be between ${MIN_HP} and ${MAX_HP}`);
      return;
    }

    if (quantity < 1) {
      setError("Quantity must be at least 1");
      return;
    }

    onAdd({ hp, format, holeStyle, quantity });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="hp">HP</Label>
        <Input
          id="hp"
          type="number"
          min={MIN_HP}
          max={MAX_HP}
          value={hp}
          onChange={(e) => setHp(parseInt(e.target.value) || 0)}
          className="w-20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="format">Format</Label>
        <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
          <SelectTrigger id="format" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3u">3U</SelectItem>
            <SelectItem value="1u-intellijel">1U Intellijel</SelectItem>
            <SelectItem value="1u-pulplogic">1U Pulp Logic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="holeStyle">Hole Style</Label>
        <Select value={holeStyle} onValueChange={(v) => setHoleStyle(v as HoleStyle)}>
          <SelectTrigger id="holeStyle" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="slot">Slot</SelectItem>
            <SelectItem value="circle">Circle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="quantity">Quantity</Label>
        <Input
          id="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          className="w-16"
        />
      </div>

      <Button type="submit">Add</Button>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/components/PanelForm.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PanelForm.tsx src/components/PanelForm.test.tsx
git commit -m "feat: add PanelForm component with validation"
```

---

### Task 7: PanelList Component (TDD)

**Files:**
- Create: `src/components/PanelList.tsx`, `src/components/PanelList.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/PanelList.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PanelList } from "./PanelList";
import { PanelEntry } from "@/lib/types";

const mockPanels: PanelEntry[] = [
  { id: "1", hp: 8, format: "3u", holeStyle: "slot", quantity: 2 },
  { id: "2", hp: 4, format: "1u-intellijel", holeStyle: "circle", quantity: 1 },
];

describe("PanelList", () => {
  it("displays all panels with HP, format, and quantity", () => {
    render(<PanelList panels={mockPanels} onUpdate={vi.fn()} onRemove={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText(/8HP/)).toBeInTheDocument();
    expect(screen.getByText(/3U/i)).toBeInTheDocument();
    expect(screen.getByText(/×2/)).toBeInTheDocument();
    expect(screen.getByText(/4HP/)).toBeInTheDocument();
  });

  it("increments quantity when + is clicked", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<PanelList panels={mockPanels} onUpdate={onUpdate} onRemove={vi.fn()} onClear={vi.fn()} />);

    const plusButtons = screen.getAllByRole("button", { name: /increase/i });
    await user.click(plusButtons[0]);

    expect(onUpdate).toHaveBeenCalledWith("1", 3);
  });

  it("decrements quantity when - is clicked (min 1)", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<PanelList panels={mockPanels} onUpdate={onUpdate} onRemove={vi.fn()} onClear={vi.fn()} />);

    const minusButtons = screen.getAllByRole("button", { name: /decrease/i });
    await user.click(minusButtons[0]);

    expect(onUpdate).toHaveBeenCalledWith("1", 1);
  });

  it("calls onRemove when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<PanelList panels={mockPanels} onUpdate={vi.fn()} onRemove={onRemove} onClear={vi.fn()} />);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await user.click(removeButtons[0]);

    expect(onRemove).toHaveBeenCalledWith("1");
  });

  it("calls onClear when clear all is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<PanelList panels={mockPanels} onUpdate={vi.fn()} onRemove={vi.fn()} onClear={onClear} />);

    await user.click(screen.getByRole("button", { name: /clear all/i }));

    expect(onClear).toHaveBeenCalled();
  });

  it("hides clear all when list is empty", () => {
    render(<PanelList panels={[]} onUpdate={vi.fn()} onRemove={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/components/PanelList.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement PanelList**

Create `src/components/PanelList.tsx`:
```tsx
import { Button } from "@/components/ui/button";
import { PanelEntry } from "@/lib/types";

interface PanelListProps {
  panels: PanelEntry[];
  onUpdate: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const FORMAT_LABELS: Record<string, string> = {
  "3u": "3U",
  "1u-intellijel": "1U Intellijel",
  "1u-pulplogic": "1U Pulp Logic",
};

export function PanelList({ panels, onUpdate, onRemove, onClear }: PanelListProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {panels.map((panel) => (
        <div
          key={panel.id}
          className="flex items-center gap-1 border border-border bg-card px-2 py-1 text-sm font-mono"
        >
          <span className="text-primary">{panel.hp}HP</span>
          <span className="text-muted-foreground">{FORMAT_LABELS[panel.format]}</span>
          <span className="text-foreground">×{panel.quantity}</span>

          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-xs"
            onClick={() => onUpdate(panel.id, Math.max(1, panel.quantity - 1))}
            aria-label={`Decrease quantity of ${panel.hp}HP ${FORMAT_LABELS[panel.format]}`}
          >
            -
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-xs"
            onClick={() => onUpdate(panel.id, panel.quantity + 1)}
            aria-label={`Increase quantity of ${panel.hp}HP ${FORMAT_LABELS[panel.format]}`}
          >
            +
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-xs text-destructive"
            onClick={() => onRemove(panel.id)}
            aria-label={`Remove ${panel.hp}HP ${FORMAT_LABELS[panel.format]}`}
          >
            ×
          </Button>
        </div>
      ))}

      {panels.length > 0 && (
        <Button
          variant="link"
          size="sm"
          className="text-muted-foreground"
          onClick={onClear}
          aria-label="Clear all panels"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/components/PanelList.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PanelList.tsx src/components/PanelList.test.tsx
git commit -m "feat: add PanelList component with quantity controls"
```

---

### Task 8: SvgPreview Component (TDD)

**Files:**
- Create: `src/components/SvgPreview.tsx`, `src/components/SvgPreview.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/SvgPreview.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SvgPreview } from "./SvgPreview";
import { PlacedPanel } from "@/lib/types";
import { computePanel } from "@/lib/panel";

describe("SvgPreview", () => {
  it("shows empty state message when no panels", () => {
    render(<SvgPreview placed={[]} sheetWidth={0} sheetHeight={0} />);
    expect(screen.getByText(/add panels to preview/i)).toBeInTheDocument();
  });

  it("renders SVG when panels exist", () => {
    const spec = computePanel(8, "3u", "slot");
    const placed: PlacedPanel[] = [{ spec, x: 0, y: 0, label: "8HP 3U" }];
    const { container } = render(
      <SvgPreview placed={placed} sheetWidth={spec.width} sheetHeight={spec.height} />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("updates when panels change", () => {
    const spec1 = computePanel(8, "3u", "slot");
    const placed1: PlacedPanel[] = [{ spec: spec1, x: 0, y: 0, label: "8HP 3U" }];

    const { rerender, container } = render(
      <SvgPreview placed={placed1} sheetWidth={spec1.width} sheetHeight={spec1.height} />
    );

    const spec2 = computePanel(10, "3u", "slot");
    const placed2: PlacedPanel[] = [
      { spec: spec1, x: 0, y: 0, label: "8HP 3U" },
      { spec: spec2, x: spec1.width + 2, y: 0, label: "10HP 3U" },
    ];

    rerender(
      <SvgPreview placed={placed2} sheetWidth={spec1.width + 2 + spec2.width} sheetHeight={spec1.height} />
    );

    // Should have 2 panel groups
    const groups = container.querySelectorAll("svg g g");
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/components/SvgPreview.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement SvgPreview**

Create `src/components/SvgPreview.tsx`:
```tsx
import { useMemo } from "react";
import { PlacedPanel } from "@/lib/types";
import { generateSvg } from "@/lib/svg";

interface SvgPreviewProps {
  placed: PlacedPanel[];
  sheetWidth: number;
  sheetHeight: number;
}

export function SvgPreview({ placed, sheetWidth, sheetHeight }: SvgPreviewProps) {
  const svgString = useMemo(
    () => (placed.length > 0 ? generateSvg(placed, sheetWidth, sheetHeight) : ""),
    [placed, sheetWidth, sheetHeight]
  );

  if (placed.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 border border-border bg-card/50 min-h-[400px]">
        <p className="text-muted-foreground font-mono text-sm">
          Add panels to preview your cut sheet
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center flex-1 border border-border bg-[#0a0a08] p-8 min-h-[400px] overflow-auto">
      <div
        className="max-w-full max-h-full"
        dangerouslySetInnerHTML={{
          __html: svgString.replace(/<\?xml[^?]*\?>/, ""),
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/components/SvgPreview.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SvgPreview.tsx src/components/SvgPreview.test.tsx
git commit -m "feat: add SvgPreview component with empty state"
```

---

### Task 9: App Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing integration tests**

Update `src/App.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("App", () => {
  it("renders app title and empty state", () => {
    render(<App />);
    expect(screen.getByText("rackcut")).toBeInTheDocument();
    expect(screen.getByText(/add panels to preview/i)).toBeInTheDocument();
  });

  it("adds a panel and shows it in the list", async () => {
    const user = userEvent.setup();
    render(<App />);

    const hpInput = screen.getByLabelText(/hp/i);
    await user.clear(hpInput);
    await user.type(hpInput, "8");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByText(/8HP/)).toBeInTheDocument();
    expect(screen.getByText(/×1/)).toBeInTheDocument();
  });

  it("shows SVG preview after adding a panel", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    const hpInput = screen.getByLabelText(/hp/i);
    await user.clear(hpInput);
    await user.type(hpInput, "8");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByText(/add panels to preview/i)).not.toBeInTheDocument();
  });

  it("clears all panels", async () => {
    const user = userEvent.setup();
    render(<App />);

    const hpInput = screen.getByLabelText(/hp/i);
    await user.clear(hpInput);
    await user.type(hpInput, "8");
    await user.click(screen.getByRole("button", { name: /add/i }));

    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(screen.getByText(/add panels to preview/i)).toBeInTheDocument();
  });

  it("download button is present when panels exist", async () => {
    const user = userEvent.setup();
    render(<App />);

    const hpInput = screen.getByLabelText(/hp/i);
    await user.clear(hpInput);
    await user.type(hpInput, "8");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/App.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement App.tsx**

Update `src/App.tsx`:
```tsx
import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelForm } from "@/components/PanelForm";
import { PanelList } from "@/components/PanelList";
import { SvgPreview } from "@/components/SvgPreview";
import { computePanel, layoutPanels } from "@/lib/panel";
import { generateSvg, downloadSvg } from "@/lib/svg";
import { PanelEntry, Format, HoleStyle } from "@/lib/types";
import { DEFAULT_GAP, MIN_GAP, MAX_GAP } from "@/lib/constants";

const FORMAT_LABELS: Record<string, string> = {
  "3u": "3U",
  "1u-intellijel": "1U Intellijel",
  "1u-pulplogic": "1U Pulp Logic",
};

function App() {
  const [panels, setPanels] = useState<PanelEntry[]>([]);
  const [gap, setGap] = useState(DEFAULT_GAP);

  const handleAdd = useCallback(
    (panel: { hp: number; format: Format; holeStyle: HoleStyle; quantity: number }) => {
      const entry: PanelEntry = {
        id: crypto.randomUUID(),
        ...panel,
      };
      setPanels((prev) => [...prev, entry]);
    },
    []
  );

  const handleUpdateQuantity = useCallback((id: string, quantity: number) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity } : p))
    );
  }, []);

  const handleRemove = useCallback((id: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleClear = useCallback(() => {
    setPanels([]);
  }, []);

  const layoutResult = useMemo(() => {
    const specs = panels.flatMap((entry) => {
      const spec = computePanel(entry.hp, entry.format, entry.holeStyle);
      return Array.from({ length: entry.quantity }, () => ({
        spec,
        label: `${entry.hp}HP ${FORMAT_LABELS[entry.format] || entry.format}`,
      }));
    });
    return layoutPanels(specs, gap);
  }, [panels, gap]);

  const handleDownload = useCallback(() => {
    const svg = generateSvg(layoutResult.placed, layoutResult.sheetWidth, layoutResult.sheetHeight);
    downloadSvg(svg);
  }, [layoutResult]);

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-primary text-xl font-bold tracking-tight">rackcut</h1>
        <p className="text-muted-foreground text-xs">Eurorack blank panel generator</p>
      </header>

      {/* Controls Bar */}
      <div className="border-b border-border px-4 py-3 flex flex-wrap items-end gap-4">
        <PanelForm onAdd={handleAdd} />

        <div className="h-8 w-px bg-border" />

        <div className="flex flex-col gap-1">
          <Label htmlFor="gap">Gap (mm)</Label>
          <Input
            id="gap"
            type="number"
            min={MIN_GAP}
            max={MAX_GAP}
            step={0.5}
            value={gap}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= MIN_GAP && v <= MAX_GAP) {
                setGap(v);
              }
            }}
            className="w-20"
          />
        </div>

        {panels.length > 0 && (
          <>
            <div className="h-8 w-px bg-border" />
            <Button onClick={handleDownload} variant="outline">
              Download SVG
            </Button>
          </>
        )}
      </div>

      {/* Panel List */}
      {panels.length > 0 && (
        <div className="border-b border-border px-4 py-2">
          <PanelList
            panels={panels}
            onUpdate={handleUpdateQuantity}
            onRemove={handleRemove}
            onClear={handleClear}
          />
        </div>
      )}

      {/* Preview */}
      <SvgPreview
        placed={layoutResult.placed}
        sheetWidth={layoutResult.sheetWidth}
        sheetHeight={layoutResult.sheetHeight}
      />
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Run all tests**

```bash
pnpm vitest run
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire up App with panel state, preview, and download"
```

---

### Task 10: ModularGrid Import Dialog (TDD)

**Files:**
- Create: `src/components/ModularGridDialog.tsx`, `src/components/ModularGridDialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/ModularGridDialog.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModularGridDialog } from "./ModularGridDialog";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ModularGridDialog", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("renders import button that opens dialog", async () => {
    const user = userEvent.setup();
    render(<ModularGridDialog onImport={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));
    expect(screen.getByLabelText(/rack url/i)).toBeInTheDocument();
  });

  it("validates URL format before fetching", async () => {
    const user = userEvent.setup();
    render(<ModularGridDialog onImport={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));
    const input = screen.getByLabelText(/rack url/i);
    await user.type(input, "not-a-valid-url");
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(screen.getByText(/valid modulargrid/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows loading state while fetching", async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<ModularGridDialog onImport={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));
    const input = screen.getByLabelText(/rack url/i);
    await user.type(input, "https://www.modulargrid.net/e/racks/view/12345");
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows error when worker is unreachable", async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<ModularGridDialog onImport={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /import from modulargrid/i }));
    const input = screen.getByLabelText(/rack url/i);
    await user.type(input, "https://www.modulargrid.net/e/racks/view/12345");
    await user.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not reach/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/components/ModularGridDialog.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement ModularGridDialog**

Create `src/components/ModularGridDialog.tsx`:
```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { parseModularGridData } from "@/lib/modulargrid";
import { RackData, RackRow, Format } from "@/lib/types";

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "";
const MODULARGRID_PATTERN = /^https?:\/\/(www\.)?modulargrid\.net\/e\/racks\/view\/\d+/;

interface ModularGridDialogProps {
  onImport: (blanks: { hp: number; format: Format }[]) => void;
}

export function ModularGridDialog({ onImport }: ModularGridDialogProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rackData, setRackData] = useState<RackData | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const handleImport = async () => {
    setError(null);
    setRackData(null);

    if (!MODULARGRID_PATTERN.test(url)) {
      setError("Please enter a valid ModularGrid rack URL");
      return;
    }

    if (!WORKER_URL) {
      setError("ModularGrid import is not configured. You can add panels manually instead.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${WORKER_URL}/parse?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error(`Worker returned ${response.status}`);
      }
      const html = await response.text();
      const data = parseModularGridData(html);
      setRackData(data);

      // Select all rows with blank space by default
      const indices = new Set<number>();
      data.rows.forEach((row, i) => {
        if (row.blankHp > 0) indices.add(i);
      });
      setSelectedRows(indices);
    } catch (e) {
      setError("Could not reach the import service. You can add panels manually instead.");
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (index: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleAddSelected = () => {
    if (!rackData) return;
    const blanks = rackData.rows
      .filter((_, i) => selectedRows.has(i))
      .filter((row) => row.blankHp > 0)
      .map((row) => ({ hp: row.blankHp, format: row.format }));
    onImport(blanks);
    setOpen(false);
    setRackData(null);
    setUrl("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Import from ModularGrid</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from ModularGrid</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rackUrl">Rack URL</Label>
            <div className="flex gap-2">
              <Input
                id="rackUrl"
                placeholder="https://www.modulargrid.net/e/racks/view/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button onClick={handleImport} disabled={loading}>
                {loading ? "Loading..." : "Import"}
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          {rackData && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Found {rackData.rows.length} rows. Select blanks to add:
              </p>
              {rackData.rows.map((row, i) => (
                <label
                  key={i}
                  className="flex items-center gap-2 text-sm border border-border p-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRows.has(i)}
                    onChange={() => toggleRow(i)}
                    disabled={row.blankHp === 0}
                  />
                  <span>
                    Row {i + 1} ({row.format.toUpperCase()}) — {row.totalHp}HP total, {row.usedHp}HP used
                  </span>
                  {row.blankHp > 0 ? (
                    <span className="text-primary ml-auto">{row.blankHp}HP blank</span>
                  ) : (
                    <span className="text-muted-foreground ml-auto">Full</span>
                  )}
                </label>
              ))}
              <Button onClick={handleAddSelected} className="mt-2">
                Add Selected
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/components/ModularGridDialog.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Wire ModularGridDialog into App.tsx**

Add to App.tsx imports:
```tsx
import { ModularGridDialog } from "@/components/ModularGridDialog";
```

Add handler:
```tsx
const handleModularGridImport = useCallback(
  (blanks: { hp: number; format: Format }[]) => {
    const entries: PanelEntry[] = blanks.map((b) => ({
      id: crypto.randomUUID(),
      hp: b.hp,
      format: b.format,
      holeStyle: "slot" as HoleStyle,
      quantity: 1,
    }));
    setPanels((prev) => [...prev, ...entries]);
  },
  []
);
```

Add to the actions section in JSX (next to Download SVG button):
```tsx
<ModularGridDialog onImport={handleModularGridImport} />
```

- [ ] **Step 6: Run all tests**

```bash
pnpm vitest run
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ModularGridDialog.tsx src/components/ModularGridDialog.test.tsx src/App.tsx
git commit -m "feat: add ModularGrid import dialog with URL parsing"
```

---

### Task 11: Cloudflare Worker

**Files:**
- Create: `worker/package.json`, `worker/wrangler.toml`, `worker/tsconfig.json`, `worker/vitest.config.ts`, `worker/src/index.ts`, `worker/src/index.test.ts`

- [ ] **Step 1: Initialize worker project**

```bash
mkdir -p /Users/ogabrielluiz/Projects/rackcut/worker/src
cd /Users/ogabrielluiz/Projects/rackcut/worker
pnpm init
pnpm add -D wrangler @cloudflare/workers-types vitest
```

- [ ] **Step 2: Create wrangler.toml**

Create `worker/wrangler.toml`:
```toml
name = "rackcut-proxy"
main = "src/index.ts"
compatibility_date = "2024-01-01"
```

- [ ] **Step 3: Create worker tsconfig**

Create `worker/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

Create `worker/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 5: Write failing worker tests**

Create `worker/src/index.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRequest, isAllowedUrl } from "./index";

describe("isAllowedUrl", () => {
  it("allows modulargrid.net rack URLs", () => {
    expect(isAllowedUrl("https://www.modulargrid.net/e/racks/view/12345")).toBe(true);
    expect(isAllowedUrl("https://modulargrid.net/e/racks/view/12345")).toBe(true);
  });

  it("rejects non-modulargrid URLs", () => {
    expect(isAllowedUrl("https://evil.com")).toBe(false);
    expect(isAllowedUrl("https://modulargrid.net/e/modules")).toBe(false);
    expect(isAllowedUrl("")).toBe(false);
  });
});

describe("handleRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for missing url param", async () => {
    const req = new Request("https://worker.example.com/parse");
    const res = await handleRequest(req, "https://mysite.github.io");
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-modulargrid URL", async () => {
    const req = new Request("https://worker.example.com/parse?url=https://evil.com");
    const res = await handleRequest(req, "https://mysite.github.io");
    expect(res.status).toBe(400);
  });

  it("sets CORS headers for allowed origin", async () => {
    const req = new Request(
      "https://worker.example.com/parse?url=https://www.modulargrid.net/e/racks/view/12345"
    );

    // Mock global fetch
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<html>rack data</html>", { status: 200 })
    ));

    const res = await handleRequest(req, "https://mysite.github.io");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://mysite.github.io");
  });

  it("proxies HTML content on success", async () => {
    const req = new Request(
      "https://worker.example.com/parse?url=https://www.modulargrid.net/e/racks/view/12345"
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<html>rack data</html>", { status: 200 })
    ));

    const res = await handleRequest(req, "https://mysite.github.io");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("rack data");
  });

  it("proxies error status from modulargrid", async () => {
    const req = new Request(
      "https://worker.example.com/parse?url=https://www.modulargrid.net/e/racks/view/99999"
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("Not Found", { status: 404 })
    ));

    const res = await handleRequest(req, "https://mysite.github.io");
    expect(res.status).toBe(404);
  });

  it("returns 413 for oversized responses", async () => {
    const req = new Request(
      "https://worker.example.com/parse?url=https://www.modulargrid.net/e/racks/view/12345"
    );
    const largeBody = "x".repeat(3 * 1024 * 1024); // 3MB
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(largeBody, { status: 200 })
    ));

    const res = await handleRequest(req, "https://mysite.github.io");
    expect(res.status).toBe(413);
  });

  it("handles CORS preflight (OPTIONS)", async () => {
    const req = new Request("https://worker.example.com/parse", {
      method: "OPTIONS",
    });

    const res = await handleRequest(req, "https://mysite.github.io");
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://mysite.github.io");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
cd /Users/ogabrielluiz/Projects/rackcut/worker
pnpm vitest run
```

Expected: FAIL — functions not found.

- [ ] **Step 7: Implement the worker**

Create `worker/src/index.ts`:
```typescript
const ALLOWED_URL_PATTERN = /^https:\/\/(www\.)?modulargrid\.net\/e\/racks\/view\/\d+/;
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2MB

export function isAllowedUrl(url: string): boolean {
  return ALLOWED_URL_PATTERN.test(url);
}

export async function handleRequest(
  request: Request,
  allowedOrigin: string
): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isAllowedUrl(targetUrl)) {
    return new Response(
      JSON.stringify({ error: "URL not allowed. Only modulargrid.net rack URLs accepted." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const response = await fetch(targetUrl, {
      headers: { "User-Agent": "rackcut-proxy/1.0" },
    });

    if (!response.ok) {
      return new Response(response.statusText, {
        status: response.status,
        headers: corsHeaders,
      });
    }

    // Check content length
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      return new Response(JSON.stringify({ error: "Response too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await response.text();
    if (body.length > MAX_RESPONSE_SIZE) {
      return new Response(JSON.stringify({ error: "Response too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch from ModularGrid" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    return handleRequest(request, allowedOrigin);
  },
};
```

- [ ] **Step 8: Run worker tests**

```bash
cd /Users/ogabrielluiz/Projects/rackcut/worker
pnpm vitest run
```

Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /Users/ogabrielluiz/Projects/rackcut
git add worker/
git commit -m "feat: add Cloudflare Worker CORS proxy for ModularGrid"
```

---

### Task 12: GitHub Actions Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create deploy workflow**

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Add base config to vite for GitHub Pages**

Update `vite.config.ts` to add base path (for GitHub Pages, the repo name becomes the base):
```typescript
export default defineConfig({
  base: '/rackcut/',
  // ... rest of config
})
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml vite.config.ts
git commit -m "ci: add GitHub Pages deploy workflow"
```

---

### Task 13: E2E Tests with Playwright

**Files:**
- Create: `playwright.config.ts`, `e2e/app.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
cd /Users/ogabrielluiz/Projects/rackcut
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Create Playwright config**

Create `playwright.config.ts`:
```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:5173/rackcut/",
  },
});
```

- [ ] **Step 3: Write E2E tests**

Create `e2e/app.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

test.describe("rackcut", () => {
  test("shows empty state on load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("rackcut")).toBeVisible();
    await expect(page.getByText(/add panels to preview/i)).toBeVisible();
  });

  test("full workflow: add panels, preview, download", async ({ page }) => {
    await page.goto("/");

    // Add an 8HP 3U panel
    await page.getByLabel(/hp/i).fill("8");
    await page.getByRole("button", { name: /add/i }).click();

    // Panel appears in list
    await expect(page.getByText(/8HP/)).toBeVisible();

    // SVG preview appears
    await expect(page.locator("svg")).toBeVisible();
    await expect(page.getByText(/add panels to preview/i)).not.toBeVisible();

    // Download button appears
    const downloadButton = page.getByRole("button", { name: /download/i });
    await expect(downloadButton).toBeVisible();

    // Trigger download
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadButton.click(),
    ]);

    expect(download.suggestedFilename()).toBe("rackcut.svg");

    // Verify SVG content
    const content = await download.createReadStream().then(
      (stream) => new Promise<string>((resolve) => {
        let data = "";
        stream.on("data", (chunk: Buffer) => (data += chunk.toString()));
        stream.on("end", () => resolve(data));
      })
    );
    expect(content).toContain("<svg");
    expect(content).toContain("</svg>");
  });

  test("add and remove panels", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/hp/i).fill("10");
    await page.getByRole("button", { name: /add/i }).click();

    await expect(page.getByText(/10HP/)).toBeVisible();

    // Remove
    await page.getByRole("button", { name: /remove/i }).click();
    await expect(page.getByText(/add panels to preview/i)).toBeVisible();
  });

  test("quantity adjustment", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/hp/i).fill("8");
    await page.getByRole("button", { name: /add/i }).click();

    await expect(page.getByText(/×1/)).toBeVisible();

    await page.getByRole("button", { name: /increase/i }).click();
    await expect(page.getByText(/×2/)).toBeVisible();

    await page.getByRole("button", { name: /decrease/i }).click();
    await expect(page.getByText(/×1/)).toBeVisible();
  });
});
```

- [ ] **Step 4: Run E2E tests**

```bash
pnpm exec playwright test
```

Expected: All E2E tests PASS.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "test: add Playwright E2E tests"
```

---

### Task 14: README and Final Polish

**Files:**
- Create: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore**

Ensure `.gitignore` includes:
```
node_modules/
dist/
.superpowers/
*.local
```

- [ ] **Step 2: Create README.md**

Create a concise README with:
- Project description (1-2 sentences)
- Screenshot placeholder
- Usage: link to GitHub Pages site
- Development: `pnpm install`, `pnpm dev`, `pnpm test`
- Worker deployment: `cd worker && pnpm install && pnpm exec wrangler deploy`
- License: MIT

- [ ] **Step 3: Run full test suite one last time**

```bash
pnpm vitest run && pnpm exec playwright test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md .gitignore
git commit -m "docs: add README and finalize gitignore"
```
