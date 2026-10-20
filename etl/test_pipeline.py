"""Checks for the session CSV pipeline. No database required."""

from pathlib import Path

import pandas as pd

from pipeline import INSERT_SQL, clean_and_split, extract_csv, quality_report, upsert_rows

FIXTURE = Path(__file__).parent / "fixtures" / "raw_sessions.csv"


def test_fixture_separates_missing_zero_and_rejects():
    raw = extract_csv(FIXTURE)
    accepted, rejected = clean_and_split(raw)
    report = quality_report(len(raw), accepted, rejected)

    assert report["rows_read"] == 10
    # Kept: a real 4, a real 0, a blank, and an N/A.
    # Dropped: zero duration, bad date, bad type, duplicate, bad number, blank client.
    assert report["rows_accepted"] == 4
    assert report["rows_rejected"] == 6
    assert report["true_zeros"] == 1
    assert report["missing_measurements"] == 2
    assert report["reject_reasons"]["duplicate_key"] == 1
    assert report["reject_reasons"]["bad_duration"] == 1

    states = set(accepted["value_state"])
    assert states == {"VALUE", "ZERO", "MISSING"}
    zeros = accepted[accepted["value_state"] == "ZERO"]
    assert zeros.iloc[0]["raw_value"] == 0


def test_blank_count_is_not_stored_as_zero():
    frame = pd.DataFrame(
        [
            {
                "client_code": "AB",
                "session_date": "2026-02-02",
                "duration_minutes": "30",
                "behavior_name": "Requests",
                "measurement_type": "frequency",
                "raw_value": " ",
            }
        ]
    )
    accepted, rejected = clean_and_split(frame)
    assert rejected.empty
    assert accepted.iloc[0]["value_state"] == "MISSING"
    assert pd.isna(accepted.iloc[0]["raw_value"])


def test_load_sql_updates_on_conflict():
    assert "ON CONFLICT (client_code, session_date, behavior_name)" in INSERT_SQL
    assert "DO UPDATE" in INSERT_SQL


def test_repeat_load_does_not_duplicate():
    raw = extract_csv(FIXTURE)
    accepted, _rejected = clean_and_split(raw)
    rows = accepted.to_dict(orient="records")
    once = upsert_rows({}, rows)
    twice = upsert_rows(once, rows)
    assert len(twice) == len(once) == len(rows)
