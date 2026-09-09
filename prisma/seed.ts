import { prisma } from "../src/lib/db";
import { normalizeMeasurement } from "../src/lib/measurement";
import type { MeasurementTypeKey } from "../src/lib/measurement";

/**
 * Synthetic development data.
 *
 * Everything here is invented. No real client data belongs in this project.
 *
 * The data is generated rather than hand-written for two reasons. It is
 * deterministic, from a fixed seed, so the database is identical after every
 * reset — debugging a chart against data that changes underneath you is
 * miserable. And the effects are *planted*, so when the analysis milestone
 * arrives there is a known right answer to check the statistics against.
 *
 * The imperfections are deliberate:
 *
 *   - irregular gaps between sessions, because evenly spaced data hides bugs
 *     in date handling and phase resolution
 *   - session lengths from 45 to 120 minutes, so rate normalization is
 *     actually doing work rather than dividing by a constant
 *   - one strong effect, one weak effect, and a few outlier spikes
 *   - censored latency observations
 *   - a behavior that is not scored in every session, so the sparse grid is
 *     exercised
 */

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

/** mulberry32: small, fast, seedable. Same seed, same database, every time. */
function createRandom(seed: number) {
  let state = seed;

  return function random(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260819);

function between(min: number, max: number): number {
  return min + random() * (max - min);
}

function intBetween(min: number, max: number): number {
  return Math.floor(between(min, max + 1));
}

/**
 * Parse a plain calendar date into UTC midnight.
 *
 * Session dates are `@db.Date` columns, and building them with `new Date()`
 * from a local timezone can land on the previous day once stored. That would
 * move points across phase boundaries and change the effect the chart reports,
 * which is the single most damaging class of bug in this application.
 */
function date(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// ---------------------------------------------------------------------------
// Study design
// ---------------------------------------------------------------------------

const BASELINE_START = "2026-01-06";
const INTERVENTION_START = "2026-01-24";
const MAINTENANCE_START = "2026-03-16";
const STUDY_END = "2026-03-27";

/** Session dates: weekdays only, irregular gaps of one to four days. */
function generateSessionDates(): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${BASELINE_START}T00:00:00.000Z`);
  const end = new Date(`${STUDY_END}T00:00:00.000Z`);

  while (cursor <= end) {
    // Roll forward off a weekend rather than skipping the session, so gaps
    // stay irregular without thinning the data.
    while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    if (cursor > end) break;

    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + intBetween(1, 4));
  }

  return dates;
}

/**
 * Pick session indices at fixed positions through the study.
 *
 * Expressed as fractions rather than literal indices so they stay in range and
 * stay spread out if the session density is ever tuned.
 */
function indexesAt(fractions: number[], total: number): Set<number> {
  return new Set(fractions.map((f) => Math.floor(f * total)));
}

// ---------------------------------------------------------------------------
// Planted effects
// ---------------------------------------------------------------------------

/** Where a date falls in the study, used to pick the target value. */
function phaseOf(iso: string): "baseline" | "intervention" | "maintenance" {
  if (iso < INTERVENTION_START) return "baseline";
  if (iso < MAINTENANCE_START) return "intervention";
  return "maintenance";
}

/** 0 at the start of the intervention, 1 at the end. Drives the trend. */
function interventionProgress(iso: string): number {
  const start = Date.parse(`${INTERVENTION_START}T00:00:00Z`);
  const end = Date.parse(`${MAINTENANCE_START}T00:00:00Z`);
  const now = Date.parse(`${iso}T00:00:00Z`);

  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

/**
 * Elopement, in occurrences per hour. A strong, clear effect: a flat baseline
 * around 4.5/hr, a steady decline through the intervention, and maintenance
 * holding the gain.
 */
function elopementRate(iso: string): number {
  switch (phaseOf(iso)) {
    case "baseline":
      return between(3.6, 5.4);
    case "intervention": {
      const progress = interventionProgress(iso);
      return between(-0.4, 0.4) + 4.2 - 3.1 * progress;
    }
    case "maintenance":
      return between(0.5, 1.3);
  }
}

/**
 * On-task behavior, as a percentage of momentary time samples. A deliberately
 * WEAK effect — baseline around 46%, intervention around 55%, with enough
 * variability that "did this work?" is a genuinely open question. Real data
 * looks like this more often than the textbook example does.
 */
function onTaskPercent(iso: string): number {
  switch (phaseOf(iso)) {
    case "baseline":
      return between(38, 54);
    case "intervention":
      return between(44, 66);
    case "maintenance":
      return between(48, 68);
  }
}

/** Latency to comply, in seconds. Strong effect, plus censored non-responses. */
function complianceLatency(iso: string): number {
  switch (phaseOf(iso)) {
    case "baseline":
      return between(140, 260);
    case "intervention": {
      const progress = interventionProgress(iso);
      return Math.max(8, between(-15, 15) + 150 - 110 * progress);
    }
    case "maintenance":
      return between(15, 45);
  }
}

const SETTINGS = [
  "General ed classroom",
  "Resource room",
  "Cafeteria",
  "Specials / PE",
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

/**
 * Wipe the domain tables so the seed is repeatable.
 *
 * Deletion order matters even with cascades configured, because deleting the
 * parents directly is clearer about intent than relying on cascade side
 * effects. This is a development-only script; it never runs against anything
 * but a local database.
 */
async function reset() {
  await prisma.measurement.deleteMany();
  await prisma.annotation.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.observationSession.deleteMany();
  await prisma.behavior.deleteMany();
  await prisma.client.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("Resetting seeded data...");
  await reset();

  // -- Identity and tenancy ------------------------------------------------
  //
  // Mirrors what will happen automatically on first Google sign-in: a user, a
  // personal organization, and an OWNER membership, created together.

  const user = await prisma.user.create({
    data: {
      email: "demo.practitioner@example.com",
      name: "Demo Practitioner",
      emailVerified: new Date(),
    },
  });

  const organization = await prisma.organization.create({
    data: {
      name: "Demo Practitioner's Workspace",
      memberships: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  // -- Client --------------------------------------------------------------

  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      displayName: "J.M.",
    },
  });

  // -- Behaviors -----------------------------------------------------------

  const elopement = await prisma.behavior.create({
    data: {
      clientId: client.id,
      name: "Elopement",
      operationalDefinition:
        "Leaving the designated instructional area without adult permission for more than 3 seconds.",
      measurementType: "RATE",
      measurementConfig: {},
      direction: "DECREASE",
      targetValue: 0.5,
    },
  });

  const onTask = await prisma.behavior.create({
    data: {
      clientId: client.id,
      name: "On-task behavior",
      operationalDefinition:
        "Eyes oriented toward assigned materials or the speaker at the moment of observation.",
      measurementType: "INTERVAL",
      measurementConfig: { intervalLengthSeconds: 60, style: "MOMENTARY" },
      direction: "INCREASE",
      targetValue: 80,
    },
  });

  const compliance = await prisma.behavior.create({
    data: {
      clientId: client.id,
      name: "Latency to comply",
      operationalDefinition:
        "Time from the delivery of a one-step instruction until the learner begins the requested action.",
      measurementType: "LATENCY",
      measurementConfig: {
        antecedent: "A one-step instruction is delivered by an adult.",
      },
      direction: "DECREASE",
      targetValue: 30,
    },
  });

  // -- Phases --------------------------------------------------------------
  //
  // Ranges are half-open, [startDate, endDate). The intervention starting on
  // the same date the baseline ends is correct and does not double-count that
  // day.

  await prisma.phase.createMany({
    data: [
      {
        behaviorId: elopement.id,
        name: "Baseline",
        phaseType: "BASELINE",
        startDate: date(BASELINE_START),
        endDate: date(INTERVENTION_START),
      },
      {
        behaviorId: elopement.id,
        name: "DRA + break card",
        phaseType: "INTERVENTION",
        startDate: date(INTERVENTION_START),
        endDate: date(MAINTENANCE_START),
        description:
          "Functional communication training with a break card; reinforcement on a VR3 schedule.",
      },
      {
        behaviorId: elopement.id,
        name: "Maintenance",
        phaseType: "MAINTENANCE",
        startDate: date(MAINTENANCE_START),
        endDate: null,
      },
      {
        behaviorId: onTask.id,
        name: "Baseline",
        phaseType: "BASELINE",
        startDate: date(BASELINE_START),
        endDate: date(INTERVENTION_START),
      },
      {
        behaviorId: onTask.id,
        name: "Token board",
        phaseType: "INTERVENTION",
        startDate: date(INTERVENTION_START),
        endDate: null,
        description:
          "Five-token board exchanged for preferred activity; delivered on a fixed interval.",
      },
      {
        behaviorId: compliance.id,
        name: "Baseline",
        phaseType: "BASELINE",
        startDate: date(BASELINE_START),
        endDate: date(INTERVENTION_START),
      },
      {
        behaviorId: compliance.id,
        name: "Errorless prompting",
        phaseType: "INTERVENTION",
        startDate: date(INTERVENTION_START),
        endDate: null,
        description:
          "Least-to-most prompting hierarchy with a 3-second constant time delay.",
      },
    ],
  });

  // -- Sessions and measurements -------------------------------------------

  const sessionDates = generateSessionDates();

  /** Elopement spikes: a substitute teacher, a fire drill, a bad morning. */
  const outlierIndexes = indexesAt([0.3, 0.55, 0.82], sessionDates.length);

  /** Sessions where on-task behavior was not scored at all. */
  const onTaskSkippedIndexes = indexesAt(
    [0.15, 0.45, 0.72],
    sessionDates.length,
  );

  let measurementCount = 0;

  /**
   * Every measurement goes through `normalizeMeasurement`, exactly like the
   * application will. The seed does not compute normalized values itself,
   * because a second copy of that arithmetic would drift from the real one and
   * quietly invalidate everything built on top of it.
   */
  async function record(input: {
    observationSessionId: string;
    behaviorId: string;
    measurementType: MeasurementTypeKey;
    measurementConfig: unknown;
    rawEntry: unknown;
    durationMinutes: number;
  }) {
    const normalized = normalizeMeasurement({
      measurementType: input.measurementType,
      measurementConfig: input.measurementConfig,
      rawEntry: input.rawEntry,
      session: { durationMinutes: input.durationMinutes },
    });

    await prisma.measurement.create({
      data: {
        observationSessionId: input.observationSessionId,
        behaviorId: input.behaviorId,
        measurementType: normalized.measurementType,
        rawEntry: normalized.rawEntry as object,
        normalizedValue: normalized.normalizedValue,
        valueState: normalized.valueState,
        unit: normalized.unit,
      },
    });

    measurementCount += 1;
  }

  for (const [index, iso] of sessionDates.entries()) {
    const durationMinutes = intBetween(45, 120);

    const session = await prisma.observationSession.create({
      data: {
        clientId: client.id,
        observerId: user.id,
        sessionDate: date(iso),
        startTime: random() < 0.5 ? "09:15" : "13:30",
        durationMinutes,
        setting: SETTINGS[intBetween(0, SETTINGS.length - 1)],
      },
    });

    // Elopement — a count, which normalizes to a rate per hour.
    const hours = durationMinutes / 60;
    const spike = outlierIndexes.has(index) ? between(2.5, 4) : 0;
    const targetRate = Math.max(0, elopementRate(iso) + spike);

    await record({
      observationSessionId: session.id,
      behaviorId: elopement.id,
      measurementType: "RATE",
      measurementConfig: {},
      rawEntry: { count: Math.round(targetRate * hours) },
      durationMinutes,
    });

    // On-task — momentary time sampling on 60-second intervals. Skipped in a
    // few sessions, which leaves a real hole in the grid rather than a zero.
    if (!onTaskSkippedIndexes.has(index)) {
      const intervalsObserved = durationMinutes;
      const intervalsScored = Math.round(
        (onTaskPercent(iso) / 100) * intervalsObserved,
      );

      await record({
        observationSessionId: session.id,
        behaviorId: onTask.id,
        measurementType: "INTERVAL",
        measurementConfig: { intervalLengthSeconds: 60, style: "MOMENTARY" },
        rawEntry: { intervalsScored, intervalsObserved },
        durationMinutes,
      });
    }

    // Latency — occasionally the learner never complied at all, which is
    // censored rather than missing or zero. More common during baseline.
    const nonComplianceChance = phaseOf(iso) === "baseline" ? 0.25 : 0.05;
    const didNotOccur = random() < nonComplianceChance;

    await record({
      observationSessionId: session.id,
      behaviorId: compliance.id,
      measurementType: "LATENCY",
      measurementConfig: {
        antecedent: "A one-step instruction is delivered by an adult.",
      },
      rawEntry: didNotOccur
        ? { didNotOccur: true }
        : {
            didNotOccur: false,
            seconds: Math.min(
              durationMinutes * 60,
              Math.round(complianceLatency(iso)),
            ),
          },
      durationMinutes,
    });
  }

  // -- Annotations ---------------------------------------------------------

  await prisma.annotation.createMany({
    data: [
      {
        behaviorId: elopement.id,
        occurredOn: date("2026-02-10"),
        title: "Medication dosage increased",
        body: "Prescriber increased dosage; reported by parent via email.",
      },
      {
        behaviorId: onTask.id,
        occurredOn: date("2026-02-24"),
        title: "New paraprofessional assigned",
        body: "Previous para reassigned to another classroom mid-week.",
      },
    ],
  });

  // -- Summary -------------------------------------------------------------

  console.log(
    [
      "",
      "Seed complete.",
      `  organizations        1`,
      `  users                1`,
      `  clients              1`,
      `  behaviors            3`,
      `  phases               7`,
      `  observation sessions ${sessionDates.length}`,
      `  measurements         ${measurementCount}`,
      `  annotations          2`,
      "",
      `  study window ${BASELINE_START} to ${STUDY_END}`,
      `  intervention begins ${INTERVENTION_START}`,
      "",
    ].join("\n"),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
