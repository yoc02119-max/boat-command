"""Offline previous-day provenance proof / no-PRE negative controls."""
import datetime as dt
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / path)
    x = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(x)
    return x


program = module("research-program-only-daystart-v1.py", "program_only_daystart_test")
source = module("research-asof-provenance-v1.py", "program_only_source_test")
gh = module("research-github-asof-corroboration-v1.py", "program_only_git_test")


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], check=True,
                          text=True, capture_output=True).stdout.strip()


def pack(fetched="2026-09-25T21:20:00+09:00", race=1):
    return {
        "schema": "boat-command-program-pack-v1", "date": "2026-09-26",
        "race": race, "deadline": "10:47", "venue": "KIRYU",
        "venueCode": "01", "fetchedAt": fetched,
        "source": "BOAT RACE official racelist",
        "programReady": True, "exhibitionIncluded": False,
        "resultEndpointsIncluded": False, "resultIncluded": False,
        "boats": [{"lane": i, "registration": 5000 + i, "class": "A1",
                   "motor": 10+i, "nationalWinRate": 5.0}
                  for i in range(1, 7)],
    }


class DaystartTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.repo = Path(tmp.name)
        git(self.repo, "init", "-q")
        git(self.repo, "config", "user.name", "offline")
        git(self.repo, "config", "user.email", "test@example.invalid")
        self.file = self.repo/"live"/"kiryu"/"2026-09-26"/"program"/"race-1.json"
        self.file.parent.mkdir(parents=True)
        self.save(pack())
        self.early_sha = git(self.repo, "rev-parse", "HEAD")

    def save(self, obj):
        # git rm may remove the last file AND its parent directory.
        self.file.parent.mkdir(parents=True, exist_ok=True)
        self.file.write_text(json.dumps(obj, ensure_ascii=False)+"\n", encoding="utf-8")
        git(self.repo, "add", str(self.file.relative_to(self.repo)))
        git(self.repo, "commit", "-qm", "snapshot")

    def seen_early(self, sha, cutoff):
        if sha == self.early_sha:
            return dt.datetime.fromisoformat("2026-09-25T13:30:00+00:00")
        return None

    def verify(self, seen=None):
        return program.verify_case(
            self.repo, "kiryu", "01", "2026-09-26", 1,
            source, gh, self.seen_early if seen is None else seen)

    def test_daystart_proof_witness_after_fetch_and_before_midnight(self):
        result = self.verify()
        self.assertEqual(result["status"], program.PASS)
        self.assertTrue(result["observedBeforeRaceDayJst"])
        self.assertFalse(result["eligibleForStrictHistoricalModel"])
        self.assertFalse(result["importedToModel"])
        self.assertTrue(result["independentOfficialRaceDeadlineUnverified"])
        self.assertEqual(len(result["cardFields"]), 6)
        self.assertIn("motor", result["cardFields"][0])
        self.assertNotIn("actual", str(result))

    def test_self_reported_tminus3_does_not_release_card(self):
        self.save(pack("2026-09-26T10:10:00+09:00"))
        dayof = git(self.repo, "rev-parse", "HEAD")
        def seen(sha, cutoff):
            if sha == dayof:
                return dt.datetime.fromisoformat("2026-09-26T01:12:00+00:00")
            return None
        # The earlier original snapshot is not server-hosted in this test.
        result = self.verify(seen)
        self.assertEqual(result["status"], program.DAY_ONLY)
        self.assertFalse(result["eligibleForStrictHistoricalModel"])
        self.assertNotIn("cardFields", result)

    def test_late_rewrite_does_not_destroy_original_daystart_proof(self):
        changed = pack("2026-09-26T22:00:00+09:00")
        changed["boats"][0]["motor"] = 999
        self.save(changed)
        result = self.verify()
        self.assertEqual(result["status"], program.PASS)
        self.assertEqual(result["commit"], self.early_sha)
        self.assertEqual(result["cardFields"][0]["motor"], 11)

    def test_no_hosted_witness_and_witness_before_fetch_are_rejected(self):
        result = self.verify(lambda sha, cutoff: None)
        self.assertEqual(result["status"], "PROGRAM_SERVER_ASOF_NOT_CORROBORATED")
        earlier = dt.datetime.fromisoformat("2026-09-25T10:00:00+00:00")
        result = self.verify(lambda sha, cutoff: earlier)
        self.assertEqual(result["status"], "PROGRAM_SERVER_ASOF_NOT_CORROBORATED")
        self.assertEqual(result["diagnostics"]["SERVER_WITNESS_PREDATES_RECORDED_FETCH"], 1)

    def test_result_contamination_or_wrong_race_rejected(self):
        compromised = pack()
        compromised["resultIncluded"] = True
        self.save(compromised)
        # The earlier, valid version lacks a hosted witness in this test.
        latest = git(self.repo, "rev-parse", "HEAD")
        seen = lambda sha, cutoff: (dt.datetime.fromisoformat(
            "2026-09-25T13:30:00+00:00") if sha == latest else None)
        result = self.verify(seen)
        self.assertEqual(result["status"], "PROGRAM_SERVER_ASOF_NOT_CORROBORATED")
        wrong = pack()
        wrong["venueCode"] = "07"
        self.assertIsNone(program.safe_card(wrong, "kiryu", "01",
                                             "2026-09-26", 1, source))

    def test_deleted_program_commit_is_not_an_empty_proof_or_a_crash(self):
        # git log -- <path> returns the DELETE commit too; git show SHA:path
        # correctly fails for that revision, while an older version survives.
        relative = str(self.file.relative_to(self.repo))
        git(self.repo, "rm", relative)
        git(self.repo, "commit", "-qm", "temporary historical deletion")
        self.save(pack("2026-09-26T22:00:00+09:00"))
        result = self.verify(lambda sha, cutoff: None)
        self.assertEqual(result["status"], "PROGRAM_SERVER_ASOF_NOT_CORROBORATED")
        self.assertEqual(result["diagnostics"]["FILE_ABSENT_AT_HISTORICAL_COMMIT"], 1)
        recovered = self.verify(self.seen_early)
        self.assertEqual(recovered["status"], program.PASS)
        self.assertEqual(recovered["commit"], self.early_sha)

    def test_missing_commit_object_fails_closed(self):
        from unittest import mock
        original = gh.git
        def corrupted_history(repo, *args):
            if args[0] == "show" or args[:2] == ("cat-file", "-e"):
                raise subprocess.CalledProcessError(128, ["git", *args])
            return original(repo, *args)
        with mock.patch.object(gh, "git", side_effect=corrupted_history):
            with self.assertRaisesRegex(RuntimeError, "INCOMPLETE_GIT_HISTORY"):
                self.verify()

    def test_absent_pre_filter_and_complete_all_venues_metadata(self):
        report = program.scan(self.repo, source, gh, self.seen_early, cap=1)
        self.assertEqual(report["eligibleCurrentNoPreRichProgramRows"], 1)
        self.assertEqual(report["byStatus"][program.PASS], 1)
        qfile = self.file.parent.parent/"pre-rich"/self.file.name
        qfile.parent.mkdir()
        qfile.write_text("{}")
        report = program.scan(self.repo, source, gh, self.seen_early, cap=1)
        self.assertEqual(report["eligibleCurrentNoPreRichProgramRows"], 0)
        self.assertEqual(report["scanned"], 0)
        self.assertEqual(report["candidatePerVenue"], {})


if __name__ == "__main__":
    unittest.main()
