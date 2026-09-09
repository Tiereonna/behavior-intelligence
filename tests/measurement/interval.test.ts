import { describe, expect, it } from "vitest";
import { MeasurementError, normalizeMeasurement } from "@/lib/measurement";

const config = {
  intervalLengthSeconds: 60,
  style: "MOMENTARY" as const,
};

const base = {
  measurementType: "INTERVAL" as const,
  measurementConfig: config,
  session: { durationMinutes: 60 },
};

describe("INTERVAL", () => {
  it("computes the percentage of intervals scored", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { intervalsScored: 34, intervalsObserved: 60 },
    });

    expect(result.normalizedValue).toBeCloseTo(56.67, 1);
    expect(result.unit).toBe("PERCENT");
  });

  it("normalizes all three styles identically", () => {
    const entry = { intervalsScored: 30, intervalsObserved: 60 };
    const styles = ["WHOLE", "PARTIAL", "MOMENTARY"] as const;

    const values = styles.map(
      (style) =>
        normalizeMeasurement({
          ...base,
          measurementConfig: { ...config, style },
          rawEntry: entry,
        }).normalizedValue,
    );

    // The styles differ in what the observer is told to score, not in the
    // arithmetic — which is why one implementation covers all three. The style
    // is still stored, because a 50% partial-interval score and a 50%
    // whole-interval score describe different amounts of behavior.
    expect(new Set(values).size).toBe(1);
    expect(values[0]).toBeCloseTo(50);
  });

  it("treats no observed intervals as not applicable", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { intervalsScored: 0, intervalsObserved: 0 },
    });

    expect(result.valueState).toBe("NOT_APPLICABLE");
    expect(result.normalizedValue).toBeNull();
  });

  it("distinguishes a genuine zero from no observation", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { intervalsScored: 0, intervalsObserved: 60 },
    });

    expect(result.valueState).toBe("VALUE");
    expect(result.normalizedValue).toBe(0);
  });

  it("throws when more intervals are scored than observed", () => {
    expect(() =>
      normalizeMeasurement({
        ...base,
        rawEntry: { intervalsScored: 61, intervalsObserved: 60 },
      }),
    ).toThrow(MeasurementError);
  });

  it("requires a positive interval length", () => {
    expect(() =>
      normalizeMeasurement({
        ...base,
        measurementConfig: { intervalLengthSeconds: 0, style: "MOMENTARY" },
        rawEntry: { intervalsScored: 1, intervalsObserved: 2 },
      }),
    ).toThrow();
  });

  it("rejects an unknown style", () => {
    expect(() =>
      normalizeMeasurement({
        ...base,
        measurementConfig: { intervalLengthSeconds: 60, style: "OCCASIONAL" },
        rawEntry: { intervalsScored: 1, intervalsObserved: 2 },
      }),
    ).toThrow();
  });
});
