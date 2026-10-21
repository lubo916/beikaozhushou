"""B08 必须完成指定的跨卡衔接；旧的 done/已定稿、force 与旧复核回执不能放行。"""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

from _support import ROOT

SPEC = importlib.util.spec_from_file_location("bk_prerequisite_tests", ROOT / "tools/bk.py")
bk = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bk)
GATES = {
    "R01-diagnosis-evidence": "evidence-mastery",
    "R06-option-forecast": "metrics-prediction",
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class B08PrerequisiteTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="bk-prereq-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.state = {"schema": 1, "tasks": {"B08": {}}}
        for gate, rule in GATES.items():
            self.write(f"docs/baseline/rule-cards/{rule}.md",
                       "# 规则卡\n\n- 状态：已定稿（旧确认）\n\nR1 原有规则。\n")
            self.write_json(f"tests/rules/{rule}.cases.json", {
                "card": rule, "status": "已定稿", "params": {},
                "cases": [{"id": "E1", "input": {}, "expect": {"old": True}, "rule": "R1"}],
            })
            if hasattr(bk, "prerequisite_baseline"):
                baseline = bk.prerequisite_baseline(self.root, rule)
            else:
                baseline = {"card": "0" * 64, "cases": "0" * 64}
            self.state["tasks"]["B08"][gate] = {"baseline": baseline, "receipt": None}
        self.save_state()
        self.write_json("progress/tasks.json", {"tasks": [
            {"id": "R01", "status": "done"}, {"id": "R06", "status": "done"},
            {"id": "R05", "status": "done"},
            {"id": "B08", "kind": "backend", "rule": "diagnosis-start", "status": "todo", "deps": ["R01", "R06", "R05"]},
            {"id": "U99", "status": "todo", "deps": []},
        ]})
        self.cfg = copy.deepcopy(bk.DEFAULT_CONFIG)
        self.task = {"id": "B08", "kind": "backend", "rule": "diagnosis-start", "deps": [], "title": "入门流程"}
        self.write("tools/bk.py", (ROOT / "tools/bk.py").read_text(encoding="utf-8"))
        self.write(".gitignore", ".bk/\n")
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.name", "前置闸门测试")
        self.git("config", "user.email", "bk-prereq@example.invalid")
        self.git("config", "core.hooksPath", "/dev/null")
        self.commit("未完成衔接的主干基线")

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.root, text=True).strip()

    def commit(self, message):
        if self.git("status", "--porcelain"):
            self.git("add", "-A")
            self.git("commit", "-q", "-m", message)

    def write(self, rel, value):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value, encoding="utf-8")
        return path

    def write_json(self, rel, value):
        return self.write(rel, json.dumps(value, ensure_ascii=False, indent=2) + "\n")

    def save_state(self):
        self.write_json("tools/bk.prerequisites.json", self.state)

    def sources(self, gate):
        rule = GATES[gate]
        return (self.root / f"docs/baseline/rule-cards/{rule}.md",
                self.root / f"tests/rules/{rule}.cases.json")

    def advance(self, gate):
        card, cases = self.sources(gate)
        card.write_text(card.read_text() + "R2 本次已复核的衔接规则。\n", encoding="utf-8")
        data = json.loads(cases.read_text())
        data["cases"].append({"id": "E2", "input": {"integration": True}, "expect": {"integrated": True}, "rule": "R2"})
        self.write_json(cases.relative_to(self.root), data)
        decision = self.write(f"docs/decisions/{gate}.md", "# 决定\n用户确认本次衔接规则。\n")
        review = self.write(f"progress/reports/{gate}.md", "# 复核\n本次衔接规则及 E2 已复核通过。\n")
        self.state["tasks"]["B08"][gate]["receipt"] = {
            "card": digest(card), "cases": digest(cases),
            "decision": {"path": decision.relative_to(self.root).as_posix(), "sha256": digest(decision)},
            "review": {"path": review.relative_to(self.root).as_posix(), "sha256": digest(review)},
            "case_ids": ["E2"], "accepted_at": "2026-10-21 12:00",
        }
        self.save_state()

    def release_all(self, commit=True):
        for gate in GATES:
            self.advance(gate)
        if commit:
            self.commit("确认并复核两项衔接")

    def test_old_done_and_confirmed_cards_still_block(self):
        """旧 R01/R06 已 done 且已定稿，仍须完成指定衔接，不能自动放行"""
        issues = bk.prerequisite_issues(self.root, "B08")
        self.assertTrue(issues)
        for gate in GATES:
            self.assertTrue(any(gate in issue for issue in issues), issues)

    def test_unrelated_tasks_unaffected(self):
        """没有此跨卡要求的任务不受 B08 闸门影响"""
        (self.root / "tools/bk.prerequisites.json").unlink()
        self.assertEqual(bk.prerequisite_issues(self.root, "U99"), [])

    def test_missing_or_corrupt_registry_fails_closed(self):
        """前置配置丢失、损坏或漏项均阻断 B08"""
        path = self.root / "tools/bk.prerequisites.json"
        for value in (None, "{", "{}", "[]", '{"schema":1,"tasks":{"B08":{}}}'):
            with self.subTest(value=value):
                if value is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_text(value)
                self.assertTrue(bk.prerequisite_issues(self.root, "B08"))

    def test_baseline_ignores_confirmation_metadata(self):
        """仅重写确认状态不算完成新的业务衔接"""
        rule = next(iter(GATES.values()))
        before = bk.prerequisite_baseline(self.root, rule)
        card = self.root / f"docs/baseline/rule-cards/{rule}.md"
        card.write_text(card.read_text().replace("已定稿（旧确认）", "已定稿（重新确认）"), encoding="utf-8")
        p = self.root / f"tests/rules/{rule}.cases.json"
        data = json.loads(p.read_text()); data["status"] = "草稿"; data["note"] = "仅改元数据"
        self.write_json(p.relative_to(self.root), data)
        self.assertEqual(bk.prerequisite_baseline(self.root, rule), before)

    def test_both_revised_sources_and_reviews_release(self):
        """两项规则、对应例子、确认决定与复核回执均有效才能放行"""
        self.release_all()
        self.assertEqual(bk.prerequisite_issues(self.root, "B08"), [])
        bk.require_prerequisites(self.root, "B08")

    def test_one_receipt_is_insufficient(self):
        """只完成 R01 不能替代 R06 的分档预测衔接"""
        self.advance("R01-diagnosis-evidence")
        self.assertTrue(bk.prerequisite_issues(self.root, "B08"))

    def test_stale_source_or_review_invalidates_receipt(self):
        """定稿规则、例子、确认决定或复核记录变化后，旧回执失效"""
        self.release_all()
        gate = "R01-diagnosis-evidence"
        card, cases = self.sources(gate)
        receipt = self.state["tasks"]["B08"][gate]["receipt"]
        paths = [card, cases, self.root / receipt["decision"]["path"], self.root / receipt["review"]["path"]]
        for path in paths:
            with self.subTest(path=path.name):
                original = path.read_bytes(); path.write_bytes(original + b" ")
                self.assertTrue(bk.prerequisite_issues(self.root, "B08"))
                path.write_bytes(original)
                self.assertEqual(bk.prerequisite_issues(self.root, "B08"), [])

    def test_receipt_cannot_reuse_old_rule_and_cases(self):
        """补回执不能把旧规则与旧例子伪装成已完成新衔接"""
        self.release_all()
        gate = "R01-diagnosis-evidence"
        rule = GATES[gate]
        self.state["tasks"]["B08"][gate]["baseline"] = bk.prerequisite_baseline(self.root, rule)
        self.save_state()
        self.assertTrue(bk.prerequisite_issues(self.root, "B08"))

    def test_receipt_requires_existing_golden_case(self):
        """复核回执必须指向实际存在的对应例子"""
        self.release_all()
        entry = self.state["tasks"]["B08"]["R01-diagnosis-evidence"]
        for ids in ([], ["E404"], ["E2", "E2"]):
            with self.subTest(ids=ids):
                entry["receipt"]["case_ids"] = ids; self.save_state()
                self.assertTrue(bk.prerequisite_issues(self.root, "B08"))

    def test_receipt_rejects_paths_outside_review_evidence(self):
        """确认与复核依据只能引用仓库内规定的位置，不能穿越路径"""
        self.release_all()
        entry = self.state["tasks"]["B08"]["R01-diagnosis-evidence"]
        for bad in ("../outside.md", "/tmp/outside.md", "AGENTS.md"):
            with self.subTest(path=bad):
                entry["receipt"]["decision"]["path"] = bad; self.save_state()
                self.assertTrue(bk.prerequisite_issues(self.root, "B08"))

    def test_evidence_cannot_escape_its_allowed_subdirectory(self):
        """即使路径仍在仓库内，也不能借目录穿越把复核报告冒充确认决定"""
        self.release_all(); gate = "R01-diagnosis-evidence"
        receipt = self.state["tasks"]["B08"][gate]["receipt"]
        review = self.root / receipt["review"]["path"]
        receipt["decision"] = {
            "path": "docs/decisions/../../" + receipt["review"]["path"],
            "sha256": digest(review),
        }
        self.save_state()
        self.assertTrue(bk.prerequisite_issues(self.root, "B08"))

    def test_draft_source_cannot_release(self):
        """规则或例子退回草稿时即使回执哈希更新也不能通过"""
        self.release_all(); gate = "R01-diagnosis-evidence"
        card, cases = self.sources(gate)
        card.write_text(card.read_text().replace("状态：已定稿", "状态：草稿"), encoding="utf-8")
        self.state["tasks"]["B08"][gate]["receipt"]["card"] = digest(card); self.save_state()
        self.assertTrue(bk.prerequisite_issues(self.root, "B08"))

    def test_both_rule_and_cases_must_change(self):
        """仅改规则或仅改例子不能当成已完成一整项衔接"""
        gate = "R01-diagnosis-evidence"
        card, cases = self.sources(gate)
        original_card, original_cases = card.read_bytes(), cases.read_bytes()
        self.release_all()
        revised_card, revised_cases = card.read_bytes(), cases.read_bytes()
        for path, original, revised, key in ((card, original_card, revised_card, "card"),
                                             (cases, original_cases, revised_cases, "cases")):
            with self.subTest(source=key):
                path.write_bytes(original)
                self.state["tasks"]["B08"][gate]["receipt"][key] = digest(path)
                self.save_state()
                self.assertTrue(bk.prerequisite_issues(self.root, "B08"))
                path.write_bytes(revised)
                self.state["tasks"]["B08"][gate]["receipt"][key] = digest(path)
                self.save_state()

    def test_malformed_receipt_fails_closed(self):
        """格式错误或缺字段的回执不能令前置检查抛异常或放行"""
        self.release_all()
        entry = self.state["tasks"]["B08"]["R01-diagnosis-evidence"]
        for receipt in (True, [], {}, {"card": None}):
            with self.subTest(receipt=receipt):
                entry["receipt"] = receipt; self.save_state()
                self.assertTrue(bk.prerequisite_issues(self.root, "B08"))

    def test_accept_old_sources_refuses_to_write_receipt(self):
        """显式登记命令也不能用旧已定稿规则解除新衔接闸门"""
        gate = "R01-diagnosis-evidence"
        self.write("docs/decisions/accept.md", "# 决定\n确认。\n")
        self.write("progress/reports/accept.md", "# 复核\n已复核。\n")
        args = argparse.Namespace(task="B08", accept=gate,
                                  decision="docs/decisions/accept.md", review="progress/reports/accept.md", case=["E1"])
        self.commit("提交复核依据但规则尚未整合")
        before = (self.root / "tools/bk.prerequisites.json").read_bytes()
        with mock.patch.object(bk, "find_root", return_value=self.root), \
             mock.patch.object(bk, "load_config", return_value=self.cfg), \
             mock.patch.object(bk, "env_kind", return_value="local"):
            with self.assertRaises((SystemExit, bk.BkError)):
                bk.cmd_prereq(args)
        self.assertEqual((self.root / "tools/bk.prerequisites.json").read_bytes(), before)

    def test_accept_command_records_reviewed_current_sources(self):
        """本地显式复核登记绑定已修订的规则、例子、决定与报告并提交配置"""
        self.release_all(); gate = "R01-diagnosis-evidence"
        entry = self.state["tasks"]["B08"][gate]
        decision, review = entry["receipt"]["decision"]["path"], entry["receipt"]["review"]["path"]
        entry["receipt"] = None; self.save_state()
        self.commit("提交已修订源及复核依据，等待正式登记")
        args = argparse.Namespace(task="B08", accept=gate, decision=decision, review=review, case=["E2"])
        with mock.patch.object(bk, "find_root", return_value=self.root), \
             mock.patch.object(bk, "load_config", return_value=self.cfg), \
             mock.patch.object(bk, "env_kind", return_value="local"):
            bk.cmd_prereq(args)
        saved = json.loads((self.root / "tools/bk.prerequisites.json").read_text())
        receipt = saved["tasks"]["B08"][gate]["receipt"]
        self.assertEqual(receipt["case_ids"], ["E2"])
        self.assertEqual(receipt["card"], digest(self.sources(gate)[0]))
        self.assertEqual(receipt["cases"], digest(self.sources(gate)[1]))
        self.assertEqual(receipt["decision"]["path"], decision)
        self.assertEqual(receipt["review"]["path"], review)
        self.assertEqual(bk.prerequisite_issues(self.root, "B08"), [])
        self.assertIn("登记 B08 前置复核", self.git("log", "-1", "--format=%s"))
        self.assertEqual(self.git("status", "--porcelain"), "")

    def test_web_cannot_accept_its_own_gate(self):
        """网页沙箱不能自己登记复核后放行 B08"""
        before = (self.root / "tools/bk.prerequisites.json").read_bytes()
        args = argparse.Namespace(task="B08", accept="R01-diagnosis-evidence", decision="", review="", case=[])
        with mock.patch.object(bk, "find_root", return_value=self.root), \
             mock.patch.object(bk, "env_kind", return_value="web"), \
             mock.patch.object(bk, "git") as git_mock:
            with self.assertRaises(SystemExit) as caught:
                bk.cmd_prereq(args)
            self.assertEqual(caught.exception.code, 1)
            git_mock.assert_not_called()
        self.assertEqual((self.root / "tools/bk.prerequisites.json").read_bytes(), before)

    def test_ready_list_filters_b08_even_when_dependencies_done(self):
        """普通依赖全部完成也不能把尚未跨卡复核的 B08 推荐为可开始"""
        ids = [t["id"] for t in bk.ready_tasks(self.root)]
        self.assertNotIn("B08", ids)
        self.assertIn("U99", ids)
        self.release_all()
        self.assertIn("B08", [t["id"] for t in bk.ready_tasks(self.root)])

    def test_task_package_preserves_and_enforces_prerequisites(self):
        """真实任务包携带主干、门禁代码和回执；副本来源变化或删回执时网页开工被拦"""
        self.release_all()
        head = self.git("rev-parse", "main")
        outbox = self.root / ".bk/test-outbox"
        outbox.mkdir(parents=True)
        with mock.patch.object(bk, "copy_to_windows", side_effect=AssertionError("测试不得写用户下载目录")):
            package = bk.make_package(self.root, self.cfg, "task", self.task, 1, "main", head,
                                      "v0001", outbox, "bk-v0001-B08.zip")
        with zipfile.ZipFile(package) as archive:
            names = set(archive.namelist())
            self.assertIn("repo/tools/bk.py", names)
            self.assertIn("repo/tools/bk.prerequisites.json", names)
            self.assertEqual(archive.read("repo/tools/bk.prerequisites.json"),
                             (self.root / "tools/bk.prerequisites.json").read_bytes())
        destination = self.root / ".bk/test-unpacked"
        bk.safe_extract(package, destination)
        repo = destination / "repo"
        packaged_main = subprocess.check_output(["git", "rev-parse", "main"], cwd=repo, text=True).strip()
        self.assertEqual(packaged_main, head)
        module_spec = importlib.util.spec_from_file_location("bk_packaged_prerequisite_tests", repo / "tools/bk.py")
        packaged = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(packaged)
        self.assertEqual(packaged.prerequisite_launch_issues(repo, "B08"), [])

        card = repo / "docs/baseline/rule-cards/evidence-mastery.md"
        original_card = card.read_bytes()
        registry = repo / "tools/bk.prerequisites.json"
        original_registry = registry.read_bytes()
        card.write_bytes(original_card + "R3 复核后另改的来源。\n".encode("utf-8"))
        for scenario in ("changed_source", "missing_receipt"):
            with self.subTest(scenario=scenario):
                if scenario == "missing_receipt":
                    card.write_bytes(original_card)
                    data = json.loads(original_registry)
                    data["tasks"]["B08"]["R01-diagnosis-evidence"]["receipt"] = None
                    registry.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                self.assertTrue(packaged.prerequisite_launch_issues(repo, "B08"))
                result = subprocess.run([sys.executable, str(repo / "tools/bk.py"), "start", "B08", "--force", "--no-install"],
                                        cwd=repo, env=dict(os.environ, BK_ENV="web", BK_NO_INSTALL="1"),
                                        capture_output=True, text=True, timeout=20)
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("B08 前置检测未通过", result.stdout + result.stderr)
                self.assertFalse((repo / ".bk/session.json").exists())

    def test_candidate_cannot_self_certify_against_pending_main(self):
        """候选分支自己补有效回执不能替代主干已复核的前置"""
        self.git("checkout", "-q", "-b", "task/B08-r1")
        self.release_all()
        self.assertEqual(bk.prerequisite_issues(self.root, "B08"), [])
        with self.assertRaises(SystemExit):
            bk.require_prerequisites(self.root, "B08", authoritative=True)
        self.assertNotIn("B08", [t["id"] for t in bk.ready_tasks(self.root)])
        args = argparse.Namespace(task="B08", title="", note="", force=True)
        head = self.git("rev-parse", "HEAD")
        with mock.patch.object(bk, "find_root", return_value=self.root), \
             mock.patch.object(bk, "load_config", return_value=self.cfg), \
             mock.patch.object(bk, "make_package", side_effect=AssertionError("候选自证却开始出包")):
            with self.assertRaises(SystemExit):
                bk.cmd_pack(args)
        self.assertEqual(self.git("rev-parse", "HEAD"), head)
        self.assertEqual(self.git("branch", "--show-current"), "task/B08-r1")

    def test_uncommitted_receipt_on_main_cannot_self_certify(self):
        """主干工作区未提交的有效回执同样不能放行"""
        self.release_all(commit=False)
        self.assertEqual(bk.prerequisite_issues(self.root, "B08"), [])
        with self.assertRaises(SystemExit):
            bk.require_prerequisites(self.root, "B08", authoritative=True)
        self.assertNotIn("B08", [t["id"] for t in bk.ready_tasks(self.root)])

    def test_force_pack_checks_before_git_or_package(self):
        """出包的 force 不能绕过 B08 前置，阻断发生在任何 Git 或包写入之前"""
        args = argparse.Namespace(task="B08", title="", note="", force=True)
        with mock.patch.object(bk, "find_root", return_value=self.root), mock.patch.object(bk, "load_config", return_value=self.cfg), \
             mock.patch.object(bk, "git", side_effect=AssertionError("前置检查前不应操作Git")), \
             mock.patch.object(bk, "make_package", side_effect=AssertionError("未满足前置却开始出包")):
            with self.assertRaises(SystemExit) as caught:
                bk.cmd_pack(args)
            self.assertEqual(caught.exception.code, 1)

    def test_start_all_paths_block_before_side_effects(self):
        """本地、网页及 resume 开工均先拦截，不建分支、不写会话、不探测环境"""
        for env, resume in (("local", False), ("web", False), ("web", True)):
            with self.subTest(env=env, resume=resume), \
                 mock.patch.object(bk, "find_root", return_value=self.root), \
                 mock.patch.object(bk, "load_config", return_value=self.cfg), \
                 mock.patch.object(bk, "env_kind", return_value=env), \
                 mock.patch.object(bk, "ensure_local_exclude"), \
                 mock.patch.object(bk, "resume_from_outputs", return_value=None), \
                 mock.patch.object(bk, "git", side_effect=AssertionError("前置检查前不应操作Git")), \
                 mock.patch.object(bk, "probe", side_effect=AssertionError("未满足前置却探测环境")), \
                 mock.patch.object(bk, "make_report_template", side_effect=AssertionError("未满足前置却写报告")):
                args = argparse.Namespace(task="B08", title="", resume=resume, force=True, from_failed="", install=False, no_install=True, with_db=False)
                with self.assertRaises(SystemExit) as caught:
                    bk.cmd_start(args)
                self.assertEqual(caught.exception.code, 1)
                self.assertFalse((self.root / ".bk/session.json").exists())

    def test_integrate_blocks_before_git_changes(self):
        """直接接收 B08 结果也先查前置，不能绕过 pack/start"""
        with mock.patch.object(bk, "git", side_effect=AssertionError("未满足前置却开始合并")):
            with self.assertRaises(SystemExit) as caught:
                bk.integrate(self.root, self.cfg, "incoming", "progress/reports/B08-r1.md", "result.zip", self.task, {"round": 1})
            self.assertEqual(caught.exception.code, 1)

    def test_final_merge_rechecks_gate_after_review_pause(self):
        """先复查后合并的暂停期内前置失效，continue 最终合并仍须拦截"""
        with mock.patch.object(bk, "git", side_effect=AssertionError("前置失效却移动主干")), \
             mock.patch.object(bk, "finalize", side_effect=AssertionError("前置失效却登记任务完成")):
            with self.assertRaises(SystemExit) as caught:
                bk.complete_merge(self.root, self.cfg, "incoming", "progress/reports/B08-r1.md",
                                  {"results": []}, self.task, {"round": 1}, "result.zip", None)
            self.assertEqual(caught.exception.code, 1)

    def test_done_blocks_before_staging_changes(self):
        """开工后前置失效时，收工也不能绕过检查或暂存代码"""
        self.write_json(".bk/session.json", {"task": "B08", "round": 1, "branch": "task/B08-r1"})
        args = argparse.Namespace(checkpoint=False, force=True, allow_hot=None, allow_test_change=None, level=None)
        with mock.patch.object(bk, "find_root", return_value=self.root), \
             mock.patch.object(bk, "load_config", return_value=self.cfg), \
             mock.patch.object(bk, "git", side_effect=AssertionError("未满足前置却暂存代码")):
            with self.assertRaises(SystemExit) as caught:
                bk.cmd_done(args)
            self.assertEqual(caught.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
