import { z } from "zod";
import { MeasurementError, defineMeasurementType } from "../contract";

/**
 * RATE — occurrences per hour.
 *
 * The same count a practitioner records for FREQUENCY, divided by how long
 * they watched. Dividing by session length is what makes sessions of different
 * lengths comparable, which is why this is the right default for most
 * frequency-like behaviors.
 *
 * Per hour rather than per minute purely for readability: most behaviors of
 * clinical interest occur a handful of times an hour, and "4.50/hr" reads
 * better than "0.075/min".
 */

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
