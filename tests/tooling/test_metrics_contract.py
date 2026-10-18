"""Check serialized time patterns in source contracts, not runtime date validation.

Calendar validity, leap seconds, real offset bounds, and generated Zod behavior
remain implementation acceptance checks; these tests catch escaping and drift
between the JSON fixture contract and the YAML HTTP contract.
"""
import json
from pathlib import Path
import re
import unittest

import yaml


PROJECT = Path(__file__).resolve().parents[2]


class MetricsContractTimePatternTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixture = json.loads(
            (PROJECT / "docs/domains/metrics/contracts/phase0-fixture.schema.json")
            .read_text(encoding="utf-8")
        )
        api = yaml.safe_load(
            (PROJECT / "contracts/openapi.yaml").read_text(encoding="utf-8")
        )
        cls.patterns = {
            "fixture": re.compile(fixture["$defs"]["timestamp"]["pattern"]),
            "http": re.compile(
                api["components"]["schemas"]["AnalyticsEvent"]
                ["properties"]["occurred_at"]["pattern"]
            ),
        }

    def test_source_patterns_accept_milliseconds_and_known_offsets(self):
        values = (
            "2026-10-18T01:02:03Z",
            "2026-10-18T01:02:03.1Z",
            "2026-10-18T01:02:03.12Z",
            "2026-10-18T01:02:03.123Z",
            "2026-10-18T01:02:03+00:00",
            "2026-10-18T01:02:03+08:00",
            "2026-10-18T01:02:03.123-04:00",
        )
        for source, pattern in self.patterns.items():
            for value in values:
                with self.subTest(source=source, value=value):
                    self.assertIsNotNone(pattern.fullmatch(value))

    def test_source_patterns_reject_unsupported_lexical_forms(self):
        values = (
            "2026-10-18T01:02:03-00:00",
            "2026-10-18T01:02:03.123-00:00",
            "2026-10-18T01:02:03.1234Z",
            "2026-10-18T01:02:03.Z",
            "2026-10-18T01:02:03X123Z",
            "2026-10-18T01:02:03\\.123Z",
            "2026-10-18T01:02Z",
            "2026-10-18T01:02:03",
            "2026-10-18t01:02:03Z",
            "2026-10-18T01:02:03z",
            "20261018T010203Z",
        )
        for source, pattern in self.patterns.items():
            for value in values:
                with self.subTest(source=source, value=value):
                    self.assertIsNone(pattern.fullmatch(value))


if __name__ == "__main__":
    unittest.main()
