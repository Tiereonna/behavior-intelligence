import { z } from "zod";
import { defineMeasurementType } from "../contract";

/**
 * FREQUENCY — a raw count of occurrences.
 *
 * The simplest measurement system, and the easiest to misuse. A raw count is
 * only comparable across sessions when the sessions are the same length: nine
 * occurrences in twenty minutes and nine in three hours are very different
 * facts that plot as the same dot.
 *
 * It stays available because equal-length sessions are common (a fixed 30
 * minute session, a single class period) and practitioners think in counts.
 * When session lengths vary, RATE is the correct choice, and a later milestone
 * will surface that as a hint on the chart rather than silently letting the
 * data mislead.
 */

const configSchema = z.strictObject({});

const entrySchema = z.strictObject({
  count: z.number().int().min(0),
});

export const frequencyType = defineMeasurementType({
  key: "FREQUENCY",
  label: "Frequency (count)",
  helpText:
    "A raw count of occurrences. Best when every session is the same length.",
  unit: "COUNT",
  requiresSessionDuration: false,
  defaultDirection: "DECREASE",
  configSchema,
  entrySchema,

  normalize({ entry }) {
    return { state: "VALUE", value: entry.count };
  },

  format(value) {
    return String(value);
  },
});
