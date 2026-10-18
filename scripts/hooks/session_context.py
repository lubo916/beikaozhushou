#!/usr/bin/env python3
"""SessionStart（startup、resume、clear、compact）：提示当前分支对应的 work 文件与 spec_tool status 的一行摘要。两个工具共用。"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def main():
    try:
        sys.stdin.read()
    except Exception:
        pass
    try:
        br = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=ROOT, capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:
        br = ""
    msg = ""
    m = re.match(r"^(?:feat|spec)/([A-Z]{2,6}-\d{2,3})(?:-|$)", br)
    if m:
        fid = m.group(1)
        if (ROOT / "work" / f"{fid}.md").exists():
            msg = (f"当前分支 {br} 有进行中的任务 {fid}：先完整阅读 work/{fid}.md，"
                   f"再运行 python scripts/spec_tool.py pack {fid} 重新生成任务包，从“下一步”继续。")
        else:
            msg = f"当前分支 {br} 对应功能 {fid}，还没有 work 文件；按 implement-feature 技能从第 1 步开始。"
    else:
        m = re.match(r"^refine/([SOP]\d{2})$", br)
        if m:
            msg = f"当前分支 {br} 用于页面 {m.group(1)} 的深化：按 refine-page 技能进行，裁决前不写入。"
    try:
        st = subprocess.run([sys.executable, str(ROOT / "scripts" / "spec_tool.py"), "status", "--brief"], cwd=ROOT,
                            capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception:
        st = ""
    if st:
        msg = (msg + " " if msg else "") + st
    if msg:
        sys.stdout.write(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": msg}}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        sys.exit(0)
