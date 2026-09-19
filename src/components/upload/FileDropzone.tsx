"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format/bytes";
import { cn } from "@/lib/utils";

export interface FileDropzoneProps {
  label: string;
  hint: string;
  accept: string; // e.g. ".mp4,.mov,.m4v"
  extensions: string[]; // lowercase, with leading dot
  maxSizeBytes: number;
  file: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function FileDropzone({ label, hint, accept, extensions, maxSizeBytes, file, onSelect, onRemove, disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(candidate: File): string | null {
    const ext = candidate.name.slice(candidate.name.lastIndexOf(".")).toLowerCase();
    if (!extensions.includes(ext)) return `Use one of: ${extensions.join(", ").toUpperCase()}`;
    if (candidate.size === 0) return "The selected file is empty.";
    if (candidate.size > maxSizeBytes) return `This file is larger than the ${formatBytes(maxSizeBytes)} upload limit.`;
    return null;
  }

  function handleFiles(files: FileList | null) {
    const candidate = files?.[0];
    if (!candidate) return;
    const validationError = validate(candidate);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSelect(candidate);
  }

  if (file) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-foreground">{file.name}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
            <X className="size-3.5" aria-hidden="true" />
            Remove
          </Button>
        </div>
        <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center transition-colors hover:border-primary/50",
          isDragging && "border-primary bg-primary/5",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
        <span className="text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </button>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
