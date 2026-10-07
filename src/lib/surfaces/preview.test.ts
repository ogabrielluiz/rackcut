import { describe, it, expect } from "vitest";
import { encodeBmpDataUrl, renderHeightmapImage, surfacePreviewImage } from "./preview";
import type { Heightmap } from "./heightmap";

/** Decode an 8-bit BMP data URL back to RGB pixels, top row first */
function decodeBmp(url: string) {
  const prefix = "data:image/bmp;base64,";
  expect(url.startsWith(prefix)).toBe(true);
  const binary = atob(url.slice(prefix.length));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const width = view.getInt32(18, true);
  const height = view.getInt32(22, true);
  const dataOffset = view.getUint32(10, true);
  const rowSize = (width + 3) & ~3;
  const pixel = (x: number, y: number): [number, number, number] => {
    const index = bytes[dataOffset + (height - 1 - y) * rowSize + x];
    const entry = 54 + index * 4;
    return [bytes[entry + 2], bytes[entry + 1], bytes[entry]];
  };
  return { bytes, view, width, height, dataOffset, rowSize, pixel };
}

function flatMap(nx: number, ny: number, height: number, depth: number): Heightmap {
  return { nx, ny, dx: 0.3, dy: 0.3, depth, heights: new Float32Array(nx * ny).fill(height) };
}

describe("encodeBmpDataUrl", () => {
  const palette = Array.from({ length: 256 }, (_, i): [number, number, number] => [i, 255 - i, (i * 7) % 256]);

  it("writes a valid 8-bit BMP header", () => {
    const { bytes, view, dataOffset, rowSize } = decodeBmp(encodeBmpDataUrl(new Uint8Array(5 * 3), 5, 3, palette));
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("BM");
    expect(view.getUint32(2, true)).toBe(bytes.length);
    expect(dataOffset).toBe(14 + 40 + 256 * 4);
    expect(view.getUint16(28, true)).toBe(8);
    // rows are padded to four bytes
    expect(rowSize).toBe(8);
    expect(bytes.length).toBe(dataOffset + 8 * 3);
  });

  it("round-trips pixels, with the first row at the top", () => {
    const width = 5;
    const height = 3;
    const indices = Uint8Array.from({ length: width * height }, (_, k) => k * 11);
    const { pixel } = decodeBmp(encodeBmpDataUrl(indices, width, height, palette));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) expect(pixel(x, y)).toEqual(palette[indices[y * width + x]]);
    }
  });
});

describe("renderHeightmapImage", () => {
  it("shows a flat relief face in the filament colour, unshaded", () => {
    const { pixel, width, height } = decodeBmp(renderHeightmapImage(flatMap(6, 4, 0, 1), "relief", "#3355cc", "#000000"));
    expect([width, height]).toEqual([6, 4]);
    expect(pixel(2, 1)).toEqual([0x33, 0x55, 0xcc]);
  });

  it("lights relief from the upper left", () => {
    // A slope that climbs to the right has its face turned left, toward the
    // light; one that climbs to the left is turned away from it.
    const ramp = (risingRight: boolean): Heightmap => {
      const map = flatMap(8, 4, 0, 1);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) map.heights[j * 8 + i] = (risingRight ? i : 7 - i) * 0.1;
      return map;
    };
    const facingLight = decodeBmp(renderHeightmapImage(ramp(true), "relief", "#808080", "#000000")).pixel(4, 2);
    const facingAway = decodeBmp(renderHeightmapImage(ramp(false), "relief", "#808080", "#000000")).pixel(4, 2);
    expect(facingLight[0]).toBeGreaterThan(0x80);
    expect(facingAway[0]).toBeLessThan(0x80);
  });

  it("paints bands in the accent colour and the face in the base colour", () => {
    const low = decodeBmp(renderHeightmapImage(flatMap(4, 4, 0, 0.6), "bands", "#cccccc", "#2a2a2a"));
    const high = decodeBmp(renderHeightmapImage(flatMap(4, 4, 0.6, 0.6), "bands", "#cccccc", "#2a2a2a"));
    expect(low.pixel(1, 1)).toEqual([0xcc, 0xcc, 0xcc]);
    expect(high.pixel(1, 1)).toEqual([0x2a, 0x2a, 0x2a]);
  });
});

describe("surfacePreviewImage", () => {
  it("renders at 0.3mm per pixel over the whole panel", () => {
    const { width, height } = decodeBmp(surfacePreviewImage("bands-marble", 30, 60, 1, "#cccccc", "#2a2a2a"));
    expect(width).toBe(101);
    expect(height).toBe(201);
  });

  it("is reproducible, and changes with seed, pattern and colours", () => {
    const base = surfacePreviewImage("relief-damascus", 20, 40, 5, "#cccccc", "#2a2a2a");
    expect(surfacePreviewImage("relief-damascus", 20, 40, 5, "#cccccc", "#2a2a2a")).toBe(base);
    expect(surfacePreviewImage("relief-damascus", 20, 40, 6, "#cccccc", "#2a2a2a")).not.toBe(base);
    expect(surfacePreviewImage("relief-topo", 20, 40, 5, "#cccccc", "#2a2a2a")).not.toBe(base);
    expect(surfacePreviewImage("relief-damascus", 20, 40, 5, "#cc3333", "#2a2a2a")).not.toBe(base);
  });

  it("keeps the face colour around mounting holes", () => {
    const hole: [number, number] = [10, 10];
    const { pixel } = decodeBmp(
      surfacePreviewImage("bands-labyrinth", 20, 40, 5, "#cccccc", "#2a2a2a", { holes: [hole], holeStyle: "circle" })
    );
    for (const [x, y] of [[10, 10], [12, 10], [10, 12.5], [8, 8.5]]) {
      expect(pixel(Math.round(x / 0.3), Math.round(y / 0.3))).toEqual([0xcc, 0xcc, 0xcc]);
    }
  });
});
