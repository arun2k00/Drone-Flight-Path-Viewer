import { normalize360 } from "./normalizer";

const EARTH_RADIUS_M = 6_371_008.8;

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Forward azimuth from point 1 to point 2, in [0, 360). */
export function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return normalize360((Math.atan2(y, x) * 180) / Math.PI);
}

/** Point at `meters` along `bearingDeg` from (lat, lon). Used by the synthetic SRT generator. */
export function destinationPoint(lat: number, lon: number, bearingDeg: number, meters: number): { latitude: number; longitude: number } {
  const angularDistance = meters / EARTH_RADIUS_M;
  const bearing = rad(bearingDeg);
  const phi1 = rad(lat);
  const lambda1 = rad(lon);

  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(angularDistance) + Math.cos(phi1) * Math.sin(angularDistance) * Math.cos(bearing));
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(phi1),
      Math.cos(angularDistance) - Math.sin(phi1) * Math.sin(phi2),
    );

  return {
    latitude: (phi2 * 180) / Math.PI,
    longitude: (((lambda2 * 180) / Math.PI + 540) % 360) - 180,
  };
}
