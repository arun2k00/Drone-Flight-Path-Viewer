import { describe, expect, it } from "vitest";
import type { LonLat } from "@/lib/map/geojson";
import { simplifyTrack } from "@/lib/map/simplify";

describe("simplifyTrack", () => {
  it("collapses collinear points to just the endpoints", () => {
    const coords: LonLat[] = Array.from({ length: 50 }, (_, i) => [78.4 + i * 0.0001, 17.3]);
    const result = simplifyTrack(coords);
    expect(result.indices).toEqual([0, coords.length - 1]);
  });

  it("keeps the corner of an L-shape", () => {
    const coords: LonLat[] = [
      [78.4, 17.3],
      [78.4 + 0.001, 17.3],
      [78.4 + 0.002, 17.3], // corner
      [78.4 + 0.002, 17.301],
      [78.4 + 0.002, 17.302],
    ];
    const result = simplifyTrack(coords);
    expect(result.indices).toContain(0);
    expect(result.indices).toContain(2);
    expect(result.indices).toContain(4);
  });

  it("keeps a closed loop's shape with at least 4 vertices", () => {
    // A finely-sampled ~22 m-radius circle: consecutive points are close enough that most fall
    // within tolerance of their neighbors' chord, but the overall round shape must survive.
    const n = 2000;
    const radiusDeg = 0.0002;
    const coords: LonLat[] = Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * 2 * Math.PI;
      return [78.4 + radiusDeg * Math.cos(angle), 17.3 + radiusDeg * Math.sin(angle)];
    });
    const result = simplifyTrack(coords);
    expect(result.indices.length).toBeGreaterThanOrEqual(4);
    expect(result.indices.length).toBeLessThan(n);
  });

  it("simplifies a 50k-point spiral to at most 4000 vertices", () => {
    const n = 50_000;
    const coords: LonLat[] = Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * 40 * Math.PI;
      const radius = 0.0001 + (i / n) * 0.02;
      return [78.4 + radius * Math.cos(angle), 17.3 + radius * Math.sin(angle)];
    });
    const result = simplifyTrack(coords);
    expect(result.indices.length).toBeLessThanOrEqual(4000);
    expect(result.indices[0]).toBe(0);
    expect(result.indices[result.indices.length - 1]).toBe(n - 1);
  }, 20_000);

  it("always keeps the first and last vertex", () => {
    const coords: LonLat[] = [
      [0, 0],
      [0.5, 0.5],
      [1, 0],
    ];
    const result = simplifyTrack(coords);
    expect(result.indices[0]).toBe(0);
    expect(result.indices[result.indices.length - 1]).toBe(2);
  });

  it("returns both points unchanged for a 2-point track", () => {
    const coords: LonLat[] = [
      [0, 0],
      [1, 1],
    ];
    expect(simplifyTrack(coords).indices).toEqual([0, 1]);
  });

  it("returns the single point unchanged for a 1-point track", () => {
    expect(simplifyTrack([[0, 0]]).indices).toEqual([0]);
  });
});
