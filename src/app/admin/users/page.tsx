import Link from "next/link";
import { Search } from "lucide-react";
import { fmtDate, fmtDateTime, PageTitle, Panel, Pill } from "@/components/admin/ui";
import { UserActions } from "@/components/admin/UserActions";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth/session.server";
import { prisma } from "@/lib/db.server";

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireAdminPage();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const users = await prisma.user.findMany({
    where: query ? { OR: [{ email: { contains: query } }, { name: { contains: query } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { projects: true, shareLinks: true } } },
  });

  return (
    <>
      <PageTitle
        title="Users"
        description={`${users.length}${users.length === 200 ? "+" : ""} ${query ? "matching" : "total"} accounts.`}
        action={
          <form className="relative w-full sm:w-72" role="search">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input name="q" defaultValue={query} placeholder="Search name or email" className="h-9 pl-8" aria-label="Search users" />
          </form>
        }
      />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Projects</TableHead>
              <TableHead className="text-right">Share links</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="pl-5">
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                    {u.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>{u.role === "ADMIN" ? <Pill tone="admin">Admin</Pill> : <Pill tone="neutral">User</Pill>}</TableCell>
                <TableCell>{u.status === "ACTIVE" ? <Pill tone="success">Active</Pill> : <Pill tone="danger">Suspended</Pill>}</TableCell>
                <TableCell className="text-right tabular-nums">{u._count.projects}</TableCell>
                <TableCell className="text-right tabular-nums">{u._count.shareLinks}</TableCell>
                <TableCell className="text-muted-foreground">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                <TableCell className="pr-5 text-right">{u.id === me.id ? <span className="text-xs text-muted-foreground">You</span> : <UserActions user={u} />}</TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No users match &ldquo;{query}&rdquo;.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}
