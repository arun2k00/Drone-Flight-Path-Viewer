import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBody, readJsonBody, runRoute } from "@/lib/errors/route.server";

const post = (body: string) => new Request("http://localhost/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body });
const handle = (req: Request) => runRoute(async () => Response.json(parseBody(z.object({ name: z.string() }), await readJsonBody(req))));

describe("readJsonBody", () => {
  it("answers a malformed JSON body with 400 VALIDATION_FAILED, not a 500", async () => {
    const res = await handle(post("{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_FAILED");
  });

  it("passes a valid body through to the schema", async () => {
    const res = await handle(post('{"name":"Survey"}'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: "Survey" });
  });
});
