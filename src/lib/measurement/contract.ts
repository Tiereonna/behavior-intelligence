import { z } from "zod";

/**
 * The measurement subsystem: the shared shape every measurement type
 * implements.
 *
 * Behavioral data arrives in units that cannot be compared to each other — a
 * count, a percentage, a number of seconds. Charts and statistics need one
 * comparable number per data point. Each measurement type is therefore a small
 * module that knows how to validate its own inputs and collapse them to a
 * single scalar, and the rest of the application only ever talks to this
 * interface.
 *
 * Adding a seventh measurement type means writing one file and registering it.
 * No migration, no change to the data entry form, no change to the chart.
 *
 * This file is part of the pure layer: no database, no React, no Next.js. The
 * ESLint config enforces that.
 */

// ---------------------------------------------------------------------------
// Domain vocabulary
// ---------------------------------------------------------------------------

/**
 * These unions intentionally duplicate the Prisma enums rather than importing
 * them. The pure layer owns its own vocabulary so it stays independent of the
 * ORM's generated output.
 *
 * They are kept honest by a runtime parity test
 * (tests/measurement/prisma-enum-parity.test.ts) that fails if the two ever
 * drift apart.
 */
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

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when an entry is internally consistent but impossible against its
 * session — 40 minutes of behavior in a 30 minute session, more successes than
 * opportunities.
 *
 * These are data-entry errors rather than clinical states, so they fail loudly
 * instead of being silently clamped. A clamped value looks plausible on a
 * chart forever; a thrown error gets fixed at entry time.
 */
export class MeasurementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeasurementError";
  }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** What the measurement type is told about the session it belongs to. */
export interface SessionContext {
  durationMinutes: number;
}

/**
 * The result of collapsing a raw entry to a single scalar.
 *
 * The three states exist because "no number" is not one situation but three,
 * and treating them alike produces wrong statistics:
 *
 * - VALUE          an ordinary observation.
 * - CENSORED       the true value is beyond the observation window. Latency
 *                  when the behavior never occurred is not zero and is not
 *                  missing — you know it exceeded the session length. `value`
 *                  holds that lower bound.
 * - NOT_APPLICABLE the session happened but this behavior could not be
 *                  measured: no opportunities arose, no antecedent presented.
 */
export type NormalizedValue =
  | { state: "VALUE"; value: number }
  | { state: "CENSORED"; value: number }
  | { state: "NOT_APPLICABLE"; value: null; reason: string };

// ---------------------------------------------------------------------------
// The measurement type interface
// ---------------------------------------------------------------------------

export interface MeasurementTypeDefinition<TConfig, TEntry> {
  key: MeasurementTypeKey;

  /** Shown in the behavior definition form. */
  label: string;

  /** One sentence explaining when a practitioner would choose this type. */
  helpText: string;

  /** The unit of the normalized scalar. Drives axis labels and formatting. */
  unit: MeasurementUnitKey;

  /** Whether normalization divides by session length. */
  requiresSessionDuration: boolean;

  /** Pre-selected direction when defining a behavior; always overridable. */
  defaultDirection: BehaviorDirectionKey;

  /** Settings stored once on the behavior, in `Behavior.measurementConfig`. */
  configSchema: z.ZodType<TConfig>;

  /** Values recorded each session, stored in `Measurement.rawEntry`. */
  entrySchema: z.ZodType<TEntry>;

  /** Collapse one validated entry to the single comparable scalar. */
  normalize(input: {
    entry: TEntry;
    config: TConfig;
    session: SessionContext;
  }): NormalizedValue;

  /** Human-readable rendering of a normalized value, e.g. "4.50/hr". */
  format(value: number): string;
}

/**
 * The registry needs to hold six definitions with six different config and
 * entry types in one map, which generics cannot express directly. This is the
 * type-erased form it stores.
 */
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

/**
 * Wraps a fully typed definition into the erased form.
 *
 * Each type module gets complete inference inside its own `normalize` — no
 * casts, no `unknown` to wrestle with. The two casts needed to erase the types
 * live here and nowhere else, and they are sound because `normalizeMeasurement`
 * always parses through `entrySchema` and `configSchema` before calling
 * `normalize`.
 */
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
