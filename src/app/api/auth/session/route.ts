import { authenticate, registerUser } from "@/lib/auth/service.server";
import { destroySession } from "@/lib/auth/session.server";

/**
 * JSON sign-in for scripts and API clients (the e2e test, curl). Browsers use the /login and /signup forms.
 * POST { email, password } logs in; POST { name, email, password } signs up. DELETE logs out.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: { code: "VALIDATION_FAILED", message: "Send a JSON body." } }, { status: 400 });
  const failure = "name" in body ? await registerUser(body) : await authenticate(body);
  if (failure) return Response.json({ error: { code: "AUTH_FAILED", message: failure.error ?? "Some fields are invalid.", details: failure.fieldErrors ?? null } }, { status: 401 });
  return new Response(null, { status: 204 });
}

export async function DELETE() {
  await destroySession();
  return new Response(null, { status: 204 });
}
