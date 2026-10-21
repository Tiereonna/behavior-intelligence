import { describe, expect, it } from "vitest";
import {
  MeasurementType,
  MeasurementUnit,
  ValueState,
} from "@/generated/prisma/enums";
import { MEASUREMENT_TYPES, MEASUREMENT_TYPE_KEYS } from "@/lib/measurement";

// Fails if a measurement enum was added on one side only.
describe("registry / Prisma enum parity", () => {
  it("registers exactly the measurement types the database knows about", () => {
    expect([...MEASUREMENT_TYPE_KEYS].sort()).toEqual(
      Object.values(MeasurementType).sort(),
    );
  });

  it("keys every registry entry by its own type key", () => {
    // Guards against a copy-paste slip where a module is registered under the
    // wrong key, which would silently normalize with the wrong function.
    for (const [key, definition] of Object.entries(MEASUREMENT_TYPES)) {
      expect(definition.key).toBe(key);
    }
  });

  it("only uses units the database can store", () => {
    const validUnits = Object.values(MeasurementUnit);

    for (const definition of Object.values(MEASUREMENT_TYPES)) {
      expect(validUnits).toContain(definition.unit);
    }
  });

  it("covers every value state the database can store", () => {
    expect(Object.values(ValueState).sort()).toEqual([
      "CENSORED",
      "NOT_APPLICABLE",
      "VALUE",
    ]);
  });
});
