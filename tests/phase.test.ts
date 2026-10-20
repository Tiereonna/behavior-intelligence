import { describe, expect, it } from "vitest";
import { derivePhase, meanOf } from "@/lib/phase";

const phases = [
  {
    id: "a",
    name: "Baseline",
    phaseType: "BASELINE",
    startDate: new Date("2026-01-06T00:00:00.000Z"),
    endDate: new Date("2026-01-24T00:00:00.000Z"),
  },
  {
    id: "b",
    name: "Intervention",
    phaseType: "INTERVENTION",
    startDate: new Date("2026-01-24T00:00:00.000Z"),
    endDate: null,
  },
];

describe("derivePhase", () => {
  it("puts the boundary day in the new phase (half-open range)", () => {
    const phase = derivePhase(new Date("2026-01-24T00:00:00.000Z"), phases);
    expect(phase?.name).toBe("Intervention");
  });

  it("keeps the day before the boundary in baseline", () => {
    const phase = derivePhase(new Date("2026-01-23T00:00:00.000Z"), phases);
    expect(phase?.name).toBe("Baseline");
  });
});

describe("meanOf", () => {
  it("returns null for an empty list instead of 0", () => {
    expect(meanOf([])).toBeNull();
  });
});
