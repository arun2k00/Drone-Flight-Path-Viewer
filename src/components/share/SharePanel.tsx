"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, Link2, LoaderCircle, Mail, Send, Trash } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ShareLinkDto } from "@/lib/share/service.server";

const EXPIRY_OPTIONS = [
  { days: 1, label: "24 hours" },
  { days: 3, label: "3 days" },
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
];

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="icon-sm"
      variant="outline"
      aria-label="Copy link"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

/** Temporary public links for clients: no account, expires automatically, revocable, optional email invite. */
export function SharePanel({ projectId, hasExport }: { projectId: string; hasExport: boolean }) {
  const [links, setLinks] = useState<ShareLinkDto[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ expiresInDays: 7, recipientName: "", recipientEmail: "", message: "", allowDownload: true });

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/shares`);
    if (res.ok) setLinks((await res.json()).links);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/shares`)
      .then((res) => (res.ok ? res.json() : { links: [] }))
      .then((body) => !cancelled && setLinks(body.links));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't create the link.");
      const link = body.link as ShareLinkDto & { emailed: boolean };
      await navigator.clipboard?.writeText(link.url).catch(() => {});
      toast.success(link.recipientEmail ? (link.emailed ? `Link emailed to ${link.recipientEmail} and copied.` : "Link created and copied, but the email failed to send.") : "Link created and copied to your clipboard.");
      setForm((f) => ({ ...f, recipientName: "", recipientEmail: "", message: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the link.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/shares/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Link revoked. It stops working immediately.");
      await load();
    } else toast.error("Couldn't revoke the link.");
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-sm" aria-labelledby="share-heading">
      <div>
        <h2 id="share-heading" className="flex items-center gap-2 text-base font-semibold">
          <Link2 className="size-4 text-primary" aria-hidden="true" /> Share with a client
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A temporary link to the video with its live flight path and telemetry. Clients don&rsquo;t need an account.
          {hasExport ? " They can also download the exported video." : " Export a video to let them download it too."}
        </p>
      </div>

      <form onSubmit={create} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-name">Client name (optional)</Label>
            <Input id="share-name" value={form.recipientName} maxLength={80} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-email">Client email (optional)</Label>
            <Input id="share-email" type="email" value={form.recipientEmail} placeholder="We'll email them the link" onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="share-message">Message (optional)</Label>
          <textarea
            id="share-message"
            rows={3}
            maxLength={1000}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="e.g. Pier 14 is at 03:20."
            className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="share-expiry">Expires after</Label>
            <Select value={String(form.expiresInDays)} onValueChange={(v) => setForm({ ...form, expiresInDays: Number(v) })}>
              <SelectTrigger id="share-expiry" className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.days} value={String(o.days)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="share-download" checked={form.allowDownload} onCheckedChange={(v) => setForm({ ...form, allowDownload: v === true })} />
            <Label htmlFor="share-download">Allow video download</Label>
          </div>
        </div>
        <Button type="submit" disabled={creating} className="self-start">
          {creating ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : form.recipientEmail ? <Send className="size-4" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
          {form.recipientEmail ? "Create link and email it" : "Create link"}
        </Button>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-medium">Links</h3>
        {links === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : links.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">No links yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{link.recipientName ?? link.recipientEmail ?? "Anyone with the link"}</span>
                    <Badge variant={link.status === "ACTIVE" ? "default" : "secondary"} className={link.status === "ACTIVE" ? "bg-success/10 text-success" : ""}>
                      {link.status === "ACTIVE" ? "Active" : link.status === "EXPIRED" ? "Expired" : "Revoked"}
                    </Badge>
                  </div>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    {link.recipientEmail && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" aria-hidden="true" /> {link.recipientEmail}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" aria-hidden="true" /> {link.viewCount} view{link.viewCount === 1 ? "" : "s"}
                      {link.lastViewedAt ? `, last ${fmt(link.lastViewedAt)}` : ""}
                    </span>
                    <span>{link.status === "ACTIVE" ? `Expires ${fmt(link.expiresAt)}` : `Created ${fmt(link.createdAt)}`}</span>
                  </span>
                </div>
                {link.status === "ACTIVE" && (
                  <div className="flex gap-1.5">
                    <CopyButton url={link.url} />
                    <Button size="icon-sm" variant="outline" aria-label="Revoke link" onClick={() => revoke(link.id)}>
                      <Trash className="size-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
