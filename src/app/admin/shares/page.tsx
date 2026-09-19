import Link from "next/link";
import { fmtDate, fmtDateTime, PageTitle, Panel, Pill } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminRevokeShareAction } from "@/lib/admin/actions";
import { requireAdminPage } from "@/lib/auth/session.server";
import { prisma } from "@/lib/db.server";

export default async function AdminSharesPage() {
  await requireAdminPage();
  const links = await prisma.shareLink.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { project: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
  });
  const now = new Date();

  return (
    <>
      <PageTitle title="Share links" description="Temporary client links across all accounts. Revoking stops a link immediately." />
      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Project</TableHead>
              <TableHead>Shared by</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No share links yet.
                </TableCell>
              </TableRow>
            )}
            {links.map((l) => {
              const state = l.revokedAt ? "Revoked" : l.expiresAt < now ? "Expired" : "Active";
              return (
                <TableRow key={l.id}>
                  <TableCell className="pl-5 font-medium">{l.project.name}</TableCell>
                  <TableCell>
                    <Link href={`/admin/users/${l.createdBy.id}`} className="hover:underline">
                      {l.createdBy.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.recipientEmail ?? l.recipientName ?? "Link only"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.viewCount}
                    {l.lastViewedAt && <div className="text-xs text-muted-foreground">{fmtDateTime(l.lastViewedAt)}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(l.expiresAt)}</TableCell>
                  <TableCell>
                    <Pill tone={state === "Active" ? "success" : state === "Revoked" ? "danger" : "neutral"}>{state}</Pill>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    {state === "Active" && (
                      <form action={adminRevokeShareAction}>
                        <input type="hidden" name="shareId" value={l.id} />
                        <Button size="sm" variant="outline" type="submit">
                          Revoke
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}
