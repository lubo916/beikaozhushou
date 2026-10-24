"""Behavioral regressions for acceptance identity, atomic reports and shared Linux queue."""
from __future__ import annotations

import copy
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock
import zipfile

from _support import ROOT

MODULE = ROOT / "tools" / "bk_acceptance.py"
SPEC = importlib.util.spec_from_file_location("bk_acceptance_tests_module", MODULE)
acceptance = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(acceptance)


class AcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="bk-acceptance-tests-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], stderr=subprocess.STDOUT).decode().strip()

    def init_git(self):
        self.git("init", "-q")
        self.git("config", "user.email", "tests@example.invalid")
        self.git("config", "user.name", "Tool tests")
        (self.root / ".gitignore").write_text(".bk/\n")
        (self.root / "source.py").write_text("value = 1\n")
        self.git("add", ".")
        self.git("commit", "-qm", "fixture")

    def start_child(self, source, *args, pass_fds=()):
        prefix = ("import importlib.util,sys,time,json,os\nfrom pathlib import Path\n"
                  "s=importlib.util.spec_from_file_location('acc',sys.argv[1]); "
                  "a=importlib.util.module_from_spec(s); s.loader.exec_module(a)\n"
                  "root=Path(sys.argv[2])\n")
        process = subprocess.Popen([sys.executable, "-c", prefix + source, str(MODULE), str(self.root), *map(str, args)],
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, pass_fds=pass_fds)
        self.addCleanup(self.stop_child, process)
        return process

    def stop_child(self, process):
        if process.poll() is None:
            process.kill()
        process.communicate(timeout=5)

    def wait_for(self, predicate, timeout=5):
        started = time.monotonic()
        while not predicate():
            if time.monotonic() - started > timeout:
                self.fail("own test process did not reach the expected state")
            time.sleep(0.01)

    def records(self):
        return [json.loads(p.read_text()) for p in (self.root / ".bk/acceptance/queue").glob("*.json")]

    def test_atomic_write_preserves_previous_json_on_failure(self):
        target = self.root / "summary.json"
        acceptance.atomic_json(target, {"verdict": "pass"})
        with mock.patch.object(acceptance.os, "replace", side_effect=PermissionError("simulated")):
            with self.assertRaises(PermissionError):
                acceptance.atomic_json(target, {"verdict": "running"})
        self.assertEqual(json.loads(target.read_text()), {"verdict": "pass"})
        self.assertEqual(list(self.root.glob("*.tmp")), [])
        with self.assertRaises(ValueError):
            acceptance.atomic_json(target, {"value": float("nan")})
        self.assertEqual(json.loads(target.read_text()), {"verdict": "pass"})

    def test_common_root_handles_no_git_and_linked_worktree(self):
        self.assertEqual(acceptance.common_repo_root(self.root), self.root.resolve())
        self.init_git()
        linked = self.root / ".bk" / "linked"
        linked.parent.mkdir()
        self.git("worktree", "add", "-qb", "linked", str(linked))
        self.assertEqual(acceptance.common_repo_root(linked), self.root.resolve())
        first, second = acceptance.new_run(linked, "verify"), acceptance.new_run(linked, "verify")
        self.assertNotEqual(first["id"], second["id"])
        self.assertTrue(Path(first["path"]).is_relative_to(linked))
        self.assertTrue((Path(first["path"]) / "run.json").is_file())

    def test_fingerprint_binds_tracked_untracked_config_commands_and_ignores_reports(self):
        self.init_git()
        original = acceptance.fingerprint(self.root, {"timeout": 5}, ["lint", "test"], "this-run")
        run = acceptance.new_run(self.root, "verify")
        acceptance.atomic_json(Path(run["path"]) / "summary.json", {"verdict": "pass"})
        self.assertEqual(original, acceptance.fingerprint(self.root, {"timeout": 5}, ["lint", "test"], "this-run"))
        (self.root / "source.py").write_text("value = 2\n")
        changed = acceptance.fingerprint(self.root, {"timeout": 5}, ["lint", "test"], "this-run")
        self.assertEqual(original["head"], changed["head"])
        self.assertNotEqual(original["tested_state_sha256"], changed["tested_state_sha256"])
        (self.root / "new.py").write_text("new = 1")
        added = acceptance.fingerprint(self.root, {"timeout": 5}, ["lint", "test"], "this-run")
        (self.root / "new.py").write_text("new = 2")
        self.assertNotEqual(added["tested_state_sha256"],
                            acceptance.fingerprint(self.root, {"timeout": 5}, ["lint", "test"], "this-run")["tested_state_sha256"])
        self.assertNotEqual(original["config_sha256"],
                            acceptance.fingerprint(self.root, {"timeout": 6}, ["lint", "test"], "this-run")["config_sha256"])
        self.assertNotEqual(original["commands_sha256"],
                            acceptance.fingerprint(self.root, {"timeout": 5}, ["test"], "this-run")["commands_sha256"])

    def test_only_complete_same_run_normal_summary_is_valid(self):
        self.init_git()
        identity = acceptance.fingerprint(self.root, {}, ["lint", "test"], "new-run")
        good = {"run_id": "new-run", "policy_version": acceptance.POLICY_VERSION, "identity": identity,
                "mode": "normal", "status": "completed", "verdict": "pass",
                "results": [{"name": "lint", "result": "pass"}, {"name": "test", "result": "pass"}]}
        self.assertEqual(acceptance.validate_summary(good, identity), [])
        for field, value in (("run_id", "old-run"), ("mode", "diagnostic"), ("status", "interrupted"),
                             ("identity", {}), ("policy_version", "old"), ("verdict", "env")):
            bad = copy.deepcopy(good)
            bad[field] = value
            self.assertTrue(acceptance.validate_summary(bad, identity), field)
        bad = copy.deepcopy(good)
        bad["results"].pop()
        self.assertTrue(acceptance.validate_summary(bad, identity))
        bad = copy.deepcopy(good)
        bad["results"][1]["result"] = "not_run"
        self.assertTrue(acceptance.validate_summary(bad, identity))
        self.assertTrue(acceptance.validate_summary({"verdict": "pass"}, identity))

    def test_triage_does_not_exonerate_signals_timeouts_or_passing_retries(self):
        for output, code in (("Segmentation fault", 139), ("timeout", 1), ("8 flaky, retried passed", 0)):
            classified = acceptance.triage(output, code)
            self.assertEqual(classified["category"], "unknown")
            self.assertFalse(classified["auto_retry"])
            self.assertFalse(classified["can_release"])
        self.assertEqual(acceptance.triage("Cannot connect to the Docker daemon", 1)["category"], "environment")
        self.assertEqual(acceptance.triage("JSONDecodeError: malformed report", 1)["category"], "report")
        self.assertEqual(acceptance.triage("AssertionError: actual != expected", 1)["category"], "test")

    def test_triage_ignores_react_act_warning_comment(self):
        """React act() 警告正文里的 /* assert on the output */ 不是断言失败（U24 浏览器断连日志曾被误标）"""
        output = ("An update to Probe inside a test was not wrapped in act(...).\n/* assert on the output */\n"
                  "Error: [vitest] Browser connection was closed while running tests. Was the page closed unexpectedly?\n"
                  "Caused by: Error: [birpc] rpc is closed, cannot call \"createTesters\"\n")
        classified = acceptance.triage(output, 1)
        self.assertEqual(classified["category"], "unknown")
        self.assertFalse(classified["auto_retry"])
        self.assertFalse(classified["can_release"])

    def make_zip(self, path, *, tool="4.1.1", task="U01"):
        meta = {"kind": "task", "tool": tool, "version": "v0052", "base": "a" * 40, "task": task}
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("VERSION.txt", "版本：v0052\n基于提交：" + "a" * 40 + "\n任务：" + task)
            archive.writestr("repo/.bk/package.json", json.dumps(meta))
            archive.writestr("repo/tools/bk.py", 'TOOL_VERSION = "' + tool + '"')
            archive.writestr("repo/AGENTS.md", "# V4\n入口 tools/bk.py")

    def test_zip_integrity_identity_and_unsafe_members(self):
        package = self.root / "package.zip"
        self.make_zip(package)
        result = acceptance.check_zip(package, expected_task="U01", expected_version="v0052",
                                      expected_baseline="a" * 40)
        self.assertTrue(result["valid"])
        self.assertGreater(result["size_bytes"], 0)
        with self.assertRaises(acceptance.AcceptanceError):
            acceptance.check_zip(package, expected_task="U02")
        with zipfile.ZipFile(package, "a") as archive:
            archive.writestr("../outside.txt", "bad")
        with self.assertRaises(acceptance.AcceptanceError):
            acceptance.check_zip(package)
        self.make_zip(package, tool="3.9")
        with self.assertRaises(acceptance.AcceptanceError):
            acceptance.check_zip(package)
        self.make_zip(package)
        with zipfile.ZipFile(package) as archive:
            contents = {name: archive.read(name) for name in archive.namelist()}
        contents["VERSION.txt"] = contents["VERSION.txt"].replace(b"U01", b"U02") + b"\\nFilename: bk-U01.zip"
        with zipfile.ZipFile(package, "w") as archive:
            for name, value in contents.items():
                archive.writestr(name, value)
        with self.assertRaises(acceptance.AcceptanceError):
            acceptance.check_zip(package)
        package.write_bytes(b"")
        with self.assertRaises(acceptance.AcceptanceError):
            acceptance.check_zip(package)
        package.write_bytes(b"not a zip")
        with self.assertRaises(acceptance.AcceptanceError):
            acceptance.check_zip(package)
        self.make_zip(package)
        content = bytearray(package.read_bytes())
        index = content.index(b"# V4")
        content[index] ^= 1
        package.write_bytes(content)
        with self.assertRaises(acceptance.AcceptanceError):
            acceptance.check_zip(package)

    @unittest.skipUnless(sys.platform == "linux", "Linux flock and /proc identities")
    def test_same_process_nesting_and_exception_release(self):
        with self.assertRaisesRegex(RuntimeError, "failure"):
            with acceptance.serial_queue(self.root, "outer") as first:
                with acceptance.serial_queue(self.root, "inner") as second:
                    self.assertEqual(first["request_id"], second["request_id"])
                    self.assertTrue(second["nested"])
                raise RuntimeError("failure")
        with acceptance.serial_queue(self.root, "after", timeout=1):
            pass
        self.assertEqual(sorted(r["status"] for r in self.records()), ["completed", "failed"])

    @unittest.skipUnless(sys.platform == "linux", "Linux flock and /proc identities")
    def test_concurrent_processes_are_fifo_and_never_overlap(self):
        worker = ("with a.serial_queue(root,sys.argv[3],timeout=5) as ticket:\n"
                  " with (root/'events').open('a') as f: f.write(json.dumps([sys.argv[3],'start',time.monotonic(),ticket['wait_seconds']])+'\\n')\n"
                  " time.sleep(.25)\n"
                  " with (root/'events').open('a') as f: f.write(json.dumps([sys.argv[3],'end',time.monotonic()])+'\\n')\n")
        first = self.start_child(worker, "first")
        self.wait_for(lambda: (self.root / "events").exists())
        second = self.start_child(worker, "second")
        self.wait_for(lambda: any(r["operation"] == "second" for r in self.records()))
        third = self.start_child(worker, "third")
        for process in (first, second, third):
            out, err = process.communicate(timeout=7)
            self.assertEqual(process.returncode, 0, out + err)
        events = [json.loads(line) for line in (self.root / "events").read_text().splitlines()]
        self.assertEqual([(e[0], e[1]) for e in events],
                         [(name, phase) for name in ("first", "second", "third") for phase in ("start", "end")])
        self.assertGreater(events[2][3], 0)
        self.assertEqual([r["status"] for r in self.records()].count("completed"), 3)

    @unittest.skipUnless(sys.platform == "linux", "Linux flock and /proc identities")
    def test_killed_owner_releases_kernel_lock_and_stale_request_is_abandoned(self):
        first = self.start_child("with a.serial_queue(root,'killed'):\n (root/'entered').write_text('yes')\n time.sleep(60)\n")
        self.wait_for(lambda: (self.root / "entered").exists())
        second = self.start_child("with a.serial_queue(root,'survivor',timeout=5):\n print('acquired',flush=True)\n")
        self.wait_for(lambda: any(r["operation"] == "survivor" for r in self.records()))
        first.kill()
        first.communicate(timeout=3)
        out, err = second.communicate(timeout=6)
        self.assertEqual(second.returncode, 0, err)
        self.assertIn("acquired", out)
        states = {r["operation"]: r["status"] for r in self.records()}
        self.assertEqual(states, {"killed": "abandoned", "survivor": "completed"})

    @unittest.skipUnless(sys.platform == "linux" and shutil.which("flock"), "Linux legacy flock")
    def test_legacy_ancestor_flock_and_queued_parent_children_do_not_deadlock(self):
        lock = self.root / ".bk/parallel/verify.lock"
        lock.parent.mkdir(parents=True)
        code = ("import importlib.util,sys; from pathlib import Path; "
                "s=importlib.util.spec_from_file_location('acc',sys.argv[1]); "
                "a=importlib.util.module_from_spec(s); s.loader.exec_module(a); "
                "exec(\"with a.serial_queue(Path(sys.argv[2]),'legacy-child',timeout=2) as t:\\n print(t['legacy_lock_borrowed'])\")")
        result = subprocess.run(["flock", str(lock), sys.executable, "-c", code, str(MODULE), str(self.root)],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("True", result.stdout)
        with acceptance.serial_queue(self.root, "parent", timeout=2) as parent:
            unsafe = self.start_child("with a.serial_queue(root,'unsafe',timeout=2):\n pass\n")
            out, err = unsafe.communicate(timeout=5)
            self.assertNotEqual(unsafe.returncode, 0)
            self.assertIn("no proven inherited lock FD", err)
            child = self.start_child("with a.serial_queue(root,'child',timeout=2) as t:\n print(t['parent_request_id'],t['nested'])\n",
                                     pass_fds=(parent["lock_fd"],))
            out, err = child.communicate(timeout=5)
            self.assertEqual(child.returncode, 0, err)
            self.assertIn(parent["request_id"], out)
            self.assertIn("True", out)
        self.assertEqual(len(self.records()), 3)

    @unittest.skipUnless(sys.platform == "linux", "Linux legacy flock")
    def test_unrelated_live_legacy_owner_is_not_stolen(self):
        holder = self.start_child("import fcntl\nlock=root/'.bk/parallel/verify.lock'\nlock.parent.mkdir(parents=True)\nf=lock.open('a+b')\nfcntl.flock(f,fcntl.LOCK_EX)\n(root/'held').write_text('yes')\ntime.sleep(60)\n")
        self.wait_for(lambda: (self.root / "held").exists())
        with self.assertRaises(acceptance.AcceptanceError):
            with acceptance.serial_queue(self.root, "blocked", timeout=.2):
                self.fail("must not enter a live owner's lock")
        self.assertIsNone(holder.poll())
        self.assertEqual(self.records()[0]["status"], "failed")

    @unittest.skipUnless(sys.platform == "linux" and shutil.which("flock"), "Linux legacy flock")
    def test_preowned_legacy_lock_does_not_queue_behind_its_waiter(self):
        lock = self.root / ".bk/parallel/verify.lock"
        lock.parent.mkdir(parents=True)
        prefix = ("import importlib.util,sys,time,json,os\nfrom pathlib import Path\n"
                  "s=importlib.util.spec_from_file_location('acc',sys.argv[1]); "
                  "a=importlib.util.module_from_spec(s); s.loader.exec_module(a)\nroot=Path(sys.argv[2])\n")
        code = (prefix + "(root/'legacy-held').write_text('yes')\n"
                "until=time.monotonic()+4\n"
                "while not (root/'legacy-go').exists() and time.monotonic()<until: time.sleep(.01)\n"
                "with a.serial_queue(root,'legacy-inner',timeout=2) as ticket:\n"
                " (root/'legacy-inner').write_text(str(ticket['legacy_lock_borrowed']))\n")
        legacy = subprocess.Popen(["flock", str(lock), sys.executable, "-c", code, str(MODULE), str(self.root)],
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.addCleanup(self.stop_child, legacy)
        self.wait_for(lambda: (self.root / "legacy-held").exists())
        waiter = self.start_child("with a.serial_queue(root,'earlier-waiter',timeout=5):\n (root/'waiter-entered').write_text('yes')\n")
        self.wait_for(lambda: any(r["operation"] == "earlier-waiter" for r in self.records()))
        (self.root / "legacy-go").write_text("go")
        out, err = legacy.communicate(timeout=5)
        self.assertEqual(legacy.returncode, 0, out + err)
        out, err = waiter.communicate(timeout=5)
        self.assertEqual(waiter.returncode, 0, out + err)
        self.assertEqual((self.root / "legacy-inner").read_text(), "True")
        self.assertTrue((self.root / "waiter-entered").is_file())

    @unittest.skipUnless(sys.platform == "linux", "Linux inherited flock")
    def test_inherited_child_keeps_exclusion_after_parent_is_killed(self):
        prefix = ("import importlib.util,sys,time,json,os\nfrom pathlib import Path\n"
                  "s=importlib.util.spec_from_file_location('acc',sys.argv[1]); "
                  "a=importlib.util.module_from_spec(s); s.loader.exec_module(a)\nroot=Path(sys.argv[2])\n")
        child_code = (prefix + "with a.serial_queue(root,'inherited-child',timeout=3):\n"
                      " (root/'child-entered').write_text('yes')\n"
                      " until=time.monotonic()+5\n"
                      " while not (root/'release-child').exists() and time.monotonic()<until: time.sleep(.01)\n"
                      " (root/'child-finished').write_text('yes')\n")
        parent_code = ("import subprocess\n"
                       "with a.serial_queue(root,'parent-to-kill') as ticket:\n"
                       " p=subprocess.Popen([sys.executable,'-c',sys.argv[3],sys.argv[1],str(root)],pass_fds=(ticket['lock_fd'],),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\n"
                       " (root/'owned-child.json').write_text(json.dumps({'pid':p.pid,'start':a._proc_identity(p.pid)['start_ticks']}))\n"
                       " time.sleep(60)\n")
        parent = self.start_child(parent_code, child_code)
        self.wait_for(lambda: (self.root / "owned-child.json").exists())
        owned = json.loads((self.root / "owned-child.json").read_text())

        def cleanup_owned_child():
            identity = acceptance._proc_identity(owned["pid"])
            if identity and identity["start_ticks"] == owned["start"] and identity["state"] != "Z":
                os.kill(owned["pid"], 9)
        self.addCleanup(cleanup_owned_child)
        self.wait_for(lambda: (self.root / "child-entered").exists())
        parent.kill()
        parent.communicate(timeout=3)
        third = self.start_child("with a.serial_queue(root,'third',timeout=5):\n assert (root/'child-finished').exists()\n (root/'third-entered').write_text('yes')\n")
        self.wait_for(lambda: any(r["operation"] == "third" for r in self.records()))
        time.sleep(.2)
        self.assertFalse((self.root / "third-entered").exists())
        (self.root / "release-child").write_text("go")
        out, err = third.communicate(timeout=5)
        self.assertEqual(third.returncode, 0, out + err)
        self.assertTrue((self.root / "third-entered").exists())

    def test_runtime_and_secret_environment_are_bound_without_plaintext(self):
        self.init_git()
        (self.root / ".env").write_text("DATABASE_URL=private-value-one")
        first = acceptance.fingerprint(self.root, {}, ["test"], "run", environment={"E2E_SHARD": "1/2", "DATABASE_URL": "secret-url-one"})
        second = acceptance.fingerprint(self.root, {}, ["test"], "run", environment={"E2E_SHARD": "2/2", "DATABASE_URL": "secret-url-two"})
        self.assertNotEqual(first["environment_sha256"], second["environment_sha256"])
        (self.root / ".env").write_text("DATABASE_URL=private-value-two")
        third = acceptance.fingerprint(self.root, {}, ["test"], "run", environment={"E2E_SHARD": "1/2", "DATABASE_URL": "secret-url-one"})
        self.assertNotEqual(first["runtime_inputs_sha256"], third["runtime_inputs_sha256"])
        serialized = json.dumps([first, second, third])
        self.assertNotIn("private-value", serialized)
        self.assertNotIn("secret-url", serialized)

    def add_runtime(self, path):
        with zipfile.ZipFile(path) as archive:
            meta = json.loads(archive.read("repo/.bk/package.json"))
        files = {"bk.py": ('TOOL_VERSION = "' + meta["tool"] + '"\n').encode(),
                 "bk_acceptance.py": ('POLICY_VERSION = "' + acceptance.POLICY_VERSION + '"\n').encode(),
                 "AGENTS.md": "# V4 验收运行入口 bk.py\n".encode(),
                 "acceptance-flow.md": "# 验收协议\n完整验证，不跨轮复用。\n".encode()}
        manifest = {"tool_version": meta["tool"], "policy_version": acceptance.POLICY_VERSION,
                    "entry": "python3 ../BK_RUNTIME/bk.py",
                    "files": {name: {"sha256": acceptance._sha(value), "size_bytes": len(value)}
                              for name, value in files.items()}}
        with zipfile.ZipFile(path, "a") as archive:
            for name, value in files.items():
                archive.writestr("BK_RUNTIME/" + name, value)
            archive.writestr("BK_RUNTIME/runtime.json", json.dumps(manifest))

    def rewrite_zip(self, path, mutate):
        with zipfile.ZipFile(path) as archive:
            contents = {name: archive.read(name) for name in archive.namelist()}
        mutate(contents)
        with zipfile.ZipFile(path, "w") as archive:
            for name, value in contents.items():
                archive.writestr(name, value)

    def test_new_package_requires_and_validates_authority_runtime(self):
        package = self.root / "new.zip"
        for version in ("4.2.0", "4.2.1", "4.10.0"):
            with self.subTest(version=version):
                self.make_zip(package, tool=version)
                with self.assertRaises(acceptance.AcceptanceError):
                    acceptance.check_zip(package)
        self.make_zip(package, tool="4.2.0")
        self.add_runtime(package)
        result = acceptance.check_zip(package)
        self.assertTrue(result["runtime_verified"])
        self.assertEqual(result["runtime"]["policy_version"], acceptance.POLICY_VERSION)
        self.assertEqual(result["runtime"]["tool_version"], "4.2.0")
        self.make_zip(package, tool="4.1.1")
        self.assertFalse(acceptance.check_zip(package)["runtime_verified"])
        with zipfile.ZipFile(package, "a") as archive:
            archive.writestr("BK_RUNTIME/bk.py", 'TOOL_VERSION = "4.1.1"')
        with self.assertRaises(acceptance.AcceptanceError):
            acceptance.check_zip(package)

    def test_runtime_missing_files_or_repacked_corruption_fail_closed(self):
        package = self.root / "runtime.zip"
        for missing in ("bk.py", "bk_acceptance.py", "AGENTS.md", "acceptance-flow.md", "runtime.json"):
            with self.subTest(missing=missing):
                self.make_zip(package, tool="4.2.0")
                self.add_runtime(package)
                self.rewrite_zip(package, lambda contents: contents.pop("BK_RUNTIME/" + missing))
                with self.assertRaises(acceptance.AcceptanceError):
                    acceptance.check_zip(package)
        self.make_zip(package, tool="4.2.0")
        self.add_runtime(package)
        self.rewrite_zip(package, lambda contents: contents.update({"BK_RUNTIME/bk.py": b"TOOL_VERSION = '4.2.1'\n"}))
        with self.assertRaises(acceptance.AcceptanceError):
            acceptance.check_zip(package)
        self.make_zip(package, tool="4.2.0")
        self.add_runtime(package)
        self.rewrite_zip(package, lambda contents: contents.update({"BK_RUNTIME/unlisted.py": b"print('outside manifest')"}))
        with self.assertRaises(acceptance.AcceptanceError):
            acceptance.check_zip(package)

    def test_runtime_manifest_policy_entry_lengths_and_source_identity_are_enforced(self):
        package = self.root / "manifest.zip"

        def mutate_manifest(contents, change):
            manifest = json.loads(contents["BK_RUNTIME/runtime.json"])
            change(manifest)
            contents["BK_RUNTIME/runtime.json"] = json.dumps(manifest).encode()

        mutations = [
            lambda manifest: manifest.update(policy_version="old-policy"),
            lambda manifest: manifest.update(tool_version="4.1.1"),
            lambda manifest: manifest.update(entry="python3 tools/bk.py"),
            lambda manifest: manifest["files"]["bk.py"].update(size_bytes=True),
            lambda manifest: manifest["files"]["bk.py"].update(size_bytes=1),
            lambda manifest: manifest["files"]["bk.py"].update(sha256="0" * 64),
            lambda manifest: manifest["files"].pop("bk_acceptance.py"),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(mutation=index):
                self.make_zip(package, tool="4.2.0")
                self.add_runtime(package)
                self.rewrite_zip(package, lambda contents: mutate_manifest(contents, mutate))
                with self.assertRaises(acceptance.AcceptanceError):
                    acceptance.check_zip(package)

        for member, value in (("bk.py", b"TOOL_VERSION = '3.9.0'\n"),
                              ("bk_acceptance.py", b"POLICY_VERSION = 'old-policy'\n"),
                              ("AGENTS.md", b"old instructions\n")):
            with self.subTest(source_identity=member):
                self.make_zip(package, tool="4.2.0")
                self.add_runtime(package)

                def replace_source(contents):
                    contents["BK_RUNTIME/" + member] = value
                    mutate_manifest(contents, lambda manifest: manifest["files"][member].update(
                        sha256=acceptance._sha(value), size_bytes=len(value)))
                self.rewrite_zip(package, replace_source)
                with self.assertRaises(acceptance.AcceptanceError):
                    acceptance.check_zip(package)



if __name__ == "__main__":
    unittest.main()

