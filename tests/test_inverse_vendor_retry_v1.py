"""Retry only transient vendor failures; never silently treat missing as success."""
import importlib.util
import io
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

SRC = Path(__file__).resolve().parents[1] / "scripts" / "boatracecsv-inverse-join-v1.py"
spec = importlib.util.spec_from_file_location("boatracecsv_inverse_join", SRC)
join = importlib.util.module_from_spec(spec)
spec.loader.exec_module(join)
DATA = "レースコード,レース日\n202608040201,2026-08-04\n".encode("utf-8")


def http_error(req, status):
    return urllib.error.HTTPError(req.full_url, status, "test", None, None)


class RetryTest(unittest.TestCase):
    def test_transient_503_twice_then_success(self):
        calls, delays = [], []
        def urlopen(req, timeout):
            calls.append(timeout)
            if len(calls) < 3:
                raise http_error(req, 503)
            return io.BytesIO(DATA)
        with patch.object(join.urllib.request, "urlopen", urlopen), \
             patch.object(join.time, "sleep", delays.append):
            rows, audit = join.fetch_source("card", "2026-08-04")
        self.assertEqual(len(calls), 3)
        self.assertEqual(delays, [1, 2])
        self.assertEqual(audit["status"], "OK")
        self.assertEqual(audit["rows"], 1)
        self.assertIn("202608040201", rows)

    def test_404_does_not_retry(self):
        calls, delays = [], []
        def urlopen(req, timeout):
            calls.append(timeout)
            raise http_error(req, 404)
        with patch.object(join.urllib.request, "urlopen", urlopen), \
             patch.object(join.time, "sleep", delays.append):
            rows, audit = join.fetch_source("card", "2026-08-04")
        self.assertEqual(len(calls), 1)
        self.assertEqual(delays, [])
        self.assertEqual(rows, {})
        self.assertEqual(audit["status"], "HTTP_404")

    def test_exhausted_503_raises_instead_of_marking_day_complete(self):
        calls, delays = [], []
        def urlopen(req, timeout):
            calls.append(timeout)
            raise http_error(req, 503)
        with patch.object(join.urllib.request, "urlopen", urlopen), \
             patch.object(join.time, "sleep", delays.append):
            with self.assertRaises(urllib.error.HTTPError):
                join.fetch_source("card", "2026-08-04")
        self.assertEqual(len(calls), 3)
        self.assertEqual(delays, [1, 2])

    def test_other_http_error_not_retried(self):
        calls, delays = [], []
        def urlopen(req, timeout):
            calls.append(timeout)
            raise http_error(req, 403)
        with patch.object(join.urllib.request, "urlopen", urlopen), \
             patch.object(join.time, "sleep", delays.append):
            with self.assertRaises(urllib.error.HTTPError):
                join.fetch_source("card", "2026-08-04")
        self.assertEqual(len(calls), 1)
        self.assertEqual(delays, [])


if __name__ == "__main__":
    unittest.main()
