import type { ParserId, TelemetrySettings } from "@/types/telemetry";
import type { ExtractedDate } from "./common";

export interface ExtractedField {
  key: string; // as written, e.g. "rel_alt"
  raw: string;
}

export interface ExtractedRecord {
  fields: ExtractedField[]; // generic key/values (bracket, generic) or synthesized keys (inline)
  frameIndex: number | null;
  recordedAt: ExtractedDate | null;
}

export interface StrategyContext {
  coordinateOrder: "named" | "lat-lon" | "lon-lat";
  orderAssumed: boolean;
}

export interface ParserStrategy {
  id: ParserId;
  version: number;
  /** Fraction (0..1) of sample payloads this strategy recognizes, weighted. */
  detect(samplePayloads: string[]): number;
  /** File-level preparation (e.g. GPS tuple order). */
  prepare(allPayloads: string[], settings: Pick<TelemetrySettings, "coordinateOrder">): StrategyContext;
  extract(payload: string, ctx: StrategyContext): ExtractedRecord;
}
