import type {
  ErasedMeasurementTypeDefinition,
  MeasurementTypeKey,
} from "./contract";
import { durationType } from "./types/duration";
import { frequencyType } from "./types/frequency";
import { intervalType } from "./types/interval";
import { latencyType } from "./types/latency";
import { percentageType } from "./types/percentage";
import { rateType } from "./types/rate";

/**
 * Every measurement type the application knows about.
 *
 * This map is the reason there is no `measurement_types` database table. A
 * measurement type is not data — it carries behavior (a validation schema, a
 * normalization function, a formatter), and that has to live in code. A table
 * would be a second source of truth that must be kept in sync, and drift
 * between them would produce silently wrong numbers.
 *
 * Adding a type: write the module, add one line here, add one value to the
 * Prisma enum. Nothing else changes.
 */
export const MEASUREMENT_TYPES: Record<
  MeasurementTypeKey,
  ErasedMeasurementTypeDefinition
> = {
  FREQUENCY: frequencyType,
  RATE: rateType,
  DURATION: durationType,
  PERCENTAGE: percentageType,
  LATENCY: latencyType,
  INTERVAL: intervalType,
};

export const MEASUREMENT_TYPE_KEYS = Object.keys(
  MEASUREMENT_TYPES,
) as MeasurementTypeKey[];

export function getMeasurementType(
  key: MeasurementTypeKey,
): ErasedMeasurementTypeDefinition {
  const definition = MEASUREMENT_TYPES[key];

  if (!definition) {
    throw new Error(`Unknown measurement type: ${key}`);
  }

  return definition;
}
