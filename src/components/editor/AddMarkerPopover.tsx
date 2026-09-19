"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/stores/editor-store";

/** Simple label-entry step after a "+ Map marker" / "+ Video marker" click. */
export function AddMarkerPopover() {
  const pending = useEditorStore((s) => s.pendingMarker);
  const confirmPendingMarker = useEditorStore((s) => s.confirmPendingMarker);
  const setPendingMarker = useEditorStore((s) => s.setPendingMarker);
  const [label, setLabel] = useState("");

  if (!pending) return null;

  function confirm() {
    const trimmed = label.trim();
    if (!trimmed) return;
    confirmPendingMarker(trimmed);
    setLabel("");
  }

  return (
    <div className="absolute top-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-lg">
      <span className="text-xs text-muted-foreground">{pending.kind === "map" ? "Map marker" : "Video marker"} label:</span>
      <Input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirm();
          if (e.key === "Escape") setPendingMarker(null);
        }}
        placeholder="e.g. BUILDING 01"
        className="h-7 w-40"
      />
      <Button size="sm" className="h-7" onClick={confirm} disabled={!label.trim()}>
        Add
      </Button>
      <Button size="sm" variant="ghost" className="h-7" onClick={() => setPendingMarker(null)}>
        Cancel
      </Button>
    </div>
  );
}
