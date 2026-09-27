"""Network-free, no-live-write contracts for inverse-venue probability research."""
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/inverse-venue-prototype-v1.py"
spec = importlib.util.spec_from_file_location("inverse_venue_prototype_v1", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def race(day, code="01", winner="1-2-3"):
    cutoff = f"{day}T11:52:00+09:00"
    stamp = f"{day}T11:45:00+09:00"
    number = 1 if code == "01" else 2
    return {
        "date": day, "venueCode": code,
        "raceCode": day.replace("-", "") + code + "01",
        "predictionCutoffJst": cutoff,
        "status": "ACCEPTED", "identityMatch": True,
        "pre": {
            "cardTiming": "UNKNOWN_UNVERIFIED_FOR_STRICT_MODEL",
            "boats": [{"nationalWinRate": "99"}] * 6,
            "tkz": {"status": "ELIGIBLE_T_MINUS_3", "acquiredAt": stamp,
                    "value": [{"exhibitionTime": str(6.70 + (0 if lane == number else lane / 100))}
                              for lane in range(1, 7)]},
            "stt": {"status": "ELIGIBLE_T_MINUS_3", "acquiredAt": stamp,
                    "value": [{"exhibitionST": "0.15"}] * 6},
            "sui": {"status": "ELIGIBLE_T_MINUS_3", "acquiredAt": stamp,
                    "value": {"windSpeedMps": "3.0"}},
        },
        "post": {
            "actual": winner, "payout100": 2000, "decisionRaw": "逃　げ",
            "actualCourseStart": [{"course": lane, "boat": lane}
                                  for lane in range(1, 7)],
        },
    }


class InverseVenuePrototypeTests(unittest.TestCase):
    def setUp(self):
        self.row = race("2026-06-03")

    def test_pre_only_and_time_boundary(self):
        expected = mod.safe_features(self.row)
        self.assertEqual(expected, ("1", "2-3m"))
        changed = copy.deepcopy(self.row)
        changed["post"] = {"actual": "6-5-4", "payout100": 9999999}
        changed["pre"]["boats"] = [{"nationalWinRate": "0"}] * 6
        self.assertEqual(mod.safe_features(changed), expected)
        for invalid in [
            {"status": "TIMESTAMP_UNKNOWN", "acquiredAt": None},
            {"status": "ELIGIBLE_T_MINUS_3", "acquiredAt": "2026-06-03T11:53:00+09:00"},
            {"status": "ELIGIBLE_T_MINUS_3", "acquiredAt": "2026-06-04T11:45:00+09:00"},
        ]:
            changed = copy.deepcopy(self.row)
            changed["pre"]["tkz"].update(invalid)
            self.assertIsNone(mod.safe_features(changed))
        changed = copy.deepcopy(self.row)
        changed["predictionCutoffJst"] = None
        self.assertIsNone(mod.safe_features(changed))

    def test_probability_mass_and_development(self):
        model = mod.fit([(mod.safe_features(self.row), self.row)])
        prediction = mod.predict(model, mod.safe_features(self.row))
        self.assertEqual(len(prediction["candidate"]), 120)
        for name in ("venuePrior", "candidate"):
            self.assertAlmostEqual(sum(prediction[name].values()), 1.0, places=10)
            self.assertTrue(all(0 < value < 1 for value in prediction[name].values()))
        self.assertAlmostEqual(sum(prediction["winningBoatGroups"].values()), 1, places=10)
        for distribution in prediction["development"].values():
            self.assertAlmostEqual(sum(distribution.values()), 1, places=10)
        self.assertGreater(prediction["development"]["technique"]["逃げ"], 0)

    def test_strict_chronological_and_venue_isolation(self):
        rows = []
        base = dt.date(2026, 6, 1)
        for offset in range(12):
            day = (base + dt.timedelta(days=offset)).isoformat()
            rows.append(race(day, "01", "1-2-3"))
            rows.append(race(day, "02", "6-5-4"))
        result = mod.evaluate_rows(rows, min_train=2, min_holdout=1)
        self.assertEqual(result["summary"]["venueCount"], 24)
        self.assertEqual(result["summary"]["evaluatedVenues"], 2)
        self.assertEqual(result["trainEndExclusive"], "2026-06-10")
        first, second = result["venues"][:2]
        self.assertEqual(first["trainRaces"], 9)
        self.assertEqual(first["holdoutRaces"], 3)
        self.assertEqual(first["metrics"]["venuePrior"]["top1Hits"], 3)
        self.assertEqual(second["metrics"]["venuePrior"]["top1Hits"], 3)
        self.assertEqual(result["venues"][2]["status"], "INSUFFICIENT_CHRONOLOGICAL_EVIDENCE")

    def test_labels_are_for_evaluation_not_selection(self):
        day = "2026-06-03"
        rejected = race(day)
        rejected["status"] = "LABEL_CONFLICT"
        self.assertFalse(mod.valid_label(rejected))
        self.assertIsNotNone(mod.safe_features(rejected))
        # No settled payout or result fields enter the PRE feature derivation.
        rejected["post"] = {}
        self.assertEqual(mod.safe_features(rejected), mod.safe_features(self.row))
        self.assertFalse(mod.valid_label(rejected))

    def test_day_immutability_hash_and_duplicate(self):
        with tempfile.TemporaryDirectory() as temp:
            days = Path(temp)
            row = self.row
            body = {"date": "2026-06-03", "schema": "boat-command-inverse-join-v1",
                    "researchOnly": True, "productionChanged": False,
                    "prePostSeparated": True, "races": [row]}
            file = days / "2026-06-03.json"
            file.write_text(json.dumps(body), encoding="utf-8")
            source = hashlib.sha256(file.read_bytes()).hexdigest()
            coverage = {"archivedDayFiles": [{"date": "2026-06-03", "sha256": source}]}
            self.assertEqual(len(mod.load_verified_days(days, coverage)), 1)
            file.write_text(json.dumps({"modified": True}))
            with self.assertRaisesRegex(ValueError, "HASH_MISMATCH"):
                mod.load_verified_days(days, coverage)
            file.write_text(json.dumps({**body, "races": [row, row]}))
            coverage["archivedDayFiles"][0]["sha256"] = hashlib.sha256(file.read_bytes()).hexdigest()
            with self.assertRaisesRegex(ValueError, "DUPLICATE"):
                mod.load_verified_days(days, coverage)


if __name__ == "__main__":
    unittest.main()
