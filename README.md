# Behavior Intelligence

**Longitudinal behavior data analysis for behavioral professionals.**

[![Node](https://img.shields.io/badge/node-24_LTS-5FA04E)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-4169E1)](https://www.postgresql.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> **Synthetic data only.** This project is a learning exercise and is not a
> HIPAA-compliant system. No real client data belongs in this repository or in
> any database it touches.

---

## The problem

A behavior analyst working with a student who runs out of the classroom counts
how often it happens, tries an intervention, and keeps counting to find out
whether the intervention worked. That sounds simple, and in practice it is done
on paper and in spreadsheets that break in specific, predictable ways:

- **Sessions aren't the same length.** Nine incidents in twenty minutes and
  nine in three hours are very different facts. Charted as raw counts they look
  identical.
- **Different behaviors are measured in incompatible units.** A count, a
  percentage of trials, a number of seconds — there is no single "value" column
  that honestly holds all three.
- **Intervention start dates move.** They are frequently reconstructed weeks
  after the fact, and every summary statistic has to move with them.
- **"Zero" is ambiguous.** A behavior that didn't occur, a session that wasn't
  observed, and an opportunity that never arose are three different facts that
  spreadsheets happily average together into a wrong answer.

This project is a data model and application that takes those distinctions
seriously, so the chart a practitioner shows at a meeting reflects what
actually happened.

## The approach

The product centers on the **single-case experimental design chart** already
standard in applied behavior analysis: one time series per behavior, divided
into phases (baseline, intervention, maintenance), read by comparing level,
trend, and variability across the phase boundaries.

Building on that established model — rather than inventing a generic "metrics
dashboard" — is what keeps the data honest and makes the tool legible to the
people who would use it.

---

## Status

**Milestone 1 complete — the data foundation.** There is no dashboard, chart,
or analytics yet; the landing page is a placeholder.

| Milestone | Scope                                                | Status  |
| --------- | ---------------------------------------------------- | ------- |
| 1         | Schema, migration, measurement subsystem, seed data  | Done    |
| 2         | Auth.js with Google OAuth, workspace provisioning    | Planned |
| 3         | Client and behavior CRUD                             | Planned |
| 4         | Session data entry                                   | Planned |
| 5         | Longitudinal chart with phase change lines           | Planned |
| 6         | Per-phase descriptive statistics, CSV export         | Planned |

What works today: the full database schema, a validated and unit-tested
measurement subsystem covering six measurement systems, and a deterministic
seed script producing 29 observation sessions of realistic synthetic data with
known, planted intervention effects.

---

## Tech stack

| Layer     | Choice                                    | Version |
| --------- | ----------------------------------------- | ------- |
| Runtime   | Node.js                                   | 24 LTS  |
| Framework | Next.js (App Router) + React              | 16 / 19 |
| Language  | TypeScript, strict mode                   | 5.9     |
| Database  | PostgreSQL                                | 16+     |
| ORM       | Prisma with the `pg` driver adapter       | 7.9     |
| Validation| Zod                                       | 4.4     |
| Auth      | Auth.js v5, Google OAuth *(milestone 2)*  | —       |
| Styling   | Tailwind CSS                              | 4.3     |
| Testing   | Vitest                                    | 4.1     |

**Why a single TypeScript application rather than a Python analytics service?**
Every statistic planned for V1 — mean, median, regression slope, moving
average, median absolute deviation — is a few lines of TypeScript with no
dependencies. Two runtimes and a network hop between our own services is a real
cost to pay for libraries we would not yet use. The analysis layer is kept
deliberately portable so that decision can be revisited without a rewrite.

---

## Data model

Twelve models: four for identity (Auth.js), two for tenancy, six for the
behavioral domain.

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

Reading the important relationships in plain English:

**A `User` reaches a `Client` only through `Membership`.** There is no direct
relation between them, so no query can accidentally skip the access check. In
V1 every user gets one auto-created personal workspace and the word
"organization" never appears in the UI — but the boundary exists now, because
retrofitting tenancy later means migrating live records and re-auditing every
query at the same time.

**A `Client` has behaviors and sessions as independent branches.** Behaviors
are *what* you measure; observation sessions are *when* you watched. They meet
only at `Measurement`.

**`Measurement` is a grid cell.** Sessions are rows, behaviors are columns,
measurements are the filled cells. The grid is intentionally sparse and the
sparseness carries meaning: no cell means the behavior wasn't tracked that
session, a cell holding `0` means it genuinely didn't occur.

**`Phase` has no link to `Measurement`.** A data point's phase is derived at
read time from its session date against each phase's half-open `[start, end)`
range. Correcting an intervention start date is therefore a one-row edit rather
than a backfill across history.

---

## Measurement types

Six measurement systems, each collapsing to one comparable scalar so a single
chart and a single set of statistics can serve all of them.

| Type         | Records                     | Normalizes to |
| ------------ | --------------------------- | ------------- |
| `FREQUENCY`  | a count                     | count         |
| `RATE`       | a count + session length    | per hour      |
| `DURATION`   | seconds                     | % of session  |
| `PERCENTAGE` | numerator / denominator     | %             |
| `LATENCY`    | seconds to first occurrence | seconds       |
| `INTERVAL`   | intervals scored / observed | %             |

`INTERVAL` covers whole, partial, and momentary time sampling. All three share
the same arithmetic and differ only in the recording instruction, which is
stored as configuration so two styles are never silently compared as
equivalent.

Adding a seventh type means writing one file, adding one line to the registry,
and adding one value to a database enum. The data entry form, the chart, and
the services do not change.

### Three ways to have no number

Treating these alike is how a spreadsheet produces a confident wrong answer, so
the schema keeps them distinct:

- **`VALUE`** — an ordinary observation. A `0` here is real: the behavior did
  not occur.
- **`NOT_APPLICABLE`** — the session happened but the behavior could not be
  measured, because no opportunity arose. Scoring this as 0% would penalize a
  learner on a day they were never asked.
- **`CENSORED`** — the true value lies beyond the observation window. A latency
  where the behavior never occurred is not zero and not missing; you know only
  that it exceeded the session length. The stored value is that lower bound,
  and it renders as `>30:00`.

---

## What it will look like

Milestone 5 delivers the view everything else feeds. Per behavior:

- A line chart over time, with a toggle between calendar date and session
  number on the x-axis — sessions are irregularly spaced, and practitioners
  read both.
- Vertical dashed **phase-change lines** at each boundary, with the phase name
  labelled above the chart.
- A horizontal **mean line per phase**, which is how level change is read at a
  glance.
- **Annotation markers** for dated context — a medication change, a new
  paraprofessional — because the first question about any spike is what else
  happened that week.
- Censored points drawn as open markers at their lower bound, visually distinct
  from ordinary observations.

Milestone 6 adds a per-phase statistics panel: count, mean, median, range,
standard deviation, a least-squares trend line, and the change in mean from the
previous phase.

---

## Getting started

### Requirements

- **Node.js 24 LTS** — `node --version` should report v24.x
- **PostgreSQL 16 or newer** running locally (developed against 18.6)
- **npm 11+**

On macOS, [Postgres.app](https://postgresapp.com) is the least painful way to
get a local server.

### Setup

```bash
# 1. Install dependencies (also generates the Prisma client)
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

# 6. Verify — expect 7 test files, 40 tests passing
npm test
npm run db:studio
```

`.env` is gitignored and must never be committed. `.env.example` documents the
required keys and is the only environment file in version control.

### Scripts

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

## Troubleshooting

**`Environment variable not found: DATABASE_URL`** when running a Prisma
command. Prisma 7 no longer loads `.env` automatically. The `import
"dotenv/config"` at the top of `prisma.config.ts` is what populates the
environment for CLI commands — if that line is missing or `.env` doesn't exist,
every Prisma command fails this way. Next.js loads `.env` on its own, so the
running app is unaffected, which can make this look inconsistent.

**`The datasource property 'url' is no longer supported in schema files`.**
Also Prisma 7. The connection string lives in `prisma.config.ts` for CLI
commands, and the application passes a driver adapter (`@prisma/adapter-pg`) to
the `PrismaClient` constructor instead. See `src/lib/db.ts`.

**`Can't reach database server at localhost:5432`.** The Postgres server isn't
running. With Postgres.app, open the app and confirm the server shows as
running. Check with `pg_isready`.

**`createdb: command not found`.** Postgres.app doesn't add its CLI tools to
your PATH automatically:

```bash
sudo mkdir -p /etc/paths.d && \
  echo /Applications/Postgres.app/Contents/Versions/latest/bin \
  | sudo tee /etc/paths.d/postgresapp
```

Then open a new terminal window.

**`Cannot find module '@/generated/prisma/client'`.** The Prisma client is a
build artifact and is gitignored, so a fresh clone has to generate it. `npm
install` does this via a postinstall hook; run `npm run db:generate` if you
need it explicitly.

**Too many database connections after a while in development.** Next.js hot
reload re-evaluates modules on every save. `src/lib/db.ts` caches the client on
`globalThis` to prevent a new connection pool per save — if you construct a
`PrismaClient` anywhere else, expect this.

**`npm audit` reports a high-severity advisory in `deepmerge-ts`.** It is
reached only through the Prisma CLI's config loader, a development-time
dependency. Do not run `npm audit fix --force`; the offered "fix" is a
downgrade to Prisma 6, a much larger breaking change than the risk warrants.

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
      index.ts           normalizeMeasurement() — the single write path
      types/             one module per measurement type
tests/
  measurement/           unit tests, no database
docs/
  architecture.md        decisions and their reasoning
```

### The one architectural rule

```
app → features → services → repositories → PostgreSQL
                      ↓
        lib/measurement, lib/analysis  ← pure, depend on nothing
```

`lib/measurement` and `lib/analysis` import nothing from Prisma, React, or
Next.js. This is enforced by a `no-restricted-imports` ESLint rule rather than
by convention, because boundaries erode one "just this once" import at a time.

The payoff is concrete: the test suite runs in under 200ms with no database, no
fixtures, and no setup — and the analysis layer could later move behind an HTTP
call to a Python service without touching a single caller.

Full reasoning for every significant decision is in
[`docs/architecture.md`](docs/architecture.md).

---

## License

MIT — see [LICENSE](LICENSE).
