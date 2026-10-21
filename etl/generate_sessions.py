# writes a synthetic session csv
# the mix of bad dates, zeros, missing, and dupes is the same every run
# nothing here is a real client record

from __future__ import annotations

import argparse
import csv
from datetime import date, timedelta
from pathlib import Path

HEADER = [
    "client_code",
    "session_date",
    "duration_minutes",
    "behavior_name",
    "measurement_type",
    "raw_value",
]

# each block is 20 rows: 4 rejects, 1 missing, 1 true zero, 14 normal
ROWS_PER_BLOCK = 20
DEFAULT_ROWS = 400
DEFAULT_OUT = Path(__file__).parent / "fixtures" / "sessions_400.csv"


def build_rows(n_rows: int) -> list[dict[str, str]]:
    if n_rows % ROWS_PER_BLOCK != 0:
        raise ValueError(f"--rows must be a multiple of {ROWS_PER_BLOCK}")

    rows: list[dict[str, str]] = []
    blocks = n_rows // ROWS_PER_BLOCK
    start = date(2020, 1, 1)

    for block in range(blocks):
        client = f"C{block % 5}"
        # unique valid date per block so the 0 vs duplicate pair still works
        # at 500k rows (feb-31 would blow up if we just used block + 1)
        zero_date = (start + timedelta(days=block)).isoformat()
        zero_key = {
            "client_code": client,
            "session_date": zero_date,
            "behavior_name": "Requests",
        }
        for slot in range(ROWS_PER_BLOCK):
            row = {
                "client_code": client,
                "session_date": f"2026-03-{(slot % 27) + 1:02d}",
                "duration_minutes": "60",
                "behavior_name": f"Behavior{block}-{slot}",
                "measurement_type": "frequency",
                "raw_value": str(slot + 1),
            }
            if slot == 0:
                row["session_date"] = "not-a-date"
            elif slot == 1:
                row["duration_minutes"] = "0"
            elif slot == 2:
                row["measurement_type"] = "not-a-type"
            elif slot == 3:
                row["raw_value"] = ""
            elif slot == 4:
                row.update(zero_key)
                row["raw_value"] = "0"
            elif slot == 5:
                row.update(zero_key)
                row["raw_value"] = "8"
            rows.append(row)
    return rows


def write_csv(path: Path, n_rows: int) -> int:
    rows = build_rows(n_rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=DEFAULT_ROWS)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()
    out = args.out
    if out is None:
        if args.rows == DEFAULT_ROWS:
            out = DEFAULT_OUT
        else:
            out = Path(__file__).parent / "artifacts" / f"sessions_{args.rows}.csv"
    n = write_csv(out, args.rows)
    print(f"Wrote {n} rows to {out}")


if __name__ == "__main__":
    main()
