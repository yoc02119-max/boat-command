#!/usr/bin/env python3
"""Offline regression tests for research-only third-party pre/post join."""
import csv
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "inverse_join", ROOT / "scripts" / "boatracecsv-inverse-join-v1.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

DATE = "2026-09-01"
CODE = "11"
RACE = "202609011101"
REGISTERED = [5101, 5102, 5103, 5104, 5105, 5106]
S = mod.SOURCES


def csv_blob(row):
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(row.keys()))
    writer.writeheader()
    writer.writerow(row)
    return buf.getvalue().encode("utf-8-sig")


class InverseJoinTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        folder = self.root / "rich-history-24"
        folder.mkdir()
        (folder / "biwako-rich-history-v1.json").write_text(json.dumps({
            "venueCode": "11",
            "races": [{
                "d": DATE, "r": 1, "o": "1-3-2", "p": 1640,
                "boats": [{"lane": i, "registration": REGISTERED[i - 1]}
                          for i in range(1, 7)],
            }]
        }), encoding="utf-8")
        card = {"レースコード": RACE, "レース日": DATE}
        for i, n in enumerate(REGISTERED, 1):
            card[f"艇{i}_登録番号"] = str(n)
            card[f"艇{i}_級別"] = "B1"
            card[f"艇{i}_モーター2連対率"] = "37.5"
        pre = {"レースコード": RACE, "レース日": DATE,
               "締切時刻": "12:30", "取得日時": "2026-09-01T12:24:00+09:00"}
        result = {"レースコード": RACE, "レース日": DATE,
                  "締切時刻": "12:30", "取得日時": "2026-09-01T12:40:00+09:00",
                  "決まり手": "逃　げ",
                  "1着_艇番": "1", "2着_艇番": "3", "3着_艇番": "2"}
        payout = {"レースコード": RACE, "レース日": DATE,
                  "締切時刻": "12:30", "取得日時": "2026-09-01T12:42:00+09:00",
                  "3連単_組番": "1-3-2", "3連単_払戻金": "1640"}
        self.source = {
            "card": card, "tkz": dict(pre), "stt": dict(pre),
            "sui": dict(pre), "result": result, "payout": payout}
        self.source["tkz"]["艇1_展示タイム"] = "6.80"
        self.source["stt"]["艇1_コース"] = "1"
        self.source["sui"]["風速(m)"] = "3.0"

    def fetch(self, url):
        key = next(k for k, v in S.items() if f"/{v}/" in url)
        return csv_blob(self.source[key])

    def report(self):
        return mod.build_day(self.root, DATE, self.fetch)

    def test_valid_six_identity_pre_post_separation(self):
        day = self.report()
        self.assertEqual(day["summary"]["accepted"], 1)
        self.assertEqual(day["summary"]["sourceFileCountOK"], 6)
        race = day["races"][0]
        self.assertEqual(race["status"], "ACCEPTED")
        self.assertEqual(race["post"]["actual"], "1-3-2")
        self.assertEqual(race["post"]["payout100"], 1640)
        self.assertEqual(race["post"]["decisionRaw"], "逃　げ")
        self.assertEqual(race["pre"]["tkz"]["status"], "ELIGIBLE_T_MINUS_3")
        self.assertEqual(race["pre"]["tkz"]["value"][0]["exhibitionTime"], "6.80")
        self.assertNotIn("actual", json.dumps(race["pre"]))
        self.assertEqual(race["predictionCutoffJst"], "2026-09-01T12:27:00+09:00")

    def test_after_cutoff_source_excluded(self):
        self.source["tkz"]["取得日時"] = "2026-09-01T12:28:00+09:00"
        race = self.report()["races"][0]
        self.assertEqual(race["pre"]["tkz"]["status"], "AFTER_T_MINUS_3")
        self.assertIsNone(race["pre"]["tkz"]["value"])
        self.assertEqual(race["post"]["actual"], "1-3-2")

    def test_six_identity_rejection(self):
        self.source["card"]["艇6_登録番号"] = "9999"
        race = self.report()["races"][0]
        self.assertEqual(race["status"], "SIX_RACER_IDENTITY_REJECTED")
        self.assertNotIn("pre", race)
        self.assertNotIn("post", race)

    def test_result_payout_disagreement_quarantined(self):
        self.source["payout"]["3連単_組番"] = "1-2-3"
        race = self.report()["races"][0]
        self.assertEqual(race["status"], "LABEL_CONFLICT")
        self.assertIn("THIRD_PARTY_RESULT_VS_PAYOUT_ORDER", race["conflicts"])
        self.assertIsNone(race["post"])

    def test_original_payout_disagreement_quarantined(self):
        self.source["payout"]["3連単_払戻金"] = "9990"
        race = self.report()["races"][0]
        self.assertEqual(race["status"], "LABEL_CONFLICT")
        self.assertIn("ORIGINAL_VS_THIRD_PARTY_PAYOUT", race["conflicts"])

    def test_missing_payout_does_not_invent_labels(self):
        self.source["payout"]["3連単_払戻金"] = ""
        race = self.report()["races"][0]
        self.assertEqual(race["status"], "LABEL_INCOMPLETE")
        self.assertIsNone(race["post"])

    def test_no_source_card(self):
        self.source["card"]["レースコード"] = "202609011102"
        race = self.report()["races"][0]
        self.assertEqual(race["status"], "NO_CARD")

    def test_normalize_rejects_invalid_race_outcome(self):
        self.assertIsNone(mod.normalize_order("1-1-3"))
        self.assertIsNone(mod.normalize_order("返還"))
        self.assertIsNone(mod.normalize_money("返還"))

    def test_unknown_source_timestamp_never_becomes_eligible(self):
        del self.source["stt"]["取得日時"]
        race = self.report()["races"][0]
        self.assertEqual(race["pre"]["stt"]["status"], "TIMESTAMP_UNKNOWN")
        self.assertIsNone(race["pre"]["stt"]["value"])

    def test_no_existing_targets_stays_research_only(self):
        day = mod.build_day(self.root, "2026-09-02",
                            lambda _: self.fail("must not fetch"))
        self.assertEqual(day["status"], "NO_EXISTING_TARGETS")
        self.assertTrue(day["researchOnly"])
        self.assertFalse(day["productionChanged"])


if __name__ == "__main__":
    unittest.main()
