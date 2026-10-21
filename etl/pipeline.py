"""
Load a messy session CSV into a PostgreSQL staging table.

Missing is not zero. A blank measurement means the behavior was not scored.
A 0 means it was scored and did not happen. Mixing those up changes every
later average. This pipeline keeps them apart before anything is stored.

The staging table is separate from the app's Prisma tables. A bad CSV should
not be able to overwrite the records the chart reads.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import pandas as pd

ALLOWED_TYPES = {
    "FREQUENCY",
    "RATE",
    "DURATION",
    "PERCENTAGE",
    "LATENCY",
    "INTERVAL",
}

REQUIRED_COLUMNS = (
    "client_code",
    "session_date",
    "duration_minutes",
    "behavior_name",
    "measurement_type",
    "raw_value",
)

# Blank-like tokens. These are missing observations, not zeros.
MISSING_TOKENS = {"", "na", "n/a", "null", "none", "nan"}

STAGING_DDL = """
CREATE TABLE IF NOT EXISTS observation_staging (
    id serial PRIMARY KEY,
    client_code text NOT NULL,
    session_date date NOT NULL,
    duration_minutes integer NOT NULL,
    behavior_name text NOT NULL,
    measurement_type text NOT NULL,
    raw_value double precision,
    value_state text NOT NULL,
    loaded_at timestamptz NOT NULL DEFAULT now()
)
"""

# One row per client, day, and behavior. A second load updates that row
# instead of inserting a copy. If an older table already has duplicates,
# creating this index will fail until that table is dropped.
UNIQUE_INDEX_SQL = """
CREATE UNIQUE INDEX IF NOT EXISTS observation_staging_natural_key
ON observation_staging (client_code, session_date, behavior_name)
"""

INSERT_SQL = """
INSERT INTO observation_staging (
    client_code,
    session_date,
    duration_minutes,
    behavior_name,
    measurement_type,
    raw_value,
    value_state
) VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (client_code, session_date, behavior_name)
DO UPDATE SET
    duration_minutes = EXCLUDED.duration_minutes,
    measurement_type = EXCLUDED.measurement_type,
    raw_value = EXCLUDED.raw_value,
    value_state = EXCLUDED.value_state,
    loaded_at = now()
"""


def extract_csv(path: Path) -> pd.DataFrame:
    """Read the raw file. Nothing is fixed here; cleaning is the next step."""
    frame = pd.read_csv(path, dtype=str, keep_default_na=False)
    missing = [name for name in REQUIRED_COLUMNS if name not in frame.columns]
    if missing:
        raise ValueError(f"CSV is missing columns: {', '.join(missing)}")
    return frame


def _is_missing(raw: str) -> bool:
    return raw.strip().lower() in MISSING_TOKENS


def clean_and_split(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Return (accepted, rejected).

    Rejected rows keep a `reject_reason` so the quality report can say why
    a row was dropped instead of silently disappearing.
    """
    accepted_rows: list[dict] = []
    rejected_rows: list[dict] = []
    seen_keys: set[tuple[str, str, str]] = set()

    for record in frame.to_dict(orient="records"):
        reason = _reject_reason(record, seen_keys)
        if reason is None:
            accepted_rows.append(_accepted_row(record))
            seen_keys.add(_key(record))
        else:
            rejected_rows.append({**record, "reject_reason": reason})

    accepted = pd.DataFrame(accepted_rows)
    rejected = pd.DataFrame(rejected_rows)
    return accepted, rejected


def _key(record: dict) -> tuple[str, str, str]:
    return (
        str(record.get("client_code", "")).strip(),
        str(record.get("session_date", "")).strip(),
        str(record.get("behavior_name", "")).strip().lower(),
    )


def _reject_reason(record: dict, seen_keys: set[tuple[str, str, str]]) -> str | None:
    client = str(record.get("client_code", "")).strip()
    behavior = str(record.get("behavior_name", "")).strip()
    session_date = str(record.get("session_date", "")).strip()
    measurement_type = str(record.get("measurement_type", "")).strip().upper()
    duration_text = str(record.get("duration_minutes", "")).strip()
    raw_text = str(record.get("raw_value", "")).strip()

    if not client or not behavior:
        return "missing_identity"
    if pd.isna(pd.to_datetime(session_date, errors="coerce")):
        return "bad_date"
    try:
        duration = int(duration_text)
    except ValueError:
        return "bad_duration"
    if duration <= 0:
        return "bad_duration"
    if measurement_type not in ALLOWED_TYPES:
        return "bad_measurement_type"
    if not _is_missing(raw_text):
        try:
            float(raw_text)
        except ValueError:
            return "bad_raw_value"
    if _key(record) in seen_keys:
        return "duplicate_key"
    return None


def _accepted_row(record: dict) -> dict:
    raw_text = str(record.get("raw_value", "")).strip()
    if _is_missing(raw_text):
        raw_value = None
        value_state = "MISSING"
    else:
        raw_value = float(raw_text)
        # A scored zero is real. Do not turn it into a blank.
        value_state = "ZERO" if raw_value == 0 else "VALUE"
    return {
        "client_code": str(record["client_code"]).strip(),
        "session_date": str(record["session_date"]).strip(),
        "duration_minutes": int(str(record["duration_minutes"]).strip()),
        "behavior_name": str(record["behavior_name"]).strip(),
        "measurement_type": str(record["measurement_type"]).strip().upper(),
        "raw_value": raw_value,
        "value_state": value_state,
    }


def quality_report(rows_read: int, accepted: pd.DataFrame, rejected: pd.DataFrame) -> dict:
    """Counts rows read, kept, dropped, and why."""
    reasons: dict[str, int] = {}
    if not rejected.empty and "reject_reason" in rejected.columns:
        reasons = {str(key): int(value) for key, value in rejected["reject_reason"].value_counts().items()}

    missing = 0
    zeros = 0
    if not accepted.empty:
        missing = int((accepted["value_state"] == "MISSING").sum())
        zeros = int((accepted["value_state"] == "ZERO").sum())

    return {
        "rows_read": rows_read,
        "rows_accepted": int(len(accepted)),
        "rows_rejected": int(len(rejected)),
        "reject_reasons": reasons,
        "missing_measurements": missing,
        "true_zeros": zeros,
    }


def staging_key(row: dict) -> tuple[str, str, str]:
    """The same three columns the database unique index uses."""
    return (row["client_code"], str(row["session_date"]), row["behavior_name"])


def upsert_rows(existing: dict[tuple[str, str, str], dict], rows: list[dict]) -> dict[tuple[str, str, str], dict]:
    """
    In-memory version of ON CONFLICT DO UPDATE.

    A repeated load replaces the row for that key. It does not append a second one.
    """
    merged = dict(existing)
    for row in rows:
        merged[staging_key(row)] = row
    return merged


def load_postgres(accepted: pd.DataFrame, database_url: str, batch_size: int = 5000) -> int:
    """Upsert accepted rows in batches. Returns how many keys were applied."""
    import psycopg

    if accepted.empty:
        return 0

    rows = _insert_tuples(accepted)
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(STAGING_DDL)
            cursor.execute(UNIQUE_INDEX_SQL)
            for i in range(0, len(rows), batch_size):
                cursor.executemany(INSERT_SQL, rows[i : i + batch_size])
        connection.commit()
    return int(len(accepted))


def _insert_tuples(accepted: pd.DataFrame) -> list[tuple]:
    rows = []
    for record in accepted.to_dict(orient="records"):
        raw_value = record["raw_value"]
        rows.append(
            (
                record["client_code"],
                record["session_date"],
                int(record["duration_minutes"]),
                record["behavior_name"],
                record["measurement_type"],
                None if raw_value is None or pd.isna(raw_value) else float(raw_value),
                record["value_state"],
            )
        )
    return rows


def run(csv_path: Path, database_url: str | None, report_path: Path) -> dict:
    import time

    started = time.perf_counter()
    raw = extract_csv(csv_path)
    accepted, rejected = clean_and_split(raw)
    report = quality_report(len(raw), accepted, rejected)
    report["loaded_rows"] = 0
    if database_url:
        report["loaded_rows"] = load_postgres(accepted, database_url)
    report["seconds"] = round(time.perf_counter() - started, 2)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2))
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean a session CSV and load the good rows.")
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("artifacts/quality_report.json"),
    )
    args = parser.parse_args()
    # No URL means "write the report only." That lets you inspect rejects
    # before pointing the pipeline at a database.
    database_url = os.environ.get("DATABASE_URL")
    report = run(args.csv, database_url, args.report)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
