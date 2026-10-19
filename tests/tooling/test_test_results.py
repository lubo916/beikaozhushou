"""测试结果接线（计划 A7）：Vitest、Playwright 与工具测试的结果合并为 .test-results/results.json，spec_tool 能据此推导 AC 状态。"""
import json
import unittest

from _support import ROOT, load_engineering, spec_tool, temp_repo, write

results = load_engineering("test_results")


class TestResultsTest(unittest.TestCase):
    def test_vitest(self):
        """Vitest 的 JSON 结果按完整标题与状态记入"""
        data = {"testResults": [{"name": str(ROOT / "apps/api/src/app.test.ts"), "status": "passed", "assertionResults": [
            {"ancestorTitles": ["错误体"], "title": "未知路由 [METR-01-AC3]", "fullName": "错误体 未知路由 [METR-01-AC3]", "status": "passed"},
            {"ancestorTitles": [], "title": "待写", "fullName": "待写", "status": "todo"}]},
            {"name": str(ROOT / "apps/api/src/broken.test.ts"), "status": "failed", "assertionResults": []}]}
        recs = results.vitest_records(data, ROOT)
        self.assertEqual([(r["title"], r["status"]) for r in recs],
                         [("错误体 未知路由 [METR-01-AC3]", "passed"), ("待写", "skipped"),
                          ("apps/api/src/broken.test.ts：测试文件未能运行", "failed")])
        self.assertEqual(recs[0]["file"], "apps/api/src/app.test.ts")

    def test_playwright(self):
        """Playwright 的 JSON 结果按套件、用例与浏览器项目记入"""
        data = {"suites": [{"title": "smoke/learner.spec.ts", "file": "smoke/learner.spec.ts", "specs": [], "suites": [
            {"title": "学员端骨架", "file": "smoke/learner.spec.ts", "specs": [{"title": "首页 [GP-1]", "tests": [
                {"projectName": "chromium", "status": "expected"}, {"projectName": "webkit", "status": "unexpected"}]}]}]}],
            "errors": []}
        recs = results.playwright_records(data)
        self.assertEqual([(r["title"], r["status"]) for r in recs],
                         [("学员端骨架 › 首页 [GP-1]（chromium）", "passed"), ("学员端骨架 › 首页 [GP-1]（webkit）", "failed")])

    def test_tooling_titles_from_docstring(self):
        """工具测试的标题取测试方法文档字符串的首行"""
        root = temp_repo(self)
        write(root, "t/test_sample.py", 'import unittest\n\n\nclass S(unittest.TestCase):\n'
                                        '    def test_a(self):\n        """反例被拦下 [PLAT-02-AC7]\n\n        说明。"""\n\n'
                                        '    def test_b(self):\n        self.assertEqual(1, 2)\n')
        import io
        recs, ok = results.run_tooling(root / "t", stream=io.StringIO())
        self.assertFalse(ok)
        self.assertEqual({(r["title"], r["status"]) for r in recs},
                         {("反例被拦下 [PLAT-02-AC7]", "passed"), ("test_sample.S.test_b", "failed")})

    def test_merge_and_spec_tool(self):
        """合并写出 results.json，spec_tool 按标题中的 AC 标签推导状态"""
        root = temp_repo(self)
        write(root, ".test-results/tooling.json", json.dumps({"tests": [{"title": "工具 [PLAT-02-AC7]", "status": "passed"}]}))
        write(root, ".test-results/playwright.json", json.dumps({"suites": [{"title": "x.spec.ts", "file": "x.spec.ts", "specs": [
            {"title": "冒烟 [METR-01-AC10]", "tests": [{"projectName": "chromium", "status": "unexpected"}]}]}]}))
        merged = results.merge(root)
        self.assertEqual(len(merged["tests"]), 2)
        res = spec_tool.Repo(root).test_results
        self.assertEqual(res.get("PLAT-02-AC7"), "passed")
        self.assertEqual(res.get("METR-01-AC10"), "failed")


if __name__ == "__main__":
    unittest.main()
