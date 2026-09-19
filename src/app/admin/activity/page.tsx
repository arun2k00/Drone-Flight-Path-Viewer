import Link from "next/link";
import { ActivityBadge, fmtDateTime, PageTitle, Panel } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/session.server";
import { prisma } from "@/lib/db.server";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const CATEGORIES = [
  { key: "", label: "All" },
  { key: "auth.", label: "Sign-ins" },
  { key: "project.", label: "Projects" },
  { key: "export.", label: "Exports" },
  { key: "share.", label: "Sharing" },
  { key: "admin.", label: "Admin" },
];

export default async function AdminActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireAdminPage();
  const sp = await searchParams;
  const category = CATEGORIES.some((c) => c.key === sp.type) ? (sp.type as string) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = category ? { action: { startsWith: category } } : {};
  const [rows, total] = await Promise.all([
    prisma.activity.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { id: true, name: true, email: true } } } }),
    prisma.activity.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number, type = category) => `/admin/activity?${new URLSearchParams({ ...(type ? { type } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <PageTitle title="Activity" description="Everything users and admins did, newest first. IP addresses come from the proxy's X-Forwarded-For header." />
      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={href(1, c.key)}
            className={cn("rounded-full border px-3 py-1 text-sm", c.key === category ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {c.label}
          </Link>
        ))}
      </div>
      <Panel>
        <ul className="divide-y divide-border">
          {rows.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Nothing here yet.</li>}
          {rows.map((a) => (
            <li key={a.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <ActivityBadge action={a.action} />
                {a.user ? (
                  <Link href={`/admin/users/${a.user.id}`} className="text-sm font-medium hover:underline">
                    {a.user.name}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Unknown user</span>
                )}
                {a.detail && <span className="truncate text-sm text-muted-foreground">{a.detail}</span>}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {a.ip ? `${a.ip} · ` : ""}
                {fmtDateTime(a.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={href(page - 1)} className="font-medium text-primary hover:underline">← Newer</Link> : <span />}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(page + 1)} className="font-medium text-primary hover:underline">Older →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
