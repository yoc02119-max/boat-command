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

    def test_newest_first_prioritizes_recent_and_skips_existing(self):
        dates = batch.candidates("2026-09-01", "2026-09-08",
                                 {"2026-09-08"}, 3, newest_first=True)
        self.assertEqual(dates, ["2026-09-07", "2026-09-06", "2026-09-05"])

    def test_two_rounds_skip_transient_failed_day_until_next_run(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)
            called = []
            def sometimes_fails(date):
                called.append(date)
                if date == "2026-09-08":
                    raise ValueError("transient HTTP 503")
                return safe_report(date)
            report = batch.bounded_backfill_rounds(
                base, base / "days", "2026-09-01", "2026-09-08",
                set(), limit=3, rounds=2, newest_first=True,
                builder=sometimes_fails)
            self.assertEqual(report["roundsExecuted"], 2)
            self.assertEqual(report["selectedDates"],
                             ["2026-09-08", "2026-09-07", "2026-09-06",
                              "2026-09-05", "2026-09-04", "2026-09-03"])
            self.assertEqual(report["newFiles"], 5)
            self.assertEqual([x["date"] for x in report["failedDates"]],
                             ["2026-09-08"])
            self.assertEqual(called.count("2026-09-08"), 1)
            self.assertFalse((base / "days" / "2026-09-08.json").exists())
            again = batch.bounded_backfill_rounds(
                base, base / "days", "2026-09-01", "2026-09-08",
                set(c["date"] for c in report["completedDates"]),
                limit=3, rounds=1, newest_first=True,
                builder=lambda date: safe_report(date))
            self.assertEqual(again["selectedDates"][0], "2026-09-08")
            self.assertEqual(again["newFiles"], 3)

    def test_two_round_limit_enforced(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(ValueError, "MAX_TWO"):
                batch.bounded_backfill_rounds(
                    Path(d), Path(d) / "out", "2026-09-01",
                    "2026-09-02", set(), rounds=3)
            with self.assertRaisesRegex(ValueError, "MAX_DATES"):
                batch.bounded_backfill_rounds(
                    Path(d), Path(d) / "out", "2026-09-01",
                    "2026-09-19", set(), limit=17, rounds=1)

    def test_no_dates_left_creates_no_files_or_requests(self):
        with tempfile.TemporaryDirectory() as d:
            report = batch.bounded_backfill_rounds(
                Path(d), Path(d) / "out", "2026-09-01", "2026-09-02",
                {"2026-09-01", "2026-09-02"}, 2, 2,
                builder=lambda _: self.fail("unexpected fetch"))
            self.assertEqual(report["roundsExecuted"], 0)
            self.assertEqual(report["newFiles"], 0)
            self.assertEqual(report["selectedDates"], [])

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
