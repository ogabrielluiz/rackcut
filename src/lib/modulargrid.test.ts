import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseModularGridData, ModularGridParseError } from "./modulargrid";

const fixtureHtml = readFileSync(
  join(__dirname, "__fixtures__/modulargrid-rack.html"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// parseModularGridData
// ---------------------------------------------------------------------------

describe("parseModularGridData", () => {
  // Row extraction ----------------------------------------------------------

  it("extracts the correct number of rows", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows).toHaveLength(3);
  });

  // Module counts per row ---------------------------------------------------

  it("extracts correct module count for row 1", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[0].modules).toHaveLength(11);
  });

  it("extracts correct module count for row 2 (1U)", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[1].modules).toHaveLength(6);
  });

  it("extracts correct module count for row 3", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[2].modules).toHaveLength(12);
  });

  // Module data quality -----------------------------------------------------

  it("all module names are non-empty strings", () => {
    const result = parseModularGridData(fixtureHtml);
    for (const row of result.rows) {
      for (const mod of row.modules) {
        expect(mod.name).toBeTruthy();
        expect(typeof mod.name).toBe("string");
        expect(mod.name.length).toBeGreaterThan(0);
      }
    }
  });

  it("all module HP values are positive integers", () => {
    const result = parseModularGridData(fixtureHtml);
    for (const row of result.rows) {
      for (const mod of row.modules) {
        expect(mod.hp).toBeGreaterThan(0);
        expect(Number.isInteger(mod.hp)).toBe(true);
      }
    }
  });

  // usedHp per row ----------------------------------------------------------

  it("calculates correct usedHp for row 1 (103HP)", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[0].usedHp).toBe(103);
  });

  it("calculates correct usedHp for row 2 (96HP)", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[1].usedHp).toBe(96);
  });

  it("calculates correct usedHp for row 3 (94HP)", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[2].usedHp).toBe(94);
  });

  // blankHp per row ---------------------------------------------------------

  it("calculates correct blankHp for row 1 (1HP)", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[0].blankHp).toBe(1);
  });

  it("calculates correct blankHp for row 2 (8HP)", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[1].blankHp).toBe(8);
  });

  it("calculates correct blankHp for row 3 (10HP)", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[2].blankHp).toBe(10);
  });

  // Format detection --------------------------------------------------------

  it("detects row 1 as 3u format", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[0].format).toBe("3u");
  });

  it("detects row 2 as 1u-intellijel format", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[1].format).toBe("1u-intellijel");
  });

  it("detects row 3 as 3u format", () => {
    const result = parseModularGridData(fixtureHtml);
    expect(result.rows[2].format).toBe("3u");
  });

  // totalHp -----------------------------------------------------------------

  it("totalHp is 104 for all rows", () => {
    const result = parseModularGridData(fixtureHtml);
    for (const row of result.rows) {
      expect(row.totalHp).toBe(104);
    }
  });

  // Error handling ----------------------------------------------------------

  it("throws ModularGridParseError for unrecognized HTML", () => {
    expect(() => parseModularGridData("<html><body>Hello</body></html>")).toThrow(
      ModularGridParseError,
    );
    expect(() => parseModularGridData("<html><body>Hello</body></html>")).toThrow(
      "ModularGrid page structure not recognized",
    );
  });

  it("throws for empty HTML input", () => {
    expect(() => parseModularGridData("")).toThrow();
  });

  it("ModularGridParseError is an instance of Error", () => {
    const error = new ModularGridParseError("test");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ModularGridParseError");
  });
});
