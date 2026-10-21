import { z } from "zod";
import { MeasurementError, defineMeasurementType } from "../contract";

// Percent of intervals scored. WHOLE, PARTIAL, and MOMENTARY use the same math.

const configSchema = z.strictObject({
  intervalLengthSeconds: z.number().int().positive(),
  style: z.enum(["WHOLE", "PARTIAL", "MOMENTARY"]),
});

const entrySchema = z.strictObject({
  intervalsScored: z.number().int().min(0),
  intervalsObserved: z.number().int().min(0),
});

export const intervalType = defineMeasurementType({
  key: "INTERVAL",
  label: "Interval recording (%)",
  helpText:
    "Percentage of observed intervals in which the behavior was scored. Supports whole, partial, and momentary time sampling.",
  unit: "PERCENT",
  requiresSessionDuration: false,
  defaultDirection: "INCREASE",
  configSchema,
  entrySchema,

  normalize({ entry }) {
    if (entry.intervalsObserved === 0) {
      return {
        state: "NOT_APPLICABLE",
        value: null,
        reason: "No intervals were observed during this session.",
      };
    }

    if (entry.intervalsScored > entry.intervalsObserved) {
      throw new MeasurementError(
        `Intervals scored (${entry.intervalsScored}) cannot exceed intervals observed (${entry.intervalsObserved}).`,
      );
    }

    return {
      state: "VALUE",
      value: (entry.intervalsScored / entry.intervalsObserved) * 100,
    };
  },

  format(value) {
    return `${value.toFixed(1)}%`;
  },
});
