import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format/duration";
import type { SyncReport } from "@/types/telemetry";

const STATUS_LABEL: Record<SyncReport["status"], string> = {
  GOOD: "Sync good",
  WARNING: "Sync warning",
  MISMATCH: "Sync mismatch",
  NO_OVERLAP: "No overlap",
};

const STATUS_CLASS: Record<SyncReport["status"], string> = {
  GOOD: "border-success/40 bg-success/10 text-success",
  WARNING: "border-warning/40 bg-warning/10 text-warning",
  MISMATCH: "border-destructive/40 bg-destructive/10 text-destructive",
  NO_OVERLAP: "border-destructive/40 bg-destructive/10 text-destructive",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}

export function SyncCard({ sync }: { sync: SyncReport }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sync</CardTitle>
        <Badge className={STATUS_CLASS[sync.status]}>{STATUS_LABEL[sync.status]}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-sm tabular-nums">
          <Field label="Video duration" value={formatDuration(sync.videoDurationSec)} />
          <Field label="SRT telemetry range" value={`${formatDuration(sync.telemetryStartSec)} → ${formatDuration(sync.telemetryEndSec)}`} />
        </div>
        {sync.messages.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {sync.messages.map((m) => (
              <li key={m.code}>{m.message}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
