# behavior-intelligence

GSU project. Chart of fake ABA session data (not real clients, not HIPAA).

Demo: https://behavior-intelligence.vercel.app

Next.js + Postgres + Prisma. The home page plots one client (J.M.) over sessions. Click the behavior name to switch series. Phase lines come from dates.

`etl/` is a python script that reads a messy csv, drops bad rows, and loads the rest into a staging table. Missing stays missing. `0` stays zero.

I have not built login, forms, or scheduling.

## run the chart

Need Node and Postgres.

```bash
npm install
createdb behavior_intelligence
cp .env.example .env
npm run db:migrate
npm run db:seed
npm test
npm run dev
```

Chart is at http://localhost:3000

## etl

```bash
cd etl
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pytest test_pipeline.py
```

500k row run (on my laptop, with Postgres): 400000 accepted, 100000 rejected, 63.11 seconds. Details in [etl/README.md](etl/README.md).

```bash
docker compose run --build --rm etl
```

CI: lint, typecheck, vitest, and pytest (including a docker load run twice so duplicates don't sneak in).
