import { describe, expect, it } from "vitest";
import { normalizeMeasurement } from "@/lib/measurement";

const base = {
  measurementType: "FREQUENCY" as const,
  measurementConfig: {},
  session: { durationMinutes: 60 },
};

describe("FREQUENCY", () => {
  it("passes the count through unchanged", () => {
    const result = normalizeMeasurement({ ...base, rawEntry: { count: 9 } });

    expect(result.normalizedValue).toBe(9);
    expect(result.valueState).toBe("VALUE");
    expect(result.unit).toBe("COUNT");
  });

  it("treats zero as a real observation, not missing data", () => {
    const result = normalizeMeasurement({ ...base, rawEntry: { count: 0 } });

    expect(result.normalizedValue).toBe(0);
    expect(result.valueState).toBe("VALUE");
  });

  it("ignores session duration", () => {
    const short = normalizeMeasurement({
      ...base,
      rawEntry: { count: 5 },
      session: { durationMinutes: 15 },
    });
    const long = normalizeMeasurement({
      ...base,
      rawEntry: { count: 5 },
      session: { durationMinutes: 240 },
    });

    // Identical output from very different observation windows is exactly why
    // RATE exists and why frequency is only safe with equal-length sessions.
    expect(short.normalizedValue).toBe(long.normalizedValue);
  });

  it("rejects a negative count", () => {
    expect(() =>
      normalizeMeasurement({ ...base, rawEntry: { count: -1 } }),
    ).toThrow();
  });

  it("rejects a fractional count", () => {
    expect(() =>
      normalizeMeasurement({ ...base, rawEntry: { count: 2.5 } }),
    ).toThrow();
  });

  it("rejects a misspelled key instead of silently storing it", () => {
    // This is the guard that makes the JSON rawEntry column trustworthy.
    expect(() =>
      normalizeMeasurement({ ...base, rawEntry: { cont: 9 } }),
    ).toThrow();
  });
});
