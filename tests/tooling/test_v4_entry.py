"""Windows V4入口始终执行主干验收策略，不借用旧任务分支工具。"""
from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from _support import ROOT

SPEC = importlib.util.spec_from_file_location(
    "v4_entry_tested", ROOT / "scripts/engineering/v4_entry.py"
)
entry = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(entry)


class AuthoritativeEntryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="v4-entry-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "tools").mkdir()
        (self.root / "tools/bk.py").write_text("raise RuntimeError('OLD_TASK_TOOL')\n")
        self.sources = {
            "bk.py": b"print('OPTIMIZED_MAIN_TOOL')\n",
            "bk_acceptance.py": b"POLICY_VERSION = '2026-10-24.1'\n",
        }

    def materialize(self):
        with mock.patch.object(entry, "main_tool_bytes",
                               side_effect=lambda root, name, ref: self.sources[name]), \
             mock.patch.object(entry, "git", return_value="main-commit"):
            return entry.authoritative_tool(self.root)

    def test_two_modules_are_read_from_one_frozen_main_commit(self):
        reads = []
        def read(root, name, ref):
            reads.append(ref)
            return self.sources[name]
        with mock.patch.object(entry, "main_tool_bytes", side_effect=read), \
             mock.patch.object(entry, "git", side_effect=["frozen-main", "workspace-head"]):
            driver, _ = entry.authoritative_tool(self.root)
        self.assertEqual(reads, ["frozen-main", "frozen-main"])
        self.assertTrue(driver.exists())

    def test_old_task_branch_tool_is_never_selected(self):
        driver, version = self.materialize()
        self.assertNotEqual(driver, self.root / "tools/bk.py")
        self.assertEqual(driver.read_bytes(), self.sources["bk.py"])
        self.assertEqual(version, "2026-10-24.1")
        self.assertIn("OLD_TASK_TOOL", (self.root / "tools/bk.py").read_text())

    def test_same_policy_sources_reuse_cache_and_changed_sources_get_new_driver(self):
        first, _ = self.materialize()
        again, _ = self.materialize()
        self.assertEqual(first, again)
        self.sources["bk.py"] += b"# patched main driver\n"
        changed, _ = self.materialize()
        self.assertNotEqual(first, changed)
        self.assertTrue(first.exists(), "不得删除正在运行的旧版本运行时")

    def test_corrupt_cached_driver_is_repaired_from_authoritative_source(self):
        driver, _ = self.materialize()
        driver.write_text("CORRUPT\n")
        repaired, _ = self.materialize()
        self.assertEqual(repaired.read_bytes(), self.sources["bk.py"])

    def test_missing_main_policy_is_a_hard_failure_without_old_tool_fallback(self):
        with mock.patch.object(entry, "main_tool_bytes",
                               side_effect=entry.RepositoryError("主干缺工具")):
            with self.assertRaises(entry.RepositoryError):
                entry.authoritative_tool(self.root)

    def test_policy_mismatch_is_not_silently_downgraded(self):
        self.sources["bk_acceptance.py"] = b"POLICY_VERSION = 'old'\n"
        with self.assertRaisesRegex(entry.RepositoryError, "版本不匹配"):
            self.materialize()

    def test_runtime_symlink_cannot_redirect_execution(self):
        base = self.root / ".bk/entry-runtime"
        base.parent.mkdir()
        other = self.root / "elsewhere"
        other.mkdir()
        base.symlink_to(other, target_is_directory=True)
        with self.assertRaisesRegex(entry.RepositoryError, "链接"):
            self.materialize()

    def test_runtime_file_symlink_is_rejected(self):
        driver, _ = self.materialize()
        driver.unlink()
        driver.symlink_to(self.root / "tools/bk.py")
        with self.assertRaisesRegex(entry.RepositoryError, "链接"):
            self.materialize()

    def test_failed_atomic_publish_preserves_previous_complete_file(self):
        path = self.root / "state.json"
        path.write_bytes(b"PREVIOUS")
        with mock.patch.object(entry.os, "replace", side_effect=OSError("disk unavailable")):
            with self.assertRaises(OSError):
                entry.atomic_bytes(path, b"NEW")
        self.assertEqual(path.read_bytes(), b"PREVIOUS")
        self.assertFalse(list(path.parent.glob(".entry-*")))


if __name__ == "__main__":
    unittest.main()
