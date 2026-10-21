import { z } from "zod";

// Same values as the Prisma enums. prisma-enum-parity.test.ts fails if they drift.
export type MeasurementTypeKey =
  | "FREQUENCY"
  | "RATE"
  | "DURATION"
  | "PERCENTAGE"
  | "LATENCY"
  | "INTERVAL";

export type MeasurementUnitKey = "COUNT" | "PER_HOUR" | "PERCENT" | "SECONDS";

export type ValueStateKey = "VALUE" | "CENSORED" | "NOT_APPLICABLE";

export type BehaviorDirectionKey = "INCREASE" | "DECREASE";

// Impossible entry, like more behavior-seconds than the session. Not clamped.
export class MeasurementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeasurementError";
  }
}

export interface SessionContext {
  durationMinutes: number;
}

// CENSORED is a lower bound (latency that ran out the session), not a zero.
// NOT_APPLICABLE means there was nothing to score.
export type NormalizedValue =
  | { state: "VALUE"; value: number }
  | { state: "CENSORED"; value: number }
  | { state: "NOT_APPLICABLE"; value: null; reason: string };

export interface MeasurementTypeDefinition<TConfig, TEntry> {
  key: MeasurementTypeKey;

  label: string;

  helpText: string;

  unit: MeasurementUnitKey;

  requiresSessionDuration: boolean;

  defaultDirection: BehaviorDirectionKey;

  configSchema: z.ZodType<TConfig>;

  entrySchema: z.ZodType<TEntry>;

  normalize(input: {
    entry: TEntry;
    config: TConfig;
    session: SessionContext;
  }): NormalizedValue;

  format(value: number): string;
}

export interface ErasedMeasurementTypeDefinition {
  key: MeasurementTypeKey;
  label: string;
  helpText: string;
  unit: MeasurementUnitKey;
  requiresSessionDuration: boolean;
  defaultDirection: BehaviorDirectionKey;
  configSchema: z.ZodType<unknown>;
  entrySchema: z.ZodType<unknown>;
  normalize(input: {
    entry: unknown;
    config: unknown;
    session: SessionContext;
  }): NormalizedValue;
  format(value: number): string;
}

export function defineMeasurementType<TConfig, TEntry>(
  definition: MeasurementTypeDefinition<TConfig, TEntry>,
): ErasedMeasurementTypeDefinition {
  return {
    key: definition.key,
    label: definition.label,
    helpText: definition.helpText,
    unit: definition.unit,
    requiresSessionDuration: definition.requiresSessionDuration,
    defaultDirection: definition.defaultDirection,
    configSchema: definition.configSchema as z.ZodType<unknown>,
    entrySchema: definition.entrySchema as z.ZodType<unknown>,
    normalize: ({ entry, config, session }) =>
      definition.normalize({
        entry: entry as TEntry,
        config: config as TConfig,
        session,
      }),
    format: definition.format,
  };
}
