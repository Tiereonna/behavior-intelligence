import { describe, expect, it } from "vitest";
import { MeasurementError, normalizeMeasurement } from "@/lib/measurement";

const base = {
  measurementType: "PERCENTAGE" as const,
  measurementConfig: {},
  session: { durationMinutes: 60 },
};

describe("PERCENTAGE", () => {
  it("computes successes over opportunities", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { numerator: 8, denominator: 10 },
    });

    expect(result.normalizedValue).toBeCloseTo(80);
    expect(result.valueState).toBe("VALUE");
  });

  it("distinguishes zero successes from no opportunities", () => {
    const zeroSuccesses = normalizeMeasurement({
      ...base,
      rawEntry: { numerator: 0, denominator: 10 },
    });
    const noOpportunities = normalizeMeasurement({
      ...base,
      rawEntry: { numerator: 0, denominator: 0 },
    });

    // Asked ten times and got none right is a real 0%.
    expect(zeroSuccesses.valueState).toBe("VALUE");
    expect(zeroSuccesses.normalizedValue).toBe(0);

    // Never asked is not a score at all. Recording it as 0% would drag the
    // mean down on a day the learner was never given a chance.
    expect(noOpportunities.valueState).toBe("NOT_APPLICABLE");
    expect(noOpportunities.normalizedValue).toBeNull();
  });

  it("throws when successes exceed opportunities", () => {
    expect(() =>
      normalizeMeasurement({
        ...base,
        rawEntry: { numerator: 11, denominator: 10 },
      }),
    ).toThrow(MeasurementError);
  });

  it("rejects fractional trial counts", () => {
    expect(() =>
      normalizeMeasurement({
        ...base,
        rawEntry: { numerator: 1.5, denominator: 10 },
      }),
    ).toThrow();
  });

  it("ignores session duration", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { numerator: 3, denominator: 4 },
      session: { durationMinutes: 5 },
    });

    expect(result.normalizedValue).toBeCloseTo(75);
  });
});
