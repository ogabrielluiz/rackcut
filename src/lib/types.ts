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
