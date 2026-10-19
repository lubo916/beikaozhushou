"""深化来源检查保留文档约束，不误判依赖完整性摘要。"""
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from _support import spec_tool, temp_repo, write


class RefineScanTest(unittest.TestCase):
    def test_lock_integrity_is_not_a_source_reference(self):
        """锁文件中的随机编号不报错，文档中的同一外部编号仍被检出"""
        root = temp_repo(self)
        external_id = "T" + str(92)
        write(root, "pnpm-lock.yaml", f'integrity: "sha512-a/{external_id}/b"\n')
        write(root, "docs/example.md", f"外部来源 {external_id}\n")
        with patch.dict(spec_tool.CFG, {"deep_source": {"forbidden_patterns": [r"\bT\d{2}\b"]}}):
            findings = spec_tool.check_refine(spec_tool.Repo(root), SimpleNamespace(baselines=[]))
        self.assertEqual([(f.code, Path(f.file).relative_to(root).as_posix()) for f in findings], [("E-REFINE-03", "docs/example.md")])
