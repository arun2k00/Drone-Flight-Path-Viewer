"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFile, UploadError } from "@/lib/uploads/client.browser";
import { useEditorStore } from "@/stores/editor-store";

export function BrandingPanel({ projectId }: { projectId: string }) {
  const projectName = useEditorStore((s) => s.projectName);
  const companyName = useEditorStore((s) => s.companyName);
  const hasLogo = useEditorStore((s) => s.hasLogo);
  const logoVersion = useEditorStore((s) => s.logoVersion);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const setCompanyName = useEditorStore((s) => s.setCompanyName);
  const setHasLogo = useEditorStore((s) => s.setHasLogo);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadFile(projectId, "LOGO", file);
      setHasLogo(true);
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "Logo upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/logo`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("Remove failed");
      setHasLogo(false);
    } catch {
      setError("Failed to remove logo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Branding</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branding-name" className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Project name
        </Label>
        <Input id="branding-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="h-8" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branding-company" className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Company name (optional)
        </Label>
        <Input
          id="branding-company"
          value={companyName ?? ""}
          onChange={(e) => setCompanyName(e.target.value || null)}
          className="h-8"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Logo</Label>
        {hasLogo ? (
          <div className="flex items-center gap-2">
            <img
              key={logoVersion}
              src={`/api/projects/${projectId}/logo?v=${logoVersion}`}
              alt="Logo"
              className="h-10 w-10 rounded border border-border bg-white/5 object-contain"
            />
            <Button variant="outline" size="sm" onClick={() => void handleRemove()} disabled={busy}>
              <X className="size-3.5" aria-hidden="true" />
              Remove
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            {busy ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
            Upload logo
          </Button>
        )}
        <input ref={fileInputRef} type="file" accept=".png,.svg,.webp" className="hidden" onChange={(e) => void handleFileChange(e)} />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
