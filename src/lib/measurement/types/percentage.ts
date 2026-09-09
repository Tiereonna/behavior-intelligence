import { z } from "zod";
import { MeasurementError, defineMeasurementType } from "../contract";

/**
 * PERCENTAGE — successes out of opportunities.
 *
 * The standard system for skill acquisition: correct responses out of trials
 * presented, independent steps out of steps in a task analysis.
 *
 * The interesting case is a denominator of zero. That is not an error and it
 * is not a score of zero — it means the opportunity never came up, so there is
 * nothing to report. Recording it as 0% would drag the mean down and make a
 * learner look like they were failing on a day they were never asked.
 */

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
