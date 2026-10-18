#!/usr/bin/env python3
"""交接包：Codex 与网页版 Claude 之间的出包与回包（ADR-024、ADR-030）。
流程见 docs/meta/plan/README.md 第 3 节；每种包带哪些文件、结果能写哪些位置见 docs/meta/plan/packages.yaml。

  python scripts/handoff.py write-specs <闭环> [--notes <文件>] [--no-prototype]   规格编写包（P1）
  python scripts/handoff.py write-plan <ID> [--notes <文件>]                       计划编写包（P2）
  python scripts/handoff.py adopt-plan <ID>                                        换入预写计划（P2，有预写稿时）
  python scripts/handoff.py where                                                  列出出包位置与结果包的查找位置
  python scripts/handoff.py out <ID> [--notes <文件>] [--round N] [--force]        实现或修复包
  python scripts/handoff.py out HANDSHAKE --handshake                              握手测试包
  python scripts/handoff.py specs <闭环>                                           规格冷启动复核包（重型通道）
  python scripts/handoff.py in [<结果包>] [--latest <键>] [--dry-run] [--accept-extra]
  python scripts/handoff.py selftest

键：L<闭环>-write、<ID>-plan、<ID>、L<闭环>-specs、HANDSHAKE。包放在仓库旁边的 ../handoff/（outbox 出包，log 记录）；
结果包默认从“下载”文件夹或 ../handoff/inbox 里找最新的。
"""
import argparse
import datetime
import fnmatch
import hashlib
import json
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
PACKAGES = ROOT / "docs" / "meta" / "plan" / "packages.yaml"
SKIP_PARTS = {"node_modules", ".git", "dist", "__pycache__", ".pack", ".test-results", ".trace", ".eval", "build-artifacts", "coverage"}
BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4", ".webm"}
WRITE_MAX_BYTES = 12_000_000   # 编写包上限（含原型与截图）
CODE_FILE_MAX = 200_000        # 计划编写包里单个代码文件的上限；超过的只列路径
TESTS_BUDGET = 1_000_000       # 计划编写包里 tests/ 的合计上限；与本功能 ID 相关的测试不受限
BACKSLASH = chr(92)
PLAN_KEYS = ["改动文件", "参考文件", "契约变更", "AC → 测试", "风险与不确定", "确认"]
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


def parse_plan_paths(text):
    """计划文字中“改动文件”“参考文件”两项列出的路径（以 / 结尾的是目录前缀）。"""
    out = {"改动文件": [], "参考文件": []}
    cur = None
    for line in (text or "").splitlines():
        m = re.match(r"^-\s*([^：:]+)[：:](.*)$", line)
        if m:
            cur, rest = m.group(1).strip(), m.group(2)
        else:
            rest = line
        if cur in out:
            out[cur] += [n for n in (norm(x) for x in PATH_RE.findall(rest)) if n]
    return out["改动文件"], out["参考文件"]


def plan_paths(fid):
    """work 文件“计划”一节中“改动文件”“参考文件”两项列出的路径。"""
    w = work_path(fid)
    if not w.exists():
        return [], []
    return parse_plan_paths(section(read(w), "计划"))


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


def win_path(p):
    """给 Windows 用户看的路径：/mnt/d/x 写成 D 盘路径；WSL2 里的 Linux 路径写成 wsl.localhost 共享路径；其余原样。"""
    s = str(pathlib.Path(p).resolve())
    m = re.match(r"^/mnt/([a-z])/(.*)$", s)
    if m:
        return m.group(1).upper() + ":" + BACKSLASH + m.group(2).replace("/", BACKSLASH)
    distro = os.environ.get("WSL_DISTRO_NAME")
    if distro and s.startswith("/"):
        return BACKSLASH * 2 + "wsl.localhost" + BACKSLASH + distro + s.replace("/", BACKSLASH)
    return s


def tell(zpath, result, key, n, nfiles):
    if key.endswith("-specs"):
        where = "新开一个对话（冷启动复核每一轮都用新对话）"
    elif n > 1:
        where = f"回到 {key} 第 1 轮的那个对话"
    elif FEATURE_RE.match(key) and any(OUTBOX.glob(f"{key}-plan-r*.zip")):
        where = f"回到写 {key} 计划（{key}-plan 第 1 轮）的那个对话，计划与实现用同一个对话"
    else:
        where = "新开一个对话"
    size = zpath.stat().st_size // 1024 + 1
    print(f"交接包已生成：{win_path(zpath)}（{size} KB，含 {nfiles} 个仓库文件）")
    print("请转告产品负责人：")
    print(f"  1. 打开 claude.ai 的「备考助手·实现」项目，{where}。")
    print(f"  2. 把 {zpath.name} 拖进对话（它在 {win_path(OUTBOX)}），不要解压、不要改名。")
    print(f"  3. 只粘贴这一句，不另加要求：按压缩包里的 TASK.md 完成 {key} 第 {n} 轮，最后给我 {result} 的下载链接。")
    print(f"  4. Claude 给出 {result} 后点下载：放进浏览器默认的“下载”文件夹，或放进 {win_path(INBOX)}；不要解压、不要改名。")
    print("  5. 回来告诉我“结果已下载”。")


def fix_text(fid, notes):
    v = LOG / f"{fid}-verify-latest.txt"
    out = "# 需要修复的问题\n\n## 本地检查输出（verify，最后 200 行）\n\n```text\n"
    out += "\n".join(read(v).splitlines()[-200:]) if v.exists() else "（没有记录）"
    out += "\n```\n\n## 复查意见\n\n" + (read(notes) if notes else "（无）") + "\n"
    return out


def notes_missing(a):
    notes = getattr(a, "notes", None)
    if notes and not pathlib.Path(notes).is_file():
        print(f"找不到意见文件 {notes}：先把复核意见写成文件，再用 --notes 指向它。")
        return True
    return False


def cmd_out(a):
    if notes_missing(a):
        return 2
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
        print(f"没有 work/{key}.md：先运行 python scripts/spec_tool.py work start {key}，再用 write-plan 请网页版 Claude 写计划（README 的 P2）。")
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
    always = (packages().get("implement") or {}).get("always") or ALWAYS
    files = expand(change + refs + always)
    if n > 1:
        main = "main" if git("rev-parse", "--verify", "main") else "origin/main"
        changed = git("diff", "--name-only", f"{main}...HEAD").splitlines() + git("diff", "--name-only").splitlines()
        changed += git("ls-files", "--others", "--exclude-standard").splitlines()
        files |= {x for x in changed if (ROOT / x).is_file() and not x.startswith("work/")}
    files = sorted(f for f in files if not forbidden(f, allow_protected=True) or f in always)
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
        print("这个闭环还没有任何规格：先走 P1，用 write-specs 请网页版 Claude 写。")
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
        _, lp = find_loop(a.loop)
        for t in [str(x) for x in (lp or {}).get("tasks") or []]:
            plan = ROOT / "docs" / "meta" / "plan" / "work" / f"{t.split()[0]}.md" if t.split() else None
            if plan and plan.is_file():
                z.write(plan, f"plans/{plan.name}")
    missing = [f for f in feats if f not in have]
    if missing:
        print(f"提示：{('、'.join(missing))} 还没有规格，本包不含。")
    tell(zpath, result, key, n, 0)
    return 0


# ---------------------------------------------------------------- 编写包（ADR-030；内容见 docs/meta/plan/packages.yaml）
# 原则（doc-system 第 1、2、6 章）：内容由闭环与规格的登记机械推导，恰好够用；包里没有的，由网页版 Claude 在结果中要，下一轮补上。

def packages():
    import yaml
    return yaml.safe_load(read(PACKAGES)) or {}


def entry_parts(entry):
    """packages.yaml 的一项 → (路径, 是否可以不存在, 理由, 条件)。字符串写作“路径 — 理由”；字典写作 {path, why, when}。"""
    if isinstance(entry, dict):
        path, why, when = str(entry.get("path", "")), str(entry.get("why", "")), entry.get("when")
    else:
        path, _, why = str(entry).partition(" — ")
        when = None
    path = path.strip()
    optional = path.endswith("?")
    return (path[:-1] if optional else path), optional, why.strip(), when


def expand_entry(path, ctx):
    p = path.replace("{loop}", str(ctx.get("loop", ""))).replace("{phase}", str(ctx.get("phase", "")))
    if "{id}" in p:
        return [p.replace("{id}", f).replace("{domain}", ctx.get("domain_of", {}).get(f, "")) for f in ctx.get("ids", [])]
    if "{domain}" in p:
        return [p.replace("{domain}", d) for d in ctx.get("domains", [])]
    if "{dep_domain}" in p:
        return [p.replace("{dep_domain}", d) for d in ctx.get("dep_domains", [])]
    return [p]


def skipped(rel):
    return bool(set(rel.split("/")) & SKIP_PARTS)


def match_files(pattern):
    """路径模式 → 仓库相对路径。以 / 结尾为目录（递归）；含 * 或 [ 用通配；否则是单个文件。"""
    pattern = pattern.strip()
    if pattern.endswith("/"):
        base = ROOT / pattern.rstrip("/")
        out = [p.relative_to(ROOT).as_posix() for p in base.rglob("*") if p.is_file()] if base.is_dir() else []
    elif any(ch in pattern for ch in "*["):
        out = [p.relative_to(ROOT).as_posix() for p in ROOT.glob(pattern) if p.is_file()]
    else:
        out = [pattern] if (ROOT / pattern).is_file() else []
    return sorted(x for x in out if not skipped(x))


def path_matches(rel, patterns):
    return any((p.endswith("/") and rel.startswith(p)) or fnmatch.fnmatch(rel, p) for p in patterns)


def tracked_files():
    files = [x for x in git("ls-files").splitlines() if x]
    if not files:
        files = [p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file()]
    return sorted(x for x in files if not skipped(x) and (ROOT / x).is_file())


def phases_data():
    import yaml
    return yaml.safe_load(read(ROOT / "docs/product/phases.yaml")) or {}


def find_loop(loop):
    for ph in phases_data().get("phases", []):
        for lp in ph.get("loops") or []:
            if str(lp.get("id")) == str(loop):
                return ph, lp
    return None, None


def loop_of_feature(fid):
    for ph in phases_data().get("phases", []):
        for lp in ph.get("loops") or []:
            if fid in [str(x) for x in lp.get("features") or []]:
                return ph, lp
    return None, None


def roadmap_map():
    import yaml
    return {str(f.get("id")): f for f in yaml.safe_load(read(ROOT / "docs/product/roadmap.yaml")) or []}


def domain_map():
    import yaml
    return {str(d.get("name")): d for d in yaml.safe_load(read(ROOT / "docs/product/domain-map.yaml")) or []}


def spec_front_matter(path):
    import yaml
    m = re.match(r"^---\n(.*?)\n---\n", read(path), re.S)
    return (yaml.safe_load(m.group(1)) or {}) if m else {}


def ctx_for(fids, loop, phase):
    rm, dm = roadmap_map(), domain_map()
    dom = {f: str((rm.get(f) or {}).get("domain") or "") for f in fids}
    doms = sorted({d for d in dom.values() if d})
    near = set(doms) | {str(x) for d in doms for x in (dm.get(d) or {}).get("depends") or []}
    groups = {str((dm.get(d) or {}).get("group")) for d in near}
    return {"loop": str(loop), "phase": str(phase), "ids": list(fids), "domain_of": dom, "domains": doms,
            "dep_domains": sorted(near - set(doms)), "groups": groups, "flags": {}}


def prototype_path():
    import tomllib
    src = (tomllib.loads(read(ROOT / "scripts" / "spec_tool.toml")).get("paths") or {}).get("prototype_source") or ""
    return (ROOT / src).resolve() if src else None


def spec_ui_section(text):
    """规格第 3 节（界面）的正文：只有这里点名的页面才算本功能的页面参考（与任务包的规则一致）。"""
    m = re.search(r"^## 3 [^\n]*\n(.*?)(?=^## 4 |\Z)", text or "", re.S | re.M)
    return m.group(1) if m else ""


def page_ids(text):
    return set(re.findall(r"(?<![A-Za-z0-9])([SOP]\d{2})(?:-\d{2})?(?![0-9])", text or ""))


END_OF_PAGE = {"S": "learner", "O": "org", "P": "admin"}


def page_yaml(pid):
    return f"design/screens/{END_OF_PAGE.get(pid[0], 'learner')}/{pid}.yaml"


class Bundle:
    """一个编写包：包内路径 → (内容, 读法, 理由)；另记缺失的必需来源与没有放进包的文件。"""

    def __init__(self, title):
        self.title, self.items, self.missing, self.left_out = title, {}, [], []

    def add(self, name, data, how, why):
        if name not in self.items:
            self.items[name] = (data if isinstance(data, bytes) else data.encode("utf-8"), how, why)

    def add_repo(self, rel, how, why):
        if rel == "AGENTS.md":
            self.add("AGENTS.md", (ROOT / rel).read_bytes(), how, why)
        elif pathlib.PurePosixPath(rel).suffix.lower() in BINARY_EXT and not rel.startswith("design/screens/shots/"):
            self.left_out.append((rel, "二进制文件，只列路径"))
        else:
            self.add("repo/" + rel, (ROOT / rel).read_bytes(), how, why)

    def size(self):
        return sum(len(v[0]) for v in self.items.values())

    def repo_count(self):
        return sum(1 for k in self.items if k.startswith("repo/") or k == "AGENTS.md")

    def sources(self):
        order = {"必读": 0, "计算": 1, "依据": 2}
        lines = [f"# {self.title}：包内文件清单（handoff.py 生成）", "",
                 "读法：必读＝先完整读；计算＝handoff.py 从仓库生成或摘取的内容；依据＝按需查阅，每个结论都要能在这里找到出处。",
                 "包的内容按 docs/meta/plan/packages.yaml 由本闭环（或本功能）的登记机械推导，恰好够用；需要却不在包里的，写进结果的“需要补充的文件”。", "",
                 "| 包内路径 | 读法 | 为什么在包里 | SHA-256 前 12 位 |", "|---|---|---|---|"]
        for name in sorted(self.items, key=lambda n: (order.get(self.items[n][1], 3), n)):
            data, how, why = self.items[name]
            lines.append(f"| {name} | {how} | {why} | {hashlib.sha256(data).hexdigest()[:12]} |")
        lines += ["", "## 未包含", ""] + ([f"- {p}：{why}" for p, why in self.left_out] or ["- 无"])
        return "\n".join(lines) + "\n"


def add_static(b, spec, ctx):
    for key, how in (("must", "必读"), ("basis", "依据")):
        for entry in spec.get(key) or []:
            path, optional, why, when = entry_parts(entry)
            if when and not ctx["flags"].get(when):
                continue
            for p in expand_entry(path, ctx):
                files = match_files(p)
                if not files:
                    (b.left_out if optional else b.missing).append((p, "不存在" if optional else "必需的来源不存在"))
                for f in files:
                    b.add_repo(f, how, why)


def doc_sections(titles):
    """从 doc-system.md 摘出指定的章节（跳过代码块里的井号行）。返回 (文字, 缺失的标题)。"""
    text = read(ROOT / "docs/meta/doc-system.md")
    heads, pos, fence = [], 0, False
    for line in text.splitlines(keepends=True):
        if line.startswith("```"):
            fence = not fence
        elif not fence:
            m = re.match(r"^(#{2,3}) (.+?)\s*$", line)
            if m:
                heads.append((pos, len(m.group(1)), m.group(2)))
        pos += len(line)
    parts, missing = [], []
    for want in titles:
        i = next((k for k, h in enumerate(heads) if h[2].startswith(want)), None)
        if i is None:
            missing.append(want)
            continue
        start, level, _ = heads[i]
        end = next((h[0] for h in heads[i + 1:] if h[1] <= level), len(text))
        parts.append(text[start:end].rstrip())
    return "\n\n".join(parts) + "\n", missing


def adr_digest():
    out = ["# 设计决定摘要（handoff.py 由 docs/adr/ 生成）", "",
           "每份 ADR 只收标题、状态与“决定”一节（doc-system 5.11）；整份已被取代的只留状态行。需要背景与后果的，写进“需要补充的文件”。", ""]
    for p in sorted((ROOT / "docs/adr").glob("ADR-*.md")):
        t = read(p)
        title = t.splitlines()[0].lstrip("# ").strip() if t.strip() else p.stem
        m = re.search(r"^- 状态：(.+)$", t, re.M)
        status = m.group(1).strip() if m else ""
        out += [f"## {title}", "", f"状态：{status}", ""]
        if status.startswith("已被"):
            continue
        d = re.search(r"^## 决定\s*\n(.*?)(?=^## |\Z)", t, re.S | re.M)
        out += [d.group(1).strip() if d else "（无“决定”一节）", ""]
    return "\n".join(out) + "\n"


def boundaries_digest(ctx, pages, rm):
    import yaml
    loop_of = {}
    for ph in phases_data().get("phases", []):
        for lp in ph.get("loops") or []:
            for f in lp.get("features") or []:
                loop_of[str(f)] = str(lp.get("id"))
    cover = {str(i): fid for fid, f in rm.items() for i in f.get("covers") or []}
    lines = ["# 边界一览（handoff.py 由 roadmap.yaml、phases.yaml 与页面登记生成）", "",
             "用途：判断条目归哪个功能、哪个闭环，避免越界与重复。★ 为本闭环的功能。以 roadmap.yaml 与页面登记为准。", "",
             "## 一、本闭环涉及页面的条目归属", ""]
    for pid in sorted(pages):
        f = ROOT / page_yaml(pid)
        if not f.exists():
            continue
        pg = yaml.safe_load(read(f)) or {}
        lines.append(f"### {pid} {pg.get('title', '')}（{pg.get('mode', '')}）")
        for it in pg.get("items") or []:
            if it.get("removed"):
                continue
            iid = str(it.get("id"))
            owner = cover.get(iid)
            if owner:
                tag = f"{owner} {(rm.get(owner) or {}).get('title', '')}（闭环 {loop_of.get(owner, '主题池')}）" + (" ★" if owner in ctx["ids"] else "")
            elif it.get("ui_only"):
                tag = "ui_only：随页面任务实现"
            elif it.get("out_of_scope"):
                tag = f"不做：{it.get('out_of_scope')}"
            else:
                tag = "未覆盖"
            lines.append(f"- {iid} {it.get('name', '')}（{it.get('page_priority', '')}）→ {tag}")
        lines.append("")
    lines += ["## 二、全部闭环与功能", ""]
    for ph in phases_data().get("phases", []):
        for lp in ph.get("loops") or []:
            feats = "、".join(f"{x} {(rm.get(str(x)) or {}).get('title', '')}" for x in lp.get("features") or []) or "（无功能）"
            nd = "；不做：" + "、".join(str(x) for x in lp.get("not_doing") or []) if lp.get("not_doing") else ""
            lines.append(f"- {lp.get('id')} {lp.get('title')}：{feats}{nd}")
    lines += ["", "## 三、全部页面", ""]
    for end in ("learner", "org", "admin"):
        for f in sorted((ROOT / "design/screens" / end).glob("*.yaml")):
            pg = yaml.safe_load(read(f)) or {}
            lines.append(f"- {pg.get('id')} {pg.get('title', '')}（{pg.get('mode', '')}）")
    return "\n".join(lines) + "\n"


def add_pages(b, pids, with_yaml=True):
    for pid in sorted(pids):
        if with_yaml and (ROOT / page_yaml(pid)).is_file():
            b.add_repo(page_yaml(pid), "依据", f"{pid} 的页面登记（范围的唯一来源）")
        for f in match_files(f"design/screens/slices/{pid}.html") + match_files(f"design/screens/shots/{pid}/"):
            b.add_repo(f, "依据", f"{pid} 的原型切片与截图（布局参考）")


def add_work_plans(b, task_slices, fids):
    for rel in ["docs/meta/plan/work/README.md"] + [f"docs/meta/plan/work/{s}.md" for s in task_slices] + \
               [f"docs/meta/plan/work/{f}.md" for f in fids]:
        if (ROOT / rel).is_file():
            b.add_repo(rel, "必读", "已有的计划：闭环级任务计划、功能计划预写稿与写法说明")


PROTOTYPE_TOKENS = {"prototype", "原型", "冻结原型", "context/prototype.html"}


def add_requests(b, key):
    req = LOG / f"{key}-requests.txt"
    if not req.exists():
        return
    for line in read(req).splitlines():
        token = line.strip()
        if not token:
            continue
        if token in PROTOTYPE_TOKENS:
            proto = prototype_path()
            if proto and proto.is_file():
                b.add("context/prototype.html", proto.read_bytes(), "依据",
                      "冻结原型（ADR-030 的按需例外）：只在页面登记、切片与截图缺信息时查阅，以登记为准")
            else:
                b.left_out.append(("context/prototype.html", f"上一轮要求附冻结原型，但 {proto} 不存在"))
            continue
        rel = norm(token)
        files = match_files(rel) if rel else []
        if not files:
            b.left_out.append((token, "上一轮要求补充，但仓库里没有"))
        for f in files:
            b.add_repo(f, "依据", "上一轮结果要求补充")


def save_requests(key, lines):
    items = []
    for line in lines:
        m = re.match(r"^\s*[-*]\s*`?([^`\s（(—–]+)`?", line)
        if not m or m.group(1) in ("无", "（无）"):
            continue
        token = m.group(1)
        if token in PROTOTYPE_TOKENS or norm(token):
            items.append(token if token in PROTOTYPE_TOKENS else norm(token))
    if not items:
        return []
    req = LOG / f"{key}-requests.txt"
    old = read(req).splitlines() if req.exists() else []
    req.write_text("\n".join(dict.fromkeys(old + items)) + "\n", encoding="utf-8")
    return items


def revise_block(n, notes=None, plan=False):
    if n <= 1 and not notes:
        return ""
    tail = "交回完整的新 PLAN.md。" if plan else "只交回这一轮新增或修改的文件。"
    return (f"\n## 本轮要按意见修改（第 {n} 轮）\n先读 REVISE.md：Codex 的复核意见与产品负责人的修改要求，逐条处理；"
            "在结果中写明每条怎么改的，不同意的写理由。repo/ 下是仓库当前版本，含已有草稿与上一轮的内容。" + tail + "\n")


def add_revise(b, key, n, notes):
    if n <= 1 and not notes:
        return
    text = read(notes) if notes else "（本轮没有附复核意见。）\n"
    b.add("REVISE.md", "# 本轮要处理的意见\n\n" + text, "必读", "复核意见与产品负责人的修改要求")
    prev = LOG / f"{key}-r{n - 1}-MANIFEST.md"
    if prev.exists():
        b.add("context/PREVIOUS.md", "# 上一轮的结果清单（MANIFEST 原文）\n\n" + read(prev), "计算", "上一轮写入了哪些文件")


def run_pack(fid, *extra):
    r = spec_tool("pack", fid, *extra)
    p = ROOT / ".pack" / f"{fid}.md"
    return r, (read(p) if p.exists() else "")


def finish_bundle(b, key, n, result, kind):
    if b.missing:
        print(f"{kind}缺少必需的依据，未出包（规定见 docs/meta/plan/packages.yaml）：")
        for p, why in b.missing:
            print(f"  - {p}：{why}")
        return 2
    if b.size() > WRITE_MAX_BYTES:
        print(f"{kind} {b.size() // 1024} KB，超过 {WRITE_MAX_BYTES // 1024} KB：检查 packages.yaml 是否带了不必要的大文件。")
        return 2
    OUTBOX.mkdir(parents=True, exist_ok=True)
    LOG.mkdir(parents=True, exist_ok=True)
    zpath = OUTBOX / f"{key}-r{n}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for name, (data, _, _) in sorted(b.items.items()):
            z.writestr(name, data)
        z.writestr("context/SOURCES.md", b.sources())
    tell(zpath, result, key, n, b.repo_count())
    if b.left_out:
        print(f"提示：{len(b.left_out)} 项没有放进包里，已列在包内 context/SOURCES.md 的“未包含”一节。")
    return 0


def cmd_write_specs(a):
    import yaml
    if notes_missing(a):
        return 2
    ph, lp = find_loop(a.loop)
    if lp is None:
        print(f"phases.yaml 里没有闭环 {a.loop}。")
        return 2
    br = git("rev-parse", "--abbrev-ref", "HEAD")
    if br and br != f"spec/loop-{a.loop}" and not a.force:
        print(f"当前分支是 {br}，规格批次应在 spec/loop-{a.loop} 上进行；确认无误可加 --force。")
        return 2
    spec = packages().get("write-specs") or {}
    fids = [str(x) for x in lp.get("features") or []]
    ctx = ctx_for(fids, a.loop, ph.get("id"))
    rm = roadmap_map()
    key = f"L{a.loop}-write"
    n = a.round or next_round(key)
    result = f"{key}-r{n}-result.zip"
    loop_doc = ROOT / f"docs/meta/plan/loops/{a.loop}.md"
    drafts = {f: spec_file(f) for f in fids if spec_file(f)}
    draft_refs = {}
    for f, sp in drafts.items():
        for k, v in ((spec_front_matter(sp).get("refs") or {}).items()):
            draft_refs.setdefault(k, set()).update(str(x) for x in v or [])
    pages = page_ids(yaml.safe_dump(lp, allow_unicode=True) + (read(loop_doc) if loop_doc.exists() else ""))
    pages |= page_ids(" ".join(str(i) for f in fids for i in (rm.get(f) or {}).get("covers") or []))
    pages |= page_ids(" ".join(spec_ui_section(read(sp)) for sp in drafts.values()))
    pages = {p for p in pages if (ROOT / page_yaml(p)).is_file()}
    scenarios = [s for s in (yaml.safe_load(read(ROOT / "contracts/ai/scenarios.yaml")) or [])
                 if isinstance(s, dict) and str(s.get("owner")) in ctx["domains"]]
    scen_ids = {str(s.get("id")) for s in scenarios} | draft_refs.get("ai", set())
    tasks = [str(x) for x in lp.get("tasks") or []]
    ctx["flags"] = {"has_tasks": bool(tasks), "ui": bool(pages), "ai": bool(scen_ids),
                    "learning": "学习核心" in ctx["groups"] or bool(tasks),
                    "exam_data": bool(ctx["groups"] & {"学习核心", "内容"})}
    b = Bundle(f"闭环 {a.loop} 规格编写包第 {n} 轮")
    add_static(b, spec, ctx)
    b.add("context/loop.yaml", yaml.safe_dump({"phase": {k: v for k, v in ph.items() if k != "loops"}, "loop": lp},
                                              allow_unicode=True, sort_keys=False), "必读", "phases.yaml 中本闭环及所在期的原文切片")
    rules, miss = doc_sections(spec.get("doc_system_sections") or [])
    if miss:
        b.missing.append(("docs/meta/doc-system.md", "找不到章节：" + "、".join(miss)))
    b.add("context/writing-rules.md", "# 写作规则（handoff.py 从 docs/meta/doc-system.md 摘取）\n\n" + rules, "必读",
          "规格格式、契约与待定问题写法、refs、通道、预算、写作约定、模板与检查规则")
    b.add("context/adr-decisions.md", adr_digest(), "依据", "全部设计决定的“决定”一节")
    b.add("context/boundaries.md", boundaries_digest(ctx, pages, rm), "依据", "条目归属、全部闭环与功能、全部页面：判断边界")
    for fid in fids:
        r, text = run_pack(fid, "--spec-mode")
        if r.returncode != 0 or not text:
            print(f"{fid} 的写规格任务包生成失败，未出包：\n{r.stdout}{r.stderr}")
            return 2
        b.add(f"packs/{fid}.spec-mode.md", text, "必读", "写规格任务包：路线图条目、覆盖条目、领域已有登记、不变量、待定问题与规则")
        if fid in drafts:
            r, text = run_pack(fid)
            why = "开发者将拿到的任务包（核对体量与 refs）"
            if r.returncode != 0:
                r, text = run_pack(fid, "--allow-over")
                why = "开发者将拿到的任务包：超出预算，写规格时要收窄"
            if text:
                b.add(f"packs/{fid}.md", text, "必读", why)
    closure, stack = set(), list(fids)
    while stack:
        for d in (rm.get(stack.pop()) or {}).get("depends") or []:
            if str(d) not in closure:
                closure.add(str(d))
                stack.append(str(d))
    neighbors = {owner for owner, f in rm.items() for i in f.get("covers") or [] if str(i)[:3] in pages}
    for other in sorted((closure | neighbors) - set(fids)):
        sp = spec_file(other)
        if sp:
            why = "依赖的功能的规格（接口与口径保持一致）" if other in closure else "覆盖同一页面的功能的规格（边界保持一致）"
            b.add_repo(sp.relative_to(ROOT).as_posix(), "依据", why)
    add_pages(b, pages)
    for end in sorted({END_OF_PAGE[p[0]] for p in pages}):
        if (ROOT / f"apps/{end}/AGENTS.md").is_file():
            b.add_repo(f"apps/{end}/AGENTS.md", "依据", f"{end} 端的要点与审查规则")
    for sid in sorted(scen_ids):
        for f in match_files(f"evals/{sid}/") + match_files(f"packages/ai/{sid}/"):
            b.add_repo(f, "依据", f"AI 场景 {sid} 的评测与输出结构")
    add_work_plans(b, [t.split()[0] for t in tasks if t.split()], fids)
    if tasks:
        b.add("context/tree.txt", "\n".join(tracked_files()) + "\n", "依据", "仓库全部已跟踪文件（写闭环级任务计划用）")
    add_requests(b, key)
    add_revise(b, key, n, a.notes)
    feats = "、".join(f"{f} {(rm.get(f) or {}).get('title', '')}" for f in fids) or "无（本闭环只有闭环级任务）"
    b.add("TASK.md", fill("task-write-specs.md", LOOP=a.loop, PHASE=ph.get("id"), ROUND=n, RESULT=result, FEATURES=feats,
                          TASKS="；".join(tasks) or "无", REVISE=revise_block(n, a.notes)), "必读", "本轮任务说明")
    return finish_bundle(b, key, n, result, "规格编写包")


def add_code_context(b, fid, pack_text, tracked):
    m = re.search(r"^- 涉及路径：(.+)$", pack_text, re.M)
    globs = [g.strip() for g in re.split(r"[、,，]", m.group(1)) if g.strip()] if m else []
    tests_used = 0
    entry_re = re.compile(r"(apps/[^/]+|packages/[^/]+|packages/domains/[^/]+)/(index\.ts|src/index\.tsx?|src/main\.tsx?|src/app\.ts|src/App\.tsx)")
    for rel in tracked:
        name = rel.rsplit("/", 1)[-1]
        if any(fnmatch.fnmatch(rel, g) for g in globs):
            why = "本功能涉及路径中的文件"
        elif name == "package.json" or (name.startswith("tsconfig") and name.endswith(".json")):
            why = "工作区与编译配置"
        elif "/" not in rel and re.search(r"\.(ts|js|cjs|mjs|json|ya?ml)$", rel):
            why = "根目录配置"
        elif entry_re.fullmatch(rel):
            why = "工作区包的入口"
        else:
            continue
        size = (ROOT / rel).stat().st_size
        if size > CODE_FILE_MAX:
            b.left_out.append((rel, f"{size // 1024} KB，超过单个文件上限，只列路径"))
            continue
        if rel.startswith("tests/") and fid.lower() not in rel.lower():
            if tests_used + size > TESTS_BUDGET:
                b.left_out.append((rel, "tests/ 超出体量上限；需要时写进“需要补充的文件”"))
                continue
            tests_used += size
        b.add_repo(rel, "依据", why)


def cmd_write_plan(a):
    fid = a.id
    if notes_missing(a):
        return 2
    if not FEATURE_RE.match(fid):
        print(f"{fid} 不是功能 ID。")
        return 2
    br = git("rev-parse", "--abbrev-ref", "HEAD")
    if not br.startswith(f"feat/{fid}-") and not a.force:
        print(f"当前分支是 {br}，应在 feat/{fid}-<短名> 上出计划包；确认无误可加 --force。")
        return 2
    if not work_path(fid).exists():
        print(f"没有 work/{fid}.md：先运行 python scripts/spec_tool.py work start {fid}。")
        return 2
    sp = spec_file(fid)
    if not sp:
        print(f"{fid} 还没有规格：先走 P1。")
        return 2
    fm = spec_front_matter(sp)
    if fm.get("status") != "ready" and not a.force:
        print(f"{fid} 的规格状态是 {fm.get('status')}：P2 只给 ready 的规格写计划；确认无误可加 --force。")
        return 2
    refs = fm.get("refs") or {}
    ph, lp = loop_of_feature(fid)
    ctx = ctx_for([fid], (lp or {}).get("id", ""), (ph or {}).get("id", ""))
    key = f"{fid}-plan"
    n = a.round or next_round(key)
    result = f"{key}-r{n}-result.zip"
    r, pack_text = run_pack(fid)
    if r.returncode != 0 or not pack_text:
        print(r.stdout + r.stderr)
        print("任务包生成失败。超出预算说明功能太宽，按 doc-system 第 10 章处理。")
        return 2
    pages = page_ids(pack_text.split("## 6 ", 1)[-1].split("## 7 ", 1)[0]) if "## 6 " in pack_text else set()
    ctx["flags"] = {"schema": bool(refs.get("schema")), "models": bool(refs.get("models")),
                    "exam_data": bool(ctx["groups"] & {"学习核心", "内容"}), "ui": bool(pages)}
    spec = packages().get("write-plan") or {}
    b = Bundle(f"{fid} 计划编写包第 {n} 轮")
    add_static(b, spec, ctx)
    b.add("pack.md", pack_text, "必读", "任务包：规格全文、适用规则、契约切片、页面、不变量、依赖接口、术语、ADR、待定问题与 AC 现状")
    b.add("work.md", read(work_path(fid)), "必读", "work 文件的当前内容")
    b.add_repo(sp.relative_to(ROOT).as_posix(), "必读", "规格原文（含 refs 与待定问题）")
    for ref in refs.get("models") or []:
        mf = f"docs/models/{str(ref).split('#')[0]}.md"
        if (ROOT / mf).is_file():
            b.add_repo(mf, "依据", "规格引用的算法规格原文（任务包只列引用）")
    for dep in refs.get("features") or []:
        dsp = spec_file(str(dep))
        if dsp:
            b.add_repo(dsp.relative_to(ROOT).as_posix(), "依据", "依赖功能的规格")
    add_pages(b, pages, with_yaml=False)
    tasks = [str(x) for x in (lp or {}).get("tasks") or []]
    add_work_plans(b, [t.split()[0] for t in tasks if t.split()], [fid])
    tracked = tracked_files()
    b.add("context/tree.txt", "\n".join(tracked) + "\n", "依据", "仓库全部已跟踪文件")
    add_code_context(b, fid, pack_text, tracked)
    rules, miss = doc_sections(spec.get("doc_system_sections") or [])
    if miss:
        b.missing.append(("docs/meta/doc-system.md", "找不到章节：" + "、".join(miss)))
    b.add("context/work-rules.md", "# work 文件规则（handoff.py 从 docs/meta/doc-system.md 摘取）\n\n" + rules, "依据", "work 文件的用途与模板")
    add_requests(b, key)
    add_revise(b, key, n, a.notes)
    b.add("TASK.md", fill("task-write-plan.md", ID=fid, TITLE=feature_title(fid), ROUND=n, RESULT=result,
                          LOOP=ctx["loop"], REVISE=revise_block(n, a.notes, plan=True)), "必读", "本轮任务说明")
    code = finish_bundle(b, key, n, result, "计划编写包")
    if code == 0:
        log_work(fid, f"| {now()} | Codex | 出计划编写包第 {n} 轮（{b.repo_count()} 个仓库文件） | 等网页版 Claude 交回 PLAN.md |")
    return code


def split_plan(text):
    secs = {m.group(1).strip(): m.group(2) for m in re.finditer(r"^## ([^\n]+)\n(.*?)(?=^## |\Z)", text or "", re.S | re.M)}
    title = next((k for k in secs if k.startswith("计划")), None)
    if title is None:
        return None, secs
    return f"## {title}\n{secs.pop(title)}", secs


def check_plan(fid, plan):
    if plan is None:
        return ["PLAN.md 里没有“## 计划（确认后才动代码）”一节"], []
    errs, warns = [], []
    keys = [m.group(1).strip() for m in re.finditer(r"^-\s*([^：:\n]+)[：:]", plan, re.M)]
    errs += [f"计划缺少“{k}”一项" for k in PLAN_KEYS if k not in keys]
    change, refs = parse_plan_paths(plan)
    if not change:
        errs.append("“改动文件”没有解析出路径：每行一个路径，说明写在其后的中文括号里；仓库根下名字带两个点的文件写成 ./ 开头")
    for rel in change:
        why = forbidden(rel)
        if why:
            errs.append(f"改动文件 {rel}：{why}")
    for rel in refs:
        if not (ROOT / rel.rstrip("/")).exists():
            warns.append(f"参考文件 {rel} 在仓库里不存在")
    m = re.search(r"^-\s*确认[：:]\s*(.*)$", plan, re.M)
    v = m.group(1).strip() if m else ""
    if v and v not in ("（谁、何时）", "(谁、何时)"):
        errs.append("“确认”一行要写“（谁、何时）”，由产品负责人确认后 Codex 填写")
    sp = spec_file(fid) if FEATURE_RE.match(fid) else None
    if sp:
        miss = [ac for ac in sorted(set(re.findall(r"\b(" + re.escape(fid) + r"-AC\d+)\b", read(sp)))) if ac not in plan]
        if miss:
            errs.append("“AC → 测试”缺少：" + "、".join(miss))
    return errs, warns


def splice_plan(fid, plan):
    w = work_path(fid)
    t = read(w)
    new = plan.rstrip("\n") + "\n\n"
    m = re.search(r"^## 计划[^\n]*\n.*?(?=^## |\Z)", t, re.S | re.M)
    t = (t[:m.start()] + new + t[m.end():]) if m else (t.rstrip("\n") + "\n\n" + new)
    w.write_text(t, encoding="utf-8")


def apply_plan(key, n, text, dry_run):
    fid = key[: -len("-plan")]
    plan, extra = split_plan(text)
    errs, warns = check_plan(fid, plan)
    for w in warns:
        print("提示：" + w)
    if errs:
        print("未写入，问题如下（写成复核意见后运行 write-plan " + fid + " --notes <文件>）：")
        for e in errs:
            print("  - " + e)
        return 1
    if not work_path(fid).exists():
        print(f"没有 work/{fid}.md：先运行 python scripts/spec_tool.py work start {fid}。")
        return 2
    if dry_run:
        print("校验通过（dry-run，未写入）。")
        return 0
    LOG.mkdir(parents=True, exist_ok=True)
    splice_plan(fid, plan)
    (LOG / f"{key}-r{n}-PLAN.md").write_text(text, encoding="utf-8")
    for title, body in extra.items():
        lines = [x for x in body.splitlines() if x.strip()]
        if "需要补充" in title:
            got = save_requests(key, lines)
            if got:
                print("网页版 Claude 要求补充的文件（下一轮计划包会带上）：" + "、".join(got))
        elif lines:
            print(f"{title}：")
            print("\n".join("  " + x for x in lines))
    log_work(fid, f"| {now()} | 网页版 Claude | 计划第 {n} 轮写入 work 文件 | Codex 按 review-plan 复核 |")
    print(f"计划已写入 work/{fid}.md 的“计划”一节：按 review-plan 技能复核，再给负责人看计划概况。")
    return 0


def cmd_where(_a):
    """列出交接用到的文件夹：出包位置、结果包的查找位置与记录位置。"""
    print(f"出包（拖给 Claude）：{win_path(OUTBOX)}")
    print("结果包的查找位置（按顺序）：")
    for d in download_dirs() + [INBOX, HAND]:
        print(f"  - {win_path(d)}{'' if d.exists() else '（不存在）'}")
    print(f"记录：{win_path(LOG)}")
    if not os.environ.get("HANDOFF_DOWNLOADS"):
        print("浏览器下载到上面以外的文件夹时，设环境变量 HANDOFF_DOWNLOADS 指向它。")
    return 0


def cmd_adopt_plan(a):
    """把网页版 Claude 预写的计划（docs/meta/plan/work/<ID>.md）换入 work 文件，检查与回收 PLAN.md 相同。"""
    fid = a.id
    src = ROOT / "docs" / "meta" / "plan" / "work" / f"{fid}.md"
    if not src.is_file():
        print(f"没有预写稿 {src.relative_to(ROOT).as_posix()}：用 write-plan {fid} 请网页版 Claude 写计划。")
        return 2
    br = git("rev-parse", "--abbrev-ref", "HEAD")
    if not br.startswith(f"feat/{fid}-") and not a.force:
        print(f"当前分支是 {br}，应在 feat/{fid}-<短名> 上换入计划；确认无误可加 --force。")
        return 2
    plan, _ = split_plan(read(src))
    errs, warns = check_plan(fid, plan)
    for w in warns:
        print("提示：" + w)
    if errs:
        print("预写稿没有换入，问题如下（写成复核意见后运行 write-plan " + fid + " --notes <文件>，计划包会带上预写稿）：")
        for e in errs:
            print("  - " + e)
        return 1
    if not work_path(fid).exists():
        print(f"没有 work/{fid}.md：先运行 python scripts/spec_tool.py work start {fid}。")
        return 2
    splice_plan(fid, plan)
    log_work(fid, f"| {now()} | Codex | 换入网页版 Claude 的预写计划 | 按 review-plan 复核 |")
    print(f"预写计划已换入 work/{fid}.md 的“计划”一节：按 review-plan 技能复核；不通过就用 write-plan {fid} --notes 退回网页版 Claude。")
    return 0


def writable_for(loop):
    spec = packages().get("write-specs") or {}
    ph, lp = find_loop(loop)
    ctx = ctx_for([str(x) for x in (lp or {}).get("features") or []], loop, (ph or {}).get("id", ""))
    allow = [p for e in spec.get("writable") or [] for p in expand_entry(entry_parts(e)[0], ctx)]
    confirm = [p for e in spec.get("writable_confirm") or [] for p in expand_entry(entry_parts(e)[0], ctx)]
    return allow, confirm


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
    dirs += [pathlib.Path.home() / "Downloads", pathlib.Path.home() / "下载"]
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
    writing = (fid or "").endswith("-write")
    with zipfile.ZipFile(zpath) as z:
        names = [x for x in z.namelist() if not x.endswith("/")]
        if (fid or "").endswith("-plan"):
            plans = [x for x in names if x == "PLAN.md" or x.endswith("/PLAN.md")]
            if len(plans) != 1:
                return "error", (["计划结果包里应当恰好有一个 PLAN.md"], [], {}, [], {})
            return "plan", z.read(plans[0]).decode("utf-8", "replace")
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
        allow, confirm = writable_for(fid[1:-len("-write")]) if writing else ([], [])
        for rel in list(files) + deletes:
            why = forbidden(rel, allow_protected=writing)
            if why:
                errs.append(f"{rel}：{why}")
                continue
            if writing and not path_matches(rel, allow + confirm):
                proposal = [entry_parts(e)[0] for e in (packages().get("write-specs") or {}).get("proposal_only") or []]
                if path_matches(rel, proposal):
                    errs.append(f"{rel}：规划文件不直接改，写进 MANIFEST“给负责人确认的规划改动”，负责人确认后由 Codex 落地")
                else:
                    errs.append(f"{rel}：不在规格编写的可写范围（docs/meta/plan/packages.yaml 的 write-specs.writable）")
                continue
            if writing and not path_matches(rel, allow):
                warns.append(f"{rel}：规划类改动，Codex 须在大白话概况里逐条列给负责人确认")
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


def finish_write(key, n, secs):
    """规格编写结果写入后：重新生成、运行 check，记下要补充的文件与需负责人确认的规划改动。"""
    g = spec_tool("gen")
    c = spec_tool("check")
    out = g.stdout + g.stderr + c.stdout + c.stderr
    (LOG / f"{key}-r{n}-check.txt").write_text(out, encoding="utf-8")
    print("\n".join(out.splitlines()[-25:]))
    for title, lines in secs.items():
        body = [x for x in lines if x.strip().lstrip("-* ").strip() not in ("无", "（无）")]
        if "需要补充" in title:
            got = save_requests(key, body)
            if got:
                print("网页版 Claude 要求补充的文件（下一轮编写包会带上）：" + "、".join(got))
        elif ("负责人确认" in title or "未决" in title) and body:
            print(f"{title}（写进大白话概况）：")
            print("\n".join("  " + x.strip() for x in body))
    loop = key[1:-len("-write")]
    ok = c.returncode == 0
    print(f"\ncheck {'通过：按 review-spec 技能复核。' if ok else '未通过：报错给了明确改法的机械问题可以直接修，其余写进复核意见后运行 write-specs ' + loop + ' --notes <文件>。'}")
    return 0 if ok else 3


def cmd_in(a):
    zpath = pathlib.Path(a.zip) if a.zip else (find_latest(a.latest) if a.latest else None)
    if not zpath or not zpath.exists():
        want = f"{a.latest}-r<轮次>-result.zip" if a.latest else "<键>-r<轮次>-result.zip"
        print(f"没找到结果包 {want}。查过的位置：")
        for d in [p for p in download_dirs() if p.exists()] + [INBOX, HAND]:
            print(f"  - {win_path(d)}")
        print("请确认已下载、文件名没被改动；把它放进上面任一位置后再说一次“结果已下载”。"
              "浏览器下载到别处的，可设环境变量 HANDOFF_DOWNLOADS 指向那个文件夹。")
        return 2
    m = re.match(r"^(.+?)-r(\d+)-result", zpath.name)
    key, n = (m.group(1), int(m.group(2))) if m else (a.latest or "UNKNOWN", 0)
    LOG.mkdir(parents=True, exist_ok=True)
    kind, data = inspect(zpath, key, a.accept_extra)
    print(f"结果包：{win_path(zpath)}")
    sent = sorted(int(m.group(1)) for x in OUTBOX.glob(f"{key}-r*.zip") if (m := re.match(rf"^{re.escape(key)}-r(\d+)\.zip$", x.name)))
    if sent and n != sent[-1]:
        print(f"提示：结果包是第 {n} 轮，最近一次出包是第 {sent[-1]} 轮；确认下载的是最新结果。")
    if kind == "plan":
        return apply_plan(key, n, data, a.dry_run)
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
    if key.endswith("-write"):
        return finish_write(key, n, secs)
    g = spec_tool("gen")  # 结果可能改了任何生成源（契约、令牌、页面登记、约定），一律重新生成再跑 verify
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
    for t in ("task-implement.md", "task-fix.md", "task-review-specs.md", "task-handshake.md", "claude-project.md",
              "task-write-specs.md", "task-write-plan.md", "business-summary.md"):
        assert (TPL / t).exists(), t

    # ADR-030：编写包的内容规定与结果的写入范围
    spec = packages()
    for kind in ("write-specs", "write-plan", "implement", "review-specs"):
        assert kind in spec, f"packages.yaml 缺少 {kind}"
    first = next(((ph, lp) for ph in phases_data().get("phases", []) for lp in ph.get("loops") or [] if lp.get("features")), None)
    if first:
        ph, lp = first
        fids = [str(x) for x in lp["features"]]
        ctx = ctx_for(fids, lp["id"], ph["id"])
        b = Bundle("selftest")
        add_static(b, spec["write-specs"], ctx)
        assert not b.missing, f"规格编写包缺少必需来源：{b.missing}"
        b = Bundle("selftest")
        add_static(b, spec["write-plan"], ctx_for(fids[:1], lp["id"], ph["id"]))
        assert not b.missing, f"计划编写包缺少必需来源：{b.missing}"
        for kind in ("write-specs", "write-plan"):
            assert not doc_sections(spec[kind].get("doc_system_sections") or [])[1], f"{kind} 的 doc-system 章节找不到"
        assert "## " in adr_digest() and "## 一、" in boundaries_digest(ctx, set(), roadmap_map())
        allow, confirm = writable_for(str(lp["id"]))
        target = f"docs/domains/{ctx['domain_of'][fids[0]]}/features/{fids[0]}.md"
        assert path_matches(target, allow), (target, allow)
        assert not path_matches("apps/learner/src/x.ts", allow + confirm)
        assert not path_matches("docs/product/roadmap.yaml", allow + confirm)
    good = ("## 计划（确认后才动代码）\n- 改动文件：\n  - packages/domains/practice/src/x.ts（说明）\n  - ./vitest.config.ts（说明）\n"
            "- 参考文件：\n  - contracts/params.yaml（说明）\n- 契约变更：无\n- AC → 测试：\n  - TEST-01-AC1 → x.test.ts：[TEST-01-AC1] 示例\n"
            "- 实现要点：无\n- 风险与不确定：无\n- 确认：（谁、何时）\n\n## 需要补充的文件\n- contracts/events.yaml\n")
    plan, extra = split_plan(good)
    assert parse_plan_paths(plan)[0] == ["packages/domains/practice/src/x.ts", "vitest.config.ts"], parse_plan_paths(plan)
    assert "需要补充的文件" in extra and not check_plan("TEST-01", plan)[0], check_plan("TEST-01", plan)
    bad = good.replace("packages/domains/practice/src/x.ts", "scripts/x.py").replace("（谁、何时）", "负责人已确认")
    assert len(check_plan("TEST-01", split_plan(bad)[0])[0]) >= 2
    assert check_plan("TEST-01", None)[0]
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
    s = sub.add_parser("specs", help="生成闭环规格冷启动复核包（重型通道）")
    s.add_argument("loop")
    w = sub.add_parser("write-specs", help="生成闭环规格编写包（P1，ADR-030）")
    w.add_argument("loop")
    w.add_argument("--notes", help="复核意见或负责人的修改要求，写进 REVISE.md")
    w.add_argument("--round", type=int)
    w.add_argument("--force", action="store_true")
    w.add_argument("--no-prototype", action="store_true", help="确认本闭环不需要冻结原型时使用，会记入 SOURCES.md")
    sub.add_parser("where", help="列出出包位置、结果包的查找位置与记录位置")
    ad = sub.add_parser("adopt-plan", help="换入网页版 Claude 的预写计划（P2，ADR-030）")
    ad.add_argument("id")
    ad.add_argument("--force", action="store_true")
    pl = sub.add_parser("write-plan", help="生成功能计划编写包（P2，ADR-030）")
    pl.add_argument("id")
    pl.add_argument("--notes", help="复核意见，写进 REVISE.md")
    pl.add_argument("--round", type=int)
    pl.add_argument("--force", action="store_true")
    i = sub.add_parser("in", help="校验并应用结果包")
    i.add_argument("zip", nargs="?")
    i.add_argument("--latest")
    i.add_argument("--dry-run", action="store_true")
    i.add_argument("--accept-extra", action="store_true")
    sub.add_parser("selftest", help="自检")
    a = ap.parse_args()
    return {"out": cmd_out, "specs": cmd_specs, "in": cmd_in, "selftest": cmd_selftest,
            "write-specs": cmd_write_specs, "write-plan": cmd_write_plan, "adopt-plan": cmd_adopt_plan, "where": cmd_where}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
