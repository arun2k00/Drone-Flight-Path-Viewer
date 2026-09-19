import { fmtDateTime, PageTitle, Panel, Pill } from "@/components/admin/ui";
import { EmailPreviews } from "@/components/admin/EmailPreviews";
import { requireAdminPage } from "@/lib/auth/session.server";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { sampleEmails } from "@/lib/email/templates";

export default async function AdminEmailsPage() {
  await requireAdminPage();
  const config = getServerConfig();
  const log = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const samples = Object.entries(sampleEmails(config.APP_URL)).map(([id, e]) => ({ id, subject: e.subject, html: e.html }));

  return (
    <>
      <PageTitle
        title="Emails"
        description={
          config.SMTP
            ? `Sending through ${config.SMTP.host}:${config.SMTP.port} as ${config.MAIL_FROM}.`
            : `SMTP isn't configured, so emails are saved as HTML files in ${config.STORAGE_PATH}/outbox. Set SMTP_HOST to deliver them.`
        }
      />
      <EmailPreviews samples={samples} />
      <Panel title="Delivery log (last 100)" className="mt-6">
        <ul className="divide-y divide-border">
          {log.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No emails sent yet.</li>}
          {log.map((e) => (
            <li key={e.id} className="grid gap-1 px-5 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{e.subject}</div>
                <div className="truncate text-xs text-muted-foreground">
                  To {e.to} · {e.template}
                  {e.error && <span className="text-destructive"> · {e.error}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Pill tone={e.status === "SENT" ? "success" : e.status === "FAILED" ? "danger" : "neutral"}>{e.status === "SAVED" ? "Saved to outbox" : e.status.toLowerCase()}</Pill>
                <span className="text-xs tabular-nums text-muted-foreground">{fmtDateTime(e.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
