/**
 * Helpers for inspecting binary STL output in tests.
 */

/** Triangle vertices as a flat array: 9 numbers (three xyz points) per triangle */
export function readTriangles(stl: ArrayBuffer): Float32Array {
  const view = new DataView(stl);
  const count = view.getUint32(80, true);
  const out = new Float32Array(count * 9);
  for (let t = 0; t < count; t++) {
    for (let k = 0; k < 9; k++) out[t * 9 + k] = view.getFloat32(84 + t * 50 + 12 + k * 4, true);
  }
  return out;
}

export function boundsOf(tris: Float32Array): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris.length; i++) {
    const axis = i % 3;
    if (tris[i] < min[axis]) min[axis] = tris[i];
    if (tris[i] > max[axis]) max[axis] = tris[i];
  }
  return { min, max };
}

/** Enclosed volume, by the divergence theorem. Positive when triangles wind outward. */
export function volumeOf(tris: Float32Array): number {
  let six = 0;
  for (let t = 0; t < tris.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = tris.subarray(t, t + 9);
    six += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return six / 6;
}

/**
 * True when the triangles form a closed, consistently wound surface: every
 * edge is used once in each direction.
 */
export function isWatertight(tris: Float32Array): boolean {
  const ids = new Map<string, number>();
  const id = (o: number) => {
    const key = `${tris[o]},${tris[o + 1]},${tris[o + 2]}`;
    let v = ids.get(key);
    if (v === undefined) ids.set(key, (v = ids.size));
    return v;
  };
  const edges = new Map<string, number>();
  for (let t = 0; t < tris.length; t += 9) {
    const v = [id(t), id(t + 3), id(t + 6)];
    if (v[0] === v[1] || v[1] === v[2] || v[2] === v[0]) return false;
    for (let k = 0; k < 3; k++) {
      const key = `${v[k]}>${v[(k + 1) % 3]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of edges) {
    const [a, b] = key.split(">");
    if (count !== 1 || edges.get(`${b}>${a}`) !== 1) return false;
  }
  return true;
}

/** Number of vertices lying within `radius` of (x, y) in plan and within `tol` of height z */
export function countVerticesNear(tris: Float32Array, x: number, y: number, z: number, radius: number, tol = 1e-4): number {
  let n = 0;
  for (let i = 0; i < tris.length; i += 3) {
    if (Math.abs(tris[i + 2] - z) <= tol && Math.hypot(tris[i] - x, tris[i + 1] - y) <= radius) n++;
  }
  return n;
}

/** Files of an uncompressed ZIP, by name */
export async function unzipStored(zip: Blob): Promise<Map<string, ArrayBuffer>> {
  const bytes = new Uint8Array(await zip.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const files = new Map<string, ArrayBuffer>();
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength;
    files.set(name, bytes.slice(start, start + size).buffer);
    offset = start + size;
  }
  return files;
}
