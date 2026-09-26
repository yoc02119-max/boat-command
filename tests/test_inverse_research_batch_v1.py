#!/usr/bin/env python3
"""Test bounded backfill without network or access to the live app."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

FILE = Path(__file__).resolve().parents[1] / "scripts" / "inverse-research-batch-v1.py"
spec = importlib.util.spec_from_file_location("inverse_research_batch_v1", FILE)
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)


def safe_report(date, accepted=1):
    return {
        "schema": "boat-command-inverse-join-v1", "date": date,
        "researchOnly": True, "productionChanged": False,
        "prePostSeparated": True,
        "summary": {"targetRaces": 1, "accepted": accepted,
                    "sourceFileCountOK": 6}, "races": [],
    }


class BatchTests(unittest.TestCase):
    def test_bounded_and_skips_existing(self):
        dates = batch.candidates("2026-09-01", "2026-09-08",
                                 {"2026-09-01", "2026-09-02"}, 3)
        self.assertEqual(dates, ["2026-09-03", "2026-09-04", "2026-09-05"])

    def test_reject_excessive_capacity_and_span(self):
        with self.assertRaisesRegex(ValueError, "MAX_DATES"):
            batch.candidates("2026-09-01", "2026-09-02", set(), 17)
        with self.assertRaisesRegex(ValueError, "INVALID_OR_EXCESSIVE"):
            batch.candidates("2026-09-02", "2026-09-01", set(), 8)

    def test_date_list_strict(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "dates"
            f.write_text("2026-09-01\n2026-09-02\n", encoding="utf-8")
            self.assertEqual(batch.existing_dates(f),
                             {"2026-09-01", "2026-09-02"})
            f.write_text("../bad.json\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "INVALID_EXISTING_DATE"):
                batch.existing_dates(f)

    def test_independent_immutable_day_outputs(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)
            dates = ["2026-09-01", "2026-09-02"]
            results = batch.bounded_backfill(
                base, base / "out", dates, lambda date: safe_report(date))
            self.assertEqual(results["newFiles"], 2)
            self.assertTrue(results["researchOnly"])
            self.assertFalse(results["productionChanged"])
            self.assertEqual(len(list((base / "out").glob("*.json"))), 2)
            repeated = batch.bounded_backfill(
                base, base / "out", dates, lambda date: safe_report(date))
            self.assertEqual(repeated["newFiles"], 0)
            self.assertEqual(len(repeated["failedDates"]), 2)

    def test_failed_date_not_persisted(self):
        with tempfile.TemporaryDirectory() as d:
            def fail(date):
                if date.endswith("02"):
                    raise ValueError("network_unavailable")
                return safe_report(date)
            report = batch.bounded_backfill(
                Path(d), Path(d) / "out", ["2026-09-01", "2026-09-02"], fail)
            self.assertEqual(report["newFiles"], 1)
            self.assertEqual(report["failedDates"][0]["date"], "2026-09-02")
            self.assertFalse((Path(d) / "out" / "2026-09-02.json").exists())

    def test_unsafe_report_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            bad = safe_report("2026-09-01")
            bad["productionChanged"] = True
            report = batch.bounded_backfill(
                Path(d), Path(d) / "out", ["2026-09-01"], lambda _: bad)
            self.assertEqual(report["newFiles"], 0)
            self.assertEqual(len(report["failedDates"]), 1)


if __name__ == "__main__":
    unittest.main()
