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
        cap = re.search(r'--start "\$START".*--limit (\d+) --newest-first', text)
        guard = re.search(r"assert x\['newFiles'\]\s*<=\s*(\d+)", text)
        self.assertIsNotNone(cap)
        self.assertIsNotNone(guard)
        self.assertEqual(cap.group(1), guard.group(1))
        self.assertTrue(1 <= int(cap.group(1)) <= 16)
        self.assertIn("1 <= limit <= 16", script)

    def test_research_output_branch_and_official_collector_independent(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("git push origin HEAD:data/inverse-research-v1", text)
        self.assertIn("contents: write", text)
        self.assertIn("inverse-research-coverage-v1.py", text)
        self.assertNotIn("git push origin HEAD:main", text)


if __name__ == "__main__":
    unittest.main()
