import "server-only";
import { createCanvas } from "@napi-rs/canvas";
import { logger } from "@/lib/errors/logger.server";
import type { AtlasLayout } from "@/lib/overlay/atlas";
import type { FrameState } from "@/lib/overlay/frame-state";
import type { OverlayElement } from "@/lib/overlay/model";
import { drawElement, type RenderContext } from "@/lib/overlay/render";
import type { FfmpegProcess } from "./process.server";

export interface WriteAtlasFramesInput {
  proc: FfmpegProcess;
  atlas: AtlasLayout;
  elementsById: Map<string, OverlayElement>;
  rc: RenderContext;
  fps: { num: number; den: number };
  framesToWrite: number;
  frameAt: (videoTime: number) => FrameState;
  signal: AbortSignal;
  onFrame: (written: number) => void;
}

/**
 * Renders the atlas canvas once per frame and streams it as raw
 * RGBA to FFmpeg's fd 3, respecting backpressure. Reads pixels via the canvas's straight-alpha
 * `getImageData()` accessor — its premultiplied-alpha counterpart was verified to produce visibly
 * wrong alpha and must not be used here.
 */
export async function writeAtlasFrames(o: WriteAtlasFramesInput): Promise<number> {
  const pipe = o.proc.atlasPipe!;
  const canvas = createCanvas(o.atlas.width, o.atlas.height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  let exited = false;
  void o.proc.exited.then(
    () => {
      exited = true;
    },
    () => {
      exited = true;
    },
  );
  pipe.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EPIPE") logger.warn("export", "atlas pipe error", { err: { message: err.message } });
  });
  const waitDrainOrExit = () =>
    new Promise<void>((resolve) => {
      const done = () => {
        pipe.off("drain", done);
        resolve();
      };
      pipe.once("drain", done);
      o.proc.exited.then(done, done);
    });

  let written = 0;
  for (let k = 0; k < o.framesToWrite && !exited && !o.signal.aborted; k++) {
    const videoTime = (k * o.fps.den) / o.fps.num; // exact rational frame time
    const frame = o.frameAt(videoTime);
    ctx.clearRect(0, 0, o.atlas.width, o.atlas.height);
    for (const slot of o.atlas.slots) {
      const el = o.elementsById.get(slot.elementId)!;
      ctx.save();
      ctx.translate(0, slot.srcY);
      ctx.beginPath();
      ctx.rect(0, 0, slot.width, slot.height);
      ctx.clip();
      ctx.globalAlpha = el.opacity;
      drawElement(ctx, el, slot.width, slot.height, o.rc, frame);
      ctx.restore();
    }
    const img = ctx.getImageData(0, 0, o.atlas.width, o.atlas.height); // straight alpha, not the premultiplied accessor
    const buf = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
    if (!pipe.write(buf)) await waitDrainOrExit();
    written = k + 1;
    o.onFrame(written);
    if ((k & 15) === 15) await new Promise<void>((r) => setImmediate(r)); // keep the server responsive
  }
  pipe.end();
  return written;
}
