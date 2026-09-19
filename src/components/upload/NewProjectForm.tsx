"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { UploadProgressRow } from "@/components/upload/UploadProgressRow";
import { UploadError, uploadFile, type UploadProgress } from "@/lib/uploads/client.browser";
import { cn } from "@/lib/utils";
import type { ProjectDto } from "@/types/api";

type Stage = "idle" | "creating" | "uploading-srt" | "uploading-video" | "analyzing" | "error";

function baseName(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return (idx === -1 ? fileName : fileName.slice(0, idx)).toLowerCase();
}

export function NewProjectForm({ maxVideoBytes, maxSrtBytes }: { maxVideoBytes: number; maxSrtBytes: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [srtProgress, setSrtProgress] = useState<UploadProgress | null>(null);
  const [videoProgress, setVideoProgress] = useState<UploadProgress | null>(null);

  const submitting = stage === "creating" || stage === "uploading-srt" || stage === "uploading-video" || stage === "analyzing";
  const canSubmit = name.trim().length > 0 && videoFile !== null && srtFile !== null && !submitting;
  const namesMatch = videoFile && srtFile ? baseName(videoFile.name) === baseName(srtFile.name) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !videoFile || !srtFile) return;

    setStage("creating");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), companyName: companyName.trim() || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Failed to create the project.");
      const { project } = body as { project: ProjectDto };

      // SRT first (small, fast feedback), then the video.
      setStage("uploading-srt");
      await uploadFile(project.id, "TELEMETRY", srtFile, { onProgress: setSrtProgress });

      setStage("uploading-video");
      await uploadFile(project.id, "VIDEO", videoFile, { onProgress: setVideoProgress });

      setStage("analyzing");
      // A failed analysis is still persisted on the project (status ERROR + message) — navigate either way
      // so the analysis page can show it, rather than stranding the user on this form.
      await fetch(`/api/projects/${project.id}/analyze`, { method: "POST" }).catch(() => {});

      router.push(`/projects/${project.id}/analysis`);
    } catch (err) {
      setStage("error");
      const message = err instanceof UploadError ? err.message : err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-name">Project name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hyderabad site survey"
            required
            maxLength={120}
            autoFocus
            disabled={submitting}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company-name">Company name (optional)</Label>
          <Input
            id="company-name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Surveys"
            maxLength={120}
            disabled={submitting}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FileDropzone
          label="Drop drone video here"
          hint="MP4 · MOV · M4V (max 4 GB)"
          accept=".mp4,.mov,.m4v"
          extensions={[".mp4", ".mov", ".m4v"]}
          maxSizeBytes={maxVideoBytes}
          file={videoFile}
          onSelect={setVideoFile}
          onRemove={() => setVideoFile(null)}
          disabled={submitting}
        />
        <FileDropzone
          label="Drop SRT telemetry here"
          hint="DJI .SRT (max 50 MB)"
          accept=".srt"
          extensions={[".srt"]}
          maxSizeBytes={maxSrtBytes}
          file={srtFile}
          onSelect={setSrtFile}
          onRemove={() => setSrtFile(null)}
          disabled={submitting}
        />
      </div>

      {namesMatch !== null && (
        <p className={cn("flex items-center gap-1.5 text-xs", namesMatch ? "text-success" : "text-warning")}>
          {namesMatch ? (
            <CircleCheck className="size-3.5" aria-hidden="true" />
          ) : (
            <TriangleAlert className="size-3.5" aria-hidden="true" />
          )}
          {namesMatch ? "File names match" : "File names differ — make sure the SRT belongs to this video."}
        </p>
      )}

      {stage === "creating" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Creating project…
        </p>
      )}
      {stage === "analyzing" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Analyzing video and telemetry…
        </p>
      )}
      {(stage === "uploading-srt" || stage === "uploading-video") && srtFile && videoFile && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <UploadProgressRow
            name={srtFile.name}
            doneBytes={stage === "uploading-srt" ? (srtProgress?.doneBytes ?? 0) : srtFile.size}
            totalBytes={srtFile.size}
            bytesPerSec={stage === "uploading-srt" ? (srtProgress?.bytesPerSec ?? 0) : 0}
            etaSec={stage === "uploading-srt" ? (srtProgress?.etaSec ?? null) : null}
          />
          {stage === "uploading-video" && (
            <UploadProgressRow
              name={videoFile.name}
              doneBytes={videoProgress?.doneBytes ?? 0}
              totalBytes={videoFile.size}
              bytesPerSec={videoProgress?.bytesPerSec ?? 0}
              etaSec={videoProgress?.etaSec ?? null}
            />
          )}
        </div>
      )}

      <div>
        <Button type="submit" disabled={!canSubmit}>
          {submitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Analyze Project
        </Button>
      </div>
    </form>
  );
}
