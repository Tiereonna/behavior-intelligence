import { z } from "zod";
import { MeasurementError, defineMeasurementType } from "../contract";

/**
 * LATENCY — seconds from an antecedent to the first occurrence of the
 * behavior.
 *
 * "Latency" is meaningless without saying latency to what, so the antecedent
 * is required configuration rather than an optional note.
 *
 * This is the one measurement type with a real statistical subtlety. When the
 * behavior never occurs during the session, the latency is not zero and it is
 * not missing data — you know it was longer than the observation window. That
 * is right-censoring. Recording it as zero corrupts every mean; dropping the
 * session throws away real information and biases the result optimistically.
 *
 * So a censored point stores the session length as a lower bound and is marked
 * CENSORED. V1 excludes those points from the mean and draws them distinctly
 * on the chart. Handling censoring properly is survival analysis, which is
 * well beyond what this project needs.
 */

const configSchema = z.strictObject({
  /** e.g. "Instruction to begin independent work is delivered." */
  antecedent: z.string().min(1),
});

/**
 * A discriminated union rather than a nullable number, so it is impossible to
 * represent "the behavior did not occur, and also it took 12 seconds."
 */
const entrySchema = z.discriminatedUnion("didNotOccur", [
  z.strictObject({
    didNotOccur: z.literal(false),
    seconds: z.number().min(0),
  }),
  z.strictObject({
    didNotOccur: z.literal(true),
  }),
]);

export const latencyType = defineMeasurementType({
  key: "LATENCY",
  label: "Latency (seconds)",
  helpText:
    "Time from a specified antecedent to the first occurrence of the behavior.",
  unit: "SECONDS",
  requiresSessionDuration: true,
  defaultDirection: "DECREASE",
  configSchema,
  entrySchema,

  normalize({ entry, session }) {
    if (session.durationMinutes <= 0) {
      throw new MeasurementError(
        "Cannot record latency for a session with no duration.",
      );
    }

    const sessionSeconds = session.durationMinutes * 60;

    if (entry.didNotOccur) {
      // All we know is "longer than the session". Store that bound.
      return { state: "CENSORED", value: sessionSeconds };
    }

    if (entry.seconds > sessionSeconds) {
      throw new MeasurementError(
        `Latency (${entry.seconds}s) exceeds session length (${sessionSeconds}s). ` +
          "If the behavior never occurred, record it as did-not-occur instead.",
      );
    }

    return { state: "VALUE", value: entry.seconds };
  },

  format(value) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  },
});
