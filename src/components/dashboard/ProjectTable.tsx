"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDuration } from "@/lib/format/duration";
import { cn } from "@/lib/utils";
import type { ProjectListItemDto, ProjectStatus } from "@/types/api";

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  return `${day} · ${time}`;
}

function formatRelative(iso: string): string {
  const diffMs = Date.parse(iso) - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  return rtf.format(Math.round(diffHour / 24), "day");
}

function StatusBadge({ status, errorMessage }: { status: ProjectStatus; errorMessage?: string | null }) {
  if (status === "DRAFT") return <Badge variant="secondary">Waiting for files</Badge>;
  if (status === "ANALYZING")
    return (
      <Badge variant="outline" className="gap-1 border-[#0b7bb5]/40 text-[#0b7bb5]">
        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
        Analyzing
      </Badge>
    );
  if (status === "READY") return <Badge className="border-success/40 bg-success/10 text-success">Ready</Badge>;
  const badge = <Badge variant="destructive">Error</Badge>;
  if (!errorMessage) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{errorMessage}</TooltipContent>
    </Tooltip>
  );
}

export function ProjectTable({ projects }: { projects: ProjectListItemDto[] }) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<ProjectListItemDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Failed to delete the project.");
      }
      toast.success(`Deleted "${pendingDelete.name}"`);
      setPendingDelete(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete the project.");
    } finally {
      setDeleting(false);
    }
  }

  function openProject(project: ProjectListItemDto) {
    const target = project.status === "READY" ? "editor" : "analysis";
    router.push(`/projects/${project.id}/${target}`);
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Resolution</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last export</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id} className="cursor-pointer" onClick={() => openProject(project)}>
              <TableCell className="font-medium text-foreground">{project.name}</TableCell>
              <TableCell className="font-mono tabular-nums text-muted-foreground">
                {formatCreatedAt(project.createdAt)}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {project.durationSec !== null ? formatDuration(project.durationSec) : "—"}
              </TableCell>
              <TableCell className="font-mono tabular-nums">{project.resolution ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge status={project.status} />
              </TableCell>
              <TableCell>
                {project.lastExport ? (
                  <span className={cn("text-muted-foreground", project.lastExport.status === "COMPLETE" && "text-success")}>
                    {project.lastExport.status}
                    {project.lastExport.finishedAt ? ` · ${formatRelative(project.lastExport.finishedAt)}` : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${project.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(project);
                  }}
                >
                  <Trash className="size-4" aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This permanently deletes &ldquo;{pendingDelete?.name}&rdquo; and all of its uploaded files and exports. This
              can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Trash className="size-4" aria-hidden="true" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
