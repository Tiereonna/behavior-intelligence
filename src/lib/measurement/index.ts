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

export interface NormalizedMeasurement {
  measurementType: MeasurementTypeKey;
  rawEntry: unknown;
  // null only when valueState is NOT_APPLICABLE
  normalizedValue: number | null;
  valueState: ValueStateKey;
  unit: MeasurementUnitKey;
}

// Rejects a bad shape (strictObject) before anything is stored.
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
