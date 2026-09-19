/**
 * Full API walkthrough against a running dev server: upload → analyze → apply the
 * survey template → export → download → verify. `npm run fixtures` must have been run first (or this
 * script generates them itself if missing).
 *
 * Usage: BASE_URL=http://localhost:3470 npm run e2e [-- --keep]
 *
 * Signs in as E2E_EMAIL / E2E_PASSWORD (default e2e@aeroxpress.test), creating that account if it
 * doesn't exist. On an empty database that first account becomes the admin, so point E2E_EMAIL at an
 * existing account when running against a real deployment.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { instantiateTemplate } from "../src/lib/overlay/templates";
import type { ExportSettings } from "../src/types/api";
import { grabRegionRgb, meanAbsDiff } from "../tests/helpers/image-diff";

const execFileP = promisify(execFile);
const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const FIXTURES_DIR = path.join(repoRoot, "tests", "fixtures", "generated");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3470";
const KEEP = process.argv.includes("--keep");

class E2EError extends Error {}

let sessionCookie = "";

/** fetch with the session cookie from signIn(). */
function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (sessionCookie) headers.set("cookie", sessionCookie);
  return fetch(url, { ...init, headers });
}

async function signIn(): Promise<void> {
  const email = process.env.E2E_EMAIL ?? "e2e@aeroxpress.test";
  const password = process.env.E2E_PASSWORD ?? "e2e-password-123";
  const attempt = (body: object) =>
    fetch(`${BASE_URL}/api/auth/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let res = await attempt({ email, password });
  if (res.status === 401) res = await attempt({ name: "E2E Test", email, password });
  if (res.status !== 204) fail("sign-in", `HTTP ${res.status} ${await res.text()}`);
  sessionCookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  if (!sessionCookie.startsWith("ax_session=")) fail("sign-in", "no session cookie returned");
}

function fail(step: string, detail: string): never {
  throw new E2EError(`[${step}] ${detail}`);
}

async function json<T>(res: Response, step: string): Promise<T> {
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | T | null;
  if (!res.ok) {
    const err = (body as { error?: { code: string; message: string } } | null)?.error;
    fail(step, `HTTP ${res.status} ${err ? `${err.code}: ${err.message}` : JSON.stringify(body)}`);
  }
  if (body === null) fail(step, "empty/invalid JSON response");
  return body as T;
}

async function ensureFixtures(): Promise<{ video: string; srt: string }> {
  const video = path.join(FIXTURES_DIR, "e2e.mp4");
  const srt = path.join(FIXTURES_DIR, "e2e.SRT");
  if (!fs.existsSync(video) || !fs.existsSync(srt)) {
    console.log("Fixtures missing — running `npm run fixtures`…");
    await execFileP("npx", ["tsx", "scripts/gen-fixtures.mts"], { cwd: repoRoot });
  }
  if (!fs.existsSync(video) || !fs.existsSync(srt)) fail("fixtures", `expected ${video} and ${srt} to exist after generation`);
  return { video, srt };
}

interface UploadSession {
  id: string;
  chunkSize: number;
}

async function uploadFile(projectId: string, role: "VIDEO" | "TELEMETRY", filePath: string, mimeType: string): Promise<void> {
  const bytes = await fsp.readFile(filePath);
  const fileName = path.basename(filePath);
  const initRes = await apiFetch(`${BASE_URL}/api/projects/${projectId}/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role, fileName, sizeBytes: bytes.byteLength, mimeType }),
  });
  const { upload } = await json<{ upload: UploadSession }>(initRes, `upload:${role}:init`);

  let offset = 0;
  while (offset < bytes.byteLength) {
    const end = Math.min(offset + upload.chunkSize, bytes.byteLength);
    const chunk = bytes.subarray(offset, end);
    const putRes = await apiFetch(`${BASE_URL}/api/uploads/${upload.id}?offset=${offset}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: new Blob([new Uint8Array(chunk)]),
    });
    const putBody = await json<{ receivedBytes: number }>(putRes, `upload:${role}:chunk@${offset}`);
    if (putBody.receivedBytes !== end) fail(`upload:${role}`, `expected receivedBytes ${end}, got ${putBody.receivedBytes}`);
    offset = end;
  }

  const completeRes = await apiFetch(`${BASE_URL}/api/uploads/${upload.id}/complete`, { method: "POST" });
  await json(completeRes, `upload:${role}:complete`);
}

interface ProjectDtoLite {
  id: string;
  status: string;
  videoMetadata: { video: { width: number; height: number; durationSec: number; frameCount: number | null; fps: { num: number; den: number; value: number } } } | null;
  telemetrySummary: { capabilities: { gps: boolean; relativeAltitude: boolean; speed: string } } | null;
  syncReport: { status: string } | null;
  overlayConfig: { elements: Array<{ id: string; type: string; x: number; y: number; width: number; height: number }> };
}

async function main(): Promise<void> {
  const t0 = Date.now();
  console.log(`E2E export test against ${BASE_URL}`);

  const { video, srt } = await ensureFixtures();
  await signIn();

  // 2. Create the project.
  const createRes = await apiFetch(`${BASE_URL}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "E2E Hyderabad Survey" }),
  });
  const { project: created } = await json<{ project: { id: string } }>(createRes, "create-project");
  const projectId = created.id;
  console.log(`project: ${projectId}`);

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp || KEEP) return;
    cleanedUp = true;
    await apiFetch(`${BASE_URL}/api/projects/${projectId}`, { method: "DELETE" }).catch(() => {});
  };

  try {
    // 3. Upload SRT then MP4.
    await uploadFile(projectId, "TELEMETRY", srt, "application/x-subrip");
    console.log("uploaded: telemetry");
    await uploadFile(projectId, "VIDEO", video, "video/mp4");
    console.log("uploaded: video");

    // 4. Analyze.
    const analyzeRes = await apiFetch(`${BASE_URL}/api/projects/${projectId}/analyze`, { method: "POST" });
    const { project } = await json<{ project: ProjectDtoLite }>(analyzeRes, "analyze");
    if (project.status !== "READY") fail("analyze", `expected status READY, got ${project.status}`);
    const caps = project.telemetrySummary?.capabilities;
    if (!caps?.gps) fail("analyze", "expected capabilities.gps === true");
    if (!caps.relativeAltitude) fail("analyze", "expected capabilities.relativeAltitude === true");
    if (caps.speed !== "gps-derived") fail("analyze", `expected speed capability "gps-derived", got "${caps.speed}"`);
    if (project.syncReport?.status !== "GOOD") fail("analyze", `expected sync status GOOD, got ${project.syncReport?.status}`);
    console.log(`analyzed: READY, gps ✓, relativeAltitude ✓, speed gps-derived, sync GOOD`);

    // 5. Flight path.
    const flightPathRes = await apiFetch(`${BASE_URL}/api/projects/${projectId}/flight-path`);
    const flightPath = await json<{ features: Array<{ properties: { kind: string }; geometry: { type: string; coordinates: unknown } }> }>(flightPathRes, "flight-path");
    const pathFeature = flightPath.features.find((f) => f.properties.kind === "path");
    if (!pathFeature || pathFeature.geometry.type !== "LineString") fail("flight-path", "no LineString path feature");
    const [lon, lat] = (pathFeature.geometry.coordinates as [number, number][])[0];
    if (Math.abs(lon - 78.4867) > 0.01 || Math.abs(lat - 17.385) > 0.01) {
      fail("flight-path", `first coordinate [${lon}, ${lat}] not near [78.4867, 17.385]`);
    }
    console.log(`flight-path: first coordinate [${lon.toFixed(4)}, ${lat.toFixed(4)}]`);

    // 6. Apply the survey template.
    const videoMeta = project.videoMetadata!.video;
    // The E2E fixture is generated in the air3s format, which has no heading field.
    const overlayConfig = instantiateTemplate("survey", { width: videoMeta.width, height: videoMeta.height }, { hasGps: true, hasHeading: false, hasLogo: false });
    const patchRes = await apiFetch(`${BASE_URL}/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ overlayConfig }),
    });
    const { project: patched } = await json<{ project: ProjectDtoLite }>(patchRes, "apply-template");
    console.log(`template applied: survey, ${patched.overlayConfig.elements.length} elements`);

    // 7. Export and poll.
    const settings: ExportSettings = { resolution: "original", quality: "balanced" };
    const exportRes = await apiFetch(`${BASE_URL}/api/projects/${projectId}/exports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ overlayConfig: patched.overlayConfig, settings }),
    });
    const { job: initialJob } = await json<{ job: { id: string; status: string } }>(exportRes, "export:start");
    const jobId = initialJob.id;
    console.log(`export started: ${jobId}`);

    interface JobPoll {
      status: string;
      phase: string | null;
      progress: number;
      output: { downloadUrl: string; sizeBytes: number; fileName: string; width: number; height: number } | null;
      error: { code: string; message: string } | null;
    }
    const deadline = Date.now() + 10 * 60_000;
    let lastPhase: string | null = null;
    let finalJob: JobPoll | null = null;
    while (Date.now() < deadline) {
      const pollRes = await apiFetch(`${BASE_URL}/api/jobs/${jobId}`);
      const { job } = await json<{ job: JobPoll | null }>(pollRes, "export:poll");
      if (!job) fail("export:poll", "empty job body");
      if (job.phase !== lastPhase) {
        lastPhase = job.phase;
        console.log(`  phase: ${job.phase ?? job.status} (${Math.round(job.progress * 100)}%)`);
      }
      if (job.status === "COMPLETE" || job.status === "FAILED" || job.status === "CANCELLED") {
        finalJob = job;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!finalJob) fail("export:poll", "timed out after 10 minutes");
    if (finalJob.status !== "COMPLETE") fail("export", `job ended ${finalJob.status}: ${finalJob.error?.code} ${finalJob.error?.message}`);
    console.log(`export complete: ${finalJob.output!.fileName}`);

    // 8. Download.
    const downloadRes = await apiFetch(`${BASE_URL}${finalJob.output!.downloadUrl}`);
    if (!downloadRes.ok) fail("download", `HTTP ${downloadRes.status}`);
    const outPath = path.join(FIXTURES_DIR, "e2e-out.mp4");
    const buf = Buffer.from(await downloadRes.arrayBuffer());
    await fsp.writeFile(outPath, buf);
    if (buf.byteLength !== finalJob.output!.sizeBytes) fail("download", `size mismatch: downloaded ${buf.byteLength}, expected ${finalJob.output!.sizeBytes}`);
    console.log(`downloaded: ${outPath} (${buf.byteLength} bytes)`);

    // 9. ffprobe the output.
    const probeJson = (await execFileP("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", outPath])).stdout;
    const probed = JSON.parse(probeJson) as { streams: Array<Record<string, unknown>>; format: { duration: string } };
    const vStream = probed.streams.find((s) => s.codec_type === "video")!;
    const aStream = probed.streams.find((s) => s.codec_type === "audio");
    if (vStream.codec_name !== "h264") fail("ffprobe", `expected h264, got ${vStream.codec_name}`);
    if (vStream.width !== videoMeta.width || vStream.height !== videoMeta.height) fail("ffprobe", `expected ${videoMeta.width}x${videoMeta.height}, got ${vStream.width}x${vStream.height}`);
    const outDuration = Number(probed.format.duration);
    if (Math.abs(outDuration - videoMeta.durationSec) > 0.5) fail("ffprobe", `duration ${outDuration} not within 0.5s of source ${videoMeta.durationSec}`);
    if (!aStream || aStream.codec_name !== "aac") fail("ffprobe", `expected aac audio, got ${aStream?.codec_name ?? "none"}`);
    console.log(`ffprobe: h264 ${vStream.width}x${vStream.height}, duration ${outDuration.toFixed(2)}s, aac audio ✓`);

    // 10. Pixel checks on the telemetry panel rect.
    const panel = patched.overlayConfig.elements.find((e) => e.type === "telemetryPanel")!;
    const rect = {
      x: Math.round(panel.x * videoMeta.width),
      y: Math.round(panel.y * videoMeta.height),
      width: Math.max(2, Math.round(panel.width * videoMeta.width)),
      height: Math.max(2, Math.round(panel.height * videoMeta.height)),
    };
    const outT2 = await grabRegionRgb(outPath, 2, rect);
    const outT9 = await grabRegionRgb(outPath, 9, rect);
    const srcT2 = await grabRegionRgb(video, 2, rect);
    const diffOverTime = meanAbsDiff(outT2, outT9);
    const diffFromSource = meanAbsDiff(outT2, srcT2);
    if (diffOverTime <= 3) fail("pixel-check", `panel diff(t2, t9) = ${diffOverTime.toFixed(2)}, expected > 3`);
    if (diffFromSource <= 10) fail("pixel-check", `panel diff(out, source) = ${diffFromSource.toFixed(2)}, expected > 10`);
    console.log(`pixel checks: diff(t2,t9)=${diffOverTime.toFixed(1)} (>3 ✓), diff(out,source)=${diffFromSource.toFixed(1)} (>10 ✓)`);

    // 11. Client share link: public page, flight log, video range, download, then revoke.
    const shareRes = await apiFetch(`${BASE_URL}/api/projects/${projectId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresInDays: 1, allowDownload: true, recipientName: "E2E Client" }),
    });
    const { link } = await json<{ link: { id: string; url: string } }>(shareRes, "share-create");
    const token = link.url.split("/s/")[1];
    const pub = (p: string, init?: RequestInit) => fetch(`${BASE_URL}${p}`, init); // no cookie: clients have no account
    const pageRes = await pub(`/s/${token}`);
    if (pageRes.status !== 200) fail("share-page", `HTTP ${pageRes.status}`);
    await pageRes.body?.cancel();
    const srtRes = await pub(`/api/s/${token}/srt`);
    if (!srtRes.ok || !(await srtRes.text()).includes("-->")) fail("share-srt", `HTTP ${srtRes.status}`);
    const rangeRes = await pub(`/api/s/${token}/video`, { headers: { Range: "bytes=0-1023" } });
    if (rangeRes.status !== 206) fail("share-video", `expected 206, got ${rangeRes.status}`);
    const shareDl = await pub(`/api/s/${token}/download`);
    if (!shareDl.ok || Number(shareDl.headers.get("content-length")) !== finalJob.output!.sizeBytes) fail("share-download", `HTTP ${shareDl.status}`);
    await shareDl.body?.cancel();
    const revokeRes = await apiFetch(`${BASE_URL}/api/shares/${link.id}`, { method: "DELETE" });
    if (revokeRes.status !== 204) fail("share-revoke", `HTTP ${revokeRes.status}`);
    if ((await pub(`/api/s/${token}/srt`)).status !== 404) fail("share-revoke", "revoked link still serves the flight log");
    console.log("share link: page 200, srt 200, video 206, download 200, revoked → 404 ✓");

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\nE2E PASS (${elapsed}s)`);
  } finally {
    await cleanup();
    if (!KEEP) console.log(`project ${projectId} deleted`);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nE2E FAIL: ${message}`);
  process.exit(1);
});
