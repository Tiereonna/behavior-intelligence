import { describe, expect, it } from "vitest";
import { MeasurementError, normalizeMeasurement } from "@/lib/measurement";

const base = {
  measurementType: "RATE" as const,
  measurementConfig: {},
};

describe("RATE", () => {
  it("converts a count and session length to occurrences per hour", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { count: 9 },
      session: { durationMinutes: 120 },
    });

    expect(result.normalizedValue).toBeCloseTo(4.5);
    expect(result.unit).toBe("PER_HOUR");
  });

  it("makes unequal session lengths comparable", () => {
    const short = normalizeMeasurement({
      ...base,
      rawEntry: { count: 3 },
      session: { durationMinutes: 30 },
    });
    const long = normalizeMeasurement({
      ...base,
      rawEntry: { count: 12 },
      session: { durationMinutes: 120 },
    });

    // Same underlying rate despite a four-fold difference in raw counts.
    expect(short.normalizedValue).toBeCloseTo(6);
    expect(long.normalizedValue).toBeCloseTo(6);
  });

  it("handles sessions shorter than an hour", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { count: 2 },
      session: { durationMinutes: 20 },
    });

    expect(result.normalizedValue).toBeCloseTo(6);
  });

  it("throws on a zero-duration session rather than returning Infinity", () => {
    expect(() =>
      normalizeMeasurement({
        ...base,
        rawEntry: { count: 4 },
        session: { durationMinutes: 0 },
      }),
    ).toThrow(MeasurementError);
  });

  it("returns zero for a session with no occurrences", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { count: 0 },
      session: { durationMinutes: 45 },
    });

    expect(result.normalizedValue).toBe(0);
    expect(result.valueState).toBe("VALUE");
  });
});
