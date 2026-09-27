"""Offline tests for 24-venue integrated-data completeness and strict timing."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "inverse_research_coverage_v1", ROOT / "scripts" / "inverse-research-coverage-v1.py")
coverage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coverage)


class CoverageTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.history = self.root / "history"
        self.days = self.root / "days"
        self.history.mkdir()
        self.days.mkdir()
        # The real input requires all 24 distinct venue histories.
        for code, slug in [(f"{i:02d}", s) for i, s in enumerate([
            "kiryu", "toda", "edogawa", "heiwajima", "tamagawa", "hamanako",
            "gamagori", "tokoname", "tsu", "mikuni", "biwako", "suminoe",
            "amagasaki", "naruto", "marugame", "kojima", "miyajima", "tokuyama",
            "shimonoseki", "wakamatsu", "ashiya", "fukuoka", "karatsu", "omura"], 1)]:
            races = ([{"d": "2026-09-01", "r": 1},
                      {"d": "2026-09-01", "r": 2},
                      {"d": "2026-09-02", "r": 1}] if slug == "toda" else [])
            (self.history / f"{slug}-rich-history-v1.json").write_text(
                json.dumps({"venueCode": code, "races": races}), encoding="utf-8")
        self.good = {
            "raceCode": "202609010201", "venue": "toda", "status": "ACCEPTED",
            "identityMatch": True, "post": {"actual": "1-2-3", "payout100": 500},
            "legacyLabelAvailable": True,
            "pre": {name: {"status": "ELIGIBLE_T_MINUS_3",
                           "value": {"valid": True}, "acquiredAt": "2026-09-01T09:00+09:00"}
                    for name in ("tkz", "stt", "sui")},
        }
        self.incomplete = {
            "raceCode": "202609010202", "venue": "toda",
            "status": "LABEL_INCOMPLETE", "pre": {}, "post": None,
        }
        self.file = self.days / "2026-09-01.json"
        self.write_doc(self.file, [self.good, self.incomplete])

    @staticmethod
    def write_doc(path, races, status=None):
        doc = {"schema": "boat-command-inverse-join-v1", "date": path.stem,
               "researchOnly": True, "productionChanged": False,
               "prePostSeparated": True, "sourceAudit": {},
               "races": races}
        if status:
            doc["status"] = status
        path.write_text(json.dumps(doc), encoding="utf-8")

    def test_venue_coverage_and_missing_rates_are_distinct(self):
        a = coverage.build_coverage(self.history, self.days)
        self.assertTrue(a["researchOnly"])
        self.assertEqual(a["summary"]["venues"], 24)
        self.assertEqual(a["summary"]["sourceRaces"], 3)
        self.assertEqual(a["summary"]["archivedTargetRaces"], 2)
        self.assertEqual(a["summary"]["acceptedJoinedRaces"], 1)
        self.assertEqual(a["summary"]["remainingUnarchivedRaces"], 1)
        self.assertFalse(a["summary"]["allSourceTargetsVisited"])
        self.assertEqual(a["summary"]["preStrictTMinus3"]["allThree"], 1)
        toda = next(v for v in a["venues"] if v["venue"] == "toda")
        self.assertEqual(toda["statusReasons"]["LABEL_INCOMPLETE"], 1)
        self.assertEqual(toda["nextPendingDay"], "2026-09-02")
        self.assertFalse(toda["cardFieldsStrictlyTimeVerified"])

    def test_sparse_rejected_row_keeps_venue_denominator(self):
        # NO_CARD and SIX_RACER_IDENTITY_REJECTED may be recorded with
        # only raceCode + status. Infer venue from trusted original history.
        self.incomplete = {"raceCode": "202609010202", "status": "NO_CARD"}
        self.write_doc(self.file, [self.good, self.incomplete])
        result = coverage.build_coverage(self.history, self.days)
        toda = next(x for x in result["venues"] if x["venue"] == "toda")
        self.assertEqual(toda["archivedTargetRaces"], 2)
        self.assertEqual(toda["acceptedJoinedRaces"], 1)
        self.assertEqual(toda["statusReasons"]["NO_CARD"], 1)
        self.assertEqual(result["summary"]["nonAcceptedArchivedRaces"], 1)

    def test_declared_venue_conflicting_with_race_code_is_rejected(self):
        self.incomplete["venue"] = "kiryu"
        self.write_doc(self.file, [self.good, self.incomplete])
        with self.assertRaisesRegex(ValueError, "ORPHAN_ARCHIVED_RACE"):
            coverage.build_coverage(self.history, self.days)

    def test_empty_day_can_be_archived_without_network(self):
        self.write_doc(self.days / "2026-09-03.json", [], "NO_EXISTING_TARGETS")
        a = coverage.build_coverage(self.history, self.days)
        self.assertEqual(a["summary"]["emptyArchivedCalendarDays"], 1)
        self.assertEqual(a["summary"]["archivedTargetRaces"], 2)

    def test_accepts_100_percent_visited_but_preserves_incomplete(self):
        third = dict(self.good, raceCode="202609020201")
        self.write_doc(self.days / "2026-09-02.json", [third])
        a = coverage.build_coverage(self.history, self.days)
        self.assertTrue(a["summary"]["allSourceTargetsVisited"])
        self.assertEqual(a["summary"]["acceptedJoinedRaces"], 2)
        self.assertEqual(a["summary"]["nonAcceptedArchivedRaces"], 1)

    def test_rejects_orphan_and_duplicate_race_code(self):
        self.incomplete["raceCode"] = "202609010299"
        self.write_doc(self.file, [self.good, self.incomplete])
        with self.assertRaisesRegex(ValueError, "ORPHAN"):
            coverage.build_coverage(self.history, self.days)
        self.write_doc(self.file, [self.good, self.good])
        with self.assertRaisesRegex(ValueError, "DUPLICATE"):
            coverage.build_coverage(self.history, self.days)

    def test_rejects_eligible_preview_without_time(self):
        bad = json.loads(json.dumps(self.good))
        bad["pre"]["tkz"]["acquiredAt"] = None
        self.write_doc(self.file, [bad])
        with self.assertRaisesRegex(ValueError, "INVALID_PRE_ELIGIBILITY"):
            coverage.build_coverage(self.history, self.days)

    def test_rejects_late_preview_values(self):
        bad = json.loads(json.dumps(self.good))
        bad["pre"]["tkz"]["status"] = "AFTER_T_MINUS_3"
        self.write_doc(self.file, [bad])
        with self.assertRaisesRegex(ValueError, "UNSAFE_PRE_VALUE"):
            coverage.build_coverage(self.history, self.days)

    def test_requires_24_source_venues(self):
        (self.history / "omura-rich-history-v1.json").unlink()
        with self.assertRaisesRegex(ValueError, "REQUIRES_COMPLETE_24"):
            coverage.build_coverage(self.history, self.days)


if __name__ == "__main__":
    unittest.main()
