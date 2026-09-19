import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActivityBadge, fmtDate, fmtDateTime, Panel, Pill } from "@/components/admin/ui";
import { UserActions } from "@/components/admin/UserActions";
import { requireAdminPage } from "@/lib/auth/session.server";
import { prisma } from "@/lib/db.server";
import { isUuid } from "@/lib/ids";

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[userId]">) {
  const me = await requireAdminPage();
  const { userId } = await params;
  if (!isUuid(userId)) notFound();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      projects: { orderBy: { createdAt: "desc" }, include: { jobs: { orderBy: { createdAt: "desc" }, take: 1 } } },
      shareLinks: { orderBy: { createdAt: "desc" }, take: 20, include: { project: { select: { name: true } } } },
      activities: { orderBy: { createdAt: "desc" }, take: 40 },
    },
  });
  if (!user) notFound();
  const now = new Date();

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> All users
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.role === "ADMIN" ? <Pill tone="admin">Admin</Pill> : <Pill tone="neutral">User</Pill>}
              {user.status === "ACTIVE" ? <Pill tone="success">Active</Pill> : <Pill tone="danger">Suspended</Pill>}
              <span className="text-xs text-muted-foreground">
                Joined {fmtDate(user.createdAt)} · Last login {user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "never"}
              </span>
            </div>
          </div>
        </div>
        {user.id !== me.id && <UserActions user={user} />}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Projects (${user.projects.length})`}>
          <ul className="divide-y divide-border">
            {user.projects.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No projects.</li>}
            {user.projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <Link href={`/projects/${p.id}/${p.status === "READY" ? "editor" : "analysis"}`} className="truncate text-sm font-medium hover:underline">
                    {p.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(p.createdAt)}
                    {p.jobs[0] ? ` · last export ${p.jobs[0].status.toLowerCase()}` : ""}
                  </div>
                </div>
                <Pill tone={p.status === "READY" ? "success" : p.status === "ERROR" ? "danger" : "neutral"}>{p.status.toLowerCase()}</Pill>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Share links">
          <ul className="divide-y divide-border">
            {user.shareLinks.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No share links.</li>}
            {user.shareLinks.map((s) => {
              const state = s.revokedAt ? "Revoked" : s.expiresAt < now ? "Expired" : "Active";
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.project.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.recipientEmail ?? "Link only"} · {s.viewCount} views · expires {fmtDate(s.expiresAt)}
                    </div>
                  </div>
                  <Pill tone={state === "Active" ? "success" : "neutral"}>{state}</Pill>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Activity" className="xl:col-span-2">
          <ul className="divide-y divide-border">
            {user.activities.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No activity recorded.</li>}
            {user.activities.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <ActivityBadge action={a.action} />
                  {a.detail && <span className="truncate text-sm text-muted-foreground">{a.detail}</span>}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {a.ip ? `${a.ip} · ` : ""}
                  {fmtDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
