import { z } from "zod";
import { defineMeasurementType } from "../contract";

// Raw count. Only lines up across sessions when the sessions are the same length.

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
