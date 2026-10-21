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
