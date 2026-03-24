import type { PatternType } from "../types";
import {
  type PatternGeometry,
  type Path2D,
  type Polygon2D,
  type Circle2D,
  type Line2D,
  type Rect2D,
  type Text2D,
  emptyGeometry,
} from "./types";

export type { PatternGeometry, Path2D, Polygon2D, Circle2D, Line2D, Rect2D, Text2D };
export { emptyGeometry };
export type { PatternType };

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

// ---------------------------------------------------------------------------
// Concentric Circles
// ---------------------------------------------------------------------------

function concentricCircles(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const cx = w / 2 + (rng() - 0.5) * w * 0.1;
  const cy = h / 2 + (rng() - 0.5) * h * 0.1;
  const maxR = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2) * 1.1;
  const spacing = 3.0 + rng() * 2.0;
  for (let r = spacing; r <= maxR; r += spacing) {
    geo.circles.push({ cx, cy, r });
  }
  return geo;
}

// ---------------------------------------------------------------------------
// Hex Grid
// ---------------------------------------------------------------------------

function hexGrid(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const size = 2.5 + rng() * 2;
  const dx = size * Math.sqrt(3);
  const dy = size * 1.5;

  for (let row = 0; row * dy < h - MARGIN; row++) {
    for (let col = 0; col * dx < w - MARGIN; col++) {
      const cx = MARGIN + col * dx + (row % 2 === 1 ? dx / 2 : 0);
      const cy = MARGIN + row * dy;
      if (cx < MARGIN || cx > w - MARGIN || cy < MARGIN || cy > h - MARGIN) continue;

      const points: [number, number][] = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        return [cx + size * Math.cos(angle), cy + size * Math.sin(angle)];
      });
      geo.polygons.push({ points });
    }
  }
  return geo;
}

// ---------------------------------------------------------------------------
// Waveform
// ---------------------------------------------------------------------------

function waveform(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const numWaves = 4 + Math.floor(rng() * 5);
  const step = 0.8;

  for (let wave = 0; wave < numWaves; wave++) {
    const yBase = MARGIN + ((h - MARGIN * 2) / (numWaves + 1)) * (wave + 1);

    const waveTypes = ["sine", "saw", "square", "fm", "additive"] as const;
    const type = waveTypes[Math.floor(rng() * waveTypes.length)];
    const frequency = 1.5 + rng() * 5;
    const amplitude = (h - MARGIN * 2) / (numWaves + 1) * (0.3 + rng() * 0.35);
    const phase = rng() * Math.PI * 2;
    const envAttack = rng() * 0.2;
    const envRelease = 0.8 + rng() * 0.2;

    const points: [number, number][] = [];

    for (let x = MARGIN; x <= w - MARGIN; x += step) {
      const t = (x - MARGIN) / (w - MARGIN * 2);
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
        const modFreq = frequency * (2 + rng() * 0.01);
        const modIndex = 1.5 + rng() * 0.01;
        y = Math.sin(t * Math.PI * 2 * frequency + Math.sin(t * Math.PI * 2 * modFreq) * modIndex + phase) * amplitude * env;
      } else {
        // Additive — sum of harmonics
        for (let harm = 1; harm <= 5; harm++) {
          y += Math.sin(t * Math.PI * 2 * frequency * harm + phase * harm) * (amplitude / harm) * env;
        }
      }

      points.push([x, yBase + y]);
    }

    geo.paths.push({ points });
  }
  return geo;
}

// ---------------------------------------------------------------------------
// Sierpinski Full Plate
// ---------------------------------------------------------------------------

function sierpinskiFull(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const depth = 4 + Math.floor(rng() * 2);
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
      geo.polygons.push({ points: [[x1, y1], [x2, y2], [x3, y3]] });
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

  return geo;
}

// ---------------------------------------------------------------------------
// Radial Burst
// ---------------------------------------------------------------------------

function radialBurst(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const cx = w / 2 + (rng() - 0.5) * w * 0.1;
  const cy = h / 2 + (rng() - 0.5) * h * 0.1;
  const maxR = Math.min(w - MARGIN * 2, h - MARGIN * 2) / 2;
  const numRays = 12 + Math.floor(rng() * 16);
  const innerR = maxR * (0.1 + rng() * 0.15);

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2 + rng() * 0.1;
    const rayLen = maxR * (0.6 + rng() * 0.4);
    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * rayLen;
    const y2 = cy + Math.sin(angle) * rayLen;
    geo.lines.push({ x1, y1, x2, y2 });
  }

  geo.circles.push({ cx, cy, r: innerR });
  geo.circles.push({ cx, cy, r: maxR * 0.9 });

  return geo;
}

// ---------------------------------------------------------------------------
// Flow Field
// ---------------------------------------------------------------------------

function flowField(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const stepSize = 0.8;
  const maxSteps = 120;

  const o1 = rng() * 100;
  const o2 = rng() * 100;
  const o3 = rng() * 100;
  const baseFreq = 0.02 + rng() * 0.03;
  const curl = rng() > 0.5 ? 1 : -1;

  function angle(x: number, y: number): number {
    const a1 = Math.sin(x * baseFreq + o1) * Math.cos(y * baseFreq + o1 * 0.7);
    const a2 = Math.sin(x * baseFreq * 2.3 + o2) * Math.cos(y * baseFreq * 2.3 + o2 * 0.6) * 0.5;
    const a3 = Math.sin(x * baseFreq * 4.7 + o3) * Math.cos(y * baseFreq * 4.7 + o3 * 0.8) * 0.25;
    return (a1 + a2 + a3) * Math.PI * 2 * curl;
  }

  const spacing = 3.5 + rng() * 2;
  for (let gx = MARGIN; gx < w - MARGIN; gx += spacing) {
    for (let gy = MARGIN; gy < h - MARGIN; gy += spacing) {
      let x = gx + (rng() - 0.5) * spacing * 0.6;
      let y = gy + (rng() - 0.5) * spacing * 0.6;
      const lineSteps = Math.floor(maxSteps * (0.4 + rng() * 0.6));
      const points: [number, number][] = [[x, y]];

      for (let s = 0; s < lineSteps; s++) {
        const a = angle(x, y);
        x += Math.cos(a) * stepSize;
        y += Math.sin(a) * stepSize;
        if (x < MARGIN - 1 || x > w - MARGIN + 1 || y < MARGIN - 1 || y > h - MARGIN + 1) break;
        points.push([x, y]);
      }

      if (points.length > 5) {
        geo.paths.push({ points });
      }
    }
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Circuit Traces
// ---------------------------------------------------------------------------

function circuitTraces(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const numTraces = 16 + Math.floor(rng() * 14);
  const padR = 0.8;
  const gridSnap = 2.54;

  function snap(v: number): number {
    return Math.round(v / gridSnap) * gridSnap;
  }

  for (let i = 0; i < numTraces; i++) {
    let x = snap(MARGIN + rng() * (w - MARGIN * 2));
    let y = snap(MARGIN + rng() * (h - MARGIN * 2));
    const segments = 5 + Math.floor(rng() * 8);
    const points: [number, number][] = [[x, y]];

    geo.circles.push({ cx: x, cy: y, r: padR });

    for (let s = 0; s < segments; s++) {
      const dirs = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, -Math.PI / 4, -Math.PI / 2, -(3 * Math.PI) / 4];
      const dir = dirs[Math.floor(rng() * dirs.length)];
      const len = gridSnap * (2 + Math.floor(rng() * 5));
      const nx = snap(x + Math.cos(dir) * len);
      const ny = snap(y + Math.sin(dir) * len);

      if (nx < MARGIN || nx > w - MARGIN || ny < MARGIN || ny > h - MARGIN) break;

      points.push([nx, ny]);
      x = nx;
      y = ny;

      if (rng() > 0.4) {
        geo.circles.push({ cx: x, cy: y, r: padR });
        geo.circles.push({ cx: x, cy: y, r: padR * 0.4 });
      }
    }

    geo.circles.push({ cx: x, cy: y, r: padR });

    if (points.length > 1) {
      geo.paths.push({ points });
    }
  }

  // IC-like rectangles
  const numICs = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < numICs; i++) {
    const icW = 4 + rng() * 6;
    const icH = 3 + rng() * 4;
    const icX = snap(MARGIN + rng() * (w - MARGIN * 2 - icW));
    const icY = snap(MARGIN + rng() * (h - MARGIN * 2 - icH));
    geo.rects.push({ x: icX, y: icY, width: icW, height: icH, rx: 0.3, ry: 0.3 });
    geo.circles.push({ cx: icX + 1, cy: icY + icH / 2, r: 0.5 });
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Binary Matrix
// ---------------------------------------------------------------------------

function binaryMatrix(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const fontSize = 4.5;
  const colSpacing = 5;
  const rowSpacing = 5.5;

  for (let x = MARGIN; x < w - MARGIN; x += colSpacing) {
    const colSpeed = 0.5 + rng() * 1.5;
    const colOffset = rng() * 100;
    const opacity = 0.3 + rng() * 0.7;

    for (let y = MARGIN + fontSize; y < h - MARGIN; y += rowSpacing) {
      const val = Math.sin((y * colSpeed + colOffset) * 0.1 + seed) > 0 ? "1" : "0";
      geo.texts.push({ x, y, text: val, fontSize, opacity });
    }
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Oscilloscope
// ---------------------------------------------------------------------------

function oscilloscope(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const iw = w - MARGIN * 2;
  const ih = h - MARGIN * 2;
  const cx = w / 2;
  const cy = h / 2;

  const divX = iw / 10;
  const divY = ih / 8;
  const tickLen = 1.0;

  // Outer border
  geo.rects.push({ x: MARGIN, y: MARGIN, width: iw, height: ih });

  // Grid lines
  for (let i = 1; i < 10; i++) {
    const x = MARGIN + i * divX;
    geo.lines.push({ x1: x, y1: MARGIN, x2: x, y2: h - MARGIN });
  }
  for (let i = 1; i < 8; i++) {
    const y = MARGIN + i * divY;
    geo.lines.push({ x1: MARGIN, y1: y, x2: w - MARGIN, y2: y });
  }

  // Center crosshair
  geo.lines.push({ x1: cx, y1: MARGIN, x2: cx, y2: h - MARGIN });
  geo.lines.push({ x1: MARGIN, y1: cy, x2: w - MARGIN, y2: cy });

  // Tick marks on center axes
  for (let i = 1; i < 10; i++) {
    const x = MARGIN + i * divX;
    geo.lines.push({ x1: x, y1: cy - tickLen, x2: x, y2: cy + tickLen });
  }
  for (let i = 1; i < 8; i++) {
    const y = MARGIN + i * divY;
    geo.lines.push({ x1: cx - tickLen, y1: y, x2: cx + tickLen, y2: y });
  }

  // Waveform trace
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
      const gate = Math.sin(t * Math.PI * 2 * freq * 0.5 + phase) > 0 ? 1 : 0;
      const noise = Math.sin(t * 347.7 + seed) * 0.7 + Math.sin(t * 891.3 + seed * 2) * 0.3;
      y = gate * noise;
    }
    return cy + y * amplitude;
  }

  const numPasses = 3 + Math.floor(rng() * 3);
  for (let pass = 0; pass < numPasses; pass++) {
    const jitter = (rng() - 0.5) * 0.02;
    const yOffset = (rng() - 0.5) * 1.5;
    const points: [number, number][] = [];

    for (let x = MARGIN; x <= w - MARGIN; x += 0.5) {
      const t = (x - MARGIN) / iw + jitter;
      const y = traceY(t) + yOffset;
      points.push([x, y]);
    }

    geo.paths.push({ points });
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Flower of Life
// ---------------------------------------------------------------------------

function flowerOfLife(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const r = Math.min(w - MARGIN * 2, h - MARGIN * 2) / (4 + rng() * 2);
  const cx = w / 2;
  const cy = h / 2;

  function addCircle(x: number, y: number) {
    if (x - r < -2 || x + r > w + 2 || y - r < -2 || y + r > h + 2) return;
    geo.circles.push({ cx: x, cy: y, r });
  }

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

  const outerR = r * rings + r * 0.5;
  geo.circles.push({ cx, cy, r: outerR });

  return geo;
}

// ---------------------------------------------------------------------------
// Metatron's Cube
// ---------------------------------------------------------------------------

function metatronsCube(w: number, h: number, _seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w - MARGIN * 2, h - MARGIN * 2) / 2.5;
  const r = R * 0.2;

  const pts: [number, number][] = [[cx, cy]];

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(angle) * R * 0.5, cy + Math.sin(angle) * R * 0.5]);
  }
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(angle) * R, cy + Math.sin(angle) * R]);
  }

  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      geo.lines.push({ x1: pts[i][0], y1: pts[i][1], x2: pts[j][0], y2: pts[j][1] });
    }
  }

  for (const [px, py] of pts) {
    geo.circles.push({ cx: px, cy: py, r });
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Seed of Life
// ---------------------------------------------------------------------------

function seedOfLife(w: number, h: number, _seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w - MARGIN * 2, h - MARGIN * 2) / 4;

  geo.circles.push({ cx, cy, r });

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    geo.circles.push({ cx: px, cy: py, r });
  }

  geo.circles.push({ cx, cy, r: r * 2 });

  return geo;
}

// ---------------------------------------------------------------------------
// Lissajous Curves
// ---------------------------------------------------------------------------

function lissajous(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const cx = w / 2;
  const cy = h / 2;
  const ax = (w - MARGIN * 2) / 2;
  const ay = (h - MARGIN * 2) / 2;
  const numCurves = 2 + Math.floor(rng() * 3);
  const ratios = [[1, 2], [2, 3], [3, 4], [3, 5], [1, 3], [4, 5], [5, 6]];

  for (let c = 0; c < numCurves; c++) {
    const [a, b] = ratios[Math.floor(rng() * ratios.length)];
    const delta = rng() * Math.PI;
    const scaleX = 0.6 + rng() * 0.35;
    const scaleY = 0.6 + rng() * 0.35;
    const points: [number, number][] = [];
    const steps = 2000;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2 * a * b;
      const x = cx + Math.sin(a * t + delta) * ax * scaleX;
      const y = cy + Math.sin(b * t) * ay * scaleY;
      points.push([x, y]);
    }

    geo.paths.push({ points });
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Voronoi Cells
// ---------------------------------------------------------------------------

function voronoi(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const numPoints = 15 + Math.floor(rng() * 20);

  const pts: [number, number][] = [];
  for (let i = 0; i < numPoints; i++) {
    pts.push([
      MARGIN + rng() * (w - MARGIN * 2),
      MARGIN + rng() * (h - MARGIN * 2),
    ]);
  }

  const step = 1.2;
  function nearest(x: number, y: number): number {
    let minD = Infinity;
    let minI = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = (x - pts[i][0]) ** 2 + (y - pts[i][1]) ** 2;
      if (d < minD) { minD = d; minI = i; }
    }
    return minI;
  }

  for (let x = MARGIN; x < w - MARGIN; x += step) {
    for (let y = MARGIN; y < h - MARGIN; y += step) {
      const n = nearest(x, y);
      const nr = nearest(x + step, y);
      const nb = nearest(x, y + step);
      if (n !== nr) {
        geo.lines.push({ x1: x, y1: y, x2: x + step, y2: y });
      }
      if (n !== nb) {
        geo.lines.push({ x1: x, y1: y, x2: x, y2: y + step });
      }
    }
  }

  for (const [px, py] of pts) {
    geo.circles.push({ cx: px, cy: py, r: 0.4 });
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Lorenz Strange Attractor
// ---------------------------------------------------------------------------

function lorenzAttractor(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
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

  const xs = trail.map(t => t[0]);
  const zs = trail.map(t => t[2]);
  const minX = xs.reduce((a, b) => Math.min(a, b), Infinity);
  const maxX = xs.reduce((a, b) => Math.max(a, b), -Infinity);
  const minZ = zs.reduce((a, b) => Math.min(a, b), Infinity);
  const maxZ = zs.reduce((a, b) => Math.max(a, b), -Infinity);
  const rangeX = (maxX - minX) || 1;
  const rangeZ = (maxZ - minZ) || 1;

  const points: [number, number][] = trail.map(([tx, , tz]) => {
    const px = MARGIN + ((tx - minX) / rangeX) * (w - MARGIN * 2);
    const py = MARGIN + ((tz - minZ) / rangeZ) * (h - MARGIN * 2);
    return [px, py];
  });

  geo.paths.push({ points });

  return geo;
}

// ---------------------------------------------------------------------------
// Topographic Contours
// ---------------------------------------------------------------------------

function topographic(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);

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

  const step = 1.2;
  const numContours = 6 + Math.floor(rng() * 4);
  for (let level = 1; level <= numContours; level++) {
    const threshold = level / (numContours + 1);
    for (let x = MARGIN; x < w - MARGIN; x += step) {
      for (let y = MARGIN; y < h - MARGIN; y += step) {
        const v = height(x, y);
        const vr = height(x + step, y);
        const vb = height(x, y + step);
        if ((v >= threshold) !== (vr >= threshold)) {
          geo.lines.push({ x1: x, y1: y, x2: x + step, y2: y });
        }
        if ((v >= threshold) !== (vb >= threshold)) {
          geo.lines.push({ x1: x, y1: y, x2: x, y2: y + step });
        }
      }
    }
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Phyllotaxis (Golden Angle Spiral)
// ---------------------------------------------------------------------------

function phyllotaxis(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
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

    geo.circles.push({ cx: x, cy: y, r: dotR });
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Moiré Lines
// ---------------------------------------------------------------------------

function moireLines(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const angle1 = 5 + rng() * 15;
  const angle2 = -(5 + rng() * 15);
  const spacing = 3.0 + rng() * 1.5;
  const rad1 = (angle1 * Math.PI) / 180;
  const rad2 = (angle2 * Math.PI) / 180;
  const diagonal = Math.sqrt(w * w + h * h);

  function drawSet(angle: number) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let d = -diagonal; d < diagonal; d += spacing) {
      const px = w / 2 + cos * d;
      const py = h / 2 + sin * d;
      const x1 = px - sin * diagonal;
      const y1 = py + cos * diagonal;
      const x2 = px + sin * diagonal;
      const y2 = py - cos * diagonal;
      geo.lines.push({ x1, y1, x2, y2 });
    }
  }

  drawSet(rad1);
  drawSet(rad2);

  return geo;
}

// ---------------------------------------------------------------------------
// Chladni Figures
// ---------------------------------------------------------------------------

function chladni(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const m = 1 + Math.floor(rng() * 5);
  const n = m + 1 + Math.floor(rng() * 4);
  const step = 1.2;

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
        geo.lines.push({ x1: x, y1: y, x2: x + step, y2: y });
      }
      if (v * vb < 0) {
        geo.lines.push({ x1: x, y1: y, x2: x, y2: y + step });
      }
    }
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Spirograph
// ---------------------------------------------------------------------------

function spirograph(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w - MARGIN * 2, h - MARGIN * 2) / 2;

  const numCurves = 1 + Math.floor(rng() * 2);

  for (let c = 0; c < numCurves; c++) {
    const R = maxR * (0.7 + rng() * 0.3);
    const rOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const rDivisor = rOptions[Math.floor(rng() * rOptions.length)];
    const r = R / rDivisor;
    const d = r * (0.5 + rng() * 1.2);
    const phase = rng() * Math.PI * 2;

    const rotations = rDivisor;
    const steps = rotations * 200;
    const points: [number, number][] = [];

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * rotations * Math.PI * 2 + phase;
      const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
      const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
      points.push([x, y]);
    }

    geo.paths.push({ points });
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Reaction-Diffusion (Gray-Scott)
// ---------------------------------------------------------------------------

function reactionDiffusion(w: number, h: number, seed: number): PatternGeometry {
  const geo = emptyGeometry();
  const rng = seededRng(seed);

  const resolution = 4.0;
  const cols = Math.floor((w - MARGIN * 2) / resolution);
  const rows = Math.floor((h - MARGIN * 2) / resolution);

  const a: number[][] = Array.from({ length: rows }, () => Array(cols).fill(1));
  const b: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

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

  const f = 0.055 + rng() * 0.01;
  const k = 0.062 + rng() * 0.005;
  const Da = 1.0;
  const Db = 0.5;
  const iterations = 300;

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

  const threshold = 0.25;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const x = MARGIN + c * resolution;
      const y = MARGIN + r * resolution;
      const v = b[r][c];
      const vr = b[r][c + 1];
      const vb = b[r + 1][c];

      if ((v >= threshold) !== (vr >= threshold)) {
        geo.lines.push({ x1: x, y1: y, x2: x + resolution, y2: y });
      }
      if ((v >= threshold) !== (vb >= threshold)) {
        geo.lines.push({ x1: x, y1: y, x2: x, y2: y + resolution });
      }
    }
  }

  return geo;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const generators: Record<string, (w: number, h: number, seed: number) => PatternGeometry> = {
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

export function generatePatternGeometry(
  pattern: PatternType,
  width: number,
  height: number,
  seed: number
): PatternGeometry {
  if (pattern === "none") return emptyGeometry();
  const gen = generators[pattern];
  if (!gen) return emptyGeometry();
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
