# Behavior Intelligence

[![CI](https://github.com/Tiereonna/behavior-intelligence/actions/workflows/ci.yml/badge.svg)](https://github.com/Tiereonna/behavior-intelligence/actions/workflows/ci.yml)

Practice project: ABA-style time series on **synthetic** data only. Not HIPAA-compliant. Do not load real client records.

What works locally: a 13-table PostgreSQL schema, six measurement types with tests, a seed of 29 sessions, a home-page chart, and a Python ETL pipeline in [`etl/`](etl/README.md). Login, data-entry forms, and scheduling are not built.

Schema notes: [`docs/architecture.md`](docs/architecture.md). Pipeline diagram, sample CSV, and test output: [`etl/README.md`](etl/README.md).

## Stack

Next.js 16, TypeScript, PostgreSQL, Prisma 7, Vitest. The ETL folder uses Python, Pandas, and pytest.

## Setup

Need Node 24, Postgres 16+, and npm 11+. On a Mac, [Postgres.app](https://postgresapp.com) is the easy way to get a server.

```bash
npm install
createdb behavior_intelligence
cp .env.example .env   # set DATABASE_URL; use `whoami` for the user
npm run db:migrate
npm run db:seed
npm test               # 8 files, 43 tests, no database
npm run dev            # chart at http://localhost:3000
```

`.env` is gitignored. Prisma 7 reads the URL from `prisma.config.ts` for CLI commands, not from `schema.prisma`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js |
| `npm test` | Unit tests |
| `npm run db:seed` | Reload synthetic data |
| `npm run db:studio` | Browse tables |

The ETL pipeline is a separate setup. From `etl/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pytest test_pipeline.py
```

If `createdb` is missing after installing Postgres.app, add its `bin` to PATH and open a new terminal.

Database tests (use a test db, they drop the staging table):

```bash
createdb etl_test
TEST_DATABASE_URL=postgresql://$(whoami)@localhost:5432/etl_test python -m pytest
```

Or with Docker:

```bash
docker compose run --build --rm etl
```

## CI

GitHub Actions runs lint, typecheck, and Vitest for the app, pytest for the ETL with a Postgres container, and the Docker load twice to check for duplicates.

## Tests last run

```text
Test Files  8 passed (8)
     Tests  43 passed (43)
```

```text
etl/ (with TEST_DATABASE_URL set)
6 passed
```

MIT — [LICENSE](LICENSE).
