#!/usr/bin/env python3
"""Stop 闸门：Claude Code 与 Codex 共用（见 docs/meta/doc-system.md 附录 I.3）。

只看本轮工作区改动：check --changed，加改动文件的 lint。失败时第一次返回 block 让 AI 接着修；
同一轮已经拦过一次（stop_hook_active 为真）就放行，只把剩余错误作为提示输出。
退出码始终为 0，输出始终是合法 JSON；总耗时控制在 30 秒以内。
"""
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUDGET_S = 28


def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False))
    sys.stdout.flush()
    sys.exit(0)


def run(cmd, timeout):
    try:
        return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=max(1, timeout))
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None


def main():
    start = time.time()
    try:
        raw = sys.stdin.read() if not sys.stdin.isatty() else ""
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        data = {}
    active = bool(data.get("stop_hook_active"))
    st = run(["git", "status", "--porcelain", "--untracked-files=all"], 10)
    if st is None or st.returncode != 0 or not st.stdout.strip():
        emit({})
    errors = []
    r = run([sys.executable, "scripts/spec_tool.py", "check", "--changed"], BUDGET_S - (time.time() - start))
    if r is None:
        errors.append("文档检查超时，留给 pre-commit 与 CI 兜底。")
    elif r.returncode != 0:
        errors += [l for l in r.stdout.splitlines() if l.startswith("E-")]
    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        import spec_tool  # noqa: E402
        v = spec_tool.CFG["verify"]
        files = [f for f in spec_tool.changed_files() if Path(f).suffix in spec_tool.CODE_EXT and (ROOT / f).exists()]
        if files and v.get("lint_files") and (ROOT / v.get("stack_marker", "package.json")).exists():
            cmd = v["lint_files"].replace("{files}", " ".join(files))
            left = BUDGET_S - (time.time() - start)
            if left > 2:
                try:
                    lr = subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=left)
                except subprocess.TimeoutExpired:
                    lr = None
                if lr is not None and lr.returncode != 0:
                    errors.append("lint 未通过：\n" + (lr.stdout or lr.stderr).strip()[-2000:])
    except Exception:
        pass
    if not errors:
        emit({})
    msg = "本轮改动未通过检查，请按报错修正：\n" + "\n".join(errors[:30])
    if len(errors) > 30:
        msg += f"\n……另有 {len(errors) - 30} 条，运行 python scripts/spec_tool.py check 查看全部。"
    if active:
        emit({"systemMessage": msg + "\n（本轮已拦过一次，剩余问题交给 pre-commit 与 CI。）"})
    emit({"decision": "block", "reason": msg})


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        emit({})
