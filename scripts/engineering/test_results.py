#!/usr/bin/env python3
"""测试结果接线：运行 tests/tooling 的工具测试，并把 Vitest、Playwright 与工具测试的结果合并为 .test-results/results.json。

用法：
  python3 scripts/engineering/test_results.py tooling   运行 tests/tooling（标准库 unittest），写 .test-results/tooling.json
  python3 scripts/engineering/test_results.py merge     合并各分项，写 .test-results/results.json
结果格式：{"tests": [{"title": …, "status": "passed" | "failed" | "skipped", "runner": …, "file": …}]}；
spec_tool 据标题中的 [<功能ID>-AC<n>]、[INV-<nn>]、[GP-<n>] 推导状态。工具测试的标题取测试方法文档字符串的首行，没有时取测试 ID。
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ".test-results"
PARTS = {"vitest": "vitest.json", "playwright": "playwright.json", "tooling": "tooling.json"}
VITEST_STATUS = {"passed": "passed", "failed": "failed", "skipped": "skipped", "pending": "skipped", "todo": "skipped", "disabled": "skipped"}
PLAYWRIGHT_STATUS = {"expected": "passed", "flaky": "passed", "unexpected": "failed", "skipped": "skipped"}


class _Collect(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.records: list[dict] = []
        self._failed_subtests: set[str] = set()

    def _record(self, test, status: str) -> None:
        title = test.shortDescription() or test.id()
        module = type(test).__module__
        self.records.append({"title": title, "status": status, "runner": "tooling", "file": f"tests/tooling/{module}.py"})

    def addSuccess(self, test):
        super().addSuccess(test)
        self._record(test, "passed")

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self._record(test, "failed")

    def addError(self, test, err):
        super().addError(test, err)
        self._record(test, "failed")

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self._record(test, "skipped")

    def addExpectedFailure(self, test, err):
        super().addExpectedFailure(test, err)
        self._record(test, "passed")

    def addUnexpectedSuccess(self, test):
        super().addUnexpectedSuccess(test)
        self._record(test, "failed")

    def addSubTest(self, test, subtest, err):
        super().addSubTest(test, subtest, err)
        if err is not None and test.id() not in self._failed_subtests:
            self._failed_subtests.add(test.id())
            self._record(test, "failed")


def run_tooling(start_dir: Path, stream=None) -> tuple[list[dict], bool]:
    """运行 start_dir 下的 unittest 测试，返回 (结果记录, 是否全部通过)。"""
    suite = unittest.defaultTestLoader.discover(str(start_dir), pattern="test*.py", top_level_dir=str(start_dir))
    runner = unittest.TextTestRunner(stream=stream or sys.stderr, verbosity=1, resultclass=_Collect)
    result = runner.run(suite)
    return result.records, result.wasSuccessful()


def vitest_records(data: dict, root: Path = ROOT) -> list[dict]:
    out = []
    for f in data.get("testResults") or []:
        name = str(f.get("name") or "")
        try:
            rel = Path(name).resolve().relative_to(root.resolve()).as_posix()
        except (ValueError, OSError):
            rel = name
        cases = f.get("assertionResults") or []
        for a in cases:
            title = a.get("fullName") or " ".join([*(a.get("ancestorTitles") or []), a.get("title") or ""]).strip()
            out.append({"title": title, "status": VITEST_STATUS.get(a.get("status"), "failed"), "runner": "vitest", "file": rel})
        if not cases and f.get("status") == "failed":
            out.append({"title": f"{rel}：测试文件未能运行", "status": "failed", "runner": "vitest", "file": rel})
    return out


def playwright_records(data: dict) -> list[dict]:
    out = []

    def walk(suite: dict, trail: list[str], file: str):
        file = suite.get("file") or file
        title = suite.get("title") or ""
        here = trail + ([title] if title and title != file else [])
        for spec in suite.get("specs") or []:
            for t in spec.get("tests") or []:
                name = " › ".join(here + [spec.get("title") or ""])
                out.append({"title": f"{name}（{t.get('projectName') or '默认'}）",
                            "status": PLAYWRIGHT_STATUS.get(t.get("status"), "failed"), "runner": "playwright", "file": f"tests/e2e/{file}"})
        for child in suite.get("suites") or []:
            walk(child, here, file)

    for s in data.get("suites") or []:
        walk(s, [], s.get("file") or s.get("title") or "")
    for i, e in enumerate(data.get("errors") or []):
        msg = str((e or {}).get("message") or "").splitlines()[:1]
        out.append({"title": f"Playwright 运行错误 {i + 1}：{msg[0] if msg else ''}", "status": "failed", "runner": "playwright", "file": ""})
    return out


def merge(root: Path = ROOT) -> dict:
    base = root / OUT_DIR
    tests: list[dict] = []
    for kind, fname in PARTS.items():
        p = base / fname
        if not p.exists():
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        if kind == "vitest":
            tests += vitest_records(data, root)
        elif kind == "playwright":
            tests += playwright_records(data)
        else:
            tests += list(data.get("tests") or [])
    result = {"tests": tests}
    base.mkdir(parents=True, exist_ok=True)
    (base / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "tooling":
        records, ok = run_tooling(ROOT / "tests" / "tooling")
        out = ROOT / OUT_DIR / PARTS["tooling"]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"tests": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"工具测试：{sum(r['status'] == 'passed' for r in records)}/{len(records)} 通过，结果写入 {out.relative_to(ROOT).as_posix()}")
        return 0 if ok else 1
    if cmd == "merge":
        try:
            result = merge()
        except (json.JSONDecodeError, OSError) as e:
            print(f"测试结果汇总失败：{e}")
            return 1
        tests = result["tests"]
        failed = sum(t["status"] == "failed" for t in tests)
        print(f"测试结果汇总：{len(tests)} 条（失败 {failed}），写入 {OUT_DIR}/results.json")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
