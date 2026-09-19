export const KEY_RE = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/;

/** Object keys match KEY_RE, contain no ".." segment and are at most 512 characters. */
export function isValidKey(key: string): boolean {
  if (key.length === 0 || key.length > 512) return false;
  if (key.split("/").includes("..")) return false;
  return KEY_RE.test(key);
}

/** Keys are only ever produced by these builders — user file names never appear in a key. */
export const keys = {
  sourceVideo: (projectId: string, ext: ".mp4" | ".mov" | ".m4v") => `projects/${projectId}/source/video${ext}`,
  sourceTelemetry: (projectId: string) => `projects/${projectId}/source/telemetry.srt`,
  logoSource: (projectId: string, ext: ".png" | ".svg" | ".webp") => `projects/${projectId}/source/logo-source${ext}`,
  logoPng: (projectId: string) => `projects/${projectId}/derived/logo.png`,
  telemetryData: (projectId: string) => `projects/${projectId}/derived/telemetry.v1.json`,
  telemetryDebug: (projectId: string) => `projects/${projectId}/derived/telemetry-debug.v1.json`,
  flightPath: (projectId: string) => `projects/${projectId}/derived/flight-path.v1.geojson`,
  basemap: (projectId: string, hash: string) => `projects/${projectId}/derived/basemaps/${hash}.png`,
  exportOutput: (projectId: string, jobId: string, fileName: string) => `projects/${projectId}/exports/${jobId}/${fileName}`,
  exportLog: (projectId: string, jobId: string) => `projects/${projectId}/exports/${jobId}/ffmpeg.log`,
  uploadPart: (uploadId: string) => `uploads/${uploadId}.part`,
  tileCache: (providerHash: string, z: number, x: number, y: number) => `tile-cache/${providerHash}/${z}/${x}/${y}.png`,
  projectPrefix: (projectId: string) => `projects/${projectId}/`,
};
