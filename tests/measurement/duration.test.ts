import { describe, expect, it } from "vitest";
import { MeasurementError, normalizeMeasurement } from "@/lib/measurement";

const base = {
  measurementType: "DURATION" as const,
  measurementConfig: {},
};

describe("DURATION", () => {
  it("converts seconds to a percentage of session length", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { seconds: 900 },
      session: { durationMinutes: 60 },
    });

    expect(result.normalizedValue).toBeCloseTo(25);
    expect(result.unit).toBe("PERCENT");
  });

  it("reports a full session as 100 percent", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { seconds: 1800 },
      session: { durationMinutes: 30 },
    });

    expect(result.normalizedValue).toBeCloseTo(100);
  });

  it("keeps the raw seconds so a total-time view can be added later", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { seconds: 450 },
      session: { durationMinutes: 30 },
    });

    expect(result.rawEntry).toEqual({ seconds: 450 });
  });

  it("throws when recorded duration exceeds the session", () => {
    // Clamping to 100% would hide the mistake behind a plausible dot.
    expect(() =>
      normalizeMeasurement({
        ...base,
        rawEntry: { seconds: 3600 },
        session: { durationMinutes: 30 },
      }),
    ).toThrow(MeasurementError);
  });

  it("throws on a zero-duration session", () => {
    expect(() =>
      normalizeMeasurement({
        ...base,
        rawEntry: { seconds: 0 },
        session: { durationMinutes: 0 },
      }),
    ).toThrow(MeasurementError);
  });

  it("accepts fractional seconds", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { seconds: 90.5 },
      session: { durationMinutes: 10 },
    });

    expect(result.normalizedValue).toBeCloseTo(15.083, 2);
  });
});
