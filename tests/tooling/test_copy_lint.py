"""F03 文案检查的 lint 接线回归：由工具测试串行运行，不与正常 Vitest 仓库扫描并发。"""
import json
import os
import shlex
import shutil
import subprocess
import unittest
from uuid import uuid4

from _support import ROOT


class CopyLintTest(unittest.TestCase):
    def scripts(self):
        return json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["scripts"]

    def assert_copy_entry(self):
        scripts = self.scripts()
        self.assertIn("lint:copy", scripts, "必须提供单独的文案与词汇检查入口")
        self.assertEqual(
            shlex.split(scripts["lint:copy"]),
            ["vitest", "run", "--project", "node", "packages/ui/scripts/repo-guards.test.ts"],
            "文案检查只运行仓库 guards，不能递归调用完整 pnpm test",
        )
        return scripts

    def run_copy_lint(self):
        self.assert_copy_entry()
        pnpm = shutil.which("pnpm")
        self.assertIsNotNone(pnpm, "运行工具测试前应完成 pnpm 环境准备")
        env = {**os.environ, "CI": "1", "NO_COLOR": "1"}
        # 指定 default reporter，避免子 Vitest 覆盖完整测试的 JSON 结果。
        result = subprocess.run(
            [pnpm, "run", "lint:copy", "--reporter=default"],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=90, env=env,
        )
        return result.returncode, result.stdout + result.stderr

    def test_lint_runs_copy_guards(self):
        """pnpm lint 必须调用独立的词汇与文案检查入口"""
        scripts = self.assert_copy_entry()
        self.assertRegex(scripts["lint"], r"(?:^|&&[ ]*)pnpm (?:run )?lint:copy(?:[ ]*(?:&&|$))")

    def test_copy_lint_accepts_current_repo(self):
        """文案检查入口能实际执行，当前仓库通过"""
        status, output = self.run_copy_lint()
        self.assertEqual(status, 0, output)
        self.assertIn("repo-guards.test.ts", output)

    def test_copy_lint_rejects_source_and_copy_counterexamples(self):
        """临时页面的掌握档和状态名、文案的禁用词与裸数字被真实 lint 入口拦下"""
        # 工具测试在 pnpm test 的常规 Vitest 结束后运行；每次只注入一份反例，
        # 文件名使用 UUID，finally 仅删除本测试创建的单个文件。
        cases = (
            ("apps/learner/src", ".tsx",
             'export const Counterexample = () => <p>已掌握 / 加载</p>;\n',
             ("写死了", "已掌握", "加载")),
            ("apps/learner/src/i18n", ".json",
             json.dumps({"promise": "保过"}, ensure_ascii=False),
             ("promise", "保过")),
            ("apps/learner/src/i18n", ".json",
             json.dumps({"interval": "间隔 7 天复习"}, ensure_ascii=False),
             ("interval", "7")),
        )
        for directory, suffix, content, messages in cases:
            with self.subTest(directory=directory, messages=messages):
                fixture = ROOT / directory / f"copy-lint-counterexample-{uuid4().hex}{suffix}"
                created = False
                try:
                    with fixture.open("x", encoding="utf-8") as stream:
                        created = True
                        stream.write(content)
                    status, output = self.run_copy_lint()
                    self.assertNotEqual(status, 0, output)
                    self.assertIn(fixture.name, output)
                    for message in messages:
                        self.assertIn(message, output)
                finally:
                    if created:
                        fixture.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
