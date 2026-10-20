# tests that need a real postgres db
# only run if TEST_DATABASE_URL is set (CI sets it). drops the staging table first!

import os
from pathlib import Path

import pytest

from pipeline import clean_and_split, extract_csv, load_postgres

DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
FIXTURE = Path(__file__).parent / "fixtures" / "raw_sessions.csv"

pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="TEST_DATABASE_URL not set")


@pytest.fixture()
def conn():
    import psycopg

    with psycopg.connect(DATABASE_URL) as c:
        c.execute("DROP TABLE IF EXISTS observation_staging")
        c.commit()
        yield c


def count_rows(conn, where="TRUE"):
    return conn.execute(f"SELECT count(*) FROM observation_staging WHERE {where}").fetchone()[0]


def test_loading_twice_does_not_duplicate(conn):
    accepted, _ = clean_and_split(extract_csv(FIXTURE))
    load_postgres(accepted, DATABASE_URL)
    load_postgres(accepted, DATABASE_URL)
    assert count_rows(conn) == len(accepted)


def test_missing_and_zero_stay_different(conn):
    accepted, _ = clean_and_split(extract_csv(FIXTURE))
    load_postgres(accepted, DATABASE_URL)
    # blank should be NULL, a real 0 should be 0
    assert count_rows(conn, "value_state = 'MISSING' AND raw_value IS NULL") == 2
    assert count_rows(conn, "value_state = 'ZERO' AND raw_value = 0") == 1
