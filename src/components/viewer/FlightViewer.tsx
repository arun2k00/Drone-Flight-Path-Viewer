"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, FileVideo, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicConfig } from "@/lib/config/public-config.server";
import { isSrt, isVideo, loadLocalFlight, pairFiles, type FlightPair, type LocalFlight } from "@/lib/viewer/local-flight";
import { cn } from "@/lib/utils";
import { FlightSession } from "./FlightSession";

const card = "rounded-xl border border-border bg-card shadow-sm";

export function FlightViewer({ publicConfig }: { publicConfig: PublicConfig }) {
  const [files, setFiles] = useState<File[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ pair: FlightPair; flight: LocalFlight | null; error: string | null } | null>(null);

  const pairs = useMemo(() => pairFiles(files, overrides), [files, overrides]);
  const pair = pairs.find((p) => p.key === selectedKey) ?? pairs[0] ?? null;

  // Parse the SRT once per selected pair, in memory. Videos are never read, only referenced by object URL.
  useEffect(() => {
    if (!pair) return;
    let cancelled = false;
    (async () => {
      if (!pair.srt) return { pair, flight: null, error: null };
      try {
        return { pair, flight: loadLocalFlight(new Uint8Array(await pair.srt.arrayBuffer())), error: null };
      } catch (err) {
        return { pair, flight: null, error: err instanceof Error ? err.message : "Unable to read this SRT file." };
      }
    })().then((next) => !cancelled && setLoaded(next));
    return () => {
      cancelled = true;
    };
  }, [pair?.key, pair?.video, pair?.srt]); // eslint-disable-line react-hooks/exhaustive-deps -- pair identity changes every render

  function addFiles(list: FileList | null) {
    const accepted = [...(list ?? [])].filter((f) => isSrt(f) || isVideo(f));
    if (!accepted.length) return;
    setFiles((prev) => [...prev.filter((p) => !accepted.some((a) => a.name === p.name)), ...accepted]);
  }

  if (files.length === 0) return <DropZone onFiles={addFiles} />;

  const srtNames = files.filter(isSrt).map((f) => f.name);
  return (
    <div className="flex flex-col gap-4">
      <div className={cn(card, "flex flex-col gap-3 p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">Drone Flight Viewer</h1>
          <div className="flex items-center gap-3">
            <PrivacyNote />
            <AddFilesButton onFiles={addFiles} />
          </div>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Flights">
          {pairs.map((p) => (
            <li key={p.key}>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  p.key === pair?.key ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <button type="button" className="font-medium uppercase" onClick={() => setSelectedKey(p.key)}>
                  {p.key}
                </button>
                {p.video && <FileVideo className="size-4 text-muted-foreground" aria-label="Video" />}
                {p.video ? (
                  <select
                    aria-label={`SRT for ${p.video.name}`}
                    className="rounded border border-input bg-background px-1 py-0.5 text-xs"
                    value={p.srt?.name ?? ""}
                    onChange={(e) => setOverrides((o) => ({ ...o, [p.video!.name]: e.target.value || null }))}
                  >
                    <option value="">No SRT</option>
                    {srtNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="size-4" aria-hidden="true" /> SRT only
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {loaded && loaded.pair.key === pair?.key && (
        <FlightSession
          key={`${pair.key}:${pair.video?.name}:${pair.srt?.name}`}
          publicConfig={publicConfig}
          flight={loaded.flight}
          error={loaded.error}
          video={pair.video}
          hasSrt={pair.srt !== null}
        />
      )}
    </div>
  );
}

function DropZone({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Drone Flight Viewer</h1>
        <p className="mt-1 text-muted-foreground">See where the drone was, when it was there, and what the camera was doing.</p>
      </div>
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card px-6 py-20 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="size-8 text-primary" aria-hidden="true" />
        <p className="text-base font-semibold">Drop your DJI flight files here</p>
        <p className="text-muted-foreground">An SRT on its own, or MP4 + SRT. Matching names such as DJI_0042.MP4 and DJI_0042.SRT pair automatically.</p>
        <AddFilesButton onFiles={onFiles} label="Browse files" />
        <PrivacyNote />
      </div>
    </div>
  );
}

function AddFilesButton({ onFiles, label = "Add files" }: { onFiles: (files: FileList | null) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".srt,.mp4,.mov,.m4v"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

function PrivacyNote() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Only map tiles are fetched from OpenStreetMap, which reveals the area being viewed.">
      <ShieldCheck className="size-4 text-success" aria-hidden="true" />
      Your footage stays on this device. Nothing is uploaded.
    </p>
  );
}

