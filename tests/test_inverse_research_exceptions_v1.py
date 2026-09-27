"""Offline exception reconciliation tests; no network, model or bankroll."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "inverse-research-exceptions-v1.py"
spec = importlib.util.spec_from_file_location("inverse_research_exceptions_v1", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExceptionsTest(unittest.TestCase):
    def setUp(self):
        t = tempfile.TemporaryDirectory()
        self.addCleanup(t.cleanup)
        self.path = Path(t.name)
        self.day = "2026-09-01"
        self.good = {
            "raceCode": "202609010201", "venue": "toda", "venueCode": "02",
            "status": "ACCEPTED", "identityMatch": True,
            "post": {"actual": "1-2-3", "payout100": 1250},
        }
        self.unknown = {
            "raceCode": "202609010202", "status": "NO_CARD",
        }
        self.missing = {
            "raceCode": "202609010203", "venue": "toda", "venueCode": "02",
            "status": "LABEL_INCOMPLETE", "post": None,
            "labelAvailability": {
                "resultRowPresent": True, "resultTrifectaUsable": True,
                "payoutRowPresent": False, "payoutTrifectaUsable": False,
                "payoutYenUsable": False,
            },
        }

    def write_day(self, races, filename="2026-09-01.json", audit=None):
        payload = {
            "schema": "boat-command-inverse-join-v1",
            "date": filename[:-5], "researchOnly": True,
            "productionChanged": False, "prePostSeparated": True,
            "races": races,
            "sourceAudit": audit or {},
        }
        (self.path / filename).write_text(json.dumps(payload), encoding="utf-8")

    def test_count_and_attribution_without_synthesizing_data(self):
        self.write_day([self.good, self.unknown, self.missing])
        result = module.audit_days(self.path)
        self.assertEqual(result["summary"]["visitedRaces"], 3)
        self.assertEqual(result["summary"]["unacceptedRaces"], 2)
        self.assertEqual(result["summary"]["byStatus"], {
            "LABEL_INCOMPLETE": 1, "NO_CARD": 1})
        a = next(v for v in result["exceptions"] if v["status"] == "NO_CARD")
        self.assertEqual(a["venueCode"], "02")
        self.assertEqual(a["venue"], "CODE_02")
        b = next(v for v in result["exceptions"] if v["status"] == "LABEL_INCOMPLETE")
        self.assertIn("NOT_PAYOUTROWPRESENT", b["labelMissingReasons"])
        self.assertTrue(b["archiveDetailRecorded"])
        self.assertTrue(result["immutableSourcesPreserved"])

    def test_old_day_without_detail_is_truthfully_undetermined(self):
        older = dict(self.missing)
        older.pop("labelAvailability")
        self.write_day([older])
        result = module.audit_days(self.path)
        self.assertEqual(result["summary"]["unresolvedLegacyWithoutDetailedReason"], 1)
        self.assertEqual(result["exceptions"][0]["labelMissingReasons"],
                         ["DETAIL_NOT_RECORDED_IN_IMMUTABLE_SNAPSHOT"])

    def test_conflicts_are_preserved(self):
        conflicted = dict(self.missing, status="LABEL_CONFLICT",
                          conflicts=["ORIGINAL_VS_THIRD_PARTY_PAYOUT"])
        self.write_day([conflicted])
        result = module.audit_days(self.path)
        self.assertEqual(result["exceptions"][0]["conflictReasons"],
                         ["ORIGINAL_VS_THIRD_PARTY_PAYOUT"])

    def test_duplicate_races_rejected(self):
        self.write_day([self.good, self.good])
        with self.assertRaisesRegex(ValueError, "DUPLICATE_RACE"):
            module.audit_days(self.path)

    def test_unsafe_day_rejected(self):
        self.write_day([self.good])
        file = self.path / "2026-09-01.json"
        data = json.loads(file.read_text(encoding="utf-8"))
        data["productionChanged"] = True
        file.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "UNSAFE"):
            module.audit_days(self.path)

    def test_does_not_misreport_file_fetch_success_as_race_coverage(self):
        source = {key: {"status": "OK"} for key in module.SOURCE_NAMES}
        self.write_day([self.unknown], audit=source)
        report = module.audit_days(self.path)
        self.assertEqual(report["summary"]["unacceptedRaces"], 1)
        self.assertEqual(report["summary"]["daysWithSourceFileNotOk"], {})
        self.assertEqual(report["exceptions"][0]["status"], "NO_CARD")


if __name__ == "__main__":
    unittest.main()
