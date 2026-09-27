"""Offline provenance regression: no official network requests in CI."""
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
    "prospective_hash_pre_test", ROOT/"scripts"/"research-prospective-raw-pre-v1.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

DATE = "2026-09-28"
CODE = "01"
RAW_CARD = b"<html><body>official prospective six racer list test</body></html>"
RAW_PRE = b"<html><body>official prospective beforeinfo test</body></html>"


def ts(time):
    return dt.datetime.fromisoformat(DATE+"T"+time+"+09:00")


def saved_pack(deadline="10:30", race=1):
    return {
        "schema": "boat-command-program-pack-v1",
        "venue": "KIRYU", "venueCode": CODE, "date": DATE, "race": race,
        "deadline": deadline, "fetchedAt": ts("09:00:00").isoformat(),
        "source": "BOAT RACE official racelist", "programReady": True,
        "exhibitionIncluded": False, "resultEndpointsIncluded": False,
        "resultIncluded": False,
        "boats": [{"lane": n, "registration": 5000+n, "class": "A1",
                   "motor": 10+n, "boat": 20+n}
                  for n in range(1, 7)],
    }


def default_clock(last=None):
    values = [ts("10:14:00"), ts("10:14:01"), ts("10:14:05"),
              ts("10:14:06"), ts("10:14:10") if last is None else last]
    return iter(values).__next__


def fake_fetch(url):
    if "racelist?" in url:
        return RAW_CARD
    if "beforeinfo?" in url:
        return RAW_PRE
    raise AssertionError("FORBIDDEN_ENDPOINT_REQUESTED")


def parse_card(_text, date, race, _venue, code):
    assert date==DATE and race==1 and code==CODE
    return saved_pack()


def parse_pre(_text):
    return {"exhibitionTimes": 6, "startDisplayRows": 6, "weatherFields": 4}


def one(**opts):
    args={
        "raw_fetcher":fake_fetch,
        "clock":default_clock(),
        "fresh_card_parser":parse_card,
        "before_parser":parse_pre,
    }
    args.update(opts)
    return mod.capture_one(saved_pack(), CODE, "kiryu", DATE, 1, **args)


class ProspectiveHashPreTests(unittest.TestCase):
    def test_genuine_raw_bytes_hashed_not_redistributed(self):
        snapshot = one()
        self.assertEqual(snapshot["schema"],"boat-command-prospective-hash-pre-v1")
        self.assertFalse(snapshot["strictModelUseEnabled"])
        self.assertFalse(snapshot["independentServerPublicationProved"])
        self.assertFalse(snapshot["originalHtmlRedistributed"])
        self.assertFalse(snapshot["resultEndpointsIncluded"])
        self.assertTrue(mod.validate_snapshot(snapshot))
        first = snapshot["officialRacelist"]
        self.assertEqual(first["sha256OriginalBytes"], hashlib.sha256(RAW_CARD).hexdigest())
        self.assertEqual(first["byteLength"], len(RAW_CARD))
        self.assertFalse(first["originalBytesRetained"])
        self.assertNotIn("gzipBase64OriginalBytes", first)
        self.assertEqual(snapshot["registrations"], [5001,5002,5003,5004,5005,5006])

    def test_deadline_and_midnight_block_late_capture(self):
        for last in [ts("10:25:01"), ts("10:27:30"),
                     dt.datetime.fromisoformat("2026-09-29T00:01:00+09:00")]:
            with self.subTest(last=last):
                with self.assertRaisesRegex(mod.RejectedObservation,
                                            "SOURCE_FETCH_NOT_FROZEN_BEFORE_CUTOFF"):
                    one(clock=default_clock(last))
        self.assertEqual(mod.cutoff(DATE,"10:30").isoformat(),
                         DATE+"T10:27:00+09:00")
        self.assertIsNone(mod.cutoff(DATE,"29:66"))

    def test_stale_card_and_past_race_rejected(self):
        stale=saved_pack()
        stale["fetchedAt"]=ts("10:45:00").isoformat()
        self.assertIsNone(mod.baseline_ok(stale,ts("10:14:00"),CODE,DATE,1))
        stale=saved_pack()
        stale["resultEndpointsIncluded"]=True
        self.assertIsNone(mod.baseline_ok(stale,ts("10:14:00"),CODE,DATE,1))
        self.assertIsNone(mod.baseline_ok(saved_pack(),ts("11:00:00"),CODE,DATE,1))
        self.assertIsNone(mod.baseline_ok(saved_pack(),ts("10:14:00"),"07",DATE,1))

    def test_race_identity_motor_and_deadline_conflicts_fail_closed(self):
        for kind in ["registration","motor","deadline","result"]:
            def conflict(text,date,race,name,code):
                altered=saved_pack()
                if kind=="deadline":
                    altered["deadline"]="10:31"
                elif kind=="result":
                    altered["resultIncluded"]=True
                else:
                    altered["boats"][2][kind]=9999
                return altered
            with self.subTest(kind=kind), self.assertRaisesRegex(
                    mod.RejectedObservation, "FRESH_OFFICIAL_CARD_OR_DEADLINE_CONFLICT"):
                one(fresh_card_parser=conflict)

    def test_only_authorized_pre_endpoints_can_be_fetched(self):
        for path in ("result", "resultlist", "payout"):
            with self.assertRaisesRegex(mod.RejectedObservation,
                                        "DISALLOWED_HTTP_ENDPOINT"):
                mod.runner_fetch("https://www.boatrace.jp/owpc/pc/race/"+path)
        urls=mod.original_urls(DATE,"01",1)
        self.assertTrue(urls[0].startswith("https://www.boatrace.jp/"))
        self.assertIn("/racelist?",urls[0])
        self.assertIn("/beforeinfo?",urls[1])
        with self.assertRaisesRegex(mod.RejectedObservation,"INVALID_VENUE_CODE"):
            mod.original_urls(DATE,"99",1)

    def test_source_bytes_and_beforeinfo_content_are_required(self):
        with self.assertRaisesRegex(mod.RejectedObservation,
                                    "EMPTY_OR_OVERSIZE_HTTP_RESPONSE"):
            one(raw_fetcher=lambda url: b"" if "beforeinfo" in url else RAW_CARD)
        with self.assertRaisesRegex(mod.RejectedObservation,
                                    "EMPTY_OR_OVERSIZE_HTTP_RESPONSE"):
            one(raw_fetcher=lambda url: b"*"*(mod.MAX_RAW_BYTES+1))
        with self.assertRaisesRegex(mod.RejectedObservation,
                                    "UNVERIFIED_BEFOREINFO_BODY"):
            one(before_parser=lambda text:{"exhibitionTimes":0,
                                          "startDisplayRows":0,"weatherFields":0})

    def test_digest_format_and_copy_injection_not_permitted(self):
        item=one()
        for edit in [
            lambda x:x["officialRacelist"].update({"sha256OriginalBytes":"bad"}),
            lambda x:x["officialRacelist"].update({"originalBytesRetained":True}),
            lambda x:x["officialBeforeinfo"].update({"gzipBase64OriginalBytes":"unlicensed"}),
            lambda x:x["officialRacelist"].update({"url":"https://bad.example/source"}),
            lambda x:x.update({"strictModelUseEnabled":True}),
        ]:
            obj=copy.deepcopy(item)
            edit(obj)
            with self.subTest(item=obj), self.assertRaises(mod.RejectedObservation):
                mod.validate_snapshot(obj)

    def test_select_today_one_per_venue_and_no_duplicate_archive(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            program=root/"live"/"kiryu"/DATE/"program"
            program.mkdir(parents=True)
            for race in (1,2):
                saved=saved_pack("10:30" if race==1 else "10:31",race)
                (program/f"race-{race}.json").write_text(json.dumps(saved))
            table={"01":("KIRYU","kiryu")}
            archived=root/"archive"
            chosen=mod.candidates(root/"live",archived,ts("10:14:00"),table)
            self.assertEqual(len(chosen),1)
            self.assertEqual(chosen[0][2],1)
            (archived/DATE/"kiryu").mkdir(parents=True)
            (archived/DATE/"kiryu"/"01.json").write_text("{}")
            later=mod.candidates(root/"live",archived,ts("10:14:00"),table)
            self.assertEqual(later[0][2],2)
            self.assertEqual(len(later),1)


if __name__=="__main__":
    unittest.main()
