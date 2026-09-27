"""Protect the independently archived data workflow's bounded capacity contract."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/inverse-research-backfill-v1.yml"
SCRIPT = ROOT / "scripts/inverse-research-batch-v1.py"


class WorkflowCapacityTest(unittest.TestCase):
    def test_runtime_guard_matches_cli_requested_capacity(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        script = SCRIPT.read_text(encoding="utf-8")
        cap = re.search(r'--start "\$START".*--limit (\d+) --rounds (\d+) --newest-first', text)
        guard = re.search(r"assert x\['newFiles'\]\s*<=\s*(\d+)", text)
        self.assertIsNotNone(cap)
        self.assertIsNotNone(guard)
        per_round, rounds = int(cap.group(1)), int(cap.group(2))
        self.assertEqual(per_round * rounds, int(guard.group(1)))
        self.assertTrue(1 <= per_round <= 16)
        self.assertTrue(1 <= rounds <= 2)
        self.assertIn("1 <= limit <= 16", script)
        self.assertIn("1 <= rounds <= 2", script)
        self.assertIn("assert x['maxSelectedDatesThisRun']<=32", text)

    def test_research_output_branch_and_official_collector_independent(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("git push origin HEAD:data/inverse-research-v1", text)
        self.assertIn("contents: write", text)
        self.assertIn("inverse-research-coverage-v1.py", text)
        self.assertNotIn("git push origin HEAD:main", text)


if __name__ == "__main__":
    unittest.main()
