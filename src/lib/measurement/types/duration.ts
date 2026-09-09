import { z } from "zod";
import { MeasurementError, defineMeasurementType } from "../contract";

/**
 * DURATION — total time the behavior occurred, as a percentage of the session.
 *
 * Used when how long a behavior lasts matters more than how often it starts:
 * tantrums, sustained engagement, time out of seat.
 *
 * The raw seconds are kept in `rawEntry` even though the normalized value is a
 * percentage, so a "total minutes" view can be added later without a
 * migration and without recomputing anything.
 */

const configSchema = z.strictObject({});

const entrySchema = z.strictObject({
  seconds: z.number().min(0),
});

export const durationType = defineMeasurementType({
  key: "DURATION",
  label: "Duration (% of session)",
  helpText:
    "Total time the behavior occurred, reported as a percentage of session length.",
  unit: "PERCENT",
  requiresSessionDuration: true,
  defaultDirection: "DECREASE",
  configSchema,
  entrySchema,

  normalize({ entry, session }) {
    if (session.durationMinutes <= 0) {
      throw new MeasurementError(
        "Cannot compute a duration percentage for a session with no duration.",
      );
    }

    const sessionSeconds = session.durationMinutes * 60;

    if (entry.seconds > sessionSeconds) {
      // Clamping to 100% here would hide a real data-entry mistake behind a
      // plausible-looking dot that nobody ever questions again.
      throw new MeasurementError(
        `Recorded duration (${entry.seconds}s) exceeds session length (${sessionSeconds}s).`,
      );
    }

    return { state: "VALUE", value: (entry.seconds / sessionSeconds) * 100 };
  },

  format(value) {
    return `${value.toFixed(1)}%`;
  },
});
