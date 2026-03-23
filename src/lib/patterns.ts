import { ENGRAVE_COLOR } from "./constants";
import type { PatternType } from "./types";

const STROKE = `stroke="${ENGRAVE_COLOR}" stroke-width="0.25" fill="none"`;
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
  const cx = w / 2 + (rng() - 0.5) * w * 0.1;
  const cy = h / 2 + (rng() - 0.5) * h * 0.1;
  // Fill the whole panel — max radius reaches the corners
  const maxR = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2) * 1.1;
  const spacing = 3.0 + rng() * 2.0; // enough breathing room between rings
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
  const lines: string[] = [];
  const numWaves = 4 + Math.floor(rng() * 5);
  const step = 0.8;

  for (let wave = 0; wave < numWaves; wave++) {
    const yBase = MARGIN + ((h - MARGIN * 2) / (numWaves + 1)) * (wave + 1);

    // Each wave gets its own character
    const waveTypes = ["sine", "saw", "square", "fm", "additive"] as const;
    const type = waveTypes[Math.floor(rng() * waveTypes.length)];
    const frequency = 1.5 + rng() * 5;
    const amplitude = (h - MARGIN * 2) / (numWaves + 1) * (0.3 + rng() * 0.35);
    const phase = rng() * Math.PI * 2;
    // Amplitude envelope — fade in/out for more organic feel
    const envAttack = rng() * 0.2;
    const envRelease = 0.8 + rng() * 0.2;

    const points: string[] = [];

    for (let x = MARGIN; x <= w - MARGIN; x += step) {
      const t = (x - MARGIN) / (w - MARGIN * 2);
      // Envelope
      let env = 1;
      if (t < envAttack) env = t / envAttack;
      if (t > envRelease) env = (1 - t) / (1 - envRelease);

      let y = 0;
      if (type === "sine") {
        y = Math.sin(t * Math.PI * 2 * frequency + phase) * amplitude * env;
      } else if (type === "saw") {
        const p = (t * frequency + phase / (Math.PI * 2)) % 1;
        y = (p * 2 - 1) * amplitude * env;
      } else if (type === "square") {
        const p = (t * frequency + phase / (Math.PI * 2)) % 1;
        y = (p < 0.5 ? 1 : -1) * amplitude * 0.7 * env;
      } else if (type === "fm") {
        // FM synthesis — modulator modulates carrier
        const modFreq = frequency * (2 + rng() * 0.01); // fixed ratio per wave
        const modIndex = 1.5 + rng() * 0.01;
        y = Math.sin(t * Math.PI * 2 * frequency + Math.sin(t * Math.PI * 2 * modFreq) * modIndex + phase) * amplitude * env;
      } else {
        // Additive — sum of harmonics
        for (let h = 1; h <= 5; h++) {
          y += Math.sin(t * Math.PI * 2 * frequency * h + phase * h) * (amplitude / h) * env;
        }
      }

      points.push(`${x.toFixed(2)},${(yBase + y).toFixed(2)}`);
    }

    lines.push(`<polyline points="${points.join(" ")}" ${STROKE}/>`);
  }
  return lines.join("\n    ");
}

function radialBurst(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const cx = w / 2 + (rng() - 0.5) * w * 0.1;
  const cy = h / 2 + (rng() - 0.5) * h * 0.1;
  const maxR = Math.min(w - MARGIN * 2, h - MARGIN * 2) / 2;
  const numRays = 12 + Math.floor(rng() * 16); // cap at 28 to avoid center congestion
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
  const stepSize = 0.8;
  const maxSteps = 120;

  // Multi-octave noise for richer, more organic flow
  const o1 = rng() * 100;
  const o2 = rng() * 100;
  const o3 = rng() * 100;
  const baseFreq = 0.02 + rng() * 0.03;
  // Curl direction — some seeds spiral clockwise, some counter
  const curl = rng() > 0.5 ? 1 : -1;

  function angle(x: number, y: number): number {
    // Three octaves of pseudo-noise for complex swirling
    const a1 = Math.sin(x * baseFreq + o1) * Math.cos(y * baseFreq + o1 * 0.7);
    const a2 = Math.sin(x * baseFreq * 2.3 + o2) * Math.cos(y * baseFreq * 2.3 + o2 * 0.6) * 0.5;
    const a3 = Math.sin(x * baseFreq * 4.7 + o3) * Math.cos(y * baseFreq * 4.7 + o3 * 0.8) * 0.25;
    return (a1 + a2 + a3) * Math.PI * 2 * curl;
  }

  // Grid-seeded start points with slight jitter for even coverage
  const spacing = 3.5 + rng() * 2;
  for (let gx = MARGIN; gx < w - MARGIN; gx += spacing) {
    for (let gy = MARGIN; gy < h - MARGIN; gy += spacing) {
      let x = gx + (rng() - 0.5) * spacing * 0.6;
      let y = gy + (rng() - 0.5) * spacing * 0.6;
      const lineSteps = Math.floor(maxSteps * (0.4 + rng() * 0.6)); // variable length
      const points: string[] = [`${x.toFixed(2)},${y.toFixed(2)}`];

      for (let s = 0; s < lineSteps; s++) {
        const a = angle(x, y);
        x += Math.cos(a) * stepSize;
        y += Math.sin(a) * stepSize;
        if (x < MARGIN - 1 || x > w - MARGIN + 1 || y < MARGIN - 1 || y > h - MARGIN + 1) break;
        points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      }

      if (points.length > 5) {
        lines.push(`<polyline points="${points.join(" ")}" ${STROKE}/>`);
      }
    }
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Sierpinski Full Plate — fills the entire panel
// ---------------------------------------------------------------------------

function sierpinskiFull(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const depth = 4 + Math.floor(rng() * 2); // cap at 5 to avoid tiny triangles
  const side = Math.max(w, h * 2 / Math.sqrt(3)) * 1.05;
  const cx = w / 2;
  const baseY = h / 2 + (side * Math.sqrt(3) / 4);

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
    cx, baseY - side * Math.sqrt(3) / 2,
    cx - side / 2, baseY,
    cx + side / 2, baseY,
    depth
  );

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Circuit Traces — PCB-like paths with pads
// ---------------------------------------------------------------------------

function circuitTraces(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const numTraces = 16 + Math.floor(rng() * 14);
  const padR = 0.8;
  const gridSnap = 2.54; // standard PCB grid

  function snap(v: number): number {
    return Math.round(v / gridSnap) * gridSnap;
  }

  for (let i = 0; i < numTraces; i++) {
    let x = snap(MARGIN + rng() * (w - MARGIN * 2));
    let y = snap(MARGIN + rng() * (h - MARGIN * 2));
    const segments = 5 + Math.floor(rng() * 8);
    const points: string[] = [`${x.toFixed(2)},${y.toFixed(2)}`];

    // Start pad
    lines.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${padR}" ${STROKE}/>`);

    for (let s = 0; s < segments; s++) {
      // Traces go in orthogonal or 45-degree directions
      const dirs = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, -Math.PI / 4, -Math.PI / 2, -(3 * Math.PI) / 4];
      const dir = dirs[Math.floor(rng() * dirs.length)];
      const len = gridSnap * (2 + Math.floor(rng() * 5));
      const nx = snap(x + Math.cos(dir) * len);
      const ny = snap(y + Math.sin(dir) * len);

      if (nx < MARGIN || nx > w - MARGIN || ny < MARGIN || ny > h - MARGIN) break;

      points.push(`${nx.toFixed(2)},${ny.toFixed(2)}`);
      x = nx;
      y = ny;

      // Via/pad at corners sometimes
      if (rng() > 0.4) {
        lines.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${padR}" ${STROKE}/>`);
        lines.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(padR * 0.4).toFixed(2)}" ${STROKE}/>`);
      }
    }

    // End pad
    lines.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${padR}" ${STROKE}/>`);

    if (points.length > 1) {
      lines.push(`<polyline points="${points.join(" ")}" ${STROKE}/>`);
    }
  }

  // Add some IC-like rectangles
  const numICs = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < numICs; i++) {
    const icW = 4 + rng() * 6;
    const icH = 3 + rng() * 4;
    const icX = snap(MARGIN + rng() * (w - MARGIN * 2 - icW));
    const icY = snap(MARGIN + rng() * (h - MARGIN * 2 - icH));
    lines.push(`<rect x="${icX.toFixed(2)}" y="${icY.toFixed(2)}" width="${icW.toFixed(2)}" height="${icH.toFixed(2)}" rx="0.3" ry="0.3" ${STROKE}/>`);
    // Pin notch
    lines.push(`<circle cx="${(icX + 1).toFixed(2)}" cy="${(icY + icH / 2).toFixed(2)}" r="0.5" ${STROKE}/>`);
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Binary Matrix — columns of 0s and 1s
// ---------------------------------------------------------------------------

function binaryMatrix(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const fontSize = 4.5;
  const colSpacing = 5;
  const rowSpacing = 5.5;

  for (let x = MARGIN; x < w - MARGIN; x += colSpacing) {
    const colSpeed = 0.5 + rng() * 1.5;
    const colOffset = rng() * 100;
    const opacity = 0.3 + rng() * 0.7;

    for (let y = MARGIN + fontSize; y < h - MARGIN; y += rowSpacing) {
      const val = Math.sin((y * colSpeed + colOffset) * 0.1 + seed) > 0 ? "1" : "0";
      lines.push(
        `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" ` +
        `font-family="monospace" font-size="${fontSize}" ` +
        `fill="none" stroke="${ENGRAVE_COLOR}" stroke-width="0.2" ` +
        `opacity="${opacity.toFixed(2)}">${val}</text>`
      );
    }
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Oscilloscope — scope-style waveform display
// ---------------------------------------------------------------------------

function oscilloscope(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const THIN = `stroke="${ENGRAVE_COLOR}" stroke-width="0.15" fill="none"`;
  const iw = w - MARGIN * 2;
  const ih = h - MARGIN * 2;
  const cx = w / 2;
  const cy = h / 2;

  // Graticule — 8x10 grid with tick marks
  const divX = iw / 10;
  const divY = ih / 8;
  const tickLen = 1.0;

  // Outer border
  lines.push(`<rect x="${MARGIN}" y="${MARGIN}" width="${iw}" height="${ih}" ${THIN}/>`);

  // Grid lines (subtle)
  for (let i = 1; i < 10; i++) {
    const x = MARGIN + i * divX;
    lines.push(`<line x1="${x.toFixed(2)}" y1="${MARGIN}" x2="${x.toFixed(2)}" y2="${(h - MARGIN).toFixed(2)}" stroke="${ENGRAVE_COLOR}" stroke-width="0.08" fill="none"/>`);
  }
  for (let i = 1; i < 8; i++) {
    const y = MARGIN + i * divY;
    lines.push(`<line x1="${MARGIN}" y1="${y.toFixed(2)}" x2="${(w - MARGIN).toFixed(2)}" y2="${y.toFixed(2)}" stroke="${ENGRAVE_COLOR}" stroke-width="0.08" fill="none"/>`);
  }

  // Center crosshair with tick marks
  lines.push(`<line x1="${cx.toFixed(2)}" y1="${MARGIN}" x2="${cx.toFixed(2)}" y2="${(h - MARGIN).toFixed(2)}" stroke="${ENGRAVE_COLOR}" stroke-width="0.2" fill="none"/>`);
  lines.push(`<line x1="${MARGIN}" y1="${cy.toFixed(2)}" x2="${(w - MARGIN).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${ENGRAVE_COLOR}" stroke-width="0.2" fill="none"/>`);

  // Tick marks on center axes
  for (let i = 1; i < 10; i++) {
    const x = MARGIN + i * divX;
    lines.push(`<line x1="${x.toFixed(2)}" y1="${(cy - tickLen).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(cy + tickLen).toFixed(2)}" ${THIN}/>`);
  }
  for (let i = 1; i < 8; i++) {
    const y = MARGIN + i * divY;
    lines.push(`<line x1="${(cx - tickLen).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(cx + tickLen).toFixed(2)}" y2="${y.toFixed(2)}" ${THIN}/>`);
  }

  // Generate waveform trace
  const traceTypes = ["fm-chaos", "wavefolder", "ring-mod", "sync", "noise-burst"] as const;
  const traceType = traceTypes[Math.floor(rng() * traceTypes.length)];
  const freq = 2 + rng() * 3;
  const amplitude = ih * 0.35;
  const phase = rng() * Math.PI * 2;

  function traceY(t: number): number {
    let y = 0;
    if (traceType === "fm-chaos") {
      const modFreq = freq * (3 + rng() * 0.001);
      const modIndex = 3 + rng() * 0.001;
      y = Math.sin(t * Math.PI * 2 * freq + Math.sin(t * Math.PI * 2 * modFreq) * modIndex + phase);
    } else if (traceType === "wavefolder") {
      const raw = Math.sin(t * Math.PI * 2 * freq + phase) * 2.5;
      y = Math.sin(raw * Math.PI);
    } else if (traceType === "ring-mod") {
      y = Math.sin(t * Math.PI * 2 * freq + phase) * Math.sin(t * Math.PI * 2 * freq * 1.7 + phase * 0.3);
    } else if (traceType === "sync") {
      const master = t * freq;
      const slave = t * freq * (2.3 + rng() * 0.001);
      y = Math.sin((slave % 1) * Math.PI * 2) * (1 - 0.3 * Math.abs(Math.sin(master * Math.PI)));
    } else {
      // noise-burst — signal with gated noise
      const gate = Math.sin(t * Math.PI * 2 * freq * 0.5 + phase) > 0 ? 1 : 0;
      const noise = Math.sin(t * 347.7 + seed) * 0.7 + Math.sin(t * 891.3 + seed * 2) * 0.3;
      y = gate * noise;
    }
    return cy + y * amplitude;
  }

  // Multiple trace passes — simulates phosphor persistence / retrigger jitter
  const numPasses = 3 + Math.floor(rng() * 3);
  for (let pass = 0; pass < numPasses; pass++) {
    const jitter = (rng() - 0.5) * 0.02; // slight timing offset
    const yOffset = (rng() - 0.5) * 1.5; // slight vertical drift
    const points: string[] = [];

    for (let x = MARGIN; x <= w - MARGIN; x += 0.5) {
      const t = (x - MARGIN) / iw + jitter;
      const y = traceY(t) + yOffset;
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }

    lines.push(`<polyline points="${points.join(" ")}" ${STROKE}/>`);
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Flower of Life
// ---------------------------------------------------------------------------

function flowerOfLife(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const r = Math.min(w - MARGIN * 2, h - MARGIN * 2) / (4 + rng() * 2);
  const cx = w / 2;
  const cy = h / 2;

  function addCircle(x: number, y: number) {
    if (x - r < -2 || x + r > w + 2 || y - r < -2 || y + r > h + 2) return;
    lines.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" ${STROKE}/>`);
  }

  // Generate expanding rings of circles
  addCircle(cx, cy);
  const rings = 3 + Math.floor(rng() * 2);

  for (let ring = 1; ring <= rings; ring++) {
    const numInRing = ring * 6;
    for (let i = 0; i < numInRing; i++) {
      const angle = (i / numInRing) * Math.PI * 2 + (ring % 2 === 0 ? Math.PI / numInRing : 0);
      const dist = r * ring;
      addCircle(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist);
    }
  }

  // Outer bounding circle
  const outerR = r * rings + r * 0.5;
  lines.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${outerR.toFixed(2)}" ${STROKE}/>`);

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Metatron's Cube
// ---------------------------------------------------------------------------

function metatronsCube(w: number, h: number, _seed: number): string {
  const lines: string[] = [];
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w - MARGIN * 2, h - MARGIN * 2) / 2.5;
  const r = R * 0.2; // smaller circles to avoid center congestion

  // 13 points: center + 6 inner ring + 6 outer ring
  const points: [number, number][] = [[cx, cy]];

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    points.push([cx + Math.cos(angle) * R * 0.5, cy + Math.sin(angle) * R * 0.5]);
  }
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    points.push([cx + Math.cos(angle) * R, cy + Math.sin(angle) * R]);
  }

  // Connect every point to every other point
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      lines.push(
        `<line x1="${points[i][0].toFixed(2)}" y1="${points[i][1].toFixed(2)}" ` +
        `x2="${points[j][0].toFixed(2)}" y2="${points[j][1].toFixed(2)}" ${STROKE}/>`
      );
    }
  }

  // Circles at each point
  for (const [px, py] of points) {
    lines.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${r.toFixed(2)}" ${STROKE}/>`);
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Seed of Life
// ---------------------------------------------------------------------------

function seedOfLife(w: number, h: number, _seed: number): string {
  const lines: string[] = [];
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w - MARGIN * 2, h - MARGIN * 2) / 4;

  // Center circle
  lines.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" ${STROKE}/>`);

  // 6 surrounding circles
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    lines.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${r.toFixed(2)}" ${STROKE}/>`);
  }

  // Outer enclosing circle
  lines.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(r * 2).toFixed(2)}" ${STROKE}/>`);

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Lissajous Curves
// ---------------------------------------------------------------------------

function lissajous(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const cx = w / 2;
  const cy = h / 2;
  const ax = (w - MARGIN * 2) / 2;
  const ay = (h - MARGIN * 2) / 2;
  const numCurves = 2 + Math.floor(rng() * 3); // 2-4 curves to avoid center congestion
  const ratios = [[1, 2], [2, 3], [3, 4], [3, 5], [1, 3], [4, 5], [5, 6]];

  for (let c = 0; c < numCurves; c++) {
    const [a, b] = ratios[Math.floor(rng() * ratios.length)];
    const delta = rng() * Math.PI;
    const scaleX = 0.6 + rng() * 0.35; // fixed per curve, not per point
    const scaleY = 0.6 + rng() * 0.35;
    const points: string[] = [];
    const steps = 2000;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2 * a * b; // full period = LCM of both frequencies
      const x = cx + Math.sin(a * t + delta) * ax * scaleX;
      const y = cy + Math.sin(b * t) * ay * scaleY;
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }

    lines.push(`<polyline points="${points.join(" ")}" ${STROKE}/>`);
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Voronoi Cells
// ---------------------------------------------------------------------------

function voronoi(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const numPoints = 15 + Math.floor(rng() * 20);

  // Generate seed points with slight clustering
  const points: [number, number][] = [];
  for (let i = 0; i < numPoints; i++) {
    points.push([
      MARGIN + rng() * (w - MARGIN * 2),
      MARGIN + rng() * (h - MARGIN * 2),
    ]);
  }

  // Approximate Voronoi via pixel sampling — find edges where nearest point changes
  const step = 1.2;
  function nearest(x: number, y: number): number {
    let minD = Infinity;
    let minI = 0;
    for (let i = 0; i < points.length; i++) {
      const d = (x - points[i][0]) ** 2 + (y - points[i][1]) ** 2;
      if (d < minD) { minD = d; minI = i; }
    }
    return minI;
  }

  // Trace edges by finding where nearest neighbor changes
  for (let x = MARGIN; x < w - MARGIN; x += step) {
    for (let y = MARGIN; y < h - MARGIN; y += step) {
      const n = nearest(x, y);
      const nr = nearest(x + step, y);
      const nb = nearest(x, y + step);
      if (n !== nr) {
        lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + step).toFixed(1)}" y2="${y.toFixed(1)}" ${STROKE}/>`);
      }
      if (n !== nb) {
        lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + step).toFixed(1)}" ${STROKE}/>`);
      }
    }
  }

  // Small circles at seed points
  for (const [px, py] of points) {
    lines.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="0.4" ${STROKE}/>`);
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Lorenz Strange Attractor
// ---------------------------------------------------------------------------

function lorenzAttractor(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const sigma = 10;
  const rho = 28;
  const beta = 8 / 3;
  const dt = 0.005;
  const steps = 8000;

  let x = 0.1 + rng() * 0.5;
  let y = 0;
  let z = 0;
  const trail: [number, number, number][] = [];

  for (let i = 0; i < steps; i++) {
    const dx = sigma * (y - x) * dt;
    const dy = (x * (rho - z) - y) * dt;
    const dz = (x * y - beta * z) * dt;
    x += dx; y += dy; z += dz;
    trail.push([x, y, z]);
  }

  // Project XZ plane, scale to panel
  const xs = trail.map(t => t[0]);
  const zs = trail.map(t => t[2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const points: string[] = trail.map(([tx, , tz]) => {
    const px = MARGIN + ((tx - minX) / (maxX - minX)) * (w - MARGIN * 2);
    const py = MARGIN + ((tz - minZ) / (maxZ - minZ)) * (h - MARGIN * 2);
    return `${px.toFixed(2)},${py.toFixed(2)}`;
  });

  lines.push(`<polyline points="${points.join(" ")}" ${STROKE}/>`);

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Topographic Contours
// ---------------------------------------------------------------------------

function topographic(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];

  // Simple height function using overlapping sine waves
  const peaks = 2 + Math.floor(rng() * 3);
  const peakData: { x: number; y: number; r: number; h: number }[] = [];
  for (let i = 0; i < peaks; i++) {
    peakData.push({
      x: MARGIN + rng() * (w - MARGIN * 2),
      y: MARGIN + rng() * (h - MARGIN * 2),
      r: 15 + rng() * 30,
      h: 0.5 + rng() * 0.5,
    });
  }

  function height(x: number, y: number): number {
    let v = 0;
    for (const p of peakData) {
      const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
      v += p.h * Math.exp(-(d * d) / (2 * p.r * p.r));
    }
    return v;
  }

  // March contour lines using simple threshold detection
  const step = 1.2;
  const numContours = 6 + Math.floor(rng() * 4); // cap at 10
  for (let level = 1; level <= numContours; level++) {
    const threshold = level / (numContours + 1);
    for (let x = MARGIN; x < w - MARGIN; x += step) {
      for (let y = MARGIN; y < h - MARGIN; y += step) {
        const v = height(x, y);
        const vr = height(x + step, y);
        const vb = height(x, y + step);
        if ((v >= threshold) !== (vr >= threshold)) {
          lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + step).toFixed(1)}" y2="${y.toFixed(1)}" ${STROKE}/>`);
        }
        if ((v >= threshold) !== (vb >= threshold)) {
          lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + step).toFixed(1)}" ${STROKE}/>`);
        }
      }
    }
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Phyllotaxis (Golden Angle Spiral)
// ---------------------------------------------------------------------------

function phyllotaxis(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) / 2 - MARGIN;
  const goldenAngle = 137.508 * (Math.PI / 180);
  const numPoints = 200 + Math.floor(rng() * 200);
  const c = maxR / Math.sqrt(numPoints);
  const dotR = 0.5 + rng() * 0.3;

  for (let n = 1; n <= numPoints; n++) {
    const angle = n * goldenAngle + seed * 0.01;
    const r = c * Math.sqrt(n);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;

    if (x < 0 || x > w || y < 0 || y > h) continue;

    lines.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${dotR.toFixed(2)}" ${STROKE}/>`);
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Moiré Lines — angled lines that interact with aluminum grain
// ---------------------------------------------------------------------------

function moireLines(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const angle1 = 5 + rng() * 15; // degrees off horizontal
  const angle2 = -(5 + rng() * 15);
  const spacing = 3.0 + rng() * 1.5; // wide enough that two crossed sets don't fill solid
  const rad1 = (angle1 * Math.PI) / 180;
  const rad2 = (angle2 * Math.PI) / 180;
  const diagonal = Math.sqrt(w * w + h * h);

  function drawSet(angle: number) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let d = -diagonal; d < diagonal; d += spacing) {
      // Line perpendicular to angle direction at distance d from center
      const px = w / 2 + cos * d;
      const py = h / 2 + sin * d;
      const x1 = px - sin * diagonal;
      const y1 = py + cos * diagonal;
      const x2 = px + sin * diagonal;
      const y2 = py - cos * diagonal;
      lines.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" ${STROKE}/>`);
    }
  }

  drawSet(rad1);
  drawSet(rad2);

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Chladni Figures — vibration patterns made visible
// ---------------------------------------------------------------------------

function chladni(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const m = 1 + Math.floor(rng() * 5);
  const n = m + 1 + Math.floor(rng() * 4);
  const step = 1.2;

  // Chladni equation: cos(m*pi*x/w)*cos(n*pi*y/h) - cos(n*pi*x/w)*cos(m*pi*y/h) = 0
  // We find zero-crossings by checking sign changes
  function chladniVal(x: number, y: number): number {
    const nx = (x - MARGIN) / (w - MARGIN * 2);
    const ny = (y - MARGIN) / (h - MARGIN * 2);
    return (
      Math.cos(m * Math.PI * nx) * Math.cos(n * Math.PI * ny) -
      Math.cos(n * Math.PI * nx) * Math.cos(m * Math.PI * ny)
    );
  }

  for (let x = MARGIN; x < w - MARGIN; x += step) {
    for (let y = MARGIN; y < h - MARGIN; y += step) {
      const v = chladniVal(x, y);
      const vr = chladniVal(x + step, y);
      const vb = chladniVal(x, y + step);
      if (v * vr < 0) {
        lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + step).toFixed(1)}" y2="${y.toFixed(1)}" ${STROKE}/>`);
      }
      if (v * vb < 0) {
        lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + step).toFixed(1)}" ${STROKE}/>`);
      }
    }
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Spirograph — hypotrochoid/epitrochoid curves
// ---------------------------------------------------------------------------

function spirograph(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w - MARGIN * 2, h - MARGIN * 2) / 2;

  // Hypotrochoid: x = (R-r)*cos(t) + d*cos((R-r)/r * t)
  //               y = (R-r)*sin(t) - d*sin((R-r)/r * t)
  // Pick integer ratios for clean closed curves
  const numCurves = 1 + Math.floor(rng() * 2);

  for (let c = 0; c < numCurves; c++) {
    const R = maxR * (0.7 + rng() * 0.3);
    // Use integer-ish ratios for closed figures
    const rOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const rDivisor = rOptions[Math.floor(rng() * rOptions.length)];
    const r = R / rDivisor;
    const d = r * (0.5 + rng() * 1.2); // pen distance — controls petal depth
    const phase = rng() * Math.PI * 2;

    // Full period = 2π * r / gcd(R_int, r_int), but we just do enough rotations
    const rotations = rDivisor;
    const steps = rotations * 200;
    const points: string[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * rotations * Math.PI * 2 + phase;
      const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
      const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }

    lines.push(`<polyline points="${points.join(" ")}" ${STROKE}/>`);
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Reaction-Diffusion (Gray-Scott) — Turing patterns
// ---------------------------------------------------------------------------

function reactionDiffusion(w: number, h: number, seed: number): string {
  const rng = seededRng(seed);
  const lines: string[] = [];

  // Simulate on a coarse grid, then trace contours
  // Resolution of 4mm produces open, organic structures
  const resolution = 4.0;
  const cols = Math.floor((w - MARGIN * 2) / resolution);
  const rows = Math.floor((h - MARGIN * 2) / resolution);

  // Initialize chemical concentrations
  const a: number[][] = Array.from({ length: rows }, () => Array(cols).fill(1));
  const b: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  // Seed some spots of chemical B — fewer, larger seeds for bold features
  const numSeeds = 2 + Math.floor(rng() * 3);
  for (let s = 0; s < numSeeds; s++) {
    const sr = Math.floor(rng() * rows);
    const sc = Math.floor(rng() * cols);
    const size = 3 + Math.floor(rng() * 4);
    for (let dr = -size; dr <= size; dr++) {
      for (let dc = -size; dc <= size; dc++) {
        const r = sr + dr;
        const c = sc + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          b[r][c] = 1;
        }
      }
    }
  }

  // Run simulation
  const f = 0.055 + rng() * 0.01;
  const k = 0.062 + rng() * 0.005;
  const Da = 1.0;
  const Db = 0.5;
  const iterations = 300; // fewer iterations = larger, bolder organic features

  for (let iter = 0; iter < iterations; iter++) {
    const na = a.map(row => [...row]);
    const nb = b.map(row => [...row]);

    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const lapA = a[r-1][c] + a[r+1][c] + a[r][c-1] + a[r][c+1] - 4 * a[r][c];
        const lapB = b[r-1][c] + b[r+1][c] + b[r][c-1] + b[r][c+1] - 4 * b[r][c];
        const abb = a[r][c] * b[r][c] * b[r][c];
        na[r][c] = a[r][c] + (Da * lapA - abb + f * (1 - a[r][c]));
        nb[r][c] = b[r][c] + (Db * lapB + abb - (k + f) * b[r][c]);
        na[r][c] = Math.max(0, Math.min(1, na[r][c]));
        nb[r][c] = Math.max(0, Math.min(1, nb[r][c]));
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        a[r][c] = na[r][c];
        b[r][c] = nb[r][c];
      }
    }
  }

  // Trace contours of chemical B at threshold 0.25
  const threshold = 0.25;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const x = MARGIN + c * resolution;
      const y = MARGIN + r * resolution;
      const v = b[r][c];
      const vr = b[r][c + 1];
      const vb = b[r + 1][c];

      if ((v >= threshold) !== (vr >= threshold)) {
        lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + resolution).toFixed(1)}" y2="${y.toFixed(1)}" ${STROKE}/>`);
      }
      if ((v >= threshold) !== (vb >= threshold)) {
        lines.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + resolution).toFixed(1)}" ${STROKE}/>`);
      }
    }
  }

  return lines.join("\n    ");
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const generators: Record<string, (w: number, h: number, seed: number) => string> = {
  "concentric-circles": concentricCircles,
  "hex-grid": hexGrid,
  "waveform": waveform,
  "sierpinski-full": sierpinskiFull,
  "radial-burst": radialBurst,
  "flow-field": flowField,
  "circuit-traces": circuitTraces,
  "binary-matrix": binaryMatrix,
  "oscilloscope": oscilloscope,
  "flower-of-life": flowerOfLife,
  "metatrons-cube": metatronsCube,
  "seed-of-life": seedOfLife,
  "lissajous": lissajous,
  "voronoi": voronoi,
  "lorenz-attractor": lorenzAttractor,
  "topographic": topographic,
  "phyllotaxis": phyllotaxis,
  "moire-lines": moireLines,
  "chladni": chladni,
  "spirograph": spirograph,
  "reaction-diffusion": reactionDiffusion,
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
  "spirograph": "Spirograph",
  "binary-matrix": "Binary Matrix",
  "chladni": "Chladni Figure",
  "circuit-traces": "Circuit Traces",
  "concentric-circles": "Concentric Circles",
  "flow-field": "Flow Field",
  "flower-of-life": "Flower of Life",
  "hex-grid": "Hex Grid",
  "lissajous": "Lissajous Curves",
  "lorenz-attractor": "Lorenz Attractor",
  "metatrons-cube": "Metatron's Cube",
  "moire-lines": "Moiré Lines",
  "oscilloscope": "Oscilloscope",
  "phyllotaxis": "Phyllotaxis Spiral",
  "radial-burst": "Radial Burst",
  "reaction-diffusion": "Reaction-Diffusion",
  "seed-of-life": "Seed of Life",
  "sierpinski-full": "Sierpinski",
  "topographic": "Topographic",
  "voronoi": "Voronoi Cells",
  "waveform": "Waveform",
};

/** Pattern entries sorted alphabetically by display label, with "None" always first. */
export const SORTED_PATTERN_ENTRIES: [string, string][] = (() => {
  const entries = Object.entries(PATTERN_LABELS);
  const none = entries.find(([k]) => k === "none")!;
  const rest = entries.filter(([k]) => k !== "none").sort((a, b) => a[1].localeCompare(b[1]));
  return [none, ...rest];
})();
