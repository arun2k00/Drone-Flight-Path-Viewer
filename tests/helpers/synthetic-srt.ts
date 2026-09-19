export interface SyntheticFlight {
  durationSec: number;
  fps: { num: number; den: number }; // one cue per frame, frame-aligned times (rounded to ms, no drift)
  center: { latitude: number; longitude: number };
  radiusM: number; // circle radius
  lapSec: number; // seconds per lap
  relAlt: [number, number]; // linear ramp
  absAltOffset: number; // abs = rel + offset
  gpsUpdateHz: number; // positions held between updates
  noFixFrames: number; // leading 0,0 frames
  format: "air3s" | "enterprise";
  startWallClock: string; // "2026-05-27 13:14:22.911"
}

const EARTH_RADIUS_M = 6371000;

function destinationPoint(lat: number, lon: number, bearingDeg: number, distanceM: number): { latitude: number; longitude: number } {
  const delta = distanceM / EARTH_RADIUS_M;
  const theta = (bearingDeg * Math.PI) / 180;
  const phi1 = (lat * Math.PI) / 180;
  const lambda1 = (lon * Math.PI) / 180;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
  return { latitude: (phi2 * 180) / Math.PI, longitude: (((lambda2 * 180) / Math.PI + 540) % 360) - 180 };
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

function ts(sec: number): string {
  const ms = Math.round(sec * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(Math.floor((ms % 60000) / 1000))},${pad(ms % 1000, 3)}`;
}

function wallClock(startUtcMs: number, addMs: number): string {
  const d = new Date(startUtcMs + addMs);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  return `${date} ${time}.${pad(d.getUTCMilliseconds(), 3)}`;
}

const f6 = (n: number) => n.toFixed(6);
const f3 = (n: number) => n.toFixed(3);

/** Ground-truth speed (m/s) for a circular flight at the given radius/lap time — for test assertions. */
export function syntheticGroundSpeedMps(f: Pick<SyntheticFlight, "radiusM" | "lapSec">): number {
  return (2 * Math.PI * f.radiusM) / f.lapSec;
}

/** Deterministic synthetic DJI-style SRT: circular flight, linear altitude ramp, held GPS updates, leading no-fix frames. */
export function generateSrt(f: SyntheticFlight): string {
  const frameDurSec = f.fps.den / f.fps.num;
  const frameCount = Math.round(f.durationSec / frameDurSec);
  const startUtcMs = Date.parse(`${f.startWallClock.replace(" ", "T")}Z`);
  const updateIntervalFrames = Math.max(1, Math.round(f.fps.num / f.fps.den / f.gpsUpdateHz));

  const cues: string[] = [];
  for (let k = 1; k <= frameCount; k++) {
    const start = (k - 1) * frameDurSec;
    const end = k * frameDurSec;
    const noFix = k <= f.noFixFrames;

    const heldFrame = Math.floor((k - 1) / updateIntervalFrames) * updateIntervalFrames;
    const heldT = heldFrame * frameDurSec;
    const bearing = ((360 * heldT) / f.lapSec) % 360;
    const pos = noFix ? { latitude: 0, longitude: 0 } : destinationPoint(f.center.latitude, f.center.longitude, bearing, f.radiusM);

    const rampT = start / f.durationSec;
    const relAlt = noFix ? 0 : f.relAlt[0] + (f.relAlt[1] - f.relAlt[0]) * rampT;
    const absAlt = noFix ? -128.769 : relAlt + f.absAltOffset;

    const diffMs = Math.round(frameDurSec * 1000);
    const wall = wallClock(startUtcMs, Math.round(start * 1000));

    if (f.format === "air3s") {
      cues.push(
        `${k}\n${ts(start)} --> ${ts(end)}\n` +
          `<font size="28">FrameCnt: ${k}, DiffTime: ${diffMs}ms\n` +
          `${wall}\n` +
          `[iso: 200] [shutter: 1/6400.0] [fnum: 1.8] [ev: -0.7] [color_md: hlg] [focal_len: 24.00] [latitude: ${f6(pos.latitude)}] [longitude: ${f6(pos.longitude)}] [rel_alt: ${f3(relAlt)} abs_alt: ${f3(absAlt)}] [ct: 5263] </font>\n`,
      );
    } else {
      const speedMps = noFix ? 0 : syntheticGroundSpeedMps(f);
      const courseRad = (bearing * Math.PI) / 180;
      const speedX = speedMps * Math.sin(courseRad);
      const speedY = speedMps * Math.cos(courseRad);
      cues.push(
        `${k}\n${ts(start)} --> ${ts(end)}\n` +
          `<font size="28">SrtCnt : ${k}, DiffTime : ${diffMs}ms\n` +
          `${wall}\n` +
          `[iso : 100] [shutter : 1/1000.0] [fnum : 2.8] [ev : 0] [color_md : default] [focal_len : 24.00] [latitude: ${f6(pos.latitude)}] [longitude: ${f6(pos.longitude)}] [rel_alt: ${f3(relAlt)} abs_alt: ${f3(absAlt)}] [drone_speedx: ${f3(speedX)} drone_speedy: ${f3(speedY)} drone_speedz: 0.0] [drone_yaw: ${f3(bearing > 180 ? bearing - 360 : bearing)} drone_pitch: 0.0 drone_roll: 0.0] [gb_yaw: 0.0 gb_pitch: -90.0 gb_roll: 0.0] </font>\n`,
      );
    }
  }
  return cues.join("\n");
}
