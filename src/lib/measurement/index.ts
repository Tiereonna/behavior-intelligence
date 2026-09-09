import type {
  MeasurementTypeKey,
  MeasurementUnitKey,
  SessionContext,
  ValueStateKey,
} from "./contract";
import { getMeasurementType } from "./registry";

export {
  MeasurementError,
  defineMeasurementType,
  type BehaviorDirectionKey,
  type ErasedMeasurementTypeDefinition,
  type MeasurementTypeDefinition,
  type MeasurementTypeKey,
  type MeasurementUnitKey,
  type NormalizedValue,
  type SessionContext,
  type ValueStateKey,
} from "./contract";

export {
  MEASUREMENT_TYPES,
  MEASUREMENT_TYPE_KEYS,
  getMeasurementType,
} from "./registry";

/**
 * Exactly the columns a `measurements` row needs, derived from one raw entry.
 */
export interface NormalizedMeasurement {
  measurementType: MeasurementTypeKey;
  /** The validated entry, ready to store in the `rawEntry` JSON column. */
  rawEntry: unknown;
  /** Null only when `valueState` is NOT_APPLICABLE. */
  normalizedValue: number | null;
  valueState: ValueStateKey;
  unit: MeasurementUnitKey;
}

/**
 * The single path from a practitioner's raw input to a storable measurement.
 *
 * This function is what makes the JSON `rawEntry` column safe. Storing
 * arbitrary JSON is only defensible if nothing can write an unvalidated shape
 * into it, so every caller — the session service, the seed script, any future
 * importer — goes through here, and nothing constructs a measurement row by
 * hand.
 *
 * `strictObject` in each entry schema means a typo like `{ cont: 5 }` is
 * rejected rather than quietly stored as an entry with no count.
 */
export function normalizeMeasurement(input: {
  measurementType: MeasurementTypeKey;
  rawEntry: unknown;
  measurementConfig: unknown;
  session: SessionContext;
}): NormalizedMeasurement {
  const definition = getMeasurementType(input.measurementType);

  const config = definition.configSchema.parse(input.measurementConfig);
  const entry = definition.entrySchema.parse(input.rawEntry);

  const normalized = definition.normalize({
    entry,
    config,
    session: input.session,
  });

  return {
    measurementType: input.measurementType,
    rawEntry: entry,
    normalizedValue: normalized.value,
    valueState: normalized.state,
    unit: definition.unit,
  };
}

/**
 * Render a stored measurement for display, respecting its value state.
 */
export function formatMeasurement(input: {
  measurementType: MeasurementTypeKey;
  normalizedValue: number | null;
  valueState: ValueStateKey;
}): string {
  const definition = getMeasurementType(input.measurementType);

  if (input.valueState === "NOT_APPLICABLE" || input.normalizedValue === null) {
    return "n/a";
  }

  const formatted = definition.format(input.normalizedValue);

  // The ">" is load-bearing: a censored latency of 30:00 means "at least 30
  // minutes", and displaying it as a plain 30:00 would be a lie.
  return input.valueState === "CENSORED" ? `>${formatted}` : formatted;
}
