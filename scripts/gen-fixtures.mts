import fs from "node:fs";
import path from "node:path";
import { generateSrt } from "../tests/helpers/synthetic-srt";
import { generateSyntheticVideo } from "../tests/helpers/synthetic-video";

const OUT = path.join(process.cwd(), "tests", "fixtures", "generated");
fs.mkdirSync(OUT, { recursive: true });

const DURATION_SEC = 12;
const FPS = { num: 30000, den: 1001 };

async function main() {
  const videoPath = path.join(OUT, "e2e.mp4");
  console.log(`Generating ${videoPath} ...`);
  await generateSyntheticVideo(videoPath, {
    width: 1920,
    height: 1080,
    fps: `${FPS.num}/${FPS.den}`,
    durationSec: DURATION_SEC,
    withAudio: true,
  });

  const srtPath = path.join(OUT, "e2e.SRT");
  console.log(`Generating ${srtPath} ...`);
  const srt = generateSrt({
    durationSec: DURATION_SEC,
    fps: FPS,
    center: { latitude: 17.385044, longitude: 78.486671 },
    radiusM: 60,
    lapSec: 24,
    relAlt: [30, 60],
    absAltOffset: 480,
    gpsUpdateHz: 10,
    noFixFrames: 5,
    format: "air3s",
    startWallClock: "2026-05-27 13:14:22.911",
  });
  fs.writeFileSync(srtPath, srt, "utf8");

  console.log("Done.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
