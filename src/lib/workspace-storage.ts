import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_GAP,
  DEFAULT_MAX_BLANK_HP,
  DEFAULT_PRINT_COLOR,
  FORMAT_PARAMS,
  MAX_GAP,
  MAX_HP,
  MAX_QUANTITY,
  MIN_GAP,
  MIN_HP,
} from "./constants";
import { newPanelId } from "./panel";
import { PATTERN_LABELS } from "./pattern-geometry";
import { isSurfacePattern } from "./surfaces/fields";
import type { HoleStyle, MaterialType, OutputMode, PanelEntry, PatternType, SplitMode } from "./types";

/**
 * The workspace kept between visits: the panels on the sheet and the settings
 * around them. It is stored in the browser's localStorage and never leaves it.
 *
 * Whatever comes back out is treated as untrusted. It may have been written by
 * an older version of the app, cut short, or edited by hand, and a value that
 * slipped through (a quantity in the millions, say) would break the page on
 * every visit until the visitor cleared their site data.
 */
export interface Workspace {
  panels: PanelEntry[];
  gap: number;
  maxBlankHp: number;
  splitMode: SplitMode;
  globalPattern: PatternType;
  material: MaterialType;
  outputMode: OutputMode;
  printColor: string;
  accentColor: string;
}

/** The part of the Storage API used here */
export type WorkspaceStorage = Pick<Storage, "getItem" | "setItem">;

export const WORKSPACE_STORAGE_KEY = "rackcut:workspace";

/** Bump when the stored shape changes so that older data can no longer be read as it is */
const FORMAT_VERSION = 1;

// Every allowed value of each choice. As Record<Type, true>, TypeScript rejects
// a list that is missing a member or has one too many.
const HOLE_STYLES: Record<HoleStyle, true> = { slot: true, circle: true };
const SPLIT_MODES: Record<SplitMode, true> = { equal: true, "fill-max": true };
const OUTPUT_MODES: Record<OutputMode, true> = { "laser-cut": true, "3d-print": true };
const MATERIALS: Record<MaterialType, true> = {
  mdf: true,
  "black-acrylic": true,
  "birch-plywood": true,
  aluminum: true,
  walnut: true,
  "laser-svg": true,
};

export function defaultWorkspace(): Workspace {
  return {
    panels: [],
    gap: DEFAULT_GAP,
    maxBlankHp: DEFAULT_MAX_BLANK_HP,
    splitMode: "equal",
    globalPattern: "none",
    material: "mdf",
    outputMode: "laser-cut",
    printColor: DEFAULT_PRINT_COLOR,
    accentColor: DEFAULT_ACCENT_COLOR,
  };
}

/** localStorage, or null where the browser withholds it (private windows, blocked site data) */
function browserStorage(): WorkspaceStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOneOf = <K extends string>(choices: Record<K, unknown>, value: unknown): value is K =>
  typeof value === "string" && Object.hasOwn(choices, value);

const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && value >= min && value <= max;

const isIntegerIn = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && isNumberIn(value, min, max);

const isHexColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/** A pattern this version can draw; anything else becomes "none" */
function readPattern(value: unknown): PatternType {
  const known = isOneOf(PATTERN_LABELS, value) || (typeof value === "string" && isSurfacePattern(value as PatternType));
  return known ? (value as PatternType) : "none";
}

/**
 * The stored panels that can still be built. A panel without a usable size or
 * format is dropped; anything else wrong with it is repaired, so a single bad
 * field does not cost the visitor the panel.
 */
function readPanels(value: unknown): PanelEntry[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const panels: PanelEntry[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    if (!isIntegerIn(raw.hp, MIN_HP, MAX_HP) || !isOneOf(FORMAT_PARAMS, raw.format)) continue;

    let id = typeof raw.id === "string" && raw.id !== "" ? raw.id : newPanelId();
    while (ids.has(id)) id = newPanelId();
    ids.add(id);

    panels.push({
      id,
      hp: raw.hp,
      format: raw.format,
      holeStyle: isOneOf(HOLE_STYLES, raw.holeStyle) ? raw.holeStyle : "slot",
      quantity: isIntegerIn(raw.quantity, 1, Infinity) ? Math.min(raw.quantity, MAX_QUANTITY) : 1,
      pattern: readPattern(raw.pattern),
      patternSeed: Number.isSafeInteger(raw.patternSeed) ? (raw.patternSeed as number) : 0,
    });
  }
  return panels;
}

/** The saved workspace, or the defaults for anything missing or unusable. Never throws. */
export function loadWorkspace(storage: WorkspaceStorage | null = browserStorage()): Workspace {
  const fallback = defaultWorkspace();
  let stored: unknown;
  try {
    const text = storage?.getItem(WORKSPACE_STORAGE_KEY);
    if (!text) return fallback;
    stored = JSON.parse(text);
  } catch {
    return fallback;
  }
  if (!isRecord(stored) || stored.version !== FORMAT_VERSION) return fallback;

  return {
    panels: readPanels(stored.panels),
    gap: isNumberIn(stored.gap, MIN_GAP, MAX_GAP) ? stored.gap : fallback.gap,
    maxBlankHp: isIntegerIn(stored.maxBlankHp, MIN_HP, MAX_HP) ? stored.maxBlankHp : fallback.maxBlankHp,
    splitMode: isOneOf(SPLIT_MODES, stored.splitMode) ? stored.splitMode : fallback.splitMode,
    globalPattern: readPattern(stored.globalPattern),
    material: isOneOf(MATERIALS, stored.material) ? stored.material : fallback.material,
    outputMode: isOneOf(OUTPUT_MODES, stored.outputMode) ? stored.outputMode : fallback.outputMode,
    printColor: isHexColor(stored.printColor) ? stored.printColor : fallback.printColor,
    accentColor: isHexColor(stored.accentColor) ? stored.accentColor : fallback.accentColor,
  };
}

/** Remember the workspace for the next visit. Never throws: without storage the app just forgets. */
export function saveWorkspace(workspace: Workspace, storage: WorkspaceStorage | null = browserStorage()): void {
  try {
    storage?.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ version: FORMAT_VERSION, ...workspace }));
  } catch {
    // Storage is full or blocked.
  }
}
