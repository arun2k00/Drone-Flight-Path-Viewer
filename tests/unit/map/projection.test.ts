import { describe, expect, it } from "vitest";
import { fitViewport, mercatorY, metersPerBoxHeight, projectToBox } from "@/lib/map/projection";
import type { GeoBounds } from "@/types/telemetry";

const HYDERABAD_BOUNDS: GeoBounds = { minLon: 78.4855, minLat: 17.3835, maxLon: 78.4879, maxLat: 17.3866 };

describe("fitViewport / projectToBox", () => {
  it("keeps every corner of the bounds within [p, 1-p] along the constraining axis", () => {
    for (const aspect of [1, 1.4, 0.7, 2.5]) {
      for (const paddingRatio of [0, 0.12, 0.25]) {
        const vp = fitViewport(HYDERABAD_BOUNDS, aspect, paddingRatio);
        const corners = [
          [HYDERABAD_BOUNDS.minLon, HYDERABAD_BOUNDS.minLat],
          [HYDERABAD_BOUNDS.minLon, HYDERABAD_BOUNDS.maxLat],
          [HYDERABAD_BOUNDS.maxLon, HYDERABAD_BOUNDS.minLat],
          [HYDERABAD_BOUNDS.maxLon, HYDERABAD_BOUNDS.maxLat],
        ];
        for (const [lon, lat] of corners) {
          const { u, v } = projectToBox(vp, lon, lat);
          expect(u).toBeGreaterThanOrEqual(paddingRatio - 1e-9);
          expect(u).toBeLessThanOrEqual(1 - paddingRatio + 1e-9);
          expect(v).toBeGreaterThanOrEqual(paddingRatio - 1e-9);
          expect(v).toBeLessThanOrEqual(1 - paddingRatio + 1e-9);
        }
      }
    }
  });

  it("produces a finite viewport for zero-extent bounds (a hover)", () => {
    const point: GeoBounds = { minLon: 78.486671, minLat: 17.385044, maxLon: 78.486671, maxLat: 17.385044 };
    const vp = fitViewport(point, 1.4, 0.12);
    expect(Number.isFinite(vp.k)).toBe(true);
    expect(Number.isFinite(vp.cx)).toBe(true);
    expect(Number.isFinite(vp.cy)).toBe(true);
    const { u, v } = projectToBox(vp, point.minLon, point.minLat);
    expect(Number.isFinite(u)).toBe(true);
    expect(Number.isFinite(v)).toBe(true);
  });

  it("north is up: a higher latitude projects to a smaller v", () => {
    const vp = fitViewport(HYDERABAD_BOUNDS, 1.4, 0.12);
    const north = projectToBox(vp, 78.4867, HYDERABAD_BOUNDS.maxLat);
    const south = projectToBox(vp, 78.4867, HYDERABAD_BOUNDS.minLat);
    expect(north.v).toBeLessThan(south.v);
  });

  it("mercatorY is monotonically decreasing in latitude", () => {
    expect(mercatorY(10)).toBeLessThan(mercatorY(0));
    expect(mercatorY(0)).toBeLessThan(mercatorY(-10));
  });
});

describe("metersPerBoxHeight", () => {
  it("increases as the viewport zooms out (smaller k)", () => {
    const wide = fitViewport(HYDERABAD_BOUNDS, 1.4, 0.12);
    const narrowBounds: GeoBounds = { minLon: 78.4866, minLat: 17.3850, maxLon: 78.4867, maxLat: 17.3851 };
    const narrow = fitViewport(narrowBounds, 1.4, 0.12);
    expect(metersPerBoxHeight(wide, 17.385)).toBeGreaterThan(metersPerBoxHeight(narrow, 17.385));
  });

  it("is positive and finite for a typical viewport", () => {
    const vp = fitViewport(HYDERABAD_BOUNDS, 1.4, 0.12);
    const mpp = metersPerBoxHeight(vp, 17.385);
    expect(mpp).toBeGreaterThan(0);
    expect(Number.isFinite(mpp)).toBe(true);
  });
});
