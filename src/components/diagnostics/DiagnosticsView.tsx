"use client";

import { useState, useTransition } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiagnosticCheck } from "@/lib/diagnostics/checks.server";

const NOT_IMPLEMENTED: { id: string; label: string }[] = [];

function StatusIcon({ status }: { status: DiagnosticCheck["status"] }) {
  if (status === "ok") return <CircleCheck className="size-4 text-success" aria-hidden="true" />;
  if (status === "warn") return <TriangleAlert className="size-4 text-warning" aria-hidden="true" />;
  return <CircleAlert className="size-4 text-destructive" aria-hidden="true" />;
}

export function DiagnosticsView({ initialChecks }: { initialChecks: DiagnosticCheck[] }) {
  const [checks, setChecks] = useState(initialChecks);
  const [isPending, startTransition] = useTransition();

  function runAgain() {
    startTransition(async () => {
      const res = await fetch("/api/diagnostics");
      const body = (await res.json()) as { checks: DiagnosticCheck[] };
      setChecks(body.checks);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Diagnostics</h1>
        <Button variant="outline" onClick={runAgain} disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcw className="size-4" aria-hidden="true" />
          )}
          Run again
        </Button>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <StatusIcon status={check.status} />
              <span className="text-foreground">{check.label}</span>
            </div>
            {check.detail && <span className="font-mono text-xs text-muted-foreground">{check.detail}</span>}
          </div>
        ))}
        {NOT_IMPLEMENTED.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3 opacity-60">
            <span className="text-foreground">{item.label}</span>
            <span className="text-xs text-muted-foreground">Not implemented yet</span>
          </div>
        ))}
      </div>
    </div>
  );
}
