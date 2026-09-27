#!/usr/bin/env python3
"""Offline checks that outcome-first research cannot leak outcome into predictors."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "inverse-outcome-patterns-v1.py"
spec = importlib.util.spec_from_file_location("inverse_outcome_patterns_v1", SCRIPT)
patterns = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patterns)


def sample(actual="6-2-3", payoff=152730, wind="2", exhibition="6.75",
           safe=True, code="202609012101"):
    tkz = [{"exhibitionTime": "6.78"} for _ in range(6)]
    tkz[5]["exhibitionTime"] = exhibition
    return {
        "raceCode": code, "venue": "ashiya", "status": "ACCEPTED",
        "pre": {
            "cardTiming": "UNKNOWN_UNVERIFIED_FOR_STRICT_MODEL",
            "boats": [{"motor2Rate": "99"} for _ in range(6)],
            "tkz": {"status": "ELIGIBLE_T_MINUS_3" if safe else "AFTER_T_MINUS_3",
                    "value": tkz},
            "sui": {"status": "ELIGIBLE_T_MINUS_3" if safe else "AFTER_T_MINUS_3",
                    "value": {"windSpeedMps": wind}},
        },
        "post": {
            "actual": actual, "payout100": payoff,
            "winningBoat": int(actual[0]), "decisionRaw": "まくり差し",
            "actualCourseStart": [{"course": x, "boat": x} for x in range(1, 7)],
        },
    }


class OutcomePatternsTest(unittest.TestCase):
    def test_pre_unchanged_when_post_replaced(self):
        a = sample()
        b = sample(actual="1-2-3", payoff=100)
        self.assertEqual(patterns.pre_features(a), patterns.pre_features(b))
        self.assertEqual(patterns.pre_features(a)["fastExhibitionBoat"], 6)
        self.assertEqual(patterns.pre_features(a)["windBucket"], "2-3m")

    def test_after_cutoff_excluded_even_if_values_present(self):
        f = patterns.pre_features(sample(safe=False))
        self.assertIsNone(f["fastExhibitionBoat"])
        self.assertIsNone(f["windBucket"])

    def test_group_denominator_includes_misses(self):
        rows = [
            sample(code="202609012101"),
            sample(actual="1-2-3", payoff=100, code="202609012102"),
            sample(code="202609012103"),
        ]
        report = patterns.summarize(rows, min_support=3)
        self.assertTrue(report["researchOnly"])
        self.assertFalse(report["autoPromotion"])
        by_key = {(a["dimension"], a["preCondition"]): a
                  for a in report["conditionalPatterns"]}
        group = by_key[("WIND_AND_FAST", "2-3m|boat6")]
        self.assertEqual(group["denominatorAllMatchingRaces"], 3)
        hit = next(x for x in group["outcomes"] if x["order"] == "6-2-3")
        self.assertEqual(hit["historicalHits"], 2)
        self.assertEqual(hit["denominatorAllMatchingRaces"], 3)
        self.assertAlmostEqual(hit["observedConditionalFrequency"], 2 / 3, places=6)
        self.assertEqual(report["claimLevel"], "IN_SAMPLE_DESCRIPTIVE_ASSOCIATIONS_ONLY")

    def test_development_conditions_count_wins_misses_and_unknown_st(self):
        rows = [
            sample(code="202609012101"),
            sample(actual="1-2-3", payoff=200, code="202609012102"),
            sample(code="202609012103"),
        ]
        rows[1]["post"]["decisionRaw"] = "逃　げ"
        report = patterns.summarize(rows, min_support=3)
        group = next(x for x in report["conditionalPatterns"]
                     if x["dimension"] == "WIND_AND_FAST"
                     and x["preCondition"] == "2-3m|boat6")
        dev = group["developmentEvidence"]
        self.assertEqual(dev["denominatorAllMatchingRaces"], 3)
        self.assertEqual(dev["recordedWinningTechniqueCounts"]["まくり差し"], 2)
        self.assertEqual(dev["recordedWinningTechniqueCounts"]["逃げ"], 1)
        self.assertEqual(dev["winningActualCourseCounts"]["6"], 2)
        self.assertEqual(dev["winningActualCourseCounts"]["1"], 1)
        self.assertEqual(dev["minimumActualSTBoatCounts"]["UNKNOWN"], 3)
        self.assertEqual(dev["outsideBoatWon"]["races"], 2)
        self.assertEqual(dev["outsideBoatPodium"]["races"], 2)
        self.assertAlmostEqual(dev["outsideBoatWon"]["observedFrequency"], 2/3, places=6)
        self.assertEqual(dev["evidenceRole"],
                         "POST_RACE_DESCRIPTIVE_NOT_SAME_RACE_PREDICTOR")

    def test_actual_st_evidence_rejects_flying_partial_and_tied(self):
        row = sample()
        start = row["post"]["actualCourseStart"]
        for v in start:
            v["actualST"] = "0.20"
        start[4]["actualST"] = "0.03"
        classified = patterns.classify_post(row["post"])
        self.assertEqual(classified["minimumActualSTBoat"], 5)
        self.assertEqual(classified["winningActualCourse"], 6)
        start[4]["flyingRaw"] = "F"
        self.assertIsNone(patterns.classify_post(row["post"])["minimumActualSTBoat"])
        start[4]["flyingRaw"] = ""
        start[3]["actualST"] = "0.03"
        self.assertIsNone(patterns.classify_post(row["post"])["minimumActualSTBoat"])
        start.pop()
        partial = patterns.classify_post(row["post"])
        self.assertIsNone(partial["winningActualCourse"])
        self.assertIsNone(partial["minimumActualSTBoat"])

    def test_group_requires_min_sample(self):
        report = patterns.summarize([sample()], min_support=20)
        self.assertEqual(report["totals"]["supportedGroups"], 0)
        self.assertGreater(report["totals"]["insufficientSampleGroupCounts"]["VENUE_ONLY"], 0)

    def test_missing_pre_still_contributes_venue_denominator(self):
        report = patterns.summarize([
            sample(safe=False),
            sample(code="202609012102")], min_support=2)
        venue = next(g for g in report["conditionalPatterns"] if g["dimension"] == "VENUE_ONLY")
        self.assertEqual(venue["denominatorAllMatchingRaces"], 2)
        self.assertEqual(report["totals"]["preMissing"]["noEligibleFastExhibition"], 1)

    def test_source_files_disallow_duplicate_races(self):
        with tempfile.TemporaryDirectory() as d:
            file = Path(d) / "day.json"
            file.write_text(json.dumps({
                "schema": "boat-command-inverse-join-v1",
                "date": "2026-09-01", "researchOnly": True,
                "productionChanged": False, "prePostSeparated": True,
                "races": [sample()],
            }), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "DUPLICATE"):
                patterns.load_documents([file, file])

    def test_payout_is_observational_only(self):
        a = patterns.summarize([sample(payoff=100)], min_support=1)
        b = patterns.summarize([sample(payoff=152730)], min_support=1)
        self.assertEqual(
            a["conditionalPatterns"][0]["outcomes"][0]["observedConditionalFrequency"],
            b["conditionalPatterns"][0]["outcomes"][0]["observedConditionalFrequency"],
        )
        self.assertNotEqual(
            a["conditionalPatterns"][0]["outcomes"][0]["inSamplePayoutOnlyRoiIfBetEveryMatchingRace"],
            b["conditionalPatterns"][0]["outcomes"][0]["inSamplePayoutOnlyRoiIfBetEveryMatchingRace"],
        )


if __name__ == "__main__":
    unittest.main()
