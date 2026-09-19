import Link from "next/link";
import { Download, FolderOpen, Link2, Mail, UserCheck, Users } from "lucide-react";
import { ActivityBadge, fmtDateTime, PageTitle, Panel } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/session.server";
import { prisma } from "@/lib/db.server";

const DAY = 864e5;

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

/** Dashboard numbers; kept out of the component so render stays pure. */
async function loadOverview() {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const since7 = new Date(now - 7 * DAY);
  const since14 = new Date(now - 13 * DAY);
  since14.setUTCHours(0, 0, 0, 0);

  const [users, newUsers7, active30, projects, exports30, exportsFailed30, activeShares, views, emails30, emailsFailed30, recentSignups, recent] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7 } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: since30 } } }),
    prisma.project.count(),
    prisma.renderJob.count({ where: { status: "COMPLETE", finishedAt: { gte: since30 } } }),
    prisma.renderJob.count({ where: { status: "FAILED", finishedAt: { gte: since30 } } }),
    prisma.shareLink.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.shareLink.aggregate({ _sum: { viewCount: true } }),
    prisma.emailLog.count({ where: { createdAt: { gte: since30 } } }),
    prisma.emailLog.count({ where: { createdAt: { gte: since30 }, status: "FAILED" } }),
    prisma.user.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true } }),
    prisma.activity.findMany({ take: 12, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, id: true } } } }),
  ]);

  const days = Array.from({ length: 14 }, (_, i) => {
    const start = since14.getTime() + i * DAY;
    return { start, count: recentSignups.filter((u) => u.createdAt.getTime() >= start && u.createdAt.getTime() < start + DAY).length };
  });
  const peak = Math.max(1, ...days.map((d) => d.count));

  return { users, newUsers7, active30, projects, exports30, exportsFailed30, activeShares, views, emails30, emailsFailed30, recent, days, peak };
}

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const { users, newUsers7, active30, projects, exports30, exportsFailed30, activeShares, views, emails30, emailsFailed30, recent, days, peak } = await loadOverview();
  return (
    <>
      <PageTitle title="Overview" description="Accounts, projects, exports and client sharing across the whole site." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi icon={Users} label="Users" value={users} sub={`${newUsers7} new in the last 7 days`} />
        <Kpi icon={UserCheck} label="Active users" value={active30} sub="Logged in during the last 30 days" />
        <Kpi icon={FolderOpen} label="Projects" value={projects} sub="Across all accounts" />
        <Kpi icon={Download} label="Exports (30 days)" value={exports30} sub={exportsFailed30 ? `${exportsFailed30} failed` : "No failures"} />
        <Kpi icon={Link2} label="Active share links" value={activeShares} sub={`${(views._sum.viewCount ?? 0).toLocaleString()} client views in total`} />
        <Kpi icon={Mail} label="Emails (30 days)" value={emails30} sub={emailsFailed30 ? `${emailsFailed30} failed to send` : "All delivered or saved"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Panel title="Signups, last 14 days" className="xl:col-span-2">
          <div className="flex h-44 items-end gap-1.5 px-5 pt-6 pb-2" role="img" aria-label={`Signups per day: ${days.map((d) => d.count).join(", ")}`}>
            {days.map((d) => (
              <div key={d.start} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-muted-foreground">{d.count || ""}</span>
                <div className="w-full rounded-t-md bg-primary/80" style={{ height: `${Math.max(3, (d.count / peak) * 120)}px`, opacity: d.count ? 1 : 0.25 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between px-5 pb-4 text-[11px] text-muted-foreground">
            <span>{new Date(days[0].start).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
            <span>Today</span>
          </div>
        </Panel>

        <Panel
          title="Recent activity"
          className="xl:col-span-3"
          action={
            <Link href="/admin/activity" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          <ul className="divide-y divide-border">
            {recent.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No activity yet.</li>}
            {recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <ActivityBadge action={a.action} />
                  <span className="truncate text-sm">
                    {a.user ? (
                      <Link href={`/admin/users/${a.user.id}`} className="font-medium hover:underline">
                        {a.user.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unknown user</span>
                    )}
                    {a.detail && <span className="text-muted-foreground"> · {a.detail}</span>}
                  </span>
                </div>
                <time className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtDateTime(a.createdAt)}</time>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
