/** Wraps to [0, 360). */
export function normalize360(v: number): number {
  return ((v % 360) + 360) % 360;
}

/** Wraps to (-180, 180], mapping -180 to 180. */
export function normalize180(v: number): number {
  const r = normalize360(v + 180) - 180;
  return r === -180 ? 180 : r;
}
