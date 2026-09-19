"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Circle, CircleCheck, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatBytes } from "@/lib/format/bytes";
import { formatDuration } from "@/lib/format/duration";
import { cn } from "@/lib/utils";
import { resolutionOptions } from "@/lib/video/output-size";
import type { ExportPhase, ExportSettings, JobDto, JobStatus, ProjectDto } from "@/types/api";

const PHASE_ORDER: ExportPhase[] = ["PREPARING_TELEMETRY", "GENERATING_FLIGHT_PATH", "RENDERING_OVERLAY", "ENCODING_VIDEO", "FINALIZING"];

/** spelled exactly as the UI shows them */
const PHASE_LABELS: Record<ExportPhase, string> = {
  PREPARING_TELEMETRY: "Preparing telemetry…",
  GENERATING_FLIGHT_PATH: "Generating flight path…",
  RENDERING_OVERLAY: "Rendering overlay…",
  ENCODING_VIDEO: "Rendering overlay frames and encoding…",
  FINALIZING: "Finalizing…",
};

const QUALITY_OPTIONS: Array<{ value: ExportSettings["quality"]; label: string; description: string }> = [
  { value: "high", label: "High", description: "Visually lossless, larger" },
  { value: "balanced", label: "Balanced", description: "Great quality, smaller" },
  { value: "small", label: "Smaller file", description: "Smallest, some detail loss" },
];

function isActive(status: JobStatus): boolean {
  return status === "QUEUED" || status === "RUNNING";
}

/** frames / fpsEstimate at the fixed "medium" preset — an estimate, labelled as one. */
function estimateSec(frameCount: number, width: number, height: number): number {
  const shortSide = Math.min(width, height);
  const fpsEstimate = shortSide <= 1080 ? 90 : shortSide <= 1440 ? 45 : 18;
  return frameCount / fpsEstimate;
}

function PhaseList({ phase, status }: { phase: ExportPhase | null; status: JobStatus }) {
  const currentIndex = phase ? PHASE_ORDER.indexOf(phase) : status === "QUEUED" ? -1 : PHASE_ORDER.length;
  return (
    <ol className="flex flex-col gap-1">
      {PHASE_ORDER.map((p, i) => {
        const done = status === "COMPLETE" || i < currentIndex;
        const active = i === currentIndex && isActive(status);
        return (
          <li key={p} className={cn("flex items-center gap-2 text-xs", active ? "font-medium text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/50")}>
            {done ? (
              <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden="true" />
            ) : active ? (
              <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <Circle className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            {PHASE_LABELS[p]}
          </li>
        );
      })}
    </ol>
  );
}

function JobHistoryRow({ job }: { job: JobDto }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs">
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground">
          {job.status} · {job.settings.resolution} · {job.settings.quality}
        </span>
        <span className="text-muted-foreground">{job.finishedAt ? new Date(job.finishedAt).toLocaleString() : new Date(job.createdAt).toLocaleString()}</span>
        {job.error && <span className="text-destructive">{job.error.message}</span>}
      </div>
      {job.status === "COMPLETE" && job.output && (
        <a href={job.output.downloadUrl} download>
          <Button variant="outline" size="sm">
            Download
          </Button>
        </a>
      )}
    </li>
  );
}

export function ExportShell({ project, diagnosticsEnabled }: { project: ProjectDto; diagnosticsEnabled: boolean }) {
  const [resolution, setResolution] = useState<ExportSettings["resolution"]>("original");
  const [quality, setQuality] = useState<ExportSettings["quality"]>("high");
  const [job, setJob] = useState<JobDto | null>(null);
  const [history, setHistory] = useState<JobDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const video = project.videoMetadata;
  const options = video ? resolutionOptions(video.video) : [];

  const refreshHistory = useCallback(async () => {
    const res = await fetch(`/api/projects/${project.id}/exports`);
    if (!res.ok) return;
    const data = (await res.json()) as { jobs: JobDto[] };
    setHistory(data.jobs);
    const active = data.jobs.find((j) => isActive(j.status));
    if (active) setJob(active);
  }, [project.id]);

  // Resume polling a job that's already queued or running, and show past jobs (navigated away and back).
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/projects/${project.id}/exports`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { jobs: JobDto[] } | null) => {
        if (cancelled || !data) return;
        setHistory(data.jobs);
        const active = data.jobs.find((j) => isActive(j.status));
        if (active) setJob(active);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    if (!job || !isActive(job.status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => {
      setNow(Date.now());
      void fetch(`/api/jobs/${job.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { job: JobDto } | null) => {
          if (!data) return;
          setJob(data.job);
          if (!isActive(data.job.status)) void refreshHistory();
        });
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job, refreshHistory]);

  const handleExport = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overlayConfig: project.overlayConfig, settings: { resolution, quality } }),
      });
      const data = (await res.json()) as { job?: JobDto; error?: { message: string } };
      if (!res.ok || !data.job) {
        setError(data.error?.message ?? "Export failed to start.");
        return;
      }
      setJob(data.job);
      void refreshHistory();
    } catch {
      setError("Export failed to start.");
    } finally {
      setStarting(false);
    }
  }, [project.id, project.overlayConfig, resolution, quality, refreshHistory]);

  const handleCancel = useCallback(async () => {
    if (!job) return;
    setConfirmingCancel(false);
    const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
    const data = (await res.json()) as { job?: JobDto };
    if (data.job) setJob(data.job);
  }, [job]);

  const statusLabel =
    job?.status === "COMPLETE"
      ? "Export complete"
      : job?.status === "FAILED"
        ? "Export failed"
        : job?.status === "CANCELLED"
          ? "Export cancelled"
          : (job?.phase && PHASE_LABELS[job.phase]) || "Queued…";

  const elapsedSec = job?.startedAt ? Math.max(0, (now - Date.parse(job.startedAt)) / 1000) : null;
  const estimate = video && !job ? estimateSec(video.video.frameCount ?? Math.round(video.video.durationSec * video.video.fps.value), video.video.width, video.video.height) : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-lg font-semibold text-foreground">Export video</h1>

      {!job && (
        <>
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Resolution</Label>
            <ToggleGroup type="single" variant="outline" value={resolution} onValueChange={(v) => v && setResolution(v as ExportSettings["resolution"])}>
              {options.map((o) => (
                <ToggleGroupItem key={o.value} value={o.value} disabled={!o.available} title={o.reason ?? undefined}>
                  {o.label}
                  {o.available && o.width ? ` (${o.width}×${o.height})` : ""}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Quality</Label>
            <ToggleGroup type="single" variant="outline" value={quality} onValueChange={(v) => v && setQuality(v as ExportSettings["quality"])}>
              {QUALITY_OPTIONS.map((q) => (
                <ToggleGroupItem key={q.value} value={q.value} title={q.description}>
                  {q.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <p className="text-xs text-muted-foreground">MP4 · H.264 · AAC (or no audio)</p>
          {estimate !== null && <p className="text-xs text-muted-foreground">Estimated time: ~{formatDuration(estimate)} (estimate)</p>}

          <Button onClick={() => void handleExport()} disabled={starting}>
            {starting ? "Starting…" : "Export Video"}
          </Button>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {job && (
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
          {isActive(job.status) ? (
            <>
              <PhaseList phase={job.phase} status={job.status} />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{Math.round(job.progress * 100)}%</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {elapsedSec !== null ? `Elapsed ${formatDuration(elapsedSec)}` : null}
                  {job.etaSec !== null ? ` · ETA ${formatDuration(job.etaSec)}` : ""}
                </span>
              </div>
              <Progress value={job.progress * 100} />
              {job.framesTotal !== null && (
                <p className="font-mono text-xs text-muted-foreground">
                  Frame {(job.framesDone ?? 0).toLocaleString()} / {job.framesTotal.toLocaleString()}
                </p>
              )}
              <Button variant="outline" onClick={() => setConfirmingCancel(true)}>
                Cancel export
              </Button>
            </>
          ) : job.status === "COMPLETE" ? (
            <>
              <span className="text-sm font-medium text-foreground">{statusLabel}</span>
              {job.output && (
                <p className="text-sm text-foreground">
                  {job.output.fileName} · {formatBytes(job.output.sizeBytes)} · {job.output.width}×{job.output.height}
                </p>
              )}
            </>
          ) : (
            <Alert variant={job.status === "FAILED" ? "destructive" : "default"}>
              <AlertTitle>{statusLabel}</AlertTitle>
              {job.error && (
                <AlertDescription>
                  {job.error.message}
                  {diagnosticsEnabled && (
                    <>
                      {" · "}
                      <a href={`/api/jobs/${job.id}/log`} download>
                        Download FFmpeg log
                      </a>
                    </>
                  )}
                </AlertDescription>
              )}
            </Alert>
          )}

          {job.warnings.length > 0 && (
            <ul className="flex flex-col gap-1">
              {job.warnings.map((w, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  {w.message}
                </li>
              ))}
            </ul>
          )}

          {job.status === "COMPLETE" && job.output && (
            <a href={job.output.downloadUrl} download>
              <Button variant="default">Download Video</Button>
            </a>
          )}

          {!isActive(job.status) && (
            <Button variant="ghost" onClick={() => setJob(null)}>
              Export again
            </Button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">History</Label>
          <ul className="flex flex-col gap-2">
            {history.map((h) => (
              <JobHistoryRow key={h.id} job={h} />
            ))}
          </ul>
        </div>
      )}

      <Link href={`/projects/${project.id}/editor`} className="text-sm text-muted-foreground hover:underline">
        ← Back to editor
      </Link>

      <Dialog open={confirmingCancel} onOpenChange={setConfirmingCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel export?</DialogTitle>
            <DialogDescription>The in-progress export will be stopped and its partial file discarded. This can&rsquo;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep exporting</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void handleCancel()}>
              Cancel export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
