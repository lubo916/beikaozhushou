"""真实临时 Git 仓库验证验收默认策略与交付恢复，不运行项目全套。"""
from __future__ import annotations
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock
from _support import ROOT

SPEC = importlib.util.spec_from_file_location("bk_acceptance_integration_tests", ROOT / "tools/bk.py")
bk = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bk)


class AcceptanceIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="bk-acceptance-integration-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.g("init", "-q", "-b", "main")
        self.g("config", "user.name", "验收工具测试")
        self.g("config", "user.email", "tooling@bk.local")
        (self.root / ".gitignore").write_text(".bk/\n.test-results/\n")
        (self.root / "source.txt").write_text("candidate\n")
        self.commit()
        self.cfg = copy.deepcopy(bk.DEFAULT_CONFIG)
        self.cfg.update(needs_db=[], needs_browser=[], hub_only=[], _acceptance_protocol_fixture=True)
        self.cfg["timeouts"] = {"default": 3}

    def g(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, text=True, capture_output=True, check=True).stdout.strip()

    def commit(self):
        self.g("add", "-A")
        self.g("commit", "-q", "-m", "临时受测候选")

    def commands(self, *sources):
        commands = []
        for index, source in enumerate(sources):
            name = f"step{index}.py"
            (self.root / name).write_text(source)
            commands.append("cmd:python3 " + name)
        self.cfg["verify"] = {"quick": commands, "full": commands, "web": commands}
        self.commit()
        return commands

    def verify(self, *, diagnostic=False):
        with redirect_stdout(io.StringIO()), mock.patch.object(bk, "env_kind", return_value="local"):
            return bk.do_verify(self.root, self.cfg, "full", diagnostic=diagnostic)

    def test_default_failfast_records_unrun_stages_and_fresh_atomic_result(self):
        self.commands("raise AssertionError('真实失败')\n", *["raise RuntimeError('不应运行')\n"] * 6)
        bk.acceptance.atomic_json(self.root / ".bk/last-verify.json", {"verdict": "pass", "old": True})
        summary = self.verify()
        self.assertEqual(summary["verdict"], "fail")
        self.assertEqual([x["result"] for x in summary["results"]], ["fail"] + ["not_run"] * 6)
        current = json.loads((self.root / ".bk/last-verify.json").read_text())
        self.assertNotIn("old", current)
        self.assertEqual(current["run_id"], summary["run_id"])
        self.assertEqual(summary["results"][0]["triage"]["category"], "test")
        self.assertGreater(summary["results"][0]["duration_seconds"], 0)
        self.assertTrue(summary["results"][0]["log_sha256"])

    def test_diagnostic_collects_after_failure_but_cannot_authorize_merge(self):
        self.commands("raise AssertionError('失败')\n", "print('诊断后段')\n")
        summary = self.verify(diagnostic=True)
        self.assertEqual([x["result"] for x in summary["results"]], ["fail", "pass"])
        self.assertEqual(summary["verdict"], "diagnostic")
        self.assertTrue(bk.acceptance.validate_summary(summary, summary["identity"]))

    def test_local_full_missing_scripts_is_environment_block_not_green(self):
        self.cfg["verify"]["full"] = ["lint", "typecheck", "test", "build", "test:db", "e2e:smoke", "gallery"]
        (self.root / "package.json").write_text('{"scripts": {}}')
        self.commit()
        with mock.patch.object(bk, "run_verify_process") as run:
            summary = self.verify()
        run.assert_not_called()
        self.assertEqual(summary["verdict"], "env")
        self.assertTrue(all(x["result"] == "env" for x in summary["results"]))

    def test_exception_invalidates_old_green_and_preserves_error_run(self):
        self.commands("pass\n")
        bk.acceptance.atomic_json(self.root / ".bk/last-verify.json", {"verdict": "pass", "old": True})
        with mock.patch.object(bk, "run_verify_process", side_effect=OSError("启动失败")):
            with self.assertRaises(OSError):
                self.verify()
        summary = json.loads((self.root / ".bk/last-verify.json").read_text())
        self.assertEqual(summary["status"], "error")
        self.assertEqual(summary["verdict"], "fail")
        self.assertNotIn("old", summary)
        self.assertIsNotNone(summary["finished_at"])

    def test_candidate_change_and_log_tamper_reject_verified_pending(self):
        self.commands("print('通过')\n")
        self.g("branch", "bk/integrate")
        summary = self.verify()
        bk.require_verified_candidate(self.root, self.cfg, summary)
        log = self.root / summary["results"][0]["log"]
        original = log.read_bytes()
        log.write_bytes(original + b"tampered")
        with self.assertRaises(bk.BkError):
            bk.require_verified_candidate(self.root, self.cfg, summary)
        log.write_bytes(original)
        (self.root / "source.txt").write_text("changed after verification\n")
        with self.assertRaises(bk.BkError):
            bk.require_verified_candidate(self.root, self.cfg, summary)

    def test_mutation_during_check_cannot_pass(self):
        self.commands("from pathlib import Path\nPath('source.txt').write_text('changed')\n")
        summary = self.verify()
        self.assertEqual(summary["results"][0]["result"], "pass")
        self.assertEqual(summary["verdict"], "fail")
        self.assertTrue(summary["identity_changed"])

    def test_browser_flaky_and_fresh_report_are_preserved_and_block(self):
        (self.root / "package.json").write_text('{"scripts":{"e2e:smoke":"unused"}}')
        (self.root / "playwright.config.ts").write_text("// reporter JSON\n")
        self.cfg["verify"]["full"] = ["e2e:smoke"]
        self.cfg["needs_browser"] = ["e2e:smoke"]
        self.commit()
        def run(cmd, root, env, timeout, log, shell):
            log.write_text("1 flaky\n")
            report = root / ".test-results/playwright.json"
            report.parent.mkdir(exist_ok=True)
            report.write_text(json.dumps({"stats": {"flaky": 1, "expected": 0, "unexpected": 0, "skipped": 0}, "suites": [{"specs": [{"tests": [{"status": "flaky", "results": [{"status": "failed"}, {"status": "passed"}]}]}]}]}))
            return 0, False, True
        with mock.patch.object(bk, "run_verify_process", side_effect=run):
            summary = self.verify()
        entry = summary["results"][0]
        self.assertEqual(summary["verdict"], "fail")
        self.assertEqual(entry["flaky_count"], 1)
        self.assertEqual(entry["triage"]["category"], "flaky")
        self.assertTrue((self.root / entry["browser_report"]).exists())
        def stale(cmd, root, env, timeout, log, shell):
            log.write_text("exit zero without a new report\n")
            return 0, False, True
        with mock.patch.object(bk, "run_verify_process", side_effect=stale):
            stale_summary = self.verify()
        self.assertEqual(stale_summary["results"][0]["triage"]["category"], "report")
        self.assertEqual(stale_summary["verdict"], "fail")

    def test_zero_exit_cannot_hide_missing_stats_empty_suites_or_failed_report(self):
        (self.root / "package.json").write_text('{"scripts":{"e2e:smoke":"unused"}}')
        (self.root / "playwright.config.ts").write_text("// reporter JSON\n")
        self.cfg["verify"]["full"] = ["e2e:smoke"]
        self.cfg["needs_browser"] = ["e2e:smoke"]
        self.commit()
        valid_stats = {"expected": 1, "unexpected": 0, "flaky": 0, "skipped": 0}
        cases = [{}, {"stats": valid_stats, "suites": []},
                 {"stats": valid_stats, "errors": [{"message": "worker error"}],
                  "suites": [{"specs": [{"tests": [{"status": "unexpected", "results": [{"status": "failed"}]}]}]}]}]
        for report in cases:
            with self.subTest(report=report):
                def run(cmd, root, env, timeout, log, shell):
                    log.write_text("process exits zero\n")
                    path = root / ".test-results/playwright.json"
                    path.parent.mkdir(exist_ok=True)
                    path.write_text(json.dumps(report))
                    return 0, False, True
                with mock.patch.object(bk, "run_verify_process", side_effect=run):
                    summary = self.verify()
                self.assertEqual(summary["verdict"], "fail")
                self.assertTrue((self.root / summary["results"][0]["browser_report"]).is_file())

    def test_browser_report_copy_integrity_and_run_ownership_are_required(self):
        (self.root / "package.json").write_text('{"scripts":{"e2e:smoke":"unused"}}')
        (self.root / "playwright.config.ts").write_text("// reporter JSON\n")
        self.cfg["verify"]["full"] = ["e2e:smoke"]
        self.cfg["needs_browser"] = ["e2e:smoke"]
        self.commit()
        self.g("branch", "bk/integrate")
        def run(cmd, root, env, timeout, log, shell):
            log.write_text("passed\n")
            path = root / ".test-results/playwright.json"
            path.parent.mkdir(exist_ok=True)
            path.write_text(json.dumps({"stats": {"expected": 1, "unexpected": 0, "flaky": 0, "skipped": 0},
                                        "suites": [{"specs": [{"tests": [{"status": "expected", "results": [{"status": "passed"}]}]}]}]}))
            return 0, False, True
        with mock.patch.object(bk, "run_verify_process", side_effect=run):
            summary = self.verify()
        self.assertEqual(summary["verdict"], "pass")
        bk.require_verified_candidate(self.root, self.cfg, summary)
        report = self.root / summary["results"][0]["browser_report"]
        original = report.read_bytes()
        report.write_bytes(original + b"changed")
        with self.assertRaises(bk.BkError):
            bk.require_verified_candidate(self.root, self.cfg, summary)
        report.write_bytes(original)
        external = self.root / ".bk/not-this-run.json"
        external.write_bytes(original)
        summary["results"][0]["browser_report"] = str(external.relative_to(self.root))
        with self.assertRaises(bk.BkError):
            bk.require_verified_candidate(self.root, self.cfg, summary)

    def task_candidate(self):
        self.g("checkout", "-q", "-b", "task/U01-r1")
        (self.root / "page.txt").write_text("page\n")
        self.commit()
        self.g("checkout", "-q", "main")
        task = {"id": "U01", "title": "测试"}
        sess = {"task": "U01", "round": 1, "base": self.g("rev-parse", "HEAD"), "version": "v0001"}
        return task, sess

    def test_environment_or_unknown_failure_retains_candidate_without_product_fix_package(self):
        for category in ("environment", "unknown", "report", "tool", "flaky"):
            with self.subTest(category=category):
                if (self.root / ".bk/pending.json").exists():
                    self.g("checkout", "-q", "-f", "main")
                    self.g("branch", "-D", "bk/integrate")
                    self.g("branch", "-D", "task/U01-r1")
                task, sess = self.task_candidate()
                summary = {"verdict": "fail", "results": [{"name": "test", "result": "fail", "triage": {"category": category}}]}
                with mock.patch.object(bk, "require_prerequisites"), mock.patch.object(bk, "guard_checks", return_value=([], [])), mock.patch.object(bk, "do_verify", return_value=summary), mock.patch.object(bk, "make_fix_package") as fix, redirect_stdout(io.StringIO()):
                    self.assertFalse(bk.integrate(self.root, self.cfg, "task/U01-r1", "report.md", None, task, sess))
                fix.assert_not_called()
                pending = json.loads((self.root / ".bk/pending.json").read_text())
                self.assertEqual(pending["state"], "blocked")
                self.assertEqual(self.g("branch", "--show-current"), "bk/integrate")

    def test_interruption_retains_pending_and_does_not_lose_main(self):
        task, sess = self.task_candidate()
        main = self.g("rev-parse", "main")
        with mock.patch.object(bk, "require_prerequisites"), mock.patch.object(bk, "guard_checks", return_value=([], [])), mock.patch.object(bk, "do_verify", side_effect=KeyboardInterrupt), redirect_stdout(io.StringIO()):
            with self.assertRaises(KeyboardInterrupt):
                bk.integrate(self.root, self.cfg, "task/U01-r1", "report.md", None, task, sess)
        pending = json.loads((self.root / ".bk/pending.json").read_text())
        self.assertEqual(pending["state"], "interrupted")
        self.assertEqual(self.g("rev-parse", "main"), main)

    def test_atomic_package_validation_failure_preserves_existing_official_file(self):
        (self.root / "tools").mkdir()
        shutil.copy2(ROOT / "tools/bk.py", self.root / "tools/bk.py")
        shutil.copy2(ROOT / "tools/bk_acceptance.py", self.root / "tools/bk_acceptance.py")
        (self.root / "AGENTS.md").write_text("# V4；入口 tools/bk.py\n")
        self.commit()
        out = self.root / ".bk/packages"
        out.mkdir(parents=True)
        official = out / "bk-v0001.zip"
        official.write_bytes(b"previous valid delivery")
        with mock.patch.object(bk.acceptance, "check_zip", side_effect=bk.acceptance.AcceptanceError("模拟校验失败")):
            with self.assertRaises(bk.acceptance.AcceptanceError):
                bk.make_package(self.root, self.cfg, "version", None, 0, "main", self.g("rev-parse", "HEAD"), "v0001", out, official.name)
        self.assertEqual(official.read_bytes(), b"previous valid delivery")
        self.assertFalse(list(out.glob("*.tmp")))

    def runtime_source_fixture(self):
        (self.root / "tools").mkdir(exist_ok=True)
        shutil.copy2(ROOT / "tools/bk.py", self.root / "tools/bk.py")
        shutil.copy2(ROOT / "tools/bk_acceptance.py", self.root / "tools/bk_acceptance.py")
        (self.root / "AGENTS.md").write_text("# V4；入口 tools/bk.py\n")
        for name, value in (("tasks", {"tasks": []}), ("pages", {"pages": []}), ("questions", {"questions": []})):
            path = self.root / "progress" / (name + ".json")
            path.parent.mkdir(exist_ok=True)
            path.write_text(json.dumps(value))
        self.commit()

    def test_real_cli_mutation_waits_for_formal_lock_but_status_remains_readonly(self):
        self.runtime_source_fixture()
        release = self.root / ".bk/release-holder"
        holder_source = ("import sys,time\nfrom pathlib import Path\n"
                         f"sys.path.insert(0,{str(ROOT / 'tools')!r})\nimport bk_acceptance as a\n"
                         "root=Path(sys.argv[1])\nwith a.serial_queue(root,'formal-test'):\n"
                         " (root/'.bk/holder-ready').touch()\n"
                         " while not (root/'.bk/release-holder').exists():time.sleep(.01)\n")
        holder = subprocess.Popen([sys.executable, "-c", holder_source, str(self.root)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        board = None
        try:
            deadline = time.monotonic() + 4
            while not (self.root / ".bk/holder-ready").exists() and time.monotonic() < deadline:
                time.sleep(.01)
            self.assertTrue((self.root / ".bk/holder-ready").exists())
            driver = str(self.root / "tools/bk.py")
            board = subprocess.Popen([sys.executable, driver, "board"], cwd=self.root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            queue = self.root / ".bk/acceptance/queue"
            queued = False
            while time.monotonic() < deadline:
                queued = any(json.loads(path.read_text()).get("operation") == "board" for path in queue.glob("*.json"))
                if queued:
                    break
                time.sleep(.01)
            self.assertTrue(queued, "必须真的进入统一队列，而不是仅观察进程尚未启动")
            self.assertIsNone(board.poll())
            self.assertFalse((self.root / "progress/board.html").exists())
            status = subprocess.run([sys.executable, driver, "status"], cwd=self.root, capture_output=True, text=True, timeout=3)
            self.assertEqual(status.returncode, 0, status.stderr)
            release.touch()
            out, err = board.communicate(timeout=5)
            self.assertEqual(board.returncode, 0, err.decode())
            self.assertTrue((self.root / "progress/board.html").exists())
        finally:
            release.touch()
            holder.communicate(timeout=5)
            if board and board.poll() is None:
                board.kill()
                board.communicate()
        bk.acceptance.atomic_json(self.root / ".bk/pending.json", {"task": "U01", "state": "blocked"})
        start = subprocess.run([sys.executable, str(self.root / "tools/bk.py"), "start", "U99", "--no-install"],
                               cwd=self.root, capture_output=True, text=True, timeout=5)
        self.assertNotEqual(start.returncode, 0)
        self.assertIn("不能覆盖候选", start.stderr)
        self.assertFalse((self.root / ".bk/session.json").exists())

    def test_web_nonpass_blocks_done_and_force_records_partial(self):
        self.runtime_source_fixture()
        task, sess = self.task_candidate()
        self.g("checkout", "-q", "task/U01-r1")
        sess["branch"] = "task/U01-r1"
        bk.acceptance.atomic_json(self.root / ".bk/session.json", sess)
        report = self.root / "progress/reports/U01-r1.md"
        report.parent.mkdir(parents=True)
        report.write_text('# 交接\n\n## 一句话\n完成\n\n## 怎么看效果\n本页\n\n## 做了什么\n完成\n\n```json bk-report\n{"status":"done","pages":{},"questions":[]}\n```\n')
        args = type("Args", (), {"checkpoint": False, "allow_hot": None, "allow_test_change": None, "level": "web", "force": False})()
        summary = {"level": "web", "verdict": "env", "results": [{"name": "test", "result": "env", "note": "环境不可用"}]}
        output = self.root / ".bk/web-output"
        with mock.patch.object(bk, "find_root", return_value=self.root), mock.patch.object(bk, "load_config", return_value=self.cfg), \
             mock.patch.object(bk, "get_task", return_value=task), mock.patch.object(bk, "expand_task", return_value={"owns": ["**"]}), \
             mock.patch.object(bk, "require_prerequisites"), mock.patch.object(bk, "do_verify", return_value=summary), \
             mock.patch.object(bk, "env_kind", return_value="web"), mock.patch.object(bk, "outputs_dir", return_value=output), redirect_stdout(io.StringIO()):
            with self.assertRaises(SystemExit):
                bk.cmd_done(args)
            self.assertFalse(output.exists())
            args.force = True
            bk.cmd_done(args)
        data, _ = bk.read_report(report)
        self.assertEqual(data["status"], "partial")
        self.assertEqual(data["checks"]["test"], "env")
        self.assertTrue(list(output.glob("*-done.zip")))

    def test_ship_missing_or_stale_receipt_cannot_skip_official_package(self):
        self.runtime_source_fixture()
        head = self.g("rev-parse", "HEAD")
        self.g("tag", "-a", "bk-v0001", "-m", "version")
        remote = self.root / ".bk/local-remote.git"
        subprocess.run(["git", "init", "--bare", "-q", str(remote)], check=True)
        self.g("remote", "add", "origin", str(remote))
        self.cfg["handoff_dir"] = ".bk/handoff"
        bk.acceptance.atomic_json(self.root / ".bk/last-release.json", {"release_commit": "old", "version": "v0000", "package": "stale.zip", "remote_verified": True})
        args = type("Args", (), {})()
        with mock.patch.object(bk, "find_root", return_value=self.root), mock.patch.object(bk, "load_config", return_value=self.cfg), redirect_stdout(io.StringIO()):
            with self.assertRaises(bk.acceptance.AcceptanceError):
                bk.cmd_ship(args)
            self.assertEqual(subprocess.run(["git", "ls-remote", str(remote)], capture_output=True, text=True).stdout, "")
            package = bk.make_package(self.root, self.cfg, "version", None, 0, "main", head, "v0001", bk.handoff(self.root, self.cfg, "versions"), "bk-v0001.zip")
            bk.cmd_ship(args)
        receipt = json.loads((self.root / ".bk/last-release.json").read_text())
        self.assertEqual(receipt["release_commit"], head)
        self.assertEqual(receipt["package"], str(package))
        self.assertTrue(receipt["receipt_recovered"])
        self.assertTrue(receipt["remote_verified"])

    def test_release_pending_continue_recreates_same_version_without_finalizing_again(self):
        commit = self.g("rev-parse", "HEAD")
        self.g("tag", "-a", "bk-v0001", "-m", "version")
        pending = {"state": "release_pending", "merged_to_main": True, "release_commit": commit,
                   "release_version": "v0001", "task": "U01", "summary": {"run_id": "one"}}
        bk.acceptance.atomic_json(self.root / ".bk/pending.json", pending)
        package = self.root / ".bk/result.zip"
        package.write_bytes(b"validated package")
        args = type("Args", (), {"abort": False, "reject": None, "cont": True})()
        with mock.patch.object(bk, "find_root", return_value=self.root), mock.patch.object(bk, "load_config", return_value=self.cfg), mock.patch.object(bk, "make_package", return_value=package) as make, mock.patch.object(bk, "finalize") as finalize, redirect_stdout(io.StringIO()):
            bk.cmd_in(args)
        finalize.assert_not_called()
        self.assertEqual(make.call_args.args[7], "v0001")
        self.assertFalse((self.root / ".bk/pending.json").exists())
        release = json.loads((self.root / ".bk/last-release.json").read_text())
        self.assertEqual(release["version"], "v0001")
        self.assertEqual(release["release_commit"], commit)


if __name__ == "__main__":
    unittest.main()
