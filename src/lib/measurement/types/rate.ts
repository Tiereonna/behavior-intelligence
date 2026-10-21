import { z } from "zod";
import { MeasurementError, defineMeasurementType } from "../contract";

// Count divided by session length, in occurrences per hour.

const configSchema = z.strictObject({});

const entrySchema = z.strictObject({
  count: z.number().int().min(0),
});

export const rateType = defineMeasurementType({
  key: "RATE",
  label: "Rate (per hour)",
  helpText:
    "Occurrences per hour. Use when session lengths vary, which is most of the time.",
  unit: "PER_HOUR",
  requiresSessionDuration: true,
  defaultDirection: "DECREASE",
  configSchema,
  entrySchema,

  normalize({ entry, session }) {
    if (session.durationMinutes <= 0) {
      // A session with no duration cannot produce a rate. Rather than emitting
      // Infinity and poisoning every downstream mean, fail here.
      throw new MeasurementError(
        "Cannot compute a rate for a session with no duration.",
      );
    }

    const hours = session.durationMinutes / 60;
    return { state: "VALUE", value: entry.count / hours };
  },

  format(value) {
    return `${value.toFixed(2)}/hr`;
  },
});
