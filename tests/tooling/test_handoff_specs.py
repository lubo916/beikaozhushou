"""Specs handoff must reject stale/overbudget inputs and ship shared sources."""
import argparse
import importlib.util
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

PROJECT = Path(__file__).resolve().parents[2]
module_spec = importlib.util.spec_from_file_location("handoff_tool", PROJECT / "scripts/handoff.py")
handoff = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(handoff)


class SpecHandoffTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.out = self.root / "out"
        self.patcher = patch.multiple(handoff, ROOT=self.root, OUTBOX=self.out)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        (self.root / ".pack").mkdir()
        (self.root / ".pack/TEST-01.md").write_text("STALE", encoding="utf-8")
        (self.root / "AGENTS.md").write_text("Rules", encoding="utf-8")

    def test_failed_pack_never_retries_allow_over_or_emits_stale_zip(self):
        with patch.object(handoff, "loop_features", return_value=["TEST-01"]), \
             patch.object(handoff, "spec_file", return_value=self.root / "spec.md"), \
             patch.object(handoff, "spec_tool", return_value=SimpleNamespace(returncode=2, stdout="overbudget", stderr="")) as run:
            self.assertEqual(handoff.cmd_specs(argparse.Namespace(loop="0.1")), 2)
        run.assert_called_once_with("pack", "TEST-01")
        self.assertEqual(list(self.out.glob("*.zip")), [])

    def test_missing_spec_refuses_partial_batch(self):
        with patch.object(handoff, "loop_features", return_value=["TEST-01", "TEST-02"]), \
             patch.object(handoff, "spec_file", side_effect=[self.root / "spec.md", None]), \
             patch.object(handoff, "spec_tool") as run:
            self.assertEqual(handoff.cmd_specs(argparse.Namespace(loop="0.1")), 2)
        run.assert_not_called()
        self.assertEqual(list(self.out.glob("*.zip")), [])

    def test_success_contains_the_new_pack_and_shared_source_bytes(self):
        def generate(*_args):
            (self.root / ".pack/TEST-01.md").write_text("FRESH", encoding="utf-8")
            return SimpleNamespace(returncode=0, stdout="", stderr="")
        with patch.object(handoff, "loop_features", return_value=["TEST-01"]), \
             patch.object(handoff, "spec_file", return_value=self.root / "spec.md"), \
             patch.object(handoff, "spec_tool", side_effect=generate), \
             patch.object(handoff, "spec_review_resources", return_value={"context/loop.yaml": b"selected-loop", "repo/model.md": b"model-source"}), \
             patch.object(handoff, "fill", return_value="Review"), patch.object(handoff, "tell"):
            self.assertEqual(handoff.cmd_specs(argparse.Namespace(loop="0.1")), 0)
        with zipfile.ZipFile(self.out / "L0.1-specs-r1.zip") as archive:
            self.assertEqual(archive.read("packs/TEST-01.md"), b"FRESH")
            self.assertEqual(archive.read("repo/model.md"), b"model-source")
            self.assertEqual(archive.read("context/loop.yaml"), b"selected-loop")


if __name__ == "__main__":
    unittest.main()
