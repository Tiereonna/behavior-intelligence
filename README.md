# Behavior Intelligence

A platform for behavioral professionals to visualize longitudinal behavior
data, identify trends and anomalies, and evaluate changes across intervention
periods.

The core of the product is the single-case design chart that behavior analysts
already use: a time series per behavior, split into phases (baseline,
intervention, maintenance), read by comparing level, trend, and variability
across the phase boundaries.

> **Development uses synthetic data only.** No real client data belongs in this
> repository or in a local database.

---

## Status

**Milestone 1 complete — data foundation.**

| Milestone | Scope                                                | Status  |
| --------- | ---------------------------------------------------- | ------- |
| 1         | Schema, migration, measurement subsystem, seed data  | Done    |
| 2         | Auth.js with Google OAuth, organization provisioning | Planned |
| 3         | Client and behavior CRUD                             | Planned |
| 4         | Session data entry                                   | Planned |
| 5         | Longitudinal chart with phase change lines           | Planned |
| 6         | Per-phase descriptive statistics, CSV export         | Planned |

There is no dashboard, no chart, and no analytics yet. The landing page is a
placeholder.

---

## Requirements

- **Node.js 24 LTS** (`node --version` should report v24.x)
- **PostgreSQL 16+** running locally
- **npm 11+**

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the database
createdb behavior_intelligence

# 3. Configure the connection string
cp .env.example .env
#    then edit .env and replace USER with your system username (run `whoami`)

# 4. Apply the schema
npm run db:migrate

# 5. Load synthetic data
npm run db:seed

# 6. Verify
npm test
npm run db:studio
```

`.env` is gitignored and must never be committed. `.env.example` documents the
required keys and is the only environment file in version control.

---

## Scripts

| Script                | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | Start the development server                     |
| `npm run build`       | Production build                                 |
| `npm test`            | Run unit tests (no database required)            |
| `npm run test:watch`  | Unit tests in watch mode                         |
| `npm run typecheck`   | TypeScript with no emit                          |
| `npm run lint`        | ESLint, including the architectural import rules |
| `npm run db:migrate`  | Create and apply a migration                     |
| `npm run db:seed`     | Reset and reload synthetic data                  |
| `npm run db:reset`    | Drop, re-migrate, and re-seed                    |
| `npm run db:studio`   | Browse the database in Prisma Studio             |
| `npm run db:generate` | Regenerate the Prisma client                     |

---

## Project structure

```
prisma/
  schema.prisma          12 models: identity, tenancy, domain
  migrations/            committed migration history
  seed.ts                synthetic data, deterministic
src/
  app/                   Next.js routes (placeholder only for now)
  generated/prisma/      generated Prisma client (gitignored)
  lib/
    db.ts                Prisma client singleton
    measurement/         pure: validation and normalization
      contract.ts        the interface every measurement type implements
      registry.ts        enum -> definition map
      types/             one module per measurement type
tests/
  measurement/           unit tests, no database
```

---

## Architecture notes

Full reasoning lives in [`docs/architecture.md`](docs/architecture.md). Four
decisions shape most of the code:

**Phase membership is derived, not stored.** A measurement has no `phaseId`.
Which phase a data point belongs to is worked out from its session date against
each phase's half-open `[start, end)` range. Correcting a phase boundary is
then a one-row edit instead of a backfill across history — and practitioners
correct phase boundaries constantly, because they are often reconstructed after
the fact.

**Measurements store both a raw entry and a normalized value.** `rawEntry` is
JSON in whatever shape the measurement type defines; `normalizedValue` is the
single comparable scalar every chart and statistic reads. Adding a measurement
type therefore needs no migration. This is safe because nothing queries
`rawEntry`, and because every write goes through one validating function.

**Tenancy exists before multi-tenancy does.** Clients belong to an
organization, and users reach organizations only through memberships. In V1
every user has one auto-created personal workspace, and the word
"organization" never appears in the UI. The boundary is built now because
retrofitting it later means migrating live health records and re-auditing every
query simultaneously.

**`lib/measurement` and `lib/analysis` are pure.** No database, no React, no
Next.js — enforced by ESLint, not by discipline. That is what lets the
statistics be unit tested without a database, and what would let the analysis
layer move behind an HTTP call to a Python service without touching its
callers.

---

## Measurement types

Six are supported. Each collapses to one comparable scalar.

| Type         | Records                      | Normalizes to  |
| ------------ | ---------------------------- | -------------- |
| `FREQUENCY`  | a count                      | count          |
| `RATE`       | a count + session length     | per hour       |
| `DURATION`   | seconds                      | % of session   |
| `PERCENTAGE` | numerator / denominator      | %              |
| `LATENCY`    | seconds to first occurrence  | seconds        |
| `INTERVAL`   | intervals scored / observed  | %              |

`INTERVAL` covers whole, partial, and momentary time sampling; they share the
same arithmetic and differ only in the recording instruction, which is stored
as configuration.

Three distinctions the data model takes seriously, because getting them wrong
produces confidently incorrect statistics:

- **No row** means the behavior was not tracked in that session. **A row
  holding `0`** means the behavior genuinely did not occur.
- **`NOT_APPLICABLE`** means the session happened but the behavior could not be
  measured — no opportunities arose, no antecedent was presented.
- **`CENSORED`** means the true value is beyond the observation window. A
  latency where the behavior never occurred is not zero and not missing; it is
  "at least the session length," and `normalizedValue` holds that bound.
