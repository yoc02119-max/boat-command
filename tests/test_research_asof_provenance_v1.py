"""Offline negative controls for research-only as-of field provenance."""
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "research_asof_provenance_v1", ROOT / "scripts/research-asof-provenance-v1.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def program(fetched="2026-09-25T20:15:00+09:00"):
    return {
        "date": "2026-09-25", "race": 12, "deadline": "20:35", "fetchedAt": fetched,
        "resultEndpointsIncluded": False, "resultIncluded": False,
        "boats": [{"lane": lane, "registration": 5000 + lane,
                   "class": "A1", "motor": lane + 20}
                  for lane in range(1, 7)],
    }


def pre(fetched="2026-09-25T20:25:00+09:00"):
    item = program(fetched)
    item.pop("resultIncluded")
    item["payoutEndpointsIncluded"] = False
    return item


class AsofAuditTests(unittest.TestCase):
    def test_cutoff_and_timezones(self):
        self.assertEqual(mod.cutoff_for("2026-09-25", "20:35").isoformat(),
                         "2026-09-25T20:32:00+09:00")
        self.assertIsNone(mod.cutoff_for("2026-09-25", "25:35"))
        self.assertIsNone(mod.observed("2026-09-25T20:25:00"))
        self.assertIsNone(mod.observed("2026-09-25T11:25:00+00:00"))

    def test_relative_time_is_not_absolute_history_proof(self):
        result = mod.audit_live_pair(program(), pre(), "2026-09-25", 12)
        self.assertEqual(result["status"], "RELATIVE_TIMES_COMPATIBLE_UNPROVEN")
        self.assertIs(result["strictCardUsePermitted"], False)

    def test_current_program_file_overwritten_late(self):
        # This is a real-world-shaped negative control: current file AFTER
        # deadline but independent pre-rich captured before the deadline.
        actual = mod.audit_live_pair(
            program("2026-09-25T22:56:00+09:00"), pre(), "2026-09-25", 12)
        self.assertEqual(actual["status"], "CURRENT_PROGRAM_IS_LATER_THAN_PRE_RICH")
        self.assertFalse(actual["strictCardUsePermitted"])

    def test_field_drift_requires_quarantine(self):
        candidate = program()
        candidate["boats"][2]["motor"] = 999
        result = mod.audit_live_pair(candidate, pre(), "2026-09-25", 12)
        self.assertEqual(result["status"], "PROGRAM_FIELD_DRIFT")
        self.assertEqual(result["fieldDrift"]["motor"], 1)

    def test_source_conflict_invalid_time_and_identity(self):
        item = pre()
        item["payoutEndpointsIncluded"] = True
        self.assertEqual(mod.audit_live_pair(program(), item, "2026-09-25", 12)["status"],
                         "PRE_RICH_BOUNDARY_INVALID")
        self.assertEqual(mod.audit_live_pair(program(), pre("2026-09-25T20:34:00+09:00"),
                                                 "2026-09-25", 12)["status"],
                         "PRE_RICH_AFTER_T_MINUS_3")
        different = program()
        different["boats"][0]["registration"] = 9999
        self.assertEqual(mod.audit_live_pair(different, pre(), "2026-09-25", 12)["status"],
                         "SIX_RACER_IDENTITY_MISMATCH")
        self.assertEqual(mod.audit_live_pair(None, pre(), "2026-09-25", 12)["status"],
                         "PROGRAM_SNAPSHOT_MISSING")

    def test_official_historical_is_diagnostic_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            p = root / "kiryu" / "2026-05-20.json"
            p.parent.mkdir(parents=True)
            doc = {"venueCode": "01", "date": "2026-05-20",
                   "resultEndpointsIncluded": False, "payoutEndpointsIncluded": False,
                   "races": [
                       {"fieldStatus": {"exhibitionTimeCount": 6,
                                        "startExhibitionSTCount": 6,
                                        "weatherCoreCount": 4}},
                       {"fieldStatus": {"exhibitionTimeCount": 0}}]}
            p.write_text(json.dumps(doc))
            result = mod.scan_historical(root)
            self.assertEqual(result["kiryu"]["racePages"], 2)
            self.assertEqual(result["kiryu"]["allThreeParsed"], 1)
            self.assertEqual(result["kiryu"]["strictPreTimingUnproven"], 2)
            self.assertFalse(result["kiryu"]["strictCardUsePermitted"])
            doc["resultEndpointsIncluded"] = True
            p.write_text(json.dumps(doc))
            with self.assertRaisesRegex(ValueError, "UNSAFE"):
                mod.scan_historical(root)

    def test_vendor_timing_zero_release_and_manifest_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            days = root / "days"
            days.mkdir()
            row = {"raceCode": "202606030101", "status": "ACCEPTED",
                   "pre": {"cardTiming": "UNKNOWN_UNVERIFIED_FOR_STRICT_MODEL",
                           "tkz": {"status": "ELIGIBLE_T_MINUS_3"},
                           "stt": {"status": "ELIGIBLE_T_MINUS_3"},
                           "sui": {"status": "ELIGIBLE_T_MINUS_3"}}}
            day = {"date": "2026-06-03", "researchOnly": True,
                   "productionChanged": False, "prePostSeparated": True, "races": [row]}
            path = days / "2026-06-03.json"
            path.write_text(json.dumps(day))
            sha = hashlib.sha256(path.read_bytes()).hexdigest()
            venues = [{"venue": slug, "venueCode": code,
                       "archivedTargetRaces": 1 if code == "01" else 0,
                       "acceptedJoinedRaces": 1 if code == "01" else 0,
                       "preStrictTMinus3": {"allThree": 1 if code == "01" else 0}}
                      for code, slug in mod.VENUES.items()]
            coverage = {
                "schema": "boat-command-inverse-research-coverage-v1",
                "researchOnly": True, "productionChanged": False,
                "venues": venues,
                "archivedDayFiles": [{"date": "2026-06-03", "sha256": sha}],
                "summary": {"sourceRaces": 27_094, "archivedTargetRaces": 1, "venues": 24},
            }
            (root / "coverage-v1.json").write_text(json.dumps(coverage))
            result = mod.scan_vendor(root)
            self.assertEqual(result["venues"]["kiryu"]["identityJoinedCardButUntimed"], 1)
            self.assertEqual(result["venues"]["kiryu"]["eligibleThreePreviewSections"], 1)
            self.assertFalse(result["venues"]["kiryu"]["strictCardUsePermitted"])
            row["pre"]["cardTiming"] = "TRUST_ME"
            path.write_text(json.dumps(day))
            coverage["archivedDayFiles"][0]["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
            (root / "coverage-v1.json").write_text(json.dumps(coverage))
            with self.assertRaisesRegex(ValueError, "POLICY_CHANGED"):
                mod.scan_vendor(root)
            coverage["archivedDayFiles"][0]["sha256"] = "0" * 64
            (root / "coverage-v1.json").write_text(json.dumps(coverage))
            with self.assertRaisesRegex(ValueError, "HASH_MISMATCH"):
                mod.scan_vendor(root)


if __name__ == "__main__":
    unittest.main()
