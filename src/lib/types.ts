export type Format = "3u" | "1u-intellijel" | "1u-pulplogic";

export type HoleStyle = "slot" | "circle";

export type SplitMode = "equal" | "fill-max";

export type OutputMode = "laser-cut" | "3d-print";

export type MaterialType = "mdf" | "black-acrylic" | "birch-plywood" | "aluminum" | "walnut" | "laser-svg";

/** Patterns drawn as lines: engraved by a laser, or raised as lines on a print */
export type LinePatternType =
  | "none"
  | "concentric-circles"
  | "hex-grid"
  | "waveform"
  | "sierpinski-full"
  | "radial-burst"
  | "flow-field"
  | "circuit-traces"
  | "binary-matrix"
  | "oscilloscope"
  | "flower-of-life"
  | "metatrons-cube"
  | "seed-of-life"
  | "lissajous"
  | "voronoi"
  | "lorenz-attractor"
  | "topographic"
  | "phyllotaxis"
  | "moire-lines"
  | "chladni"
  | "spirograph"
  | "reaction-diffusion";

/** Scalar fields over the panel that surface patterns are made from */
export type SurfaceField =
  | "damascus"
  | "marble"
  | "topo"
  | "chladni-plate"
  | "interference"
  | "cells"
  | "labyrinth"
  | "ripple";

export type SurfaceStyle = "relief" | "bands";

/** A height-field pattern: one field rendered in one style. */
export type SurfacePattern = `${SurfaceStyle}-${SurfaceField}`;

export type PatternType = LinePatternType | SurfacePattern;

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
  pattern: PatternType;
  patternSeed: number;
}

export interface PanelEntry {
  id: string;
  hp: number;
  format: Format;
  holeStyle: HoleStyle;
  quantity: number;
  pattern: PatternType;
  patternSeed: number;
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
