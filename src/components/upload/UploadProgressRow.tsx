import { formatBytes } from "@/lib/format/bytes";

export function UploadProgressRow({
  name,
  doneBytes,
  totalBytes,
  bytesPerSec,
  etaSec,
}: {
  name: string;
  doneBytes: number;
  totalBytes: number;
  bytesPerSec: number;
  etaSec: number | null;
}) {
  const pct = totalBytes > 0 ? Math.min(100, Math.round((doneBytes / totalBytes) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 font-mono text-xs tabular-nums text-muted-foreground">
        <span className="truncate text-foreground">{name}</span>
        <span className="shrink-0">
          {formatBytes(doneBytes)} / {formatBytes(totalBytes)} · {formatBytes(bytesPerSec)}/s
          {etaSec !== null ? ` · ${Math.ceil(etaSec)}s left` : ""}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
