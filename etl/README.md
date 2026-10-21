# etl

Reads a session csv, checks each row, writes a quality report, and (if `DATABASE_URL` is set) upserts into `observation_staging`.

Fake data only. Don't put real client records here.

A blank / `N/A` / `null` is missing. A written `0` is zero. Mixing those up wrecks later averages.

Rejected when: date isn't a date, duration isn't a positive number, measurement type is unknown, raw value isn't a number, client or behavior is blank, or the same client + date + behavior already showed up.

The staging table is not the Prisma tables the chart uses, so a bad csv can't overwrite the demo.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pytest test_pipeline.py

python generate_sessions.py
python pipeline.py --csv fixtures/sessions_400.csv
```

Bigger file (stays in `artifacts/`, not git):

```bash
python generate_sessions.py --rows 500000
python pipeline.py --csv artifacts/sessions_500000.csv
```

Load (run twice; count per key stays 1):

```bash
DATABASE_URL="postgresql://USER@localhost:5432/behavior_intelligence" \
  python pipeline.py --csv fixtures/sessions_400.csv
```

Last 500k run on my machine, with Postgres:

```
rows_read 500000
accepted 400000
rejected 100000
  bad_date 25000
  bad_duration 25000
  bad_measurement_type 25000
  duplicate_key 25000
missing 25000
true zeros 25000
seconds 63.11
```
