"""
Write a larger synthetic session CSV.

The mix is fixed so the quality report stays the same every time you run this.
Nothing here is a real client record.
"""

from __future__ import annotations

import csv
from pathlib import Path

# 20 copies of each pattern below. 20 x 20 = 400 rows.
BLOCKS = 20
OUT = Path(__file__).parent / "fixtures" / "sessions_400.csv"

HEADER = [
    "client_code",
    "session_date",
    "duration_minutes",
    "behavior_name",
    "measurement_type",
    "raw_value",
]


def main() -> None:
    rows: list[dict[str, str]] = []
    for block in range(BLOCKS):
        day = block + 1
        client = f"C{block % 5}"
        # Residue 4 is a real zero. Residue 5 repeats that same key so the
        # pipeline can reject it as a duplicate instead of loading it twice.
        zero_key = {
            "client_code": client,
            "session_date": f"2026-02-{day:02d}",
            "behavior_name": "Requests",
        }
        for slot in range(20):
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

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {OUT}")


if __name__ == "__main__":
    main()
