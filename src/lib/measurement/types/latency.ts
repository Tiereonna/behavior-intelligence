import { z } from "zod";
import { MeasurementError, defineMeasurementType } from "../contract";

// If the behavior never happens, that is CENSORED (at least the session length), not zero.

const configSchema = z.strictObject({
  /** e.g. "Instruction to begin independent work is delivered." */
  antecedent: z.string().min(1),
});

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
