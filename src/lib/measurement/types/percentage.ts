import { z } from "zod";
import { MeasurementError, defineMeasurementType } from "../contract";

// Successes out of opportunities. A zero denominator is not a score of 0.

const configSchema = z.strictObject({});

const entrySchema = z.strictObject({
  numerator: z.number().int().min(0),
  denominator: z.number().int().min(0),
});

export const percentageType = defineMeasurementType({
  key: "PERCENTAGE",
  label: "Percentage of opportunities",
  helpText:
    "Successes out of opportunities presented, such as correct responses per trial.",
  unit: "PERCENT",
  requiresSessionDuration: false,
  defaultDirection: "INCREASE",
  configSchema,
  entrySchema,

  normalize({ entry }) {
    if (entry.denominator === 0) {
      return {
        state: "NOT_APPLICABLE",
        value: null,
        reason: "No opportunities occurred during this session.",
      };
    }

    if (entry.numerator > entry.denominator) {
      throw new MeasurementError(
        `Successes (${entry.numerator}) cannot exceed opportunities (${entry.denominator}).`,
      );
    }

    return {
      state: "VALUE",
      value: (entry.numerator / entry.denominator) * 100,
    };
  },

  format(value) {
    return `${value.toFixed(1)}%`;
  },
});
