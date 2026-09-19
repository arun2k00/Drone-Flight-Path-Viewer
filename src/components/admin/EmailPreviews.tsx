"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const NAMES: Record<string, { name: string; audience: "User" | "Client" | "Admin" }> = {
  welcome: { name: "Welcome", audience: "User" },
  passwordReset: { name: "Password reset", audience: "User" },
  passwordChanged: { name: "Password changed", audience: "User" },
  exportReady: { name: "Export ready", audience: "User" },
  exportFailed: { name: "Export failed", audience: "User" },
  shareInvite: { name: "Shared flight invite", audience: "Client" },
  shareViewed: { name: "Client opened link", audience: "User" },
  adminNewUser: { name: "New signup", audience: "Admin" },
  accountStatus: { name: "Account suspended / reactivated", audience: "User" },
};

/** Live previews of every template with sample data, rendered in a sandboxed iframe exactly as sent. */
export function EmailPreviews({ samples }: { samples: Array<{ id: string; subject: string; html: string }> }) {
  const [active, setActive] = useState(samples[0]?.id);
  const current = samples.find((s) => s.id === active) ?? samples[0];
  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm lg:grid-cols-[220px_1fr]">
      <div>
        <h2 className="mb-2 px-2 text-sm font-semibold">Templates</h2>
        <ul className="flex flex-col gap-0.5">
          {samples.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setActive(s.id)}
                aria-pressed={s.id === current?.id}
                className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm", s.id === current?.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}
              >
                <span className="truncate">{NAMES[s.id]?.name ?? s.id}</span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{NAMES[s.id]?.audience}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {current && (
        <div className="min-w-0">
          <p className="mb-2 truncate text-sm">
            <span className="text-muted-foreground">Subject:</span> <span className="font-medium">{current.subject}</span>
          </p>
          <iframe title={`${current.id} preview`} srcDoc={current.html} sandbox="" className="h-[640px] w-full rounded-lg border border-border bg-white" />
        </div>
      )}
    </div>
  );
}
