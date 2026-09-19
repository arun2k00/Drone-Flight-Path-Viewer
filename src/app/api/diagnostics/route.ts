import { runDiagnostics } from "@/lib/diagnostics/checks.server";
import { requireAdmin } from "@/lib/auth/session.server";
import { runRoute } from "@/lib/errors/route.server";

export async function GET() {
  return runRoute(async () => {
    await requireAdmin();
    const checks = await runDiagnostics();
    return Response.json({ checks });
  });
}
