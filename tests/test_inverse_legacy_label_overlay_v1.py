"""No-network regression tests for source-honest immutable label overlays."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def import_file(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


overlay = import_file("inverse_legacy_label_overlay_v1", "inverse-legacy-label-overlay-v1.py")
patterns = import_file("inverse_outcome_patterns_v1", "inverse-outcome-patterns-v1.py")
join = import_file("inverse_join_v1", "boatracecsv-inverse-join-v1.py")


class OverlayTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        self.history, self.days = root / "history", root / "days"
        self.history.mkdir()
        self.days.mkdir()
        for code, venue in join.VENUES.items():
            reg = 1000 + int(code)
            (self.history / f"{venue}-rich-history-v1.json").write_text(
                json.dumps({"venueCode": code, "races": [
                    {"d": "2026-08-29", "r": 1, "o": "1-3-2",
                     "p": 1870, "boats": [{"registration": reg} for _ in range(6)]}
                ]}), encoding="utf-8")
        self.racecode = "202608290201"
        self.race = {
            "raceCode": self.racecode, "date": "2026-08-29",
            "venue": "toda", "venueCode": "02",
            "status": "LABEL_INCOMPLETE",
            "identityMatch": True, "legacyLabelAvailable": True,
            "labelAvailability": {
                "resultRowPresent": False, "payoutRowPresent": False,
                "resultTrifectaUsable": False, "payoutTrifectaUsable": False,
                "payoutYenUsable": False,
            },
            "pre": {
                "cardTiming": "UNKNOWN_UNVERIFIED_FOR_STRICT_MODEL",
                "tkz": {"status": "ELIGIBLE_T_MINUS_3",
                        "value": [{"exhibitionTime": "6.78"} for _ in range(6)]},
                "stt": {"status": "ELIGIBLE_T_MINUS_3",
                        "value": [{"exhibitionCourse": str(i)} for i in range(1, 7)]},
                "sui": {"status": "ELIGIBLE_T_MINUS_3",
                        "value": {"windSpeedMps": "2"}},
            },
            "conflicts": [], "post": None,
        }
        self.path = self.days / "2026-08-29.json"
        self.write_doc([self.race])

    def write_doc(self, rows):
        self.path.write_text(json.dumps({
            "schema": "boat-command-inverse-join-v1", "date": "2026-08-29",
            "researchOnly": True, "productionChanged": False,
            "prePostSeparated": True, "races": rows,
        }), encoding="utf-8")

    def test_absent_vendor_rows_recover_existing_labels_without_fake_development(self):
        original = self.path.read_bytes()
        result = overlay.build_overlay(self.history, self.days)
        self.assertEqual(self.path.read_bytes(), original)
        self.assertEqual(result["summary"]["researchOnlyFallbackLabels"], 1)
        self.assertEqual(result["summary"]["fallbackWithAllThreeStrictPre"], 1)
        record = result["overrides"][self.racecode]
        self.assertEqual(record["post"]["actual"], "1-3-2")
        self.assertEqual(record["post"]["payout100"], 1870)
        self.assertIsNone(record["post"]["decisionRaw"])
        self.assertEqual(record["post"]["actualCourseStart"], [])
        self.assertEqual(record["archivedDaySha256"], hashlib.sha256(original).hexdigest())

    def test_conflict_identity_failure_or_partial_vendor_does_not_fallback(self):
        for change in ({"conflicts": ["ORIGINAL_VS_THIRD_PARTY_ORDER"]},
                       {"identityMatch": False},
                       {"labelAvailability": {"resultRowPresent": True, "payoutRowPresent": False}}):
            self.write_doc([{**self.race, **change}])
            result = overlay.build_overlay(self.history, self.days)
            self.assertEqual(result["overrides"], {})

    def test_unrecorded_legacy_diagnostic_not_assumed_missing_vendor(self):
        self.write_doc([{k: v for k, v in self.race.items() if k != "labelAvailability"}])
        self.assertEqual(overlay.build_overlay(self.history, self.days)["overrides"], {})

    def test_missing_original_label_not_invented(self):
        f = self.history / "toda-rich-history-v1.json"
        data = json.loads(f.read_text())
        data["races"][0]["p"] = None
        f.write_text(json.dumps(data))
        report = overlay.build_overlay(self.history, self.days)
        self.assertEqual(report["summary"]["researchOnlyFallbackLabels"], 0)
        self.assertEqual(report["summary"]["skippedOtherStatuses"]["ORIGINAL_STANDARD_TRIFECTA_UNAVAILABLE"], 1)

    def test_pattern_analysis_accepts_overlay_separately_and_preserves_unknown(self):
        result = overlay.build_overlay(self.history, self.days)
        fallback_file = self.days.parent / "overlay.json"
        fallback_file.write_text(json.dumps(result))
        rows, dates, provenance = patterns.load_documents([self.path], fallback_file)
        self.assertEqual(dates, ["2026-08-29"])
        self.assertEqual(len(provenance), 2)
        self.assertEqual(rows[0]["status"], "ACCEPTED")
        self.assertIsNone(rows[0]["post"]["decisionRaw"])
        report = patterns.summarize(rows, min_support=1)
        self.assertEqual(report["totals"]["thirdPartyLabelRaces"], 0)
        self.assertEqual(report["totals"]["legacyFallbackLabelRaces"], 1)
        self.assertEqual(report["venues"][0]["decisionObserved"]["UNKNOWN"], 1)

    def test_mutated_archive_or_fabricated_decision_rejected(self):
        overlay_file = self.days.parent / "overlay.json"
        result = overlay.build_overlay(self.history, self.days)
        result["overrides"][self.racecode]["post"]["decisionRaw"] = "まくり"
        overlay_file.write_text(json.dumps(result))
        with self.assertRaisesRegex(ValueError, "FABRICATE"):
            patterns.load_documents([self.path], overlay_file)
        correct = overlay.build_overlay(self.history, self.days)
        overlay_file.write_text(json.dumps(correct))
        self.write_doc([{**self.race, "pre": {"unsafe": "changed"}}])
        with self.assertRaisesRegex(ValueError, "ARCHIVE_CHANGED"):
            patterns.load_documents([self.path], overlay_file)


if __name__ == "__main__":
    unittest.main()
