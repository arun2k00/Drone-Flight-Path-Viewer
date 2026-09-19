import { z } from "zod";
import { parseBody, runRoute } from "@/lib/errors/route.server";
import { logActivity } from "@/lib/activity.server";
import { requireUser } from "@/lib/auth/session.server";
import { createProject, listProjects } from "@/lib/projects/service.server";

const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  companyName: z.string().max(120).optional(),
});

export async function GET() {
  return runRoute(async () => {
    const projects = await listProjects((await requireUser()).id);
    return Response.json({ projects });
  });
}

export async function POST(req: Request) {
  return runRoute(async () => {
    const user = await requireUser();
    const body = parseBody(createProjectSchema, await req.json());
    const project = await createProject({ ...body, userId: user.id });
    await logActivity(user.id, "project.create", project.name);
    return Response.json({ project }, { status: 201 });
  });
}
