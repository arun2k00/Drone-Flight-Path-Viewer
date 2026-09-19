import { bracketStrategy } from "./bracket";
import { genericStrategy } from "./generic";
import { inlineStrategy } from "./inline";
import type { ParserStrategy } from "./types";

export type { ExtractedField, ExtractedRecord, ParserStrategy, StrategyContext } from "./types";
export { bracketStrategy, genericStrategy, inlineStrategy };

/** Tie-break order when two strategies score equally. */
export const STRATEGIES: ParserStrategy[] = [bracketStrategy, inlineStrategy, genericStrategy];
