# Architecture

Decisions and their reasoning, so the "why" lives in the repository rather than
in a chat log. Written for a reader who has to change this code in six months.

---

## Domain framing

The product is a digital version of the **single-case experimental design
chart** used in applied behavior analysis: a time series per behavior, divided
into phases, read by visually comparing level, trend, and variability across
phase boundaries.

Leaning on that established model keeps the data honest and makes the product
feel correct to practitioners. Most schema decisions below fall out of it.

---

## Stack

| Layer     | Choice                          |
| --------- | ------------------------------- |
| Framework | Next.js (App Router) + React 19 |
| Language  | TypeScript, strict              |
| Database  | PostgreSQL                      |
| ORM       | Prisma 7 with the `pg` adapter  |
| Auth      | Auth.js v5, Google OAuth        |
| Styling   | Tailwind CSS                    |
| Testing   | Vitest                          |

**Why one TypeScript app rather than a Python backend.** The obvious
alternative buys pandas, NumPy, and SciPy. But every planned V1 statistic —
mean, median, regression slope, moving average, median absolute deviation — is
a few lines of TypeScript with no dependencies. Two runtimes, two dependency
managers, CORS, and a network hop between our own services is a real cost paid
for libraries we would not yet use. The analysis layer is kept portable so this
can be revisited without a rewrite (see "Pure layers" below).

**Why Google OAuth rather than email and password.** No credentials to store,
no hashing to get wrong, no password reset flow, no credential-stuffing
surface. It also happens to give us better sessions: Auth.js's Credentials
provider forces JWT sessions, while OAuth providers support the database
session strategy, so signing out revokes server-side instead of dropping a
cookie the server would still trust.

The provider list is isolated so adding Microsoft or GitHub later is one entry
plus two environment variables. The `Account` table already supports multiple
identities per user.

---

## Layering

```
app/                  routes, server components, server actions
  └─> features/       feature UI and action wrappers
        └─> server/services/       business rules, access guards, transactions
              └─> server/repositories/   the only Prisma imports
                    └─> PostgreSQL

lib/measurement/      pure leaf — validation and normalization
lib/analysis/         pure leaf — statistics (milestone 6)
```

Dependencies point one direction only. Business logic lives in services, not in
Server Actions — the latter is convenient for the first three features and then
you have the same phase-overlap check copy-pasted in four places with two of
them subtly wrong.

### Pure layers

`lib/measurement` and `lib/analysis` import nothing from Prisma, React, or
Next. This is enforced by a `no-restricted-imports` rule in `eslint.config.mjs`
rather than by convention, because boundaries erode one "just this once" import
at a time.

Two payoffs. Statistics can be unit tested by handing them a literal array and
asserting a number — no test database, no fixtures, millisecond runs. And the
analysis layer talks in plain serializable data, so replacing
`analyzeSeries(series)` with an HTTP POST to a Python service later means
changing one function body and nothing upstream.

The cost is that the pure layer duplicates the Prisma enums as string unions
instead of importing them. `tests/measurement/prisma-enum-parity.test.ts` fails
if the two ever drift apart.

---

## Data model

Twelve models: four for identity (Auth.js), two for tenancy, six for the
domain.

```
Account ─┐
Session ─┼─ User ─── Membership ─── Organization
         │    │                          │
         │    └── AuditLog               └── Client
         │                                     ├── Behavior
         │                                     │     ├── Phase
         │                                     │     ├── Annotation
         │                                     │     └── Measurement
         │                                     │            │
         └──── observes ─── ObservationSession ─────────────┘
```

### Tenancy before multi-tenancy

`Client.organizationId` is the only place tenancy is recorded; everything below
inherits it by descending from a client, so it cannot drift out of sync.

There is deliberately **no direct `User -> Client` relation**. Access always
resolves through `Membership`, which means no query can accidentally bypass the
check and a single guard function is sufficient rather than aspirational.

In V1 every user gets one auto-created personal organization and the only role
is `OWNER`. The features are absent; the boundary is not. Retrofitting tenancy
later would mean a data migration on live health records, a rewrite of every
query, and a security audit of every endpoint — simultaneously. Two small
tables now is a much better trade.

### Phase membership is derived, not stored

`Phase` has no foreign key to `Measurement`. A data point's phase is resolved
at read time by finding the half-open range `[startDate, endDate)` containing
its session date.

Stamping `phaseId` on each measurement would query faster and break the first
time someone corrects a phase start date — which happens constantly, because
phase boundaries are frequently reconstructed after the fact. Derived
membership makes that correction a one-row edit. Datasets here are hundreds of
points; the join costs nothing.

**Half-open ranges matter.** If a baseline ends on the 27th and an intervention
starts on the 27th, closed intervals would put that day in both phases and
silently double-count it in both means.

### Baseline and intervention are one model

Both are a `Phase` with a different `phaseType`. They share identical structure
and identical analysis, and the entire point of the chart is comparing them
with the same math. Separate models would duplicate that math and then need
awkward code to compare across types.

It also handles withdrawal designs (A-B-A-B) as four ordered rows rather than
as a special case.

### Observation is two models

`ObservationSession` is the *when and where*; `Measurement` is the *what*, one
row per behavior per session.

Read `measurements` as a grid: sessions are rows, behaviors are columns,
measurements are filled cells. The grid is sparse and the sparseness means
something — no cell is "not tracked," a cell holding `0` is "did not occur."

The split is not just normalization. **Session duration is an input to the
math** (rate divides by it, duration and interval percentages divide by it). If
it were repeated per measurement, one bad edit would leave two behaviors from
the same session computed against different session lengths.

### Raw entry plus normalized value

`Measurement.rawEntry` is JSON in whatever shape the measurement type defines.
`Measurement.normalizedValue` is the single comparable scalar.

The conventional alternative is a wide table with a nullable column per input,
which gives database-level type checking at the cost of a migration and a
wider, emptier table for every new type.

JSON is defensible here because of one property: **nothing queries `rawEntry`**.
Every chart and statistic reads `normalizedValue`, a real typed indexed column.
The JSON is parsed only when displaying or editing the original entry, where a
Zod failure surfaces immediately. The discipline that makes it safe is that
every write goes through `normalizeMeasurement()`, and each entry schema uses
`z.strictObject`, so a typo like `{ cont: 5 }` is rejected rather than stored.

`normalizedValue` is a `Float`, not a `Decimal`. These are derived,
already-approximate physical measurements, not money, and `Decimal` would force
`.toNumber()` at every boundary including serialization.

### Dates

Session dates and phase boundaries are `@db.Date`, not timestamps. A session on
the 3rd is on the 3rd regardless of server timezone. Using a timestamp produces
off-by-one-day errors that move points across phase boundaries and change the
reported effect — the most damaging class of bug this application can have.

`ObservationSession.startTime` is an `"HH:mm"` string rather than a SQL time,
because Prisma maps SQL time to a JavaScript `Date` and reintroduces exactly
the confusion `@db.Date` avoids.

---

## Measurement subsystem

Each measurement type is a module implementing `MeasurementTypeDefinition`:
a Zod schema for its behavior-level config, a Zod schema for its per-session
entry, a `normalize()` that collapses an entry to one scalar, and a formatter.
`registry.ts` maps the enum to those modules.

Adding a seventh type: write one file, add one line to the registry, add one
value to the Prisma enum. The data entry form, the chart, and the services do
not change.

**Why no `measurement_types` table.** A measurement type is not data — it
carries behavior (validation, normalization, formatting) that has to live in
code. A table would be a second source of truth requiring manual sync, and
drift between them would produce silently wrong numbers.

### Three value states

Handling "no number" as one situation produces wrong statistics, so there are
three:

- **`VALUE`** — an ordinary observation.
- **`NOT_APPLICABLE`** — the session happened but the behavior could not be
  measured: zero opportunities, no antecedent presented. `normalizedValue` is
  null. Scoring this as 0% would drag the mean down on a day the learner was
  never given a chance.
- **`CENSORED`** — the true value lies beyond the observation window. A latency
  where the behavior never occurred is not zero and not missing; you know it
  exceeded the session length. `normalizedValue` holds that lower bound and the
  UI renders it as `>30:00`.

Censoring is right-censoring in the survival-analysis sense. V1 excludes
censored points from means and marks them distinctly. Handling them properly is
survival analysis and well beyond scope.

### Failing loudly

Impossible entries — more successes than opportunities, more behavior seconds
than session seconds, a rate on a zero-duration session — throw
`MeasurementError` rather than being clamped. A clamped value looks plausible
on a chart forever; a thrown error gets fixed at entry time.

---

## Analysis roadmap

Only tier 1 is planned for V1.

1. **Descriptive** — per phase: count, mean, median, range, standard deviation,
   least-squares trend line, and mean change from the prior phase.
2. **Visual analysis metrics** — immediacy of effect (last three baseline
   points versus first three intervention points), level change at the
   boundary, and the stability envelope (80% of points within ±25% of the phase
   median).
3. **Anomaly detection** — robust statistics only. The modified z-score,
   `0.6745 × (x − median) / MAD`, flagged above about 3.5. Computed within a
   phase or a rolling window, so a real intervention effect is not flagged as
   an anomaly — the mistake that makes naive anomaly detection useless here.
   Plus run-based rules from statistical process control.
4. **Effect size** — PND, PEM, NAP, and Tau-U, the published overlap methods
   for single-case designs.

Two guards to build in from the start. Every statistic returns null below a
minimum sample size, because a regression slope on three points is noise
wearing a lab coat. And the UI frames results as decision support rather than
conclusions: these series are autocorrelated with tiny N, so the statistics aid
visual analysis rather than replace clinical judgment.

---

## Privacy

Behavioral records are protected health information, and this is a learning
project rather than a HIPAA-compliant system. Therefore:

- **Synthetic data only.** No real client data in this repository or any local
  database.
- **The `Client` model is deliberately minimal** — display name and nothing
  else. No date of birth, no external record number, no free-text notes. The
  first two are HIPAA identifiers; the third is where protected information
  accumulates unstructured. Each can be added when a feature genuinely needs
  it.
- **`AuditLog` exists from the first migration.** Retrofitting an audit trail
  means permanently being unable to answer questions about the period before it
  existed. Its `userId` is nullable with `SetNull` and its `entityId` is a
  plain string, so the log survives deletion of both the actor and the subject.
- **Never log protected information.** Not in `AuditLog.metadata`, not in
  request logs. Record that a value changed and by whom, not the clinical
  content.

---

## Known gaps

- Phase overlap is checked in the service layer (milestone 3), not by the
  database. A `daterange` column with a GiST exclusion constraint would make
  overlap impossible even from a stray `psql` session — a good follow-up
  exercise.
- The `NOT_APPLICABLE` value state is covered by unit tests but does not appear
  in the seed data.
- `npm audit` reports a high-severity advisory in `deepmerge-ts`, reached only
  through the Prisma CLI's config loader. It is a development-time dependency
  and the offered "fix" is a downgrade to Prisma 6, which is a larger breaking
  change than the risk warrants. Revisit when Prisma updates the dependency.
