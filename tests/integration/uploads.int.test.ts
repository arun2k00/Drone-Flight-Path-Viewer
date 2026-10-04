import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { createProject } from "@/lib/projects/service.server";
import { completeUpload, initUpload, putChunk } from "@/lib/uploads/service.server";

const body = (text: string) => new Blob([text]).stream();

describe("chunked uploads", () => {
  it("a superseded upload reads as not found instead of failing its next chunk as too large", async () => {
    const project = await createProject({ name: "Uploads" });
    const srt = "1\n00:00:00,000 --> 00:00:01,000\n[latitude: 17.4] [longitude: 78.4]\n";
    const first = await initUpload(project.id, { role: "TELEMETRY", fileName: "a.srt", sizeBytes: srt.length });
    const second = await initUpload(project.id, { role: "TELEMETRY", fileName: "b.srt", sizeBytes: srt.length });

    for (const p of [putChunk(first.id, 0, srt.length, body(srt)), completeUpload(first.id)]) {
      const err = await p.catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("UPLOAD_NOT_FOUND");
    }

    expect(await putChunk(second.id, 0, srt.length, body(srt))).toBe(srt.length);
    expect((await completeUpload(second.id)).originalName).toBe("b.srt");
  });
});
