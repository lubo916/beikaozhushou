#!/usr/bin/env python3
"""读取轨迹：两个工具的 PostToolUse 与 Claude 的 InstructionsLoaded，写入 .trace/<会话>.jsonl（不提交）。

只机械记录读取了哪些文件，不靠 AI 自报；汇总见 python scripts/spec_tool.py trace-report。
"""
import argparse
import datetime
import json
import re
import shlex
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
READERS = {"cat", "head", "tail", "sed", "less", "more", "nl", "bat", "rg", "grep", "awk", "wc", "jq", "yq", "view", "type"}
PATTERN_FIRST = {"rg", "grep", "awk", "sed"}


def norm(p: str, cwd: Path) -> str:
    if not p:
        return ""
    q = Path(p)
    if not q.is_absolute():
        q = (cwd / q)
    try:
        return q.resolve().relative_to(ROOT).as_posix()
    except Exception:
        return ""


def files_from_shell(cmd: str, cwd: Path) -> list:
    out = []
    for seg in re.split(r"\|\||&&|[|;]", cmd):
        try:
            toks = shlex.split(seg)
        except ValueError:
            toks = seg.split()
        if not toks:
            continue
        name = Path(toks[0]).name
        if name not in READERS:
            continue
        args = [t for t in toks[1:] if not t.startswith("-")]
        if name in PATTERN_FIRST and args:
            args = args[1:]
        for a in args:
            r = norm(a, cwd)
            if r and (ROOT / r).exists():
                out.append(r)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tool", default="unknown")
    ap.add_argument("--event", default="tool")
    a, _ = ap.parse_known_args()
    try:
        data = json.loads(sys.stdin.read() or "{}")
    except Exception:
        data = {}
    cwd = Path(data.get("cwd") or ROOT)
    files, command = [], ""
    if a.event == "instructions":
        files.append(norm(str(data.get("file_path") or data.get("path") or ""), cwd))
    else:
        tool = str(data.get("tool_name") or "")
        ti = data.get("tool_input") or {}
        if tool == "Read":
            files.append(norm(str(ti.get("file_path") or ""), cwd))
        elif tool in ("Bash", "shell", "local_shell", "exec_command"):
            command = ti.get("command") or ""
            if isinstance(command, list):
                command = " ".join(str(x) for x in command)
            files += files_from_shell(str(command), cwd)
        elif tool == "apply_patch":
            patch = str(ti.get("input") or ti.get("patch") or ti.get("command") or "")
            files += [norm(m, cwd) for m in re.findall(r"^\*\*\* (?:Update|Add|Delete) File: (.+)$", patch, re.M)]
    files = [f for f in files if f]
    try:
        br = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=ROOT, capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:
        br = ""
    sess = re.sub(r"[^\w.-]", "_", str(data.get("session_id") or data.get("sessionId") or "unknown"))[:80]
    rec = {"ts": datetime.datetime.now().isoformat(timespec="seconds"), "tool": a.tool, "event": a.event,
           "hook": data.get("hook_event_name"), "session": sess, "branch": br, "tool_name": data.get("tool_name"),
           "files": files, "command": str(command)[:300], "reason": data.get("load_reason") or data.get("reason")}
    d = ROOT / ".trace"
    d.mkdir(exist_ok=True)
    with open(d / f"{sess}.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
