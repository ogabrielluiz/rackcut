import { ENGRAVE_COLOR } from "./constants";
import type { PatternType } from "./types";

const STROKE = `stroke="${ENGRAVE_COLOR}" stroke-width="0.15" fill="none"`;
const MARGIN = 4; // mm inset from panel edges to keep patterns away from holes

// Simple seeded PRNG (mulberry32)
function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function concentricCircles(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const cx = w / 2 + (rng() - 0.5) * w * 0.15;
  const cy = h / 2 + (rng() - 0.5) * h * 0.15;
  const maxR = Math.min(w - MARGIN * 2, h - MARGIN * 2) / 2;
  const spacing = 1.5 + rng() * 1.5;
  const lines: string[] = [];
  for (let r = spacing; r <= maxR; r += spacing) {
    lines.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" ${STROKE}/>`);
  }
  return lines.join("\n    ");
}

function hexGrid(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const size = 2.5 + rng() * 2;
  const lines: string[] = [];
  const dx = size * Math.sqrt(3);
  const dy = size * 1.5;

  for (let row = 0; row * dy < h - MARGIN; row++) {
    for (let col = 0; col * dx < w - MARGIN; col++) {
      const cx = MARGIN + col * dx + (row % 2 === 1 ? dx / 2 : 0);
      const cy = MARGIN + row * dy;
      if (cx < MARGIN || cx > w - MARGIN || cy < MARGIN || cy > h - MARGIN) continue;

      // Hexagon vertices
      const pts = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        return `${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`;
      }).join(" ");
      lines.push(`<polygon points="${pts}" ${STROKE}/>`);
    }
  }
  return lines.join("\n    ");
}

function waveform(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const waveTypes = ["sine", "saw", "square"] as const;
  const type = waveTypes[Math.floor(rng() * 3)];
  const amplitude = (h - MARGIN * 2) * (0.15 + rng() * 0.2);
  const frequency = 2 + rng() * 4;
  const numWaves = 3 + Math.floor(rng() * 4);
  const lines: string[] = [];

  for (let wave = 0; wave < numWaves; wave++) {
    const yBase = MARGIN + ((h - MARGIN * 2) / (numWaves + 1)) * (wave + 1);
    const points: string[] = [];
    const step = 0.5;

    for (let x = MARGIN; x <= w - MARGIN; x += step) {
      const t = (x - MARGIN) / (w - MARGIN * 2);
      let y = 0;

      if (type === "sine") {
        y = Math.sin(t * Math.PI * 2 * frequency + wave * 0.7) * amplitude;
      } else if (type === "saw") {
        const phase = (t * frequency + wave * 0.2) % 1;
        y = (phase * 2 - 1) * amplitude;
      } else {
        const phase = (t * frequency + wave * 0.3) % 1;
        y = (phase < 0.5 ? 1 : -1) * amplitude * 0.6;
      }

      points.push(`${x.toFixed(2)},${(yBase + y).toFixed(2)}`);
    }

    lines.push(`<polyline points="${points.join(" ")}" ${STROKE}/>`);
  }
  return lines.join("\n    ");
}

function sierpinski(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const depth = 4 + Math.floor(rng() * 2);
  const inset = MARGIN + 2;
  const side = Math.min(w - inset * 2, h - inset * 2);
  const ox = (w - side) / 2;
  const oy = (h - side) / 2 + side; // bottom-left origin

  function drawTriangle(
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    d: number
  ) {
    if (d === 0) {
      lines.push(
        `<polygon points="${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)} ${x3.toFixed(2)},${y3.toFixed(2)}" ${STROKE}/>`
      );
      return;
    }
    const mx1 = (x1 + x2) / 2, my1 = (y1 + y2) / 2;
    const mx2 = (x2 + x3) / 2, my2 = (y2 + y3) / 2;
    const mx3 = (x1 + x3) / 2, my3 = (y1 + y3) / 2;
    drawTriangle(x1, y1, mx1, my1, mx3, my3, d - 1);
    drawTriangle(mx1, my1, x2, y2, mx2, my2, d - 1);
    drawTriangle(mx3, my3, mx2, my2, x3, y3, d - 1);
  }

  drawTriangle(
    ox + side / 2, oy - side * (Math.sqrt(3) / 2),
    ox, oy,
    ox + side, oy,
    depth
  );

  return lines.join("\n    ");
}

function radialBurst(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const cx = w / 2 + (rng() - 0.5) * w * 0.1;
  const cy = h / 2 + (rng() - 0.5) * h * 0.1;
  const maxR = Math.min(w - MARGIN * 2, h - MARGIN * 2) / 2;
  const numRays = 12 + Math.floor(rng() * 24);
  const innerR = maxR * (0.1 + rng() * 0.15);
  const lines: string[] = [];

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2 + rng() * 0.1;
    const rayLen = maxR * (0.6 + rng() * 0.4);
    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * rayLen;
    const y2 = cy + Math.sin(angle) * rayLen;
    lines.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" ${STROKE}/>`);
  }

  // Inner circle
  lines.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${innerR.toFixed(2)}" ${STROKE}/>`);
  // Outer circle
  lines.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(maxR * 0.9).toFixed(2)}" ${STROKE}/>`);

  return lines.join("\n    ");
}

function flowField(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const numLines = 15 + Math.floor(rng() * 20);
  const steps = 40;
  const stepSize = 1.2;

  // Simple noise-like angle field
  const freq = 0.03 + rng() * 0.04;
  const offset = rng() * 100;

  function angle(x: number, y: number): number {
    return (
      Math.sin(x * freq + offset) * Math.cos(y * freq + offset * 0.7) * Math.PI * 2 +
      Math.sin((x + y) * freq * 0.5) * Math.PI
    );
  }

  for (let i = 0; i < numLines; i++) {
    let x = MARGIN + rng() * (w - MARGIN * 2);
    let y = MARGIN + rng() * (h - MARGIN * 2);
    const points: string[] = [`${x.toFixed(2)},${y.toFixed(2)}`];

    for (let s = 0; s < steps; s++) {
      const a = angle(x, y);
      x += Math.cos(a) * stepSize;
      y += Math.sin(a) * stepSize;
      if (x < MARGIN || x > w - MARGIN || y < MARGIN || y > h - MARGIN) break;
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }

    if (points.length > 3) {
      lines.push(`<polyline points="${points.join(" ")}" ${STROKE}/>`);
    }
  }

  return lines.join("\n    ");
}

const generators: Record<string, (w: number, h: number, seed: number) => string> = {
  "concentric-circles": concentricCircles,
  "hex-grid": hexGrid,
  "waveform": waveform,
  "sierpinski": sierpinski,
  "radial-burst": radialBurst,
  "flow-field": flowField,
};

export function generatePattern(
  pattern: PatternType,
  width: number,
  height: number,
  seed: number
): string {
  if (pattern === "none") return "";
  const gen = generators[pattern];
  if (!gen) return "";
  return gen(width, height, seed);
}

export const PATTERN_LABELS: Record<PatternType, string> = {
  "none": "None",
  "concentric-circles": "Concentric Circles",
  "hex-grid": "Hex Grid",
  "waveform": "Waveform",
  "sierpinski": "Sierpinski",
  "radial-burst": "Radial Burst",
  "flow-field": "Flow Field",
};
