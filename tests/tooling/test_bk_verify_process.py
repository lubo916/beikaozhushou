"""验证命令的真实进度、超时日志和自有子进程清理回归。"""
from __future__ import annotations

import copy
import importlib.util
import io
import json
import os
import shlex
import subprocess
import signal
import sys
import tempfile
import threading
import time
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

from _support import ROOT

SPEC = importlib.util.spec_from_file_location("bk_verify_process_tests", ROOT / "tools/bk.py")
bk = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bk)


def process_identity(pid):
    try:
        fields = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
        return fields[19], fields[0]
    except (OSError, IndexError):
        return None


class VerifyProcessTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="bk-verify-process-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=self.root, check=True)
        subprocess.run(["git", "config", "user.name", "验收进程测试"], cwd=self.root, check=True)
        subprocess.run(["git", "config", "user.email", "acceptance-test@bk.local"], cwd=self.root, check=True)
        (self.root / ".gitignore").write_text(".bk/\n*.pid\nstarted\nrelease\nmust-not-run\n")
        self.addCleanup(self.cleanup_own_processes)

    def cleanup_own_processes(self):
        # 只处理本用例自己写下的 PID，并核对启动时间，避免误伤其他进程。
        for path in self.root.glob("*.pid"):
            data = json.loads(path.read_text())
            identity = process_identity(data["pid"])
            if identity and identity[0] == data["start"] and identity[1] != "Z":
                try:
                    os.kill(data["pid"], signal.SIGKILL)
                except ProcessLookupError:
                    pass

    def run_script(self, source, timeout=1, following=None, diagnostic=False):
        script = self.root / "command.py"
        script.write_text(source, encoding="utf-8")
        commands = ["cmd:" + shlex.join([sys.executable, "-u", str(script)])]
        if following:
            second = self.root / "following.py"
            second.write_text(following, encoding="utf-8")
            commands.append("cmd:" + shlex.join([sys.executable, "-u", str(second)]))
        subprocess.run(["git", "add", "-A"], cwd=self.root, check=True)
        subprocess.run(["git", "commit", "-q", "-m", "受测命令"], cwd=self.root, check=True)
        cfg = copy.deepcopy(bk.DEFAULT_CONFIG)
        cfg["verify"] = {"quick": commands}
        cfg["timeouts"] = {"default": timeout}
        cfg["needs_browser"] = []
        cfg["needs_db"] = []
        console = io.StringIO()
        with mock.patch.object(bk, "find_chromium", return_value=None), \
             mock.patch.object(bk, "script_runner", return_value=[]), \
             mock.patch.object(bk, "env_kind", return_value="local"), \
             redirect_stdout(console):
            summary = bk.do_verify(self.root, cfg, "quick", caps={"ready": True}, diagnostic=diagnostic)
        return summary, console.getvalue()

    def test_timeout_preserves_stdout_stderr_and_remains_failure(self):
        summary, console = self.run_script(
            "import sys,time\n"
            "print('BEFORE_TIMEOUT_STDOUT', flush=True)\n"
            "print('BEFORE_TIMEOUT_STDERR', file=sys.stderr, flush=True)\n"
            "time.sleep(60)\n"
        )
        self.assertEqual(summary["verdict"], "fail")
        self.assertEqual(summary["results"][0]["result"], "fail")
        self.assertIn("超时", summary["results"][0]["note"])
        log = (self.root / summary["results"][0]["log"]).read_text()
        self.assertIn("BEFORE_TIMEOUT_STDOUT", log)
        self.assertIn("BEFORE_TIMEOUT_STDERR", log)
        self.assertIn("BEFORE_TIMEOUT_STDOUT", console)
        self.assertIn("BEFORE_TIMEOUT_STDERR", console)

    def test_timeout_cleans_detached_reparented_children_before_next_check(self):
        record = (
            "import os,json,time,sys\n"
            "from pathlib import Path\n"
            "fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()\n"
            "Path(sys.argv[1]).write_text(json.dumps({'pid':os.getpid(),'start':fields[19]}))\n"
            "time.sleep(60)\n"
        )
        launcher = (
            "import subprocess,sys\n"
            f"subprocess.Popen([sys.executable,'-u','-c',{record!r},sys.argv[1]],"
            "start_new_session=True,stdin=subprocess.DEVNULL,"
            "stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)\n"
        )
        command = (
            "import os,json,subprocess,sys,time\n"
            "from pathlib import Path\n"
            "root=Path.cwd()\n"
            "fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()\n"
            "(root/'parent.pid').write_text(json.dumps({'pid':os.getpid(),'start':fields[19]}))\n"
            f"subprocess.run([sys.executable,'-u','-c',{launcher!r},str(root/'detached.pid')],"
            "start_new_session=True,check=True)\n"
            "while not (root/'detached.pid').exists():time.sleep(0.01)\n"
            "print('DETACHED_DESCENDANT_READY',flush=True)\n"
            "time.sleep(60)\n"
        )
        following = (
            "import json\n"
            "from pathlib import Path\n"
            "alive=[]\n"
            "for path in Path.cwd().glob('*.pid'):\n"
            " data=json.loads(path.read_text())\n"
            " try:fields=Path(f'/proc/{data[\"pid\"]}/stat').read_text().rsplit(')',1)[1].split()\n"
            " except FileNotFoundError:continue\n"
            " if fields[19]==data['start'] and fields[0]!='Z':alive.append(data['pid'])\n"
            "assert not alive, f'前一个检查遗留进程：{alive}'\n"
            "print('FOLLOWING_CHECK_HAS_NO_LEAKS',flush=True)\n"
        )
        summary, _ = self.run_script(command, following=following, diagnostic=True)
        self.assertTrue((self.root / "detached.pid").exists(), "必须真正生成脱离进程组且父进程已退出的后代")
        self.assertEqual(summary["verdict"], "diagnostic")
        self.assertEqual(summary["results"][0]["result"], "fail")
        self.assertEqual(summary["results"][1]["result"], "pass", "超时清理必须在下一项检查前完成")
        for path in self.root.glob("*.pid"):
            data = json.loads(path.read_text())
            identity = process_identity(data["pid"])
            self.assertFalse(identity and identity[0] == data["start"] and identity[1] != "Z",
                             f"超时后仍有本用例的自有进程：{data['pid']}")

    def test_log_and_console_show_progress_before_command_exits(self):
        release = self.root / "release"
        result = []
        errors = []
        source = (
            "import time\n"
            "from pathlib import Path\n"
            "print('LIVE_PROGRESS_BEFORE_EXIT',flush=True)\n"
            "Path('started').touch()\n"
            "while not Path('release').exists():time.sleep(0.02)\n"
        )
        def run():
            try:
                result.append(self.run_script(source, timeout=8))
            except BaseException as error:
                errors.append(error)
        worker = threading.Thread(target=run)
        worker.start()
        try:
            deadline = time.monotonic() + 3
            found = False
            while time.monotonic() < deadline:
                logs = list((self.root / ".bk/acceptance/runs").glob("*/*.log"))
                if (logs and "LIVE_PROGRESS_BEFORE_EXIT" in logs[0].read_text()
                        and isinstance(sys.stdout, io.StringIO)
                        and "LIVE_PROGRESS_BEFORE_EXIT" in sys.stdout.getvalue()):
                    found = True
                    break
                time.sleep(0.02)
            self.assertTrue(worker.is_alive(), "观察实时进度时命令必须仍在运行")
            self.assertTrue(found, "命令尚未退出时，日志就应保存真实进度")
            # redirect_stdout 的当前目标就是验证线程的控制台缓冲区。
            self.assertIn("LIVE_PROGRESS_BEFORE_EXIT", sys.stdout.getvalue())
        finally:
            release.touch()
            worker.join(timeout=10)
        self.assertFalse(worker.is_alive())
        self.assertFalse(errors, errors)
        self.assertEqual(result[0][0]["verdict"], "pass")

    def test_nonzero_exit_remains_failure_with_both_output_streams(self):
        summary, console = self.run_script(
            "import sys\n"
            "print('FAILED_STDOUT',flush=True)\n"
            "print('FAILED_STDERR',file=sys.stderr,flush=True)\n"
            "sys.exit(7)\n"
        )
        self.assertEqual(summary["verdict"], "fail")
        self.assertEqual(summary["results"][0]["result"], "fail")
        log = (self.root / summary["results"][0]["log"]).read_text()
        self.assertIn("FAILED_STDOUT", log)
        self.assertIn("FAILED_STDERR", log)
        self.assertIn("FAILED_STDERR", console)


    def test_timeout_does_not_kill_unrelated_process(self):
        unrelated = subprocess.Popen(
            [sys.executable, "-c", "import time; time.sleep(60)"],
            start_new_session=True,
        )
        try:
            identity = process_identity(unrelated.pid)
            summary, _ = self.run_script("import time\nprint('OWN_COMMAND',flush=True)\ntime.sleep(60)\n")
            self.assertEqual(summary["verdict"], "fail")
            self.assertIsNone(unrelated.poll(), "不得清理未属于本次验证的进程")
            self.assertEqual(process_identity(unrelated.pid)[0], identity[0])
        finally:
            unrelated.kill()
            unrelated.wait(timeout=3)


    def test_unclean_timeout_stops_following_checks_and_keeps_log(self):
        command = (
            "import os,json,time,sys\n"
            "from pathlib import Path\n"
            "fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()\n"
            "Path('blocked.pid').write_text(json.dumps({'pid':os.getpid(),'start':fields[19]}))\n"
            "print('UNCLEAN_TIMEOUT_STDOUT',flush=True)\n"
            "print('UNCLEAN_TIMEOUT_STDERR',file=sys.stderr,flush=True)\n"
            "time.sleep(60)\n"
        )
        real_kill = os.kill

        def refuse_only_our_child(pid, sig):
            path = self.root / "blocked.pid"
            if path.exists():
                data = json.loads(path.read_text())
                identity = process_identity(pid)
                if pid == data["pid"] and identity and identity[0] == data["start"]:
                    return None
            return real_kill(pid, sig)

        with mock.patch.object(bk.os, "kill", side_effect=refuse_only_our_child):
            summary, console = self.run_script(
                command, following="from pathlib import Path\nPath('must-not-run').touch()\n")
        data = json.loads((self.root / "blocked.pid").read_text())
        identity = process_identity(data["pid"])
        self.assertTrue(identity and identity[0] == data["start"] and identity[1] != "Z",
                        "必须真正保留一个尚未清理的本用例进程")
        self.assertEqual(summary["verdict"], "fail")
        self.assertEqual(summary["results"][1]["result"], "not_run", "清理失败必须停止，并明确保留未运行项")
        self.assertFalse((self.root / "must-not-run").exists())
        log = (self.root / summary["results"][0]["log"]).read_text()
        self.assertIn("UNCLEAN_TIMEOUT_STDOUT", log)
        self.assertIn("UNCLEAN_TIMEOUT_STDERR", log)
        self.assertIn("停止后续检查", log)
        self.assertIn("停止后续检查", console)


if __name__ == "__main__":
    unittest.main()
