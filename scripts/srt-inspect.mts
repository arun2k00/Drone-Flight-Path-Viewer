import fs from "node:fs";
import { parseTelemetry } from "../src/lib/telemetry/parser";
import { DEFAULT_TELEMETRY_SETTINGS } from "../src/types/telemetry";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npm run srt:inspect -- <path/to/file.SRT>");
  process.exit(1);
}

const bytes = fs.readFileSync(filePath);

try {
  const parsed = parseTelemetry(new Uint8Array(bytes), { coordinateOrder: DEFAULT_TELEMETRY_SETTINGS.coordinateOrder });
  console.log(`Parser: ${parsed.report.parserId} v${parsed.report.parserVersion}`);
  console.log(`Encoding: ${parsed.report.encoding}`);
  console.log(
    `Cues: ${parsed.report.totalCues} total, ${parsed.report.parsedRecords} parsed, ${parsed.report.ignoredCues} ignored, ${parsed.report.invalidRecords} invalid`,
  );
  console.log(`Coordinate order: ${parsed.report.coordinateOrder}`);

  if (Object.keys(parsed.report.issueCounts).length > 0) {
    console.log("Issue counts:");
    for (const [code, count] of Object.entries(parsed.report.issueCounts)) console.log(`  ${code}: ${count}`);
  }
  if (parsed.summary.warnings.length > 0) {
    console.log("Warnings:");
    for (const w of parsed.summary.warnings) console.log(`  [${w.code}] ${w.message}`);
  }
  if (parsed.report.unknownKeys.length > 0) {
    console.log(`Unknown keys: ${parsed.report.unknownKeys.join(", ")}`);
  }
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
