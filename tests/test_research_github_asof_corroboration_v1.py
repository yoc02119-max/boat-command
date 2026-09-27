"""Offline Git object and GitHub-server clock negative controls."""
import datetime as dt
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def module(file, name):
    spec=importlib.util.spec_from_file_location(name,ROOT/"scripts"/file)
    m=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

p=module("research-asof-provenance-v1.py","asof_source_for_git_test")
m=module("research-github-asof-corroboration-v1.py","asof_git_for_test")


def call(repo,*args):
    return subprocess.run(["git","-C",str(repo),*args],
                          text=True,capture_output=True,check=True).stdout.strip()


def payloads():
    prog={
        "date":"2026-09-26","race":1,"deadline":"10:47",
        "fetchedAt":"2026-09-25T21:26:54+09:00",
        "resultEndpointsIncluded":False,"resultIncluded":False,
        "source":"BOAT RACE official racelist",
        "boats":[{"lane":n,"registration":5000+n,"class":"A1","motor":n+10}
                 for n in range(1,7)],
    }
    pre=dict(prog)
    pre["fetchedAt"]="2026-09-26T10:30:25+09:00"
    pre.pop("resultIncluded")
    pre["payoutEndpointsIncluded"]=False
    pre["source"]={"program":"stored result-free program pack"}
    pre["predictionEnabled"]=False
    pre["hardLockEnabled"]=False
    return prog,pre


class GitHistoryProofTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        call(self.root,"init","-q")
        call(self.root,"config","user.name","asof-fixture")
        call(self.root,"config","user.email","fixture@example.invalid")
        base=self.root/"live"/"toda"/"2026-09-26"
        program,rich=base/"program",base/"pre-rich"
        program.mkdir(parents=True)
        rich.mkdir(parents=True)
        self.pfile=program/"race-1.json"
        self.qfile=rich/"race-1.json"
        a,b=payloads()
        self.pfile.write_text(json.dumps(a))
        call(self.root,"add",str(self.pfile.relative_to(self.root)))
        call(self.root,"commit","-qm","archive program")
        self.psha=call(self.root,"rev-parse","HEAD")
        self.qfile.write_text(json.dumps(b))
        call(self.root,"add",str(self.qfile.relative_to(self.root)))
        call(self.root,"commit","-qm","capture pre-rich")
        self.qsha=call(self.root,"rev-parse","HEAD")
        self.cutoff=p.cutoff_for("2026-09-26","10:47")

    def server_seen(self,sha,cutoff):
        self.assertEqual(cutoff,self.cutoff)
        when=("2026-09-25T12:28:00+00:00" if sha==self.psha
              else "2026-09-26T01:31:00+00:00" if sha==self.qsha
              else None)
        return dt.datetime.fromisoformat(when) if when else None

    def test_both_commits_must_have_server_seen_before_cutoff(self):
        item=m.candidate_research_pair(
            self.root,"toda","2026-09-26",1,p,self.server_seen)
        self.assertEqual(item["status"],"EARLIER_APP_SNAPSHOT_HOSTED_BEFORE_T_MINUS_3")
        self.assertEqual(item["programCommit"],self.psha)
        self.assertEqual(item["preRichCommit"],self.qsha)
        self.assertIs(item["strictVendorFullDayCardReleased"],False)
        self.assertIs(item["automaticallyImportedToModel"],False)
        self.assertIs(item["originalOfficialResponseHashUnavailable"],True)

    def test_relative_clock_is_not_server_publication(self):
        item=m.candidate_research_pair(
            self.root,"toda","2026-09-26",1,p,
            lambda sha,cutoff: None)
        self.assertEqual(item["status"],"PRE_RICH_NO_SERVER_ASOF_PROOF")
        item=m.candidate_research_pair(
            self.root,"toda","2026-09-26",1,p,
            lambda sha,cutoff: (self.server_seen(sha,cutoff)
                                if sha==self.qsha else None))
        self.assertEqual(item["status"],"PROGRAM_NO_MATCHING_SERVER_ASOF_PROOF")

    def test_server_claim_before_actual_fetch_is_not_accepted(self):
        def impossible_pre(sha,cutoff):
            value=self.server_seen(sha,cutoff)
            return value-dt.timedelta(hours=2) if sha==self.qsha else value
        item=m.candidate_research_pair(
            self.root,"toda","2026-09-26",1,p,impossible_pre)
        self.assertEqual(item["status"],"PRE_RICH_NO_SERVER_ASOF_PROOF")

    def test_earlier_program_version_recoverable_after_current_rewrite(self):
        changed,_=payloads()
        changed["fetchedAt"]="2026-09-26T22:56:00+09:00"
        changed["boats"][0]["motor"]=999
        self.pfile.write_text(json.dumps(changed))
        call(self.root,"add",str(self.pfile.relative_to(self.root)))
        call(self.root,"commit","-qm","late program rewrite")
        current=p.audit_live_pair(changed,p.load(self.qfile),"2026-09-26",1)
        self.assertEqual(current["status"],"CURRENT_PROGRAM_IS_LATER_THAN_PRE_RICH")
        item=m.candidate_research_pair(
            self.root,"toda","2026-09-26",1,p,self.server_seen)
        self.assertEqual(item["status"],"EARLIER_APP_SNAPSHOT_HOSTED_BEFORE_T_MINUS_3")
        self.assertEqual(item["programCommit"],self.psha)

    def test_git_server_list_api_must_match_exact_sha(self):
        import unittest.mock as mock
        class Resp:
            def __enter__(self): return self
            def __exit__(self,*args): pass
            def read(self): return self.content
        data={"workflow_runs":[
            {"head_sha":"bad-sha","created_at":"2026-09-25T12:00:00Z"},
            {"head_sha":self.psha,"created_at":"2026-09-25T12:28:40Z"},
            {"head_sha":self.psha,"created_at":"2026-09-27T00:00:00Z"}]}
        resp=Resp()
        resp.content=json.dumps(data).encode()
        with mock.patch.object(m.urllib.request,"urlopen",return_value=resp):
            found=m.github_seen_before("https://api.github.com",
                                       "owner/repo","dummy",self.psha,
                                       self.cutoff,cache={})
        self.assertEqual(found.isoformat(),"2026-09-25T12:28:40+00:00")

    def test_pilot_reports_bound_and_per_venue_without_mutation(self):
        def simplified(sha,cutoff): return self.server_seen(sha,cutoff)
        report=m.scan_repo(self.root,p,simplified,1)
        self.assertEqual(report["candidateCurrentCompatiblePairs"],1)
        self.assertEqual(report["scannedPairs"],1)
        self.assertEqual(report["unscannedPairsDueToBound"],0)
        self.assertEqual(report["byStatus"]["EARLIER_APP_SNAPSHOT_HOSTED_BEFORE_T_MINUS_3"],1)


if __name__=="__main__":
    unittest.main()
