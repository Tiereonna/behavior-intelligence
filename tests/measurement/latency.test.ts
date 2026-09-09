import { describe, expect, it } from "vitest";
import {
  MeasurementError,
  formatMeasurement,
  normalizeMeasurement,
} from "@/lib/measurement";

const base = {
  measurementType: "LATENCY" as const,
  measurementConfig: { antecedent: "Instruction to begin work is delivered." },
};

describe("LATENCY", () => {
  it("records seconds to first occurrence", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { didNotOccur: false, seconds: 42 },
      session: { durationMinutes: 30 },
    });

    expect(result.normalizedValue).toBe(42);
    expect(result.valueState).toBe("VALUE");
    expect(result.unit).toBe("SECONDS");
  });

  it("marks a non-occurrence as censored at the session length", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { didNotOccur: true },
      session: { durationMinutes: 30 },
    });

    // Not zero and not missing: all that is known is "longer than 1800s".
    expect(result.valueState).toBe("CENSORED");
    expect(result.normalizedValue).toBe(1800);
  });

  it("displays a censored value as a lower bound", () => {
    expect(
      formatMeasurement({
        measurementType: "LATENCY",
        normalizedValue: 1800,
        valueState: "CENSORED",
      }),
    ).toBe(">30:00");

    expect(
      formatMeasurement({
        measurementType: "LATENCY",
        normalizedValue: 1800,
        valueState: "VALUE",
      }),
    ).toBe("30:00");
  });

  it("requires an antecedent, since latency to nothing is meaningless", () => {
    expect(() =>
      normalizeMeasurement({
        measurementType: "LATENCY",
        measurementConfig: {},
        rawEntry: { didNotOccur: false, seconds: 10 },
        session: { durationMinutes: 30 },
      }),
    ).toThrow();
  });

  it("cannot represent both a non-occurrence and a duration", () => {
    // The discriminated union makes this state unrepresentable rather than
    // relying on a convention nobody remembers.
    expect(() =>
      normalizeMeasurement({
        ...base,
        rawEntry: { didNotOccur: true, seconds: 12 },
        session: { durationMinutes: 30 },
      }),
    ).toThrow();
  });

  it("rejects a latency longer than the session", () => {
    expect(() =>
      normalizeMeasurement({
        ...base,
        rawEntry: { didNotOccur: false, seconds: 2000 },
        session: { durationMinutes: 30 },
      }),
    ).toThrow(MeasurementError);
  });

  it("accepts an immediate response", () => {
    const result = normalizeMeasurement({
      ...base,
      rawEntry: { didNotOccur: false, seconds: 0 },
      session: { durationMinutes: 30 },
    });

    expect(result.normalizedValue).toBe(0);
    expect(result.valueState).toBe("VALUE");
  });
});
