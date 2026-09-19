export interface FfmpegProgress {
  frame: number | null;
  outTimeSec: number | null;
  fps: number | null;
  speed: number | null;
  done: boolean;
}

function parseNumber(v: string | undefined): number | null {
  if (v === undefined || v === "N/A") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Feed raw `-progress pipe:1` stdout text; emits one FfmpegProgress per completed block. */
export class FfmpegProgressParser {
  private buffer = "";
  private block: Record<string, string> = {};

  push(chunk: string): FfmpegProgress[] {
    this.buffer += chunk;
    const results: FfmpegProgress[] = [];
    let i: number;
    while ((i = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, i).trim();
      this.buffer = this.buffer.slice(i + 1);
      if (!line) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq);
      const value = line.slice(eq + 1);
      this.block[key] = value;
      if (key === "progress") {
        results.push(this.finishBlock(value === "end"));
      }
    }
    return results;
  }

  private finishBlock(done: boolean): FfmpegProgress {
    const b = this.block;
    this.block = {};
    const outTimeUs = parseNumber(b.out_time_us);
    const outTimeMs = parseNumber(b.out_time_ms);
    const rawSec = outTimeUs !== null ? outTimeUs / 1e6 : outTimeMs !== null ? outTimeMs / 1e6 : null;
    const outTimeSec = rawSec === null ? null : Math.max(0, rawSec);
    const speedStr = b.speed;
    const speed = speedStr === undefined || speedStr === "N/A" ? null : parseNumber(speedStr.replace(/x$/, ""));
    return {
      frame: parseNumber(b.frame),
      outTimeSec,
      fps: parseNumber(b.fps),
      speed,
      done,
    };
  }
}
