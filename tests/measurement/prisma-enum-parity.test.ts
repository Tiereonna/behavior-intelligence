import { describe, expect, it } from "vitest";
import {
  MeasurementType,
  MeasurementUnit,
  ValueState,
} from "@/generated/prisma/enums";
import { MEASUREMENT_TYPES, MEASUREMENT_TYPE_KEYS } from "@/lib/measurement";

/**
 * The measurement subsystem deliberately does not import Prisma's generated
 * enums — it owns its own vocabulary so the pure layer stays independent of
 * the ORM. The cost of that independence is two definitions that could drift.
 *
 * This test is what makes the duplication safe. It lives in `tests/` rather
 * than in `src/lib/measurement/` precisely so it is allowed to import from
 * both sides of the boundary.
 *
 * If it fails, you added a value to one side and not the other. The likely fix
 * is adding the missing value to the Prisma enum and running a migration.
 */
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
