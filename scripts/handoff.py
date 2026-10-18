#!/usr/bin/env python3
"""交接包：Codex 与网页版 Claude 之间的出包与回包（ADR-024；流程见 docs/meta/plan/README.md 第 3 节）。

  python scripts/handoff.py out <ID> [--notes <文件>] [--round N] [--force]   实现或修复包
  python scripts/handoff.py out HANDSHAKE --handshake                         握手测试包
  python scripts/handoff.py specs <闭环>                                      闭环规格复核包
  python scripts/handoff.py in [<结果包>] [--latest <键>] [--dry-run] [--accept-extra]
  python scripts/handoff.py selftest

包放在仓库旁边的 ../handoff/（outbox 出包，log 记录）；结果包默认从“下载”文件夹或 ../handoff/inbox 里找最新的。
"""
import argparse
import datetime
import os
import pathlib
import re
import secrets
import subprocess
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
HAND = ROOT.parent / "handoff"
OUTBOX, INBOX, LOG = HAND / "outbox", HAND / "inbox", HAND / "log"
TPL = ROOT / "docs" / "meta" / "plan" / "templates"
FEATURE_RE = re.compile(r"^[A-Z]+-\d{2}$")
FORBIDDEN_NAMES = {"CLAUDE.md", "CLAUDE.local.md", "AGENTS.override.md", "AGENTS.local.md", "AGENTS.md"}
PROTECTED = ("docs/meta/", ".agents/", ".claude/", ".codex/", ".githooks/", ".github/", "scripts/",
             "design/screens/", "work/", ".git/")
ALWAYS = ["package.json", "pnpm-workspace.yaml", "tsconfig.base.json", "tsconfig.json", "packages/params/index.ts",
          "docs/adr/ADR-025-tech-stack-baseline.md", "docs/adr/ADR-026-frontend-backend-layout.md"]  # 技术栈只经交接包送达网页版 Claude
MAX_BYTES = 3_000_000
PATH_RE = re.compile(r"(?:[A-Za-z0-9_.@\-]+/)+[A-Za-z0-9_.@\-\[\]]*|[A-Za-z0-9_\-]+\.[A-Za-z][A-Za-z0-9]*")


def run(*args):
    return subprocess.run(list(args), cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")


def spec_tool(*args):
    return run(sys.executable, "scripts/spec_tool.py", *args)


def git(*args):
    r = run("git", *args)
    return r.stdout.strip() if r.returncode == 0 else ""


def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M")


def read(p):
    return pathlib.Path(p).read_text(encoding="utf-8")


def fill(name, **kw):
    t = read(TPL / name)
    for k, v in kw.items():
        t = t.replace("{{" + k + "}}", str(v))
    return t


def norm(p):
    """包内路径 → 仓库相对路径；不合法时返回 None。"""
    p = (p or "").replace("\\", "/").strip("`")
    if not p or p.startswith("/") or re.search(r'[\x00-\x1f<>:"|?*]', p):
        return None
    parts = [x for x in p.split("/") if x not in ("", ".")]
    # 在所有平台拒绝 Windows 别名，避免同一个包换台机器后变成另一条写入路径。
    if not parts or any(x == ".." or x.endswith((".", " ")) or
                        re.fullmatch(r"(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\..*)?", x, re.I)
                        for x in parts):
        return None
    return "/".join(parts) + ("/" if p.endswith("/") else "")


def forbidden(rel, allow_protected=False):
    if not norm(rel):
        return "不合法的仓库相对路径"
    name = rel.rstrip("/").rsplit("/", 1)[-1]
    if name.casefold() in {x.casefold() for x in FORBIDDEN_NAMES}:
        return f"禁写文件 {name}"
    folded = rel.casefold().rstrip("/")
    if not allow_protected and any(folded == p.rstrip("/") or folded.startswith(p) for p in PROTECTED):
        return "禁写位置（见项目说明“不能做的”）"
    root = ROOT.resolve()
    f = root / rel
    try:
        target = f.resolve()
        target.relative_to(root)
        if target != f:
            return "路径经过符号链接或 junction"
    except (OSError, RuntimeError, ValueError):
        return "路径无法安全解析，或指向仓库之外"
    if f.is_file():
        head = f.read_text(encoding="utf-8", errors="ignore")[:400]
        if "GENERATED" in head:
            return "生成物，改源后运行 gen"
    return ""


def work_path(fid):
    return ROOT / "work" / f"{fid}.md"


def section(text, title):
    m = re.search(r"^## " + re.escape(title) + r"[^\n]*\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    return m.group(1) if m else ""


def plan_paths(fid):
    """work 文件“计划”一节中“改动文件”“参考文件”两项列出的路径（以 / 结尾的是目录前缀）。"""
    w = work_path(fid)
    out = {"改动文件": [], "参考文件": []}
    if not w.exists():
        return [], []
    cur = None
    for line in section(read(w), "计划").splitlines():
        m = re.match(r"^-\s*([^：:]+)[：:](.*)$", line)
        if m:
            cur, rest = m.group(1).strip(), m.group(2)
        else:
            rest = line
        if cur in out:
            out[cur] += [n for n in (norm(x) for x in PATH_RE.findall(rest)) if n]
    return out["改动文件"], out["参考文件"]


def plan_confirmed(fid):
    m = re.search(r"^-\s*确认[：:]\s*(.*)$", section(read(work_path(fid)), "计划"), re.M)
    v = m.group(1).strip() if m else ""
    return bool(v) and v not in ("（谁、何时）", "(谁、何时)")


def is_test(rel):
    return rel.startswith("tests/") or "/__tests__/" in rel or re.search(r"\.(test|spec)\.[a-z]+$", rel) is not None


def in_scope(rel, change):
    return is_test(rel) or rel in change or any(c.endswith("/") and rel.startswith(c) for c in change)


def feature_title(fid):
    import yaml
    for f in yaml.safe_load(read(ROOT / "docs/product/roadmap.yaml")) or []:
        if str(f.get("id")) == fid:
            return f.get("title", "")
    return ""


def loop_features(loop):
    import yaml
    for ph in yaml.safe_load(read(ROOT / "docs/product/phases.yaml")).get("phases", []):
        for lp in ph.get("loops") or []:
            if str(lp.get("id")) == loop:
                return [str(x) for x in lp.get("features") or []]
    return None


def spec_file(fid):
    hits = list((ROOT / "docs/domains").glob(f"*/features/{fid}.md"))
    return hits[0] if hits else None


def next_round(key):
    ns = [int(m.group(1)) for p in OUTBOX.glob(f"{key}-r*.zip") if (m := re.match(rf"^{re.escape(key)}-r(\d+)\.zip$", p.name))]
    return max(ns, default=0) + 1


def expand(paths):
    files = set()
    for p in paths:
        f = ROOT / p.rstrip("/")
        if f.is_file():
            files.add(p.rstrip("/"))
        elif f.is_dir():
            files |= {x.relative_to(ROOT).as_posix() for x in f.rglob("*") if x.is_file() and "node_modules" not in x.parts}
    return files


def append_section(text, title, lines):
    if not lines:
        return text
    m = re.search(r"(^## " + re.escape(title) + r"[^\n]*\n)(.*?)(?=^## |\Z)", text, re.S | re.M)
    if not m:
        return text.rstrip("\n") + f"\n\n## {title}\n" + "\n".join(lines) + "\n"
    body = m.group(2).rstrip("\n")
    return text[:m.start(2)] + (body + "\n" if body else "") + "\n".join(lines) + "\n\n" + text[m.end(2):]


def log_work(fid, row=None, decisions=(), open_items=()):
    w = work_path(fid)
    if not FEATURE_RE.match(fid) or not w.exists():
        return
    t = read(w)
    t = append_section(t, "交接记录", [row] if row else [])
    t = append_section(t, "决定", list(decisions))
    t = append_section(t, "未决", list(open_items))
    w.write_text(t, encoding="utf-8")


def tell(zpath, result, key, n, nfiles):
    where = "新开一个对话" if n == 1 else f"回到 {key} 第 1 轮的那个对话"
    size = zpath.stat().st_size // 1024 + 1
    print(f"交接包已生成：{zpath.resolve()}（{size} KB，含 {nfiles} 个仓库文件）")
    print("请转告产品负责人：")
    print(f"  1. 打开 claude.ai 的「备考助手·实现」项目，{where}。")
    print("  2. 把上面这个文件拖进对话。")
    print(f"  3. 粘贴这一句：按压缩包里的 TASK.md 完成 {key} 第 {n} 轮，最后给我 {result} 的下载链接。")
    print("  4. 下载结果包（放在默认“下载”文件夹即可），回来告诉我“结果已下载”。")


def fix_text(fid, notes):
    v = LOG / f"{fid}-verify-latest.txt"
    out = "# 需要修复的问题\n\n## 本地检查输出（verify，最后 200 行）\n\n```text\n"
    out += "\n".join(read(v).splitlines()[-200:]) if v.exists() else "（没有记录）"
    out += "\n```\n\n## 复查意见\n\n" + (read(notes) if notes else "（无）") + "\n"
    return out


def cmd_out(a):
    OUTBOX.mkdir(parents=True, exist_ok=True)
    LOG.mkdir(parents=True, exist_ok=True)
    key = a.id
    n = a.round or next_round(key)
    result = f"{key}-r{n}-result.zip"
    zpath = OUTBOX / f"{key}-r{n}.zip"
    if a.handshake:
        token = secrets.token_hex(4)
        (LOG / "HANDSHAKE.token").write_text(token, encoding="utf-8")
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("TASK.md", fill("task-handshake.md", RESULT=result, TOKEN=token))
        tell(zpath, result, key, n, 0)
        return 0
    if not FEATURE_RE.match(key):
        print(f"{key} 不是功能 ID。")
        return 2
    br = git("rev-parse", "--abbrev-ref", "HEAD")
    if not br.startswith(f"feat/{key}-") and not a.force:
        print(f"当前分支是 {br}，应在 feat/{key}-<短名> 上出包；确认无误可加 --force。")
        return 2
    if not work_path(key).exists():
        print(f"没有 work/{key}.md：先运行 python scripts/spec_tool.py work start {key} 并写计划。")
        return 2
    if not plan_confirmed(key) and not a.force:
        print("计划还没有确认：work 文件“计划”一节的“确认”一行为空。先请产品负责人确认，或按预授权填写。")
        return 2
    r = spec_tool("pack", key)
    pack = ROOT / ".pack" / f"{key}.md"
    if r.returncode != 0 or not pack.exists():
        print(r.stdout + r.stderr)
        print("任务包生成失败。超出预算说明功能太宽，按 doc-system 第 10 章处理。")
        return 2
    change, refs = plan_paths(key)
    files = expand(change + refs + ALWAYS)
    if n > 1:
        main = "main" if git("rev-parse", "--verify", "main") else "origin/main"
        changed = git("diff", "--name-only", f"{main}...HEAD").splitlines() + git("diff", "--name-only").splitlines()
        changed += git("ls-files", "--others", "--exclude-standard").splitlines()
        files |= {x for x in changed if (ROOT / x).is_file() and not x.startswith("work/")}
    files = sorted(f for f in files if not forbidden(f, allow_protected=True) or f in ALWAYS)
    total = sum((ROOT / f).stat().st_size for f in files)
    if total > MAX_BYTES:
        print(f"包内仓库文件合计 {total // 1024} KB，超过 {MAX_BYTES // 1024} KB：在计划里收窄“参考文件”，或拆分功能。")
        return 2
    tpl = "task-implement.md" if n == 1 else "task-fix.md"
    plan_list = "\n".join(f"- {p}" for p in change) or "- （计划里没有列出，见 work.md）"
    task = fill(tpl, ID=key, TITLE=feature_title(key), ROUND=n, RESULT=result, PLAN_FILES=plan_list)
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("TASK.md", task)
        z.write(ROOT / "AGENTS.md", "AGENTS.md")
        z.write(pack, "pack.md")
        z.write(work_path(key), "work.md")
        if n > 1:
            z.writestr("FIX.md", fix_text(key, a.notes))
        for f in files:
            z.write(ROOT / f, "repo/" + f)
    log_work(key, f"| {now()} | Codex | 出包第 {n} 轮（{len(files)} 个仓库文件） | 等网页版 Claude 回包 |")
    tell(zpath, result, key, n, len(files))
    return 0


def cmd_specs(a):
    OUTBOX.mkdir(parents=True, exist_ok=True)
    feats = loop_features(a.loop)
    if feats is None:
        print(f"phases.yaml 里没有闭环 {a.loop}。")
        return 2
    have = [f for f in feats if spec_file(f)]
    if not have:
        print("这个闭环还没有任何规格。先按 write-spec 写。")
        return 2
    key = f"L{a.loop}-specs"
    n = next_round(key)
    result = f"{key}-r{n}-result.zip"
    zpath = OUTBOX / f"{key}-r{n}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("TASK.md", fill("task-review-specs.md", LOOP=a.loop, ROUND=n, FEATURES="、".join(have), RESULT=result))
        z.write(ROOT / "AGENTS.md", "AGENTS.md")
        for f in have:
            r = spec_tool("pack", f)
            if r.returncode != 0:
                r = spec_tool("pack", f, "--allow-over")
            p = ROOT / ".pack" / f"{f}.md"
            if p.exists():
                z.write(p, f"packs/{f}.md")
    missing = [f for f in feats if f not in have]
    if missing:
        print(f"提示：{('、'.join(missing))} 还没有规格，本包不含。")
    tell(zpath, result, key, n, 0)
    return 0


def windows_download_dir():
    """读 Windows Known Folder 的用户位置；支持迁移目录及环境变量。"""
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                            r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders") as key:
            value, _ = winreg.QueryValueEx(key, "{374DE290-123F-4565-9164-39C4925E467B}")
        if isinstance(value, str) and value:
            return pathlib.Path(os.path.expandvars(value)).expanduser()
    except (ImportError, OSError):
        pass
    return None


def download_dirs():
    """结果包的下载位置：环境变量 HANDOFF_DOWNLOADS、本机“下载”文件夹，以及 WSL2 下 Windows 的“下载”文件夹。"""
    import glob
    dirs = []
    if os.environ.get("HANDOFF_DOWNLOADS"):
        dirs.append(pathlib.Path(os.environ["HANDOFF_DOWNLOADS"]).expanduser())
    if (downloads := windows_download_dir()) is not None:
        dirs.append(downloads)
    dirs.append(pathlib.Path.home() / "Downloads")
    dirs += [pathlib.Path(p) for p in sorted(glob.glob("/mnt/[a-z]/Users/*/Downloads"))]
    return list(dict.fromkeys(dirs))


def find_latest(key):
    cands = []
    for d in (*download_dirs(), INBOX, HAND):
        if d.exists():
            cands += list(d.glob(f"{key}-r*result*.zip"))
    return max(cands, key=lambda p: p.stat().st_mtime) if cands else None


def parse_manifest(text):
    secs, cur = {}, None
    for line in text.splitlines():
        m = re.match(r"^##\s*(.+?)\s*$", line)
        if m:
            cur = m.group(1).strip()
            secs[cur] = []
            continue
        if cur is not None and line.strip():
            secs[cur].append(line.rstrip())

    def paths(name):
        out = []
        for line in secs.get(name, []):
            m = re.match(r"^\s*[-*]\s*`?([^`\s—–]+)`?", line)
            if m and m.group(1) not in ("无", "（无）"):
                out.append(m.group(1))
        return out

    return secs, paths("修改与新增"), paths("删除")


def inspect(zpath, fid, accept_extra=False):
    errs, warns = [], []
    with zipfile.ZipFile(zpath) as z:
        names = [x for x in z.namelist() if not x.endswith("/")]
        pre = ""
        if "MANIFEST.md" not in names and "REVIEW.md" not in names:
            tops = [x for x in names if x.endswith("/MANIFEST.md") or x.endswith("/REVIEW.md")]
            if len(tops) == 1:
                pre = tops[0].rsplit("/", 1)[0] + "/"
        if pre + "REVIEW.md" in names and pre + "MANIFEST.md" not in names:
            return "review", z.read(pre + "REVIEW.md").decode("utf-8", "replace")
        if pre + "MANIFEST.md" not in names:
            return "error", (["结果包里没有 MANIFEST.md"], [], {}, [], {})
        secs, adds, dels = parse_manifest(z.read(pre + "MANIFEST.md").decode("utf-8", "replace"))
        for need in ("修改与新增", "删除"):
            if need not in secs:
                errs.append(f"MANIFEST 缺少“## {need}”一节")
        files = {}
        aliases = set()
        for x in names:
            if x.startswith(pre + "files/"):
                rel = norm(x[len(pre) + 6:])
                if not rel:
                    errs.append(f"files/ 下有不合法的路径：{x}")
                elif rel.casefold() in aliases:
                    errs.append(f"files/ 下有重复或大小写冲突的路径：{x}")
                else:
                    aliases.add(rel.casefold())
                    files[rel] = x
        listed = {norm(p) for p in adds}
        for p in adds:
            if not norm(p):
                errs.append(f"MANIFEST 里有不合法的路径：{p}")
            elif norm(p) not in files:
                errs.append(f"MANIFEST 列了 {norm(p)}，files/ 里没有")
        for rel in files:
            if rel not in listed:
                warns.append(f"files/ 里的 {rel} 没写进 MANIFEST，按新增或修改处理")
        deletes = []
        for p in dels:
            if not (rel := norm(p)):
                errs.append(f"MANIFEST 删除节里有不合法的路径：{p}")
            else:
                deletes.append(rel)
        for rel in list(files) + deletes:
            why = forbidden(rel)
            if why:
                errs.append(f"{rel}：{why}")
                continue
            target = ROOT / rel
            if target.exists() and not target.is_file():
                errs.append(f"{rel}：目标是目录，不是文件")
            for parent in pathlib.PurePosixPath(rel).parents:
                if str(parent) == ".":
                    break
                if (ROOT / parent).is_file() or parent.as_posix().casefold() in aliases:
                    errs.append(f"{rel}：父路径 {parent} 是文件")
        if any(rel.casefold() in aliases for rel in deletes):
            errs.append("同一路径不能同时新增或修改和删除")
        change, _ = plan_paths(fid) if FEATURE_RE.match(fid or "") else ([], [])
        if change:
            extra = [rel for rel in list(files) + deletes if not in_scope(rel, change)]
            if extra:
                msg = "计划外文件：" + "、".join(extra)
                (warns if accept_extra else errs).append(msg + ("" if accept_extra else "。确认后加 --accept-extra 重跑"))
        elif FEATURE_RE.match(fid or ""):
            warns.append("work 文件里没有“改动文件”，跳过范围检查")
        writes = {rel: z.read(x) for rel, x in files.items()}
    return "ok", (errs, warns, writes, deletes, secs)


def section_lines(secs, word):
    for k, v in secs.items():
        if word in k:
            return [x.strip() for x in v if x.strip().lstrip("-* ").strip() not in ("无", "（无）")]
    return []


def cmd_in(a):
    zpath = pathlib.Path(a.zip) if a.zip else (find_latest(a.latest) if a.latest else None)
    if not zpath or not zpath.exists():
        print("没找到结果包。给出路径，或用 --latest <功能ID|L<闭环>-specs|HANDSHAKE>；结果包要放在“下载”文件夹（WSL2 下会查 Windows 的“下载”文件夹，也可设环境变量 HANDOFF_DOWNLOADS）或 ../handoff/inbox。")
        return 2
    m = re.match(r"^(.+?)-r(\d+)-result", zpath.name)
    key, n = (m.group(1), int(m.group(2))) if m else (a.latest or "UNKNOWN", 0)
    LOG.mkdir(parents=True, exist_ok=True)
    kind, data = inspect(zpath, key, a.accept_extra)
    print(f"结果包：{zpath}")
    if kind == "review":
        out = LOG / f"{key}-r{n}-REVIEW.md"
        out.write_text(data, encoding="utf-8")
        print(f"复核结论已保存到 {out}：\n")
        print(data)
        return 0
    errs, warns, writes, deletes, secs = data
    if key == "HANDSHAKE":
        token_file = LOG / "HANDSHAKE.token"
        token = token_file.read_text(encoding="utf-8").strip() if token_file.exists() else ""
        got = writes.get("tmp/handshake.txt", b"").decode("utf-8", "replace").strip()
        ok = not errs and token and got == token
        print("校验通过：搬运通道可用。" if ok else f"握手失败：{errs or '内容与令牌不符'}")
        return 0 if ok else 1
    for w in warns:
        print("提示：" + w)
    if errs:
        print("未应用，问题如下：")
        for e in errs:
            print("  - " + e)
        return 1
    print(f"新增或修改 {len(writes)} 个文件，删除 {len(deletes)} 个文件。")
    if a.dry_run:
        print("校验通过（dry-run，未写入）。")
        return 0
    for rel, blob in writes.items():
        f = ROOT / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(blob)
    for rel in deletes:
        if (ROOT / rel).is_file():
            (ROOT / rel).unlink()
    with zipfile.ZipFile(zpath) as z:
        man = [x for x in z.namelist() if x.endswith("MANIFEST.md")][0]
        (LOG / f"{key}-r{n}-MANIFEST.md").write_bytes(z.read(man))
    if any(rel.startswith("contracts/") for rel in writes):
        g = spec_tool("gen")
        print("已运行 gen。" if g.returncode == 0 else "gen 失败：\n" + g.stdout + g.stderr)
    v = spec_tool("verify")
    out = v.stdout + v.stderr
    (LOG / f"{key}-verify-latest.txt").write_text(out, encoding="utf-8")
    (LOG / f"{key}-r{n}-verify.txt").write_text(out, encoding="utf-8")
    ok = v.returncode == 0
    run_cmds = section_lines(secs, "需要运行")
    log_work(key, f"| {now()} | 网页版 Claude | 第 {n} 轮：写入 {len(writes)}、删除 {len(deletes)}；verify {'通过' if ok else '未通过'} | {'复查' if ok else '修复轮'} |",
             [f"- （Claude 第 {n} 轮）{x.lstrip('-* ')}" for x in section_lines(secs, "决定")],
             [f"- （Claude 第 {n} 轮）{x.lstrip('-* ')}" for x in section_lines(secs, "未决")])
    print("\n".join(out.splitlines()[-25:]))
    if run_cmds:
        print("MANIFEST 要求本地运行（Codex 判断后执行，再重跑 verify）：" + "；".join(run_cmds))
    print(f"\nverify {'通过：按 review-change 复查。' if ok else '未通过：写复查意见后运行 out ' + key + ' --notes <文件> 生成修复包。'}")
    return 0 if ok else 3


def cmd_selftest(_a):
    import contextlib
    import io
    import types
    from unittest.mock import patch

    with tempfile.TemporaryDirectory() as td:
        good = pathlib.Path(td) / "TEST-01-r1-result.zip"
        with zipfile.ZipFile(good, "w") as z:
            z.writestr("TEST-01-r1-result/MANIFEST.md", "## 修改与新增\n- packages/domains/practice/x.ts — 示例\n- tests/x.test.ts — 测试\n## 删除\n- 无\n"
                       "## 需要运行\n- 无\n## AC → 测试\n- TEST-01-AC1 → tests/x.test.ts：[TEST-01-AC1] 示例\n## 决定\n- 无\n## 未决与风险\n- 无\n")
            z.writestr("TEST-01-r1-result/files/packages/domains/practice/x.ts", "export const x = 1\n")
            z.writestr("TEST-01-r1-result/files/tests/x.test.ts", "test('[TEST-01-AC1] 示例', () => {})\n")
        kind, (errs, warns, writes, dels, _) = inspect(good, "TEST-01")
        assert kind == "ok" and not errs and len(writes) == 2 and not dels, (errs, warns)
        bad = pathlib.Path(td) / "TEST-02-r1-result.zip"
        with zipfile.ZipFile(bad, "w") as z:
            z.writestr("MANIFEST.md", "## 修改与新增\n- AGENTS.md — 不允许\n- scripts/a.py — 不允许\n## 删除\n- ../x\n")
            z.writestr("files/AGENTS.md", "x")
            z.writestr("files/scripts/a.py", "x")
        kind, (errs, *_rest) = inspect(bad, "TEST-02")
        assert len(errs) >= 3 and any("删除节" in e for e in errs), errs
        rv = pathlib.Path(td) / "L1.3-specs-r1-result.zip"
        with zipfile.ZipFile(rv, "w") as z:
            z.writestr("REVIEW.md", "## PRAC-04\n- 无阻断问题\n")
        assert inspect(rv, "L1.3-specs")[0] == "review"

        temp = pathlib.Path(td)
        repo, hand = temp / "repo", temp / "handoff"
        repo.mkdir()
        (repo / "AGENTS.md").write_text("项目规则\n", encoding="utf-8")
        (repo / "scripts").mkdir()

        def result_zip(path, adds=(), deletes=(), members=None):
            manifest = "## 修改与新增\n" + ("".join(f"- {p} — 自测\n" for p in adds) or "- 无\n")
            manifest += "## 删除\n" + ("".join(f"- {p}\n" for p in deletes) or "- 无\n")
            manifest += "## 需要运行\n- 无\n## AC → 测试\n- 无\n## 决定\n- 无\n## 未决与风险\n- 无\n"
            with zipfile.ZipFile(path, "w") as z:
                z.writestr("MANIFEST.md", manifest)
                for p, data in (members if members is not None else [(p, b"test") for p in adds]):
                    z.writestr("files/" + p, data)

        with patch.dict(globals(), {"ROOT": repo, "HAND": hand, "OUTBOX": hand / "outbox",
                                    "INBOX": hand / "inbox", "LOG": hand / "log"}):
            edge = temp / "TEST-03-r1-result.zip"
            for rel in ("ScRiPtS/a.py", "agents.md", ".GiT/config", "docs/META/a.md",
                        "scripts./a.py", "AGENTS.md.", "scripts /a.py", "safe.txt:stream",
                        "NUL", "a/COM1.txt", "../outside.txt", "C:/outside.txt", "x\x00.txt"):
                result_zip(edge, [rel])
                _, (errs, *_rest) = inspect(edge, "TEST-03")
                assert errs, f"应拒绝写入：{rel}"
            result_zip(edge, deletes=["../outside.txt"])
            assert inspect(edge, "TEST-03")[1][0], "不合法的删除不能静默忽略"
            result_zip(edge, ["safe/a.txt", "SAFE/a.txt"])
            assert any("大小写冲突" in e for e in inspect(edge, "TEST-03")[1][0])
            result_zip(edge, ["safe.txt"], ["SAFE.txt"])
            assert inspect(edge, "TEST-03")[1][0], "同一路径不能同时写入和删除"
            result_zip(edge, ["safe", "safe/a.txt"])
            assert inspect(edge, "TEST-03")[1][0], "应在写入前发现文件与目录冲突"

            outside, linked = temp / "outside", repo / "linked"
            outside.mkdir()
            try:
                linked.symlink_to(outside, target_is_directory=True)
            except OSError:
                if os.name != "nt":
                    raise
                # 创建 junction 不需要 Windows 的符号链接特权。
                created = subprocess.run(["cmd", "/c", "mklink", "/J", str(linked), str(outside)],
                                         capture_output=True)
                assert created.returncode == 0, created.stderr
            try:
                result_zip(edge, ["linked/escape.txt"])
                assert inspect(edge, "TEST-03")[1][0], "应拒绝经链接写出仓库"
                result_zip(edge, deletes=["linked/escape.txt"])
                assert inspect(edge, "TEST-03")[1][0], "应拒绝经链接删除仓库外文件"
                assert not (outside / "escape.txt").exists()
            finally:
                if linked.is_symlink():
                    linked.unlink()
                else:
                    linked.rmdir()

            custom, relocated = temp / "custom-downloads", temp / "relocated-downloads"
            custom.mkdir()
            relocated.mkdir()
            fake_registry = types.SimpleNamespace(
                HKEY_CURRENT_USER=object(),
                OpenKey=lambda *_args: contextlib.nullcontext(None),
                QueryValueEx=lambda *_args: (str(relocated), 2))
            with patch.dict(sys.modules, {"winreg": fake_registry}), \
                    patch.dict(os.environ, {"HANDOFF_DOWNLOADS": str(custom)}):
                dirs = download_dirs()
                assert dirs[0] == custom and relocated in dirs and pathlib.Path.home() / "Downloads" in dirs
                downloaded = relocated / "HANDSHAKE-r1-result.zip"
                downloaded.touch()
                assert find_latest("HANDSHAKE") == downloaded
            with patch(__name__ + ".windows_download_dir", return_value=None):
                assert pathlib.Path.home() / "Downloads" in download_dirs()

            args = argparse.Namespace(id="HANDSHAKE", round=1, handshake=True)
            with contextlib.redirect_stdout(io.StringIO()):
                assert cmd_out(args) == 0
            token = (LOG / "HANDSHAKE.token").read_text(encoding="utf-8")
            with zipfile.ZipFile(OUTBOX / "HANDSHAKE-r1.zip") as z:
                assert token in z.read("TASK.md").decode("utf-8")
            result = temp / "HANDSHAKE-r1-result.zip"
            result_zip(result, ["tmp/handshake.txt"], members=[("tmp/handshake.txt", token + "\n")])
            args = argparse.Namespace(zip=str(result), latest=None, accept_extra=False, dry_run=False)
            with contextlib.redirect_stdout(io.StringIO()):
                assert cmd_in(args) == 0
            assert not (repo / "tmp/handshake.txt").exists(), "握手不得写入项目代码"
            result_zip(result, ["tmp/handshake.txt"], members=[("tmp/handshake.txt", "wrong-token")])
            with contextlib.redirect_stdout(io.StringIO()):
                assert cmd_in(args) == 1
    assert all(isinstance(d, pathlib.Path) for d in download_dirs())
    for t in ("task-implement.md", "task-fix.md", "task-review-specs.md", "task-handshake.md", "claude-project.md"):
        assert (TPL / t).exists(), t
    print("selftest 通过")
    return 0


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    ap = argparse.ArgumentParser(prog="handoff", description="Codex 与网页版 Claude 之间的交接包（ADR-024）")
    sub = ap.add_subparsers(dest="cmd", required=True)
    o = sub.add_parser("out", help="生成实现、修复或握手包")
    o.add_argument("id")
    o.add_argument("--notes", help="复查意见文件，写进修复包的 FIX.md")
    o.add_argument("--round", type=int)
    o.add_argument("--force", action="store_true")
    o.add_argument("--handshake", action="store_true")
    s = sub.add_parser("specs", help="生成闭环规格复核包")
    s.add_argument("loop")
    i = sub.add_parser("in", help="校验并应用结果包")
    i.add_argument("zip", nargs="?")
    i.add_argument("--latest")
    i.add_argument("--dry-run", action="store_true")
    i.add_argument("--accept-extra", action="store_true")
    sub.add_parser("selftest", help="自检")
    a = ap.parse_args()
    return {"out": cmd_out, "specs": cmd_specs, "in": cmd_in, "selftest": cmd_selftest}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
