import type { Format, RackData, RackRow } from "./types";

export class ModularGridParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModularGridParseError";
  }
}

interface MgRackJson {
  rack: {
    Rack: {
      rows: string;
      te: string;
      rows1u: string[];
      rows1usystem: string | null;
    };
    Module: MgModule[];
  };
}

interface MgModule {
  name: string;
  te: string;
  is_1u: boolean;
  ModulesRack: {
    row: string;
  };
}

/**
 * Parse a ModularGrid rack page HTML and extract row/module data.
 *
 * The rack data is embedded in a `<script type="application/json" data-mg-json="rtd">`
 * element as structured JSON containing the rack metadata and all placed modules.
 */
export function parseModularGridData(html: string): RackData {
  if (!html || html.trim().length === 0) {
    throw new ModularGridParseError(
      "ModularGrid page structure not recognized — please report this issue",
    );
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Find the embedded JSON data
  const jsonScript = doc.querySelector(
    'script[type="application/json"][data-mg-json="rtd"]',
  );

  if (!jsonScript || !jsonScript.textContent) {
    throw new ModularGridParseError(
      "ModularGrid page structure not recognized — please report this issue",
    );
  }

  let data: MgRackJson;
  try {
    data = JSON.parse(jsonScript.textContent);
  } catch {
    throw new ModularGridParseError(
      "ModularGrid page structure not recognized — please report this issue",
    );
  }

  // Validate expected structure
  if (!data.rack?.Rack || !Array.isArray(data.rack.Module)) {
    throw new ModularGridParseError(
      "ModularGrid page structure not recognized — please report this issue",
    );
  }

  const rack = data.rack.Rack;
  const totalRows = parseInt(rack.rows, 10);
  const totalHp = parseInt(rack.te, 10);
  const rows1u = new Set(rack.rows1u?.map((r) => parseInt(r, 10)) ?? []);

  if (isNaN(totalRows) || isNaN(totalHp) || totalRows <= 0) {
    throw new ModularGridParseError(
      "ModularGrid page structure not recognized — please report this issue",
    );
  }

  // Group modules by row
  const modulesByRow = new Map<number, { name: string; hp: number }[]>();
  for (let i = 1; i <= totalRows; i++) {
    modulesByRow.set(i, []);
  }

  for (const mod of data.rack.Module) {
    const rowNum = parseInt(mod.ModulesRack.row, 10);
    const hp = parseInt(mod.te, 10);
    const name = mod.name;

    if (isNaN(rowNum) || isNaN(hp) || !name) {
      continue; // skip malformed module entries
    }

    const rowModules = modulesByRow.get(rowNum);
    if (rowModules) {
      rowModules.push({ name, hp });
    }
  }

  // Build RackRow array
  const rows: RackRow[] = [];
  for (let i = 1; i <= totalRows; i++) {
    const modules = modulesByRow.get(i) ?? [];
    const format: Format = rows1u.has(i) ? "1u-intellijel" : "3u";
    const usedHp = modules.reduce((sum, m) => sum + m.hp, 0);
    const blankHp = totalHp - usedHp;

    rows.push({
      format,
      totalHp,
      modules,
      usedHp,
      blankHp,
    });
  }

  return { rows };
}
