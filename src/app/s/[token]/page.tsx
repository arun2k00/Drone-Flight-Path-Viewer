import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarClock, Download } from "lucide-react";
import { LogoImage } from "@/components/brand/Logo";
import { ManagedBy } from "@/components/brand/ManagedBy";
import { SharedFlight } from "@/components/viewer/SharedFlight";
import { getPublicConfig } from "@/lib/config/public-config.server";
import { AppError } from "@/lib/errors/app-error";
import { recordShareView, resolveShare } from "@/lib/share/service.server";
import type { TelemetrySettings } from "@/types/telemetry";

// Token URLs must never leak via Referer headers or search engines.
export const metadata: Metadata = { title: "Shared flight · Aeroxpress", robots: { index: false, follow: false }, referrer: "no-referrer" };

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);

export default async function SharePage({ params }: PageProps<"/s/[token]">) {
  await connection();
  const { token } = await params;
  const link = await resolveShare(token).catch((err) => {
    if (err instanceof AppError) return null;
    throw err;
  });

  if (!link) notFound();

  await recordShareView(link);
  const { project } = link;
  const offsetSec = (project.telemetrySettings as unknown as TelemetrySettings).offsetSec ?? 0;
  const hasExport = link.allowDownload && project.jobs.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">Shared flight{project.companyName ? ` · ${project.companyName}` : ""}</p>
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>Shared by {link.createdBy.name}</span>
              <span className="flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden="true" /> Available until {fmt(link.expiresAt)}
              </span>
            </p>
          </div>
          {hasExport && (
            <a
              href={`/api/s/${token}/download`}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Download className="size-4" aria-hidden="true" /> Download video with overlay
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        {link.message && (
          <figure className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
            <blockquote className="whitespace-pre-line text-[15px] leading-relaxed">{link.message}</blockquote>
            <figcaption className="mt-2 text-sm text-muted-foreground">— {link.createdBy.name}</figcaption>
          </figure>
        )}
        <SharedFlight token={token} publicConfig={getPublicConfig()} offsetSec={offsetSec} />
      </main>

      <footer className="flex flex-col items-center gap-2 border-t border-border py-6 text-sm text-muted-foreground">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          Shared with <LogoImage className="h-4" />
        </Link>
        <ManagedBy className="text-xs" />
      </footer>
    </div>
  );
}
