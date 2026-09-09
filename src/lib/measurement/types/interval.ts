import { z } from "zod";
import { MeasurementError, defineMeasurementType } from "../contract";

/**
 * INTERVAL — percentage of observed intervals in which the behavior was
 * scored.
 *
 * One type covers all three interval recording systems, because they differ
 * only in the instruction given to the observer, not in the arithmetic:
 *
 * - WHOLE      score the interval only if the behavior occurred throughout.
 *              Systematically UNDERestimates.
 * - PARTIAL    score the interval if the behavior occurred at any point.
 *              Systematically OVERestimates.
 * - MOMENTARY  score the interval based only on the instant it ends. The least
 *              biased of the three and the usual choice for time sampling.
 *
 * The style is stored so the chart can label it and so two behaviors recorded
 * with different styles are never silently compared as equivalent — a 60%
 * partial-interval score and a 60% whole-interval score describe quite
 * different amounts of behavior.
 */

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
