import "server-only";
import { logActivity } from "@/lib/activity.server";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { sendEmail } from "@/lib/email/send.server";
import { emails } from "@/lib/email/templates";
import { formatBytes } from "@/lib/format/bytes";

/** Emails the project owner when an export finishes or fails, and records it in the activity log. Never throws. */
export async function notifyExportFinished(jobId: string): Promise<void> {
  try {
    const job = await prisma.renderJob.findUnique({ where: { id: jobId }, include: { project: { include: { user: true } } } });
    const owner = job?.project.user;
    if (!job || !owner || (job.status !== "COMPLETE" && job.status !== "FAILED")) return;
    const appUrl = getServerConfig().APP_URL;
    await logActivity(owner.id, job.status === "COMPLETE" ? "export.complete" : "export.failed", job.project.name);

    if (job.status === "FAILED") {
      await sendEmail(owner.email, "exportFailed", emails.exportFailed({ appUrl, name: owner.name, projectName: job.project.name, message: job.errorMessage ?? "Unknown error", projectId: job.projectId }));
      return;
    }
    const file = job.outputFileId ? await prisma.storedFile.findUnique({ where: { id: job.outputFileId } }) : null;
    const settings = job.settings as { resolution?: string };
    await sendEmail(
      owner.email,
      "exportReady",
      emails.exportReady({
        appUrl,
        name: owner.name,
        projectName: job.project.name,
        fileName: file?.originalName ?? "export.mp4",
        size: file ? formatBytes(file.sizeBytes) : "—",
        resolution: settings.resolution ?? "—",
        projectId: job.projectId,
      }),
    );
  } catch {
    // Notification is best-effort; the export itself already succeeded or failed.
  }
}
