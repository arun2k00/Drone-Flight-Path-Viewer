import type { LonLat } from "./geojson";

interface Point2D {
  x: number;
  y: number;
}

/** Project to local metres around the first point. */
function project(lat0: number, lon0: number, lat: number, lon: number): Point2D {
  return {
    x: (lon - lon0) * Math.cos((lat0 * Math.PI) / 180) * 111_320,
    y: (lat - lat0) * 110_574,
  };
}

function pointToSegmentDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Iterative Douglas-Peucker (explicit stack, no recursion) using point-to-segment distance so loops survive. */
function douglasPeucker(points: Point2D[], toleranceM: number): boolean[] {
  const n = points.length;
  const keep = new Array<boolean>(n).fill(false);
  if (n === 0) return keep;
  keep[0] = true;
  keep[n - 1] = true;
  if (n <= 2) return keep;

  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length) {
    const [start, end] = stack.pop() as [number, number];
    if (end <= start + 1) continue;
    const a = points[start];
    const b = points[end];
    let maxDist = -1;
    let maxIndex = -1;
    for (let i = start + 1; i < end; i++) {
      const d = pointToSegmentDistance(points[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }
    if (maxDist > toleranceM) {
      keep[maxIndex] = true;
      stack.push([start, maxIndex]);
      stack.push([maxIndex, end]);
    }
  }
  return keep;
}

export interface SimplifyResult {
  /** Indices into the input `coords` array that survived simplification, in order. */
  indices: number[];
  toleranceMeters: number;
}

const MAX_VERTICES = 4000;
const INITIAL_TOLERANCE_M = 0.5;

/** While the result has more than 4000 vertices, doubles the tolerance and reruns. */
export function simplifyTrack(coords: LonLat[], initialToleranceM = INITIAL_TOLERANCE_M): SimplifyResult {
  if (coords.length <= 2) {
    return { indices: coords.map((_, i) => i), toleranceMeters: initialToleranceM };
  }

  const [lon0, lat0] = coords[0];
  const points = coords.map(([lon, lat]) => project(lat0, lon0, lat, lon));

  let tolerance = initialToleranceM;
  let keep: boolean[];
  for (;;) {
    keep = douglasPeucker(points, tolerance);
    if (keep.filter(Boolean).length <= MAX_VERTICES) break;
    tolerance *= 2;
  }

  const indices: number[] = [];
  keep.forEach((k, i) => {
    if (k) indices.push(i);
  });
  return { indices, toleranceMeters: tolerance };
}
