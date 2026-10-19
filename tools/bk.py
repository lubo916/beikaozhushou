#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bk：备考助手 V4 的交接与进度工具。只用 Python 标准库（3.10 及以上）。

本地（Codex 桌面端）常用
  python3 tools/bk.py doctor              环境检查
  python3 tools/bk.py status              现在到哪了、下一步做什么、等你拍板的问题
  python3 tools/bk.py pack T032           出任务包（交给网页版 Claude）
  python3 tools/bk.py in --latest         收结果包：合并、完整验证、记进度、出新版本包
  python3 tools/bk.py run                 启动本地预览
  python3 tools/bk.py ship                推送到 GitHub
网页端（Claude 沙箱）常用
  python3 tools/bk.py start T032          开工：探测环境、装依赖、建分支、打印任务简报
  python3 tools/bk.py verify              跑检查
  python3 tools/bk.py done                收工：检查改动范围、跑验证、打结果包
两边通用
  task / spec / proto / board / map / accept / answer / where / init / selftest
"""
from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

TOOL_VERSION = "4.1.1"
PAGE_STATUS = ["todo", "shell", "ui", "api", "ok"]
PAGE_STATUS_CN = {"todo": "未开始", "shell": "空壳", "ui": "前端完成（假数据）", "api": "已接后端", "ok": "已验收"}
TASK_STATUS_CN = {"todo": "未开始", "doing": "进行中", "fixing": "修复中", "done": "完成",
                  "blocked": "受阻", "skipped": "不做"}
LEVEL_CN = {"A": "A（逻辑或交互复杂，Claude 主写）", "B": "B（常规，Claude 优先，Codex 可做）",
            "C": "C（简单，Codex 即可）"}
APP_OF = {"S": ("learner", "learner"), "O": ("org", "org"), "P": ("admin", "admin")}
REPORT_RE = re.compile(r"```json bk-report[ \t]*\n(.*?)\n```", re.S)

DEFAULT_CONFIG: dict = {
    "project": "备考助手",
    "main_branch": "main",
    "handoff_dir": "../handoff",
    "zip_limit_mb": 25,
    "node_major": 24,
    "max_rounds": 3,
    "schema_frozen": False,
    "freeze_paths": ["packages/db/prisma/migrations/**"],
    "test_globs": ["*.test.*", "*.spec.*", "tests/**"],
    "pack_depth": 30,
    "prototype": "design/prototype/prototype.html",
    "exclude": ["node_modules/", "dist/", "build/", ".turbo/", "coverage/", "playwright-report/",
                "test-results/", ".bk/", ".vite/", ".cache/", "generated/", "*.log", ".env", ".env.*",
                ".DS_Store"],
    "keep_env_files": [".env.example"],
    "hub_only": ["progress/tasks.json", "progress/pages.json", "progress/questions.json",
                 "progress/board.md", "progress/board.html", "progress/changelog.md",
                 "progress/questions.md"],
    "always_allowed": ["progress/reports/**", "docs/decisions/**"],
    "hot_paths": ["package.json", "*/package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
                  ".npmrc", ".nvmrc", "tsconfig*.json", "eslint.config.*", ".github/**", "tools/**",
                  "AGENTS.md", "CLAUDE.md", "docs/baseline/**", "packages/ui/**",
                  "apps/*/src/app/**", "apps/*/src/router/**", "apps/*/src/routes.ts",
                  "apps/*/src/mocks/index.ts", "apps/*/src/i18n/index.ts",
                  "contracts/openapi/_common.yaml", "contracts/openapi/schemas/**",
                  "packages/db/prisma/schema/_base.prisma", "design/tokens.json",
                  "tests/rules/**", "tests/e2e/golden/**", "docs/baseline/errata.md"],
    "never_read": ["archive/**", "docs/history/**", "pnpm-lock.yaml", "**/node_modules/**",
                   "**/*.gen.*", "packages/contract/src/generated/**",
                   "design/prototype/prototype.html（用 bk spec / bk proto 代替）"],
    "verify": {"quick": ["lint", "typecheck", "test"],
               "web": ["lint", "typecheck", "test", "build", "e2e:smoke"],
               "full": ["lint", "typecheck", "test", "build", "test:db", "e2e:smoke", "gallery"]},
    "needs_browser": ["e2e:smoke", "e2e:full", "gallery"],
    "needs_db": ["test:db", "e2e:full"],
    "timeouts": {"default": 900, "e2e:smoke": 1500, "gallery": 1500, "build": 1200},
    "run": {"mock": "pnpm dev", "real": "pnpm dev:real",
            "compose": "deploy/compose.dev.yml",
            "urls": {"学员端": "http://localhost:5173", "机构端": "http://localhost:5174",
                     "平台后台": "http://localhost:5175", "接口": "http://localhost:3000/health"}},
    "routes": {},
    "kinds": {},
}


# ───────────────────────── 基础工具 ─────────────────────────

class BkError(Exception):
    pass


def say(msg: str = "") -> None:
    print(msg, flush=True)


def die(msg: str, code: int = 1) -> None:
    print("✗ " + msg, file=sys.stderr, flush=True)
    sys.exit(code)


def now() -> str:
    return dt.datetime.now().strftime("%Y-%m-%d %H:%M")


def sh(cmd, cwd=None, check=True, timeout=None, env=None) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=timeout, env=env, shell=isinstance(cmd, str))
    if check and r.returncode != 0:
        raise BkError(f"命令失败：{cmd if isinstance(cmd, str) else ' '.join(map(str, cmd))}\n"
                      f"{(r.stdout or '')[-1500:]}{(r.stderr or '')[-1500:]}")
    return r


def git(root: Path, *args: str, check: bool = True) -> str:
    return sh(["git", *args], cwd=root, check=check).stdout.strip()


def load_json(path: Path, default=None):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        die(f"{path} 不是合法的 JSON：{e}")


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def find_root() -> Path:
    p = Path.cwd().resolve()
    for q in [p, *p.parents]:
        if (q / "tools" / "bk.py").exists() and (q / ".git").exists():
            return q
    die("找不到仓库根目录（要同时有 tools/bk.py 和 .git）。先 cd 到仓库根再运行。")
    raise SystemExit


def load_config(root: Path) -> dict:
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    user = load_json(root / "tools" / "bk.config.json", {}) or {}
    for k, v in user.items():
        if isinstance(v, dict) and isinstance(cfg.get(k), dict):
            cfg[k].update(v)
        else:
            cfg[k] = v
    return cfg


def env_kind() -> str:
    """web：claude.ai 对话沙箱；cloud：Claude Code 网页版（连 GitHub）；local：你的电脑。"""
    v = os.environ.get("BK_ENV")
    if v == "cloud":
        return "web"
    if v in ("web", "local"):
        return v
    return "web" if Path("/mnt/user-data").is_dir() else "local"


def is_cloud() -> bool:
    return os.environ.get("BK_ENV") == "cloud"


def outputs_dir() -> Path:
    return Path(os.environ.get("BK_OUTPUTS", "/mnt/user-data/outputs"))


def uploads_dir() -> Path:
    return Path(os.environ.get("BK_UPLOADS", "/mnt/user-data/uploads"))


def is_wsl() -> bool:
    try:
        return "microsoft" in Path("/proc/version").read_text().lower()
    except OSError:
        return False


def win_downloads() -> Path | None:
    v = os.environ.get("BK_WIN_DOWNLOADS")
    if v and Path(v).is_dir():
        return Path(v)
    if not is_wsl():
        return None
    base = Path("/mnt/c/Users")
    if not base.is_dir():
        return None
    skip = {"Public", "Default", "Default User", "All Users", "defaultuser0", "WDAGUtilityAccount"}
    cands = []
    try:
        for d in base.iterdir():
            if d.name in skip:
                continue
            dl = d / "Downloads"
            if dl.is_dir():
                cands.append(dl)
    except OSError:
        return None
    if not cands:
        return None
    return max(cands, key=lambda p: p.stat().st_mtime)


def win_path(p: Path) -> str:
    if is_wsl() and shutil.which("wslpath"):
        r = sh(["wslpath", "-w", str(p)], check=False)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    return str(p)


def match_any(path: str, patterns) -> bool:
    for pat in patterns:
        pat = pat.split("（")[0].strip()
        if not pat:
            continue
        if fnmatch.fnmatchcase(path, pat):
            return True
        if pat.endswith("/**") and (path == pat[:-3] or path.startswith(pat[:-2])):
            return True
        if pat.endswith("/") and path.startswith(pat):
            return True
    return False


def tail(text: str, n: int = 40) -> str:
    lines = text.rstrip().splitlines()
    return "\n".join(lines[-n:])


def vstr(n: int) -> str:
    return f"v{n:04d}"


def versions(root: Path) -> list[int]:
    tags = git(root, "tag", "-l", "bk-v*", check=False).split()
    return sorted(int(t[4:]) for t in tags if re.fullmatch(r"bk-v\d{4,}", t))


def current_version(root: Path) -> int:
    v = versions(root)
    return v[-1] if v else 0


_HANDOFF_NOTE = False


def handoff(root: Path, cfg: dict, sub: str = "") -> Path:
    """中转文件夹默认在仓库旁边（../handoff）。如果写不进去（例如 Codex 的沙箱只允许写仓库内），退回仓库内的 .bk/handoff。"""
    global _HANDOFF_NOTE
    base = Path(os.environ.get("BK_HANDOFF") or (root / cfg["handoff_dir"])).resolve()
    p = base / sub if sub else base
    try:
        p.mkdir(parents=True, exist_ok=True)
        if not os.access(p, os.W_OK):
            raise PermissionError(str(p))
    except OSError:
        base = root / ".bk" / "handoff"
        p = base / sub if sub else base
        p.mkdir(parents=True, exist_ok=True)
        if not _HANDOFF_NOTE:
            _HANDOFF_NOTE = True
            say(f"  （仓库外的中转文件夹写不进去，改用仓库内的 {base}；想用仓库外的，请在 Codex 里允许写工作区以外的文件夹）")
    return p


def bkdir(root: Path, sub: str = "") -> Path:
    if not (root / ".bk").exists() and (root / ".git").is_dir():
        ensure_local_exclude(root)
    p = root / ".bk" / sub if sub else root / ".bk"
    p.mkdir(parents=True, exist_ok=True)
    return p


def ensure_local_exclude(repo: Path) -> None:
    ex = repo / ".git" / "info" / "exclude"
    ex.parent.mkdir(parents=True, exist_ok=True)
    text = ex.read_text(encoding="utf-8") if ex.exists() else ""
    if ".bk/" not in text.split():
        ex.write_text(text + ("\n" if text and not text.endswith("\n") else "") + ".bk/\n", encoding="utf-8")


def worktree_clean(root: Path) -> bool:
    return git(root, "status", "--porcelain") == ""


def current_branch(root: Path) -> str:
    return git(root, "rev-parse", "--abbrev-ref", "HEAD", check=False)


# ───────────────────────── 任务、页面、交接单 ─────────────────────────

def tasks_doc(root: Path) -> dict:
    return load_json(root / "progress" / "tasks.json", {"tasks": []}) or {"tasks": []}


def pages_doc(root: Path) -> dict:
    return load_json(root / "progress" / "pages.json", {"pages": []}) or {"pages": []}


def task_map(doc: dict) -> dict:
    return {t["id"]: t for t in doc.get("tasks", [])}


def expand_task(task: dict, cfg: dict) -> dict:
    """把任务的种类模板（kinds）展开成具体的 owns / reads / lookup / accept / not。"""
    kind = cfg.get("kinds", {}).get(task.get("kind", ""), {})
    pages = task.get("pages") or []

    domains = task.get("domains") or ([task["domain"]] if task.get("domain") else [])

    def fill(templates):
        res = []
        for tpl in templates:
            needs_page = any(x in tpl for x in ("{page}", "{app}", "{appdir}"))
            needs_dom = "{domain}" in tpl
            for p in (pages if needs_page else [None]):
                for dmn in (domains if needs_dom else [None]):
                    vals = {"id": task["id"], "domain": dmn or "", "rule": task.get("rule", ""),
                            "page": p or "", "pages": " ".join(pages)}
                    if p:
                        vals["app"], vals["appdir"] = APP_OF.get(p[0], ("learner", "learner"))
                    s = tpl
                    missing = False
                    for k, v in vals.items():
                        if "{" + k + "}" in s:
                            if not v:
                                missing = True
                            s = s.replace("{" + k + "}", v)
                    if not missing and "{" not in s.split("（")[0]:
                        res.append(s)
        return res

    def dedupe(xs):
        seen, outl = set(), []
        for x in xs:
            if x not in seen:
                seen.add(x)
                outl.append(x)
        return outl

    return {
        "owns": dedupe(fill(kind.get("owns", [])) + task.get("owns", [])),
        "reads": dedupe(fill(kind.get("reads", [])) + task.get("reads", [])),
        "lookup": dedupe(fill(kind.get("lookup", [])) + task.get("lookup", [])),
        "accept": dedupe(task.get("accept", []) + fill(kind.get("accept", []))),
        "not": dedupe(task.get("not", []) + fill(kind.get("not", []))),
        "proto": (kind.get("proto", False) if bool(pages) else False),
    }


def adhoc_task(task_id: str, title: str) -> dict:
    return {"id": task_id, "title": title or "临时修复", "stage": 9, "lane": "修复", "level": "B",
            "tool": "任意", "kind": "fix", "deps": [], "pages": [], "owns": ["**"],
            "goal": title or "修复用户反馈的问题",
            "accept": ["先写一个能复现问题的测试并确认它失败，再修，修好后它通过",
                       "bk verify 通过；交接单写明根因与影响范围"]}


def get_task(root: Path, cfg: dict, task_id: str, title: str = "") -> dict:
    t = task_map(tasks_doc(root)).get(task_id)
    if t:
        return t
    if re.fullmatch(r"X\d{4}[a-z]?", task_id) or title:
        return adhoc_task(task_id, title)
    die(f"任务清单 progress/tasks.json 里没有 {task_id}。临时修复请用：bk start fix --title \"一句话\"")
    raise SystemExit


def new_adhoc_id(root: Path) -> str:
    base = "X" + dt.datetime.now().strftime("%m%d")
    used = {p.name.split("-r")[0] for p in (root / "progress" / "reports").glob(base + "*-r*.md")}
    for c in "abcdefghijklmnopqrstuvwxyz":
        if base + c not in used:
            return base + c
    return base + "z"


def next_round(root: Path, task_id: str) -> int:
    rs = [int(m.group(1)) for p in (root / "progress" / "reports").glob(f"{task_id}-r*.md")
          if (m := re.fullmatch(rf"{re.escape(task_id)}-r(\d+)\.md", p.name))]
    return (max(rs) + 1) if rs else 1


REPORT_TEMPLATE = """# 交接单 {task} 第 {round} 轮：{title}

> 给产品负责人看的，全部用大白话。下面的数据块给工具读，按格式改，不要删。

```json bk-report
{data}
```

## 一句话
（待填：这一轮做成了什么，一句话）

## 怎么看效果
（待填：本地运行 `python3 tools/bk.py run` 后，打开哪个网址、点哪里、应该看到什么）

## 做了什么
（待填：3–8 条，每条一句话）

## 没做 / 留到以后
（待填；没有就写“无”）

## 需要你拍板
（没有就写“无”。有的话每条写：问题是什么；选项 A、B 分别对用户意味着什么；我推荐哪个；我已经先按哪个做了。同时写进上面数据块的 questions）

## 风险与提醒
（待填；没有就写“无”）
"""


def report_path(root: Path, task_id: str, rnd: int) -> Path:
    return root / "progress" / "reports" / f"{task_id}-r{rnd}.md"


def make_report_template(root: Path, task: dict, rnd: int) -> Path:
    p = report_path(root, task["id"], rnd)
    if p.exists():
        return p
    prev = report_path(root, task["id"], rnd - 1) if rnd > 1 else None
    if prev and prev.exists():
        text = prev.read_text(encoding="utf-8")
        text = re.sub(r"^# 交接单 (\S+) 第 \d+ 轮", rf"# 交接单 \1 第 {rnd} 轮", text, count=1, flags=re.M)
        text = text.replace("> 给产品负责人看的", f"> 第 {rnd} 轮是在第 {rnd - 1} 轮基础上的修复：请更新下面各节，写清这次修了什么、根因是什么。\n> 给产品负责人看的", 1)
        p.write_text(text, encoding="utf-8")
        try:
            data, _ = read_report(p)
            for k in ("checks", "changed", "out_of_scope", "verify_level", "allow_hot", "tool", "base", "version"):
                data.pop(k, None)
            data["round"] = rnd
            write_report_data(p, data)
        except BkError:
            pass
        return p
    data = {"task": task["id"], "round": rnd, "status": "done",
            "pages": {pg: "ui" for pg in task.get("pages", [])} if task.get("kind") == "page" else {},
            "questions": [], "answers": {}, "decisions": [], "next": []}
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(REPORT_TEMPLATE.format(task=task["id"], round=rnd, title=task.get("title", ""),
                                        data=json.dumps(data, ensure_ascii=False, indent=2)), encoding="utf-8")
    return p


def read_report(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    m = REPORT_RE.search(text)
    if not m:
        raise BkError(f"{path.name} 里找不到 ```json bk-report 数据块")
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        raise BkError(f"{path.name} 的数据块不是合法 JSON（常见原因：多了逗号、用了中文引号）：{e}")
    return data, text


def write_report_data(path: Path, data: dict) -> None:
    text = path.read_text(encoding="utf-8")
    block = "```json bk-report\n" + json.dumps(data, ensure_ascii=False, indent=2) + "\n```"
    path.write_text(REPORT_RE.sub(lambda m: block, text, count=1), encoding="utf-8")


def report_section(text: str, title: str) -> str:
    m = re.search(rf"^## {re.escape(title)}\s*\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    return m.group(1).strip() if m else ""


# ───────────────────────── 环境探测与依赖 ─────────────────────────

def find_chromium() -> str | None:
    if os.environ.get("BK_CHROMIUM") and Path(os.environ["BK_CHROMIUM"]).exists():
        return os.environ["BK_CHROMIUM"]
    roots = [os.environ.get("PLAYWRIGHT_BROWSERS_PATH", ""), "/opt/pw-browsers",
             str(Path.home() / ".cache" / "ms-playwright")]
    found = []
    for r in roots:
        if r and Path(r).is_dir():
            found += sorted(Path(r).glob("chromium-*/chrome-linux*/chrome"))
    return str(found[-1]) if found else None


def tcp_ok(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def db_reachable(root: Path) -> bool:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        for f in (".env.local", ".env"):
            p = root / f
            if p.exists():
                m = re.search(r"^DATABASE_URL\s*=\s*['\"]?([^'\"\n]+)", p.read_text(encoding="utf-8"), re.M)
                if m:
                    url = m.group(1)
                    break
    m = re.search(r"@([^:/@]+)(?::(\d+))?/", url)
    host, port = (m.group(1), int(m.group(2) or 5432)) if m else ("127.0.0.1", 5432)
    return tcp_ok(host, port)


def npm_registry_ok() -> bool:
    try:
        urllib.request.urlopen("https://registry.npmjs.org/-/ping", timeout=8)
        return True
    except Exception:
        return False


def package_manager(root: Path) -> str:
    pj = load_json(root / "package.json", {}) or {}
    return pj.get("packageManager", "")


def script_runner(root: Path) -> list[str]:
    pm = package_manager(root)
    if (pm.startswith("pnpm") or (root / "pnpm-workspace.yaml").exists()) and shutil.which("pnpm"):
        return ["pnpm", "-s", "run"]
    return ["npm", "run", "-s"]


def ensure_deps(root: Path, caps: dict, force: bool = False) -> None:
    if not (root / "package.json").exists():
        caps["deps"] = "无 package.json（工程骨架还没建）"
        return
    if (root / "node_modules").exists() and not force:
        caps["deps"] = True
        return
    if os.environ.get("BK_NO_INSTALL"):
        caps["deps"] = "已跳过安装（BK_NO_INSTALL）"
        return
    log = bkdir(root, "logs") / "install.log"
    pm = package_manager(root)
    envx = dict(os.environ, COREPACK_ENABLE_DOWNLOAD_PROMPT="0", CI="1")
    want = int(load_config(root).get("node_major", 24))
    have = sh(["node", "-v"], check=False).stdout.strip() if shutil.which("node") else ""
    have_major = int(re.findall(r"\d+", have)[0]) if have else 0
    if env_kind() == "web" and have_major < want and not os.environ.get("BK_SKIP_TOOLCHAIN"):
        prefix = Path.home() / ".bk-tools"
        say(f"· 沙箱是 Node {have or '无'}，尝试经 npm 装 Node {want}（约 10 秒，失败就继续用现有版本）……")
        r = sh(["npm", "i", "-g", f"node@{want}", "--prefix", str(prefix)], check=False, env=envx, timeout=300)
        nb = prefix / "bin" / "node"
        if r.returncode == 0 and nb.exists() and os.access("/usr/local/bin", os.W_OK):
            try:
                tgt = Path("/usr/local/bin/node")
                if tgt.exists() or tgt.is_symlink():
                    tgt.unlink()
                tgt.symlink_to(nb)
            except OSError:
                pass
        now_v = sh(["node", "-v"], check=False).stdout.strip()
        say(f"  现在是 Node {now_v}" + ("" if now_v.startswith(f"v{want}") else "（没装上，项目兼容 22.12 以上，可以继续）"))
    try:
        if pm.startswith("pnpm") and not shutil.which("pnpm"):
            say(f"· 安装 {pm} ……")
            r = sh(["corepack", "enable"], check=False, env=envx)
            r2 = sh(["corepack", "prepare", pm, "--activate"], check=False, env=envx, timeout=300)
            if r.returncode != 0 or r2.returncode != 0 or not shutil.which("pnpm"):
                sh(["npm", "i", "-g", pm], check=False, env=envx, timeout=300)
        lock = (root / "pnpm-lock.yaml").exists()
        cmd = ["pnpm", "install", "--frozen-lockfile"] if lock else (["pnpm", "install"] if shutil.which("pnpm") else ["npm", "install"])
        say("· 安装依赖（第一次大约 2–6 分钟）……")
        r = sh(cmd, cwd=root, check=False, env=envx, timeout=1800)
        log.write_text((r.stdout or "") + (r.stderr or ""), encoding="utf-8")
        caps["deps"] = r.returncode == 0
        if r.returncode != 0:
            say("  依赖安装失败，日志末尾：\n" + tail((r.stdout or "") + (r.stderr or ""), 25))
    except subprocess.TimeoutExpired:
        caps["deps"] = False
        say("  依赖安装超时")


def probe(root: Path, install: bool) -> dict:
    caps = {"env": env_kind(), "python": sys.version.split()[0], "node": None, "git": None,
            "network": None, "browser": None, "db": False, "deps": None, "time": now()}
    r = sh(["node", "-v"], check=False) if shutil.which("node") else None
    caps["node"] = r.stdout.strip() if r and r.returncode == 0 else None
    caps["git"] = sh(["git", "--version"], check=False).stdout.strip()
    caps["browser"] = find_chromium() if caps["env"] == "web" else (find_chromium() or "本地 Playwright")
    if caps["env"] == "web":
        caps["network"] = npm_registry_ok()
    caps["db"] = db_reachable(root)
    if install:
        ensure_deps(root, caps)
    else:
        caps["deps"] = (root / "node_modules").exists() or ("无 package.json" if not (root / "package.json").exists() else False)
    save_json(bkdir(root) / "env.json", caps)
    return caps


def caps_line(c: dict) -> str:
    def yn(v):
        return "✓" if v is True or (isinstance(v, str) and v and not v.startswith("无")) else "✗"
    parts = [f"Node {c.get('node') or '✗'}"]
    if c.get("env") == "web":
        parts.append(f"联网装包 {yn(c.get('network'))}")
    parts.append(f"依赖 {yn(c.get('deps')) if not isinstance(c.get('deps'), str) else c['deps']}")
    parts.append(f"浏览器 {yn(c.get('browser'))}")
    parts.append(f"数据库 {yn(c.get('db'))}")
    return "  ".join(parts)


# ───────────────────────── 验证 ─────────────────────────

def do_verify(root: Path, cfg: dict, level: str, caps: dict | None = None) -> dict:
    caps = caps or load_json(root / ".bk" / "env.json", {}) or {}
    pj = load_json(root / "package.json", {}) or {}
    scripts = pj.get("scripts", {})
    runner = script_runner(root)
    envx = dict(os.environ, CI="1")
    chromium = find_chromium()
    if chromium:
        envx["BK_CHROMIUM"] = chromium
    web = env_kind() == "web"
    results = []
    say(f"· 验证（{level}）：{'、'.join(cfg['verify'][level])}")
    for name in cfg["verify"][level]:
        is_cmd = name.startswith("cmd:")
        if not is_cmd and name not in scripts:
            results.append({"name": name, "result": "skip", "note": "未配置"})
            continue
        if not is_cmd and not (shutil.which("pnpm") or shutil.which("npm")):
            results.append({"name": name, "result": "skip" if web else "env", "note": "没有安装 Node/npm"})
            continue
        if name in cfg["needs_browser"] and web and not chromium:
            results.append({"name": name, "result": "skip", "note": "网页端没有浏览器"})
            continue
        if name in cfg["needs_db"] and not db_reachable(root):
            results.append({"name": name, "result": "skip" if web else "env",
                            "note": "没有数据库" if web else "数据库没启动（先开 Docker Desktop，再运行 bk run --real 或 docker compose up -d）"})
            continue
        log = bkdir(root, "logs") / ("verify-" + re.sub(r"[^\w.-]+", "_", name)[:60] + ".log")
        t0 = time.time()
        timeout = cfg["timeouts"].get(name, cfg["timeouts"]["default"])
        try:
            r = subprocess.run(name[4:] if is_cmd else runner + [name], cwd=root, capture_output=True, text=True,
                               encoding="utf-8", errors="replace", timeout=timeout, env=envx, shell=is_cmd)
            outtext = (r.stdout or "") + (r.stderr or "")
            ok = r.returncode == 0
            note = f"{int(time.time() - t0)} 秒"
        except subprocess.TimeoutExpired as e:
            outtext = str(e)
            ok = False
            note = f"超时（{timeout} 秒）"
        log.write_text(outtext, encoding="utf-8")
        results.append({"name": name, "result": "pass" if ok else "fail", "note": note,
                        "log": str(log.relative_to(root))})
        say(f"  {'✓' if ok else '✗'} {name}（{note}）")
        if not ok:
            say("    ── 日志末尾 ──\n" + "\n".join("    " + x for x in tail(outtext, 30).splitlines()))
    for r in results:
        if r["result"] == "skip":
            say(f"  - {r['name']}：跳过（{r['note']}）")
        if r["result"] == "env":
            say(f"  ! {r['name']}：环境问题（{r['note']}）")
    verdict = "fail" if any(r["result"] == "fail" for r in results) else (
        "env" if any(r["result"] == "env" for r in results) else "pass")
    summary = {"level": level, "verdict": verdict, "time": now(), "results": results}
    save_json(bkdir(root) / "last-verify.json", summary)
    say({"pass": "✓ 验证通过", "fail": "✗ 验证没通过", "env": "! 验证被环境问题卡住（不是代码问题）"}[verdict])
    return summary


def checks_brief(summary: dict) -> str:
    sym = {"pass": "✓", "fail": "✗", "skip": "–", "env": "!"}
    return " ".join(f"{r['name']}{sym[r['result']]}" for r in summary.get("results", [])) or "（无可运行的检查）"


# ───────────────────────── 打包与解包 ─────────────────────────

def excluded(rel: str, name: str, patterns: list[str]) -> bool:
    """简单名字（如 node_modules/、*.log、.env）在任何层级都按名字匹配；带路径的按完整路径匹配。"""
    for pat in patterns:
        p = pat.rstrip("/")
        if "/" not in p:
            if fnmatch.fnmatchcase(name, p):
                return True
        elif match_any(rel, [pat]):
            return True
    return False


def add_tree(zf: zipfile.ZipFile, src: Path, prefix: str, exclude: list[str], keep: list[str]) -> None:
    for dirpath, dirnames, filenames in os.walk(src):
        d = Path(dirpath)
        rel_d = d.relative_to(src).as_posix()
        rel_d = "" if rel_d == "." else rel_d + "/"
        if rel_d.startswith(".bk/"):
            dirnames[:] = []
        if not rel_d.startswith(".git/"):
            dirnames[:] = [x for x in dirnames
                           if rel_d + x in (".git", ".bk") or not excluded(rel_d + x + "/", x, exclude)]
        for fn in filenames:
            rel = rel_d + fn
            if rel.startswith(".bk/"):
                if rel != ".bk/package.json":
                    continue
            elif not rel.startswith(".git/") and excluded(rel, fn, exclude) and fn not in keep and rel not in keep:
                continue
            full = d / fn
            if full.is_symlink() and not full.exists():
                continue
            zi = zipfile.ZipInfo.from_file(full, prefix + rel)
            zi.compress_type = zipfile.ZIP_DEFLATED
            with open(full, "rb") as f:
                zf.writestr(zi, f.read())


def safe_extract(zpath: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zpath) as zf:
        for zi in zf.infolist():
            name = zi.filename
            if name.startswith("/") or ".." in Path(name).parts:
                raise BkError(f"压缩包里有可疑路径：{name}")
            target = dest / name
            if zi.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(zi) as s, open(target, "wb") as d:
                shutil.copyfileobj(s, d)
            mode = (zi.external_attr >> 16) & 0o777
            if mode:
                os.chmod(target, mode)


def prepare_repo_copy(root: Path, cfg: dict, dest: Path, ref: str, branch_name: str, depth: int) -> None:
    url = "file://" + str(root)
    main = cfg["main_branch"]
    sh(["git", "clone", "--quiet", "--no-local", "--no-tags", "--single-branch", "--depth", str(depth),
        "--branch", main, url, str(dest)])
    if ref != main:
        sh(["git", "fetch", "--quiet", "--no-tags", "--depth", str(depth), url, f"+{ref}:refs/heads/{branch_name}"], cwd=dest)
        sh(["git", "checkout", "--quiet", branch_name], cwd=dest)
    sh(["git", "remote", "remove", "origin"], cwd=dest, check=False)
    for k, v in (("user.name", "Claude（网页端）"), ("user.email", "claude-web@bk.local"),
                 ("core.fileMode", "false"), ("core.autocrlf", "false"), ("gc.auto", "0")):
        sh(["git", "config", k, v], cwd=dest)
    ensure_local_exclude(dest)


START_TASK = """# 从这里开始

这是「{project}」的开发包：任务 **{task}　{title}**，基于版本 **{ver}**，第 {round} 轮。

你是网页版 Claude，负责写代码和测试。和你对话的人是产品负责人，不是程序员：给他看的话一律用大白话。

## 1. 解压并开工（照抄运行）

```bash
mkdir -p /home/claude/work && cd /home/claude/work && rm -rf repo START_HERE.md VERSION.txt FIX.md
unzip -q -o "$(ls -t /mnt/user-data/uploads/{stem}*.zip | head -1)"
cd repo && python3 tools/bk.py start {task}
```

`bk start` 会检查环境、安装依赖、建好任务分支，并打印**任务简报**。之后一切以任务简报为准。{fixline}

## 2. 读什么

- 只读任务简报「必读」里列出的文件；「按需查」的先用 `grep -rn`（或 `rg`）搜到位置再看局部；「不要读」的一律不看。不要通读仓库。
- 原型不要打开 HTML 源码读：用 `python3 tools/bk.py spec <页ID>` 看页面说明，用 `python3 tools/bk.py proto <页ID> --views` 截图后看图。
- 看一眼包根目录的 RECENT.md：最近做了什么、哪些任务正在并行（别改它们的范围）。
- 动手前，在对话里用 5 行以内说清你打算怎么做（不用等确认，说完就做）。
- `bk done` 会拦下：越界改动、改热点文件、删除或跳过测试、数据结构冻结前写迁移文件。

## 3. 做完怎么交

1. 每做完一个能运行的小步就 `git commit`。
2. 自查：`python3 tools/bk.py verify --level web`
3. 填交接单：`progress/reports/{task}-r{round}.md`（模板已生成，全部大白话）。
4. 收工：`python3 tools/bk.py done` —— 检查改动范围、跑验证、把结果包放到 `/mnt/user-data/outputs/`。把这个结果包提供给用户下载。
5. 在对话里用大白话告诉用户：做了什么；在本地怎么看效果；需要他拍板的问题（每条给选项、你的推荐、你先按哪个做了）。

## 4. 意外情况

- 沙箱重置、文件不见了：重新运行第 1 步，最后一条命令改成 `python3 tools/bk.py start {task} --resume`。
- 任务做了 40 分钟以上：先运行 `python3 tools/bk.py done --checkpoint`，把检查点包给用户下载，再继续。
- 依赖装不上：多半是网络关了。照常写代码，只跑能跑的检查，在交接单「风险与提醒」里写明，并提醒用户：设置 → 功能（Capabilities）→ 打开「代码执行与文件创建」和网络访问。
- 业务上拿不准：按「原型 → docs/baseline → 最保守的做法」取一个默认，先做下去，把问题写进交接单「需要你拍板」。不要停下来等。
"""

START_CONTINUE = """# 从这里开始（接续）

这是任务 **{task}　{title}** 的{kind}（基于 {ver}，第 {round} 轮）。用来在新对话里接着做，或沙箱重置后恢复。

```bash
mkdir -p /home/claude/work && cd /home/claude/work && rm -rf repo START_HERE.md VERSION.txt FIX.md RESULT.md
unzip -q -o "$(ls -t /mnt/user-data/uploads/{stem}*.zip | head -1)"
cd repo && python3 tools/bk.py start {task} --resume
```

然后先读 `progress/reports/{task}-r{round}.md`（上一轮的交接单），再按任务简报继续。其余规则与任务包相同：只读「必读」，小步提交，`python3 tools/bk.py done` 出结果包，最后用大白话汇报。
"""

START_VERSION = """# 从这里开始

这是「{project}」的版本包 **{ver}**（完整仓库，含进度与历史）。用户会告诉你要做的任务编号。

```bash
mkdir -p /home/claude/work && cd /home/claude/work && rm -rf repo START_HERE.md VERSION.txt FIX.md
unzip -q -o "$(ls -t /mnt/user-data/uploads/{stem}*.zip | head -1)"
cd repo && python3 tools/bk.py status
```

拿到任务编号后运行 `python3 tools/bk.py start <任务编号>`，之后按它打印的任务简报做，规则与任务包相同：只读「必读」，小步提交，填交接单，`python3 tools/bk.py done` 出结果包给用户下载，最后用大白话汇报。临时修复用 `python3 tools/bk.py start fix --title "一句话描述"`。
"""


def make_package(root: Path, cfg: dict, kind: str, task: dict | None, rnd: int, ref: str,
                 base_commit: str, base_ver: str, out_dir: Path, name: str, fix_text: str = "",
                 branch: str = "") -> Path:
    tmp = Path(tempfile.mkdtemp(prefix="bkpack-"))
    try:
        repo = tmp / "repo"
        depth = int(cfg["pack_depth"]) * (4 if kind == "fix" else 1)
        for attempt in (depth, 1):
            if repo.exists():
                shutil.rmtree(repo)
            prepare_repo_copy(root, cfg, repo, ref, branch or "bk-pack", attempt)
            meta = {"kind": kind, "version": base_ver, "base": base_commit, "task": task["id"] if task else None,
                    "title": task.get("title") if task else None, "round": rnd, "branch": branch or None,
                    "created": now(), "tool": TOOL_VERSION}
            save_json(repo / ".bk" / "package.json", meta)
            stem = name[:-4]
            if kind == "version":
                start = START_VERSION.format(project=cfg["project"], ver=base_ver, stem=stem)
            else:
                fixline = "\n\n**这是修复包：开工后先读包根目录的 FIX.md（失败的检查与日志）。**" if kind == "fix" else ""
                start = START_TASK.format(project=cfg["project"], task=task["id"], title=task.get("title", ""),
                                          ver=base_ver, round=rnd, stem=stem, fixline=fixline)
            (tmp / "START_HERE.md").write_text(start, encoding="utf-8")
            (tmp / "VERSION.txt").write_text(
                f"包：{name}\n种类：{kind}\n版本：{base_ver}\n基于提交：{base_commit}\n"
                f"任务：{task['id'] if task else '-'}\n轮次：{rnd}\n生成：{now()}\n", encoding="utf-8")
            if fix_text:
                (tmp / "FIX.md").write_text(fix_text, encoding="utf-8")
            (tmp / "RECENT.md").write_text(recent_text(root, cfg, task), encoding="utf-8")
            zpath = out_dir / name
            if zpath.exists():
                zpath.unlink()
            with zipfile.ZipFile(zpath, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
                for f in ("START_HERE.md", "VERSION.txt", "FIX.md", "RECENT.md"):
                    if (tmp / f).exists():
                        zf.write(tmp / f, f)
                add_tree(zf, repo, "repo/", cfg["exclude"], cfg.get("keep_env_files", []))
            size_mb = zpath.stat().st_size / 1024 / 1024
            if size_mb <= cfg["zip_limit_mb"]:
                return zpath
            say(f"  包有 {size_mb:.1f} MB，超过 {cfg['zip_limit_mb']} MB，改为只带最近 1 个提交再试……")
        raise BkError(f"包仍然超过 {cfg['zip_limit_mb']} MB（claude.ai 单个文件上限 30 MB）。"
                      "请检查仓库里是否提交了大文件（截图、视频、数据集），把它们移出仓库或加入 .gitignore。")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def recent_text(root: Path, cfg: dict, task: dict | None) -> str:
    L = ["# 最近发生了什么（只读，帮你避免和并行任务撞车）", ""]
    cl = root / "progress" / "changelog.md"
    lines = [x for x in (cl.read_text(encoding="utf-8").splitlines() if cl.exists() else []) if x.startswith("- ")]
    L += ["## 最近的版本", ""] + (lines[-10:] or ["（还没有）"]) + [""]
    inflight = load_json(root / ".bk" / "inflight.json", {}) or {}
    tm = task_map(tasks_doc(root))
    others = [(k, v) for k, v in inflight.items() if not task or k != task["id"]]
    L += ["## 正在并行的其他任务（不要改它们的范围；需要它们的东西，先在本页内做，交接单里说明）", ""]
    if not others:
        L.append("（没有）")
    for k, v in others:
        t = tm.get(k)
        owns = expand_task(t, cfg)["owns"][:6] if t else []
        L.append(f"- {k} {t.get('title', '') if t else ''}：" + "、".join(owns))
    return "\n".join(L) + "\n"


def copy_to_windows(p: Path) -> Path | None:
    dl = win_downloads()
    if not dl:
        return None
    d = dl / "bk-出包"
    try:
        d.mkdir(exist_ok=True)
        shutil.copy2(p, d / p.name)
        return d / p.name
    except OSError:
        return None


def claude_prompt(zname: str, kind: str) -> str:
    if kind == "fix":
        return (f"我上传了修复包 {zname}。请解压后读包根目录的 START_HERE.md 和 FIX.md，按要求修好，"
                "照常出结果包给我下载，并用大白话告诉我改了什么、怎么确认修好了。")
    return (f"我上传了 {zname}。请解压后先读包根目录的 START_HERE.md 并严格照做。最后把结果包给我下载，"
            "并用大白话告诉我：做了什么、怎么看效果、需要我拍板的问题。")


def print_handover(p: Path, kind: str, task: dict | None) -> None:
    say(f"✓ 已出包：{p.name}（{p.stat().st_size / 1024 / 1024:.1f} MB）")
    say(f"  位置：{win_path(p)}")
    w = copy_to_windows(p)
    if w:
        say(f"  也复制到了：{win_path(w)}")
    title = f"[{task['id']}] {task.get('title', '')}" if task else p.stem
    say("\n接下来你做：")
    if kind == "fix":
        say("  1. 回到这个任务原来的 Claude 对话（对话太长就新开一个）")
    else:
        say(f"  1. 打开 claude.ai，新建对话（建议把对话标题改成：{title}）")
    say("  2. 上传这个压缩包")
    say("  3. 粘贴下面这段话：")
    say("────────────────────────────────")
    say(claude_prompt(p.name, kind))
    say("────────────────────────────────")


# ───────────────────────── 简报 ─────────────────────────

def brief(root: Path, cfg: dict, task: dict, rnd: int, base_ver: str, base: str, branch: str, caps: dict) -> str:
    ex = expand_task(task, cfg)
    env = env_kind()
    L = []
    bar = "═" * 56
    L += [bar, f"任务简报  {task['id']} · {task.get('title', '')}", bar]
    L.append(f"基于：{base_ver}（{base[:8]}）  第 {rnd} 轮  分支：{branch}")
    L.append(f"等级：{LEVEL_CN.get(task.get('level', 'B'), task.get('level', ''))}  车道：{task.get('lane', '-')}  "
             f"环境：{'网页端' if env == 'web' else '本地'}")
    if caps:
        L.append("环境：" + caps_line(caps))
    deps = task.get("deps") or []
    if deps:
        tm = task_map(tasks_doc(root))
        undone = [d for d in deps if tm.get(d, {}).get("status") != "done"]
        if undone:
            L.append(f"⚠ 依赖还没完成：{'、'.join(undone)}（能做的先做，做不了的写进交接单）")
    L.append("")
    L.append("【目标】")
    L.append(task.get("goal") or task.get("title", ""))
    if task.get("notes"):
        L.append("说明：" + task["notes"])
    if task.get("pages"):
        pmap = {p["id"]: p for p in pages_doc(root).get("pages", [])}
        L.append("涉及页面：" + "、".join(f"{p} {pmap.get(p, {}).get('name', '')}（路由 {pmap.get(p, {}).get('route', '?')}）" for p in task["pages"]))
    L.append("")
    L.append("【验收】（全部做到才算完成）")
    for i, a in enumerate(ex["accept"], 1):
        L.append(f"{i}. {a}")
    if ex["not"]:
        L.append("")
        L.append("【不做】")
        L += [f"- {x}" for x in ex["not"]]
    L.append("")
    L.append("【你只能改这些位置】（改别处要在交接单里写理由；热点文件和进度文件不能改）")
    L += [f"- {x}" for x in (ex["owns"] or ["（未限定）"])]
    L.append("  另外总是允许：progress/reports/**、docs/decisions/**")
    L.append("")
    L.append("【必读】（按顺序，读全文；✗ 表示仓库里还没有，跳过）")
    n = 0
    for r in ex["reads"]:
        n += 1
        path = r.split("#")[0].split("（")[0].strip()
        mark = "" if r.startswith("运行") else (" ✓" if (root / path).exists() else " ✗")
        L.append(f"{n}. {r}{mark}")
    if ex["proto"]:
        for p in task.get("pages", []):
            n += 1
            L.append(f"{n}. 运行：python3 tools/bk.py spec {p}      ← {p} 的原型说明（功能点、布局、七态）")
            if ex["proto"] != "spec":
                n += 1
                L.append(f"{n}. 运行：python3 tools/bk.py proto {p} --views --widths 375,834,1280   ← 截图，然后用图片查看工具看 .bk/proto/{p}/")
    if ex["lookup"]:
        L.append("")
        L.append("【按需查】（先用 grep -rn 或 rg 搜索，只看相关的几十行）")
        L += [f"- {x}" for x in ex["lookup"]]
    L.append("")
    L.append("【不要读】")
    wanted = [x.split("（")[0].strip() for x in ex["reads"] + ex["lookup"]]
    nr = [x for x in cfg["never_read"]
          if not any(w.startswith(x.split("（")[0].strip().rstrip("*").rstrip("/")) for w in wanted if w)]
    L.append("- " + "、".join(nr) + "；以及与本任务无关的其他页面和领域目录")
    L.append("")
    L.append(f"【交接单】progress/reports/{task['id']}-r{rnd}.md（{'模板已生成' if branch.startswith('task/') else '开工后生成模板'}）")
    if env == "web":
        L.append("【收工】python3 tools/bk.py done   （超过 40 分钟先 done --checkpoint）")
    else:
        L.append("【收工】python3 tools/bk.py done   （本地会跑完整验证，通过后自动并入主干、打版本号、出版本包）")
    L.append(bar)
    return "\n".join(L)


# ───────────────────────── 命令：start / task ─────────────────────────

def session_path(root: Path) -> Path:
    return bkdir(root) / "session.json"


def resume_from_outputs(task_id: str) -> Path | None:
    cands = []
    for d in (outputs_dir(), uploads_dir()):
        if d.is_dir():
            cands += [p for p in d.glob(f"bk-v*-{task_id}-r*.zip")]
    return max(cands, key=lambda p: p.stat().st_mtime) if cands else None


def cmd_start(args) -> None:
    task_id = args.task
    if args.resume and env_kind() == "web":
        here = find_root()
        sess = load_json(here / ".bk" / "session.json", None)
        cur = load_json(here / ".bk" / "package.json", {}) or {}
        z = resume_from_outputs(task_id if task_id != "fix" else "X")
        # 当前仓库是原始任务包、又找到了更新的检查点包或结果包：就地换成新的内容（不删目录本身，免得终端所在目录失效）
        if z and not sess and cur.get("kind") in ("task", "version", "fix", None):
            say(f"· 从 {z.name} 接续（沙箱里没有进行中的会话）")
            tmp = Path(tempfile.mkdtemp(prefix="bkresume-"))
            safe_extract(z, tmp)
            if (tmp / "repo" / ".git").exists():
                for child in list(here.iterdir()):
                    shutil.rmtree(child) if child.is_dir() and not child.is_symlink() else child.unlink()
                for child in list((tmp / "repo").iterdir()):
                    shutil.move(str(child), str(here / child.name))
            shutil.rmtree(tmp, ignore_errors=True)
    root = find_root()
    cfg = load_config(root)
    ensure_local_exclude(root)
    meta = load_json(root / ".bk" / "package.json", {}) or {}
    sess = load_json(session_path(root), None)
    if task_id == "fix":
        task_id = new_adhoc_id(root)
    if sess and sess.get("task") == task_id and current_branch(root) == sess.get("branch"):
        task = get_task(root, cfg, task_id, sess.get("title", ""))
        say(f"· 继续进行中的会话：{task_id} 第 {sess['round']} 轮")
        rnd, base, base_ver, branch = sess["round"], sess["base"], sess["version"], sess["branch"]
    else:
        task = get_task(root, cfg, task_id, args.title or "")
        if meta.get("kind") in ("fix", "checkpoint") and meta.get("task") == task_id and meta.get("branch"):
            rnd, base, base_ver, branch = meta["round"], meta["base"], meta["version"], meta["branch"]
            if current_branch(root) != branch:
                git(root, "checkout", "--quiet", branch)
        elif meta.get("kind") == "result" and meta.get("task") == task_id:
            rnd, base, base_ver = int(meta["round"]) + 1, meta["base"], meta["version"]
            branch = f"task/{task_id}-r{rnd}"
            git(root, "checkout", "--quiet", "-B", branch)
        elif env_kind() == "local" and args.from_failed:
            ref = f"refs/bk/in/{args.from_failed}"
            if not git(root, "rev-parse", "--verify", "-q", ref, check=False):
                die(f"找不到 {ref}。用 git for-each-ref refs/bk/in 查看可用的失败结果。")
            prev = load_json(bkdir(root) / "failed.json", {}).get(args.from_failed, {})
            rnd = int(args.from_failed.rsplit("-r", 1)[1]) + 1
            base, base_ver = prev.get("base", git(root, "rev-parse", "main")), prev.get("version", vstr(current_version(root)))
            branch = f"task/{task_id}-r{rnd}"
            git(root, "checkout", "--quiet", "-B", branch, ref)
        else:
            if env_kind() == "local":
                if not worktree_clean(root):
                    die("工作区有没提交的改动。先提交或丢弃（git status 查看），再开工。")
                git(root, "checkout", "--quiet", cfg["main_branch"])
            if env_kind() == "local" and not args.force:
                clash = owns_clash(root, cfg, task)
                if clash:
                    die("和正在进行的任务改动范围重叠，现在做会冲突：\n  " + "\n  ".join(clash) + "\n等它们收包后再做，或加 --force。")
            rnd = next_round(root, task_id)
            base = git(root, "rev-parse", "HEAD")
            base_ver = meta.get("version") or vstr(current_version(root))
            branch = f"task/{task_id}-r{rnd}"
            if env_kind() == "local":
                inflight = load_json(bkdir(root) / "inflight.json", {}) or {}
                inflight[task_id] = {"status": "doing", "round": rnd, "time": now(), "package": "本地（Codex）"}
                save_json(bkdir(root) / "inflight.json", inflight)
            if git(root, "rev-parse", "--verify", "-q", f"refs/heads/{branch}", check=False):
                git(root, "checkout", "--quiet", branch)
            else:
                git(root, "checkout", "--quiet", "-b", branch)
        sess = {"task": task_id, "title": task.get("title", ""), "round": rnd, "base": base,
                "version": base_ver, "branch": branch, "started": now()}
        save_json(session_path(root), sess)
    make_report_template(root, task, rnd)
    install = env_kind() == "web" or args.install
    caps = probe(root, install=install and not args.no_install)
    if args.with_db and (root / "tools" / "sandbox-db.sh").exists():
        say("· 尝试在沙箱里启动数据库（tools/sandbox-db.sh）……")
        r = sh(["bash", "tools/sandbox-db.sh"], cwd=root, check=False, timeout=900)
        say(tail((r.stdout or "") + (r.stderr or ""), 8))
        caps["db"] = db_reachable(root)
        save_json(bkdir(root) / "env.json", caps)
    if env_kind() == "web" and caps.get("network") is False:
        say("⚠ 沙箱连不上 npm：请提醒用户在 设置 → 功能 里打开「代码执行与文件创建」的网络访问。")
    say(brief(root, cfg, task, rnd, base_ver, base, branch, caps))
    if (root.parent / "FIX.md").exists() and meta.get("kind") == "fix":
        say("\n这是修复包：先读 ../FIX.md")


def cmd_task(args) -> None:
    root = find_root()
    cfg = load_config(root)
    task = get_task(root, cfg, args.task)
    say(brief(root, cfg, task, next_round(root, args.task), vstr(current_version(root)),
              git(root, "rev-parse", "HEAD"), "（未开工）", load_json(root / ".bk" / "env.json", {}) or {}))


# ───────────────────────── 命令：verify ─────────────────────────

def cmd_verify(args) -> None:
    root = find_root()
    cfg = load_config(root)
    level = args.level or ("web" if env_kind() == "web" else "full")
    s = do_verify(root, cfg, level)
    sys.exit(0 if s["verdict"] == "pass" else (3 if s["verdict"] == "env" else 1))


# ───────────────────────── 范围检查 ─────────────────────────

def diff_files(root: Path, base: str, head: str = "HEAD") -> list[tuple[str, str]]:
    out = git(root, "diff", "--name-status", "-M", base, head)
    files = []
    for line in out.splitlines():
        parts = line.split("\t")
        st = parts[0][0]
        files.append((st, parts[-1]))
        if st == "R" and len(parts) == 3:
            files.append(("D", parts[1]))
    return files


def scope_check(cfg: dict, ex: dict, files: list[tuple[str, str]], allow_hot: bool) -> tuple[list, list, list]:
    owns = ex["owns"]
    allowed = cfg["always_allowed"]
    hub = [f for s, f in files if match_any(f, cfg["hub_only"])]
    hot = [f for s, f in files if f not in hub and match_any(f, cfg["hot_paths"])
           and not match_any(f, owns) and not match_any(f, allowed)]
    outside = [f for s, f in files if f not in hub and f not in hot and owns != ["**"]
               and not match_any(f, owns) and not match_any(f, allowed)]
    if allow_hot:
        outside += hot
        hot = []
    return hub, hot, outside


SKIP_RE = re.compile(r"\b(?:it|test|describe|suite)\.(?:skip|only|todo|fixme)\b|\b(?:xit|xdescribe|fit|fdescribe)\s*\(")


def guard_checks(root: Path, cfg: dict, base: str, head: str = "HEAD") -> tuple[list[str], list[str]]:
    """返回（测试被削弱的问题, 冻结前写迁移的问题）。"""
    files = diff_files(root, base, head)
    tests = [f for f in files if match_any(f[1], cfg["test_globs"]) or
             any(fnmatch.fnmatchcase(Path(f[1]).name, g) for g in cfg["test_globs"] if "/" not in g)]
    weak = [f"删除了测试文件 {f}" for st, f in tests if st == "D"]
    for st, f in tests:
        if st == "D":
            continue
        d = git(root, "diff", "-U0", base, head, "--", f, check=False)
        for line in d.splitlines():
            if line.startswith("+") and not line.startswith("+++") and SKIP_RE.search(line):
                weak.append(f"{f} 新增了跳过或只跑部分测试：{line[1:].strip()[:80]}")
    frozen = []
    if not cfg.get("schema_frozen"):
        frozen = [f"{f}（数据结构冻结前不写迁移文件：改 schema 后用 prisma db push 和种子重建）"
                  for st, f in files if st != "D" and match_any(f, cfg.get("freeze_paths", []))]
    return weak, frozen


def report_unfilled(text: str) -> list[str]:
    return [t for t in ("一句话", "怎么看效果", "做了什么") if "（待填" in report_section(text, t)]


# ───────────────────────── 命令：done ─────────────────────────

def cmd_done(args) -> None:
    root = find_root()
    cfg = load_config(root)
    sess = load_json(session_path(root), None)
    if not sess:
        die("没有进行中的任务。先运行 bk start <任务编号>。")
    task = get_task(root, cfg, sess["task"], sess.get("title", ""))
    ex = expand_task(task, cfg)
    if current_branch(root) != sess["branch"]:
        die(f"当前不在任务分支 {sess['branch']} 上（现在是 {current_branch(root)}）。")
    git(root, "add", "-A")
    if git(root, "status", "--porcelain"):
        git(root, "commit", "-q", "-m", f"{task['id']} r{sess['round']}：{task.get('title', '')}（{'检查点' if args.checkpoint else '收工'}）")
    rp = report_path(root, task["id"], sess["round"])
    if not rp.exists():
        make_report_template(root, task, sess["round"])
    files = diff_files(root, sess["base"])
    hub, hot, outside = scope_check(cfg, ex, files, args.allow_hot is not None)
    if hub:
        die("这些进度文件只能由本地工具改，请撤销后再收工：\n  " + "\n  ".join(hub) +
            f"\n撤销命令：git checkout {sess['base'][:10]} -- <文件>；页面和任务状态请写进交接单数据块。")
    if hot and not args.checkpoint:
        die("改到了热点文件（公共组件、依赖、路由、地基文档、锁定的规则测试与黄金路径等），这会和并行的任务冲突：\n  " + "\n  ".join(hot) +
            "\n要么撤销这些改动、把需要写进交接单「风险与提醒」；要么确有必要时运行：bk done --allow-hot \"理由\"")
    weak, frozen = guard_checks(root, cfg, sess["base"])
    if frozen and not args.checkpoint:
        die("现在还没到数据结构冻结，不能提交迁移文件：\n  " + "\n  ".join(frozen))
    if weak and not args.checkpoint and args.allow_test_change is None:
        die("测试被削弱了（删除测试、跳过测试或只跑部分测试），这会让“全绿”失去意义：\n  " + "\n  ".join(weak) +
            "\n请恢复这些测试；确实是测试本身错了，改对它而不是删掉。实在需要时：bk done --allow-test-change \"理由\"（会记进交接单，收包时提示）")
    if args.checkpoint:
        summary = {"level": "none", "verdict": "pass", "results": [], "time": now()}
    else:
        try:
            data, text = read_report(rp)
        except BkError as e:
            die(str(e))
        miss = report_unfilled(text)
        if miss:
            die(f"交接单还没填完：{'、'.join(miss)}。文件：{rp.relative_to(root)}")
        level = args.level or ("web" if env_kind() == "web" else "full")
        only_docs = files and all(re.search(r"\.(md|json|ya?ml|txt)$", f) and not f.startswith(("apps/", "packages/")) for _, f in files)
        if only_docs and not args.level:
            level = "quick"
        if env_kind() == "local" and not args.level:
            summary = {"level": "full（并入主干时运行）", "verdict": "pass", "results": [], "time": now()}
        else:
            summary = do_verify(root, cfg, level)
        if summary["verdict"] == "fail" and not args.force:
            die("验证没通过：先修好再收工（或在交接单写明原因后用 --force 交出半成品，状态写 partial）。")
    if not args.checkpoint:
        data, _ = read_report(rp)
        data.update({"tool": "claude-web" if env_kind() == "web" else "local", "base": sess["base"],
                     "version": sess["version"], "checks": {r["name"]: r["result"] for r in summary["results"]},
                     "verify_level": summary["level"], "out_of_scope": outside,
                     "allow_hot": args.allow_hot or "",
                     "allow_test_change": args.allow_test_change or "",
                     "changed": {"added": [f for s, f in files if s == "A"],
                                 "modified": [f for s, f in files if s in "MR"],
                                 "deleted": [f for s, f in files if s == "D"]}})
        write_report_data(rp, data)
        git(root, "add", "-A")
        if git(root, "status", "--porcelain"):
            git(root, "commit", "-q", "-m", f"交接单 {task['id']} r{sess['round']}")
    if outside:
        say("⚠ 范围外改动（已记入交接单，收包时会提示）：\n  " + "\n  ".join(outside))
    if is_cloud():
        say(f"\n✓ 已提交到分支 {sess['branch']}。请推送：git push -u origin {sess['branch']}")
        say(f"  然后告诉用户：在本地对 Codex 说“收分支 {sess['branch']}”（它会运行 bk in --branch {sess['branch']}）。")
        return
    if env_kind() == "web":
        od = outputs_dir()
        od.mkdir(parents=True, exist_ok=True)
        suffix = "ckpt" if args.checkpoint else "done"
        name = f"bk-{sess['version']}-{task['id']}-r{sess['round']}-{suffix}.zip"
        k = 2
        while (od / name).exists():
            name = f"bk-{sess['version']}-{task['id']}-r{sess['round']}-{suffix}-{k}.zip"
            k += 1
        tmp = Path(tempfile.mkdtemp(prefix="bkdone-"))
        try:
            z = od / name
            with zipfile.ZipFile(z, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
                zf.write(rp, "RESULT.md")
                meta = {"kind": "checkpoint" if args.checkpoint else "result", "version": sess["version"],
                        "base": sess["base"], "task": task["id"], "title": task.get("title", ""),
                        "round": sess["round"], "branch": sess["branch"], "head": git(root, "rev-parse", "HEAD"),
                        "created": now(), "tool": TOOL_VERSION}
                save_json(root / ".bk" / "package.json", meta)
                zf.writestr("VERSION.txt", f"包：{name}\n任务：{task['id']} 第 {sess['round']} 轮\n基于：{sess['version']}（{sess['base'][:10]}）\n"
                                           f"结果提交：{meta['head'][:10]}\n生成：{now()}\n")
                zf.writestr("START_HERE.md", START_CONTINUE.format(
                    task=task["id"], title=task.get("title", ""), kind="检查点包" if args.checkpoint else "结果包",
                    ver=sess["version"], round=sess["round"], stem=name[:-4]))
                add_tree(zf, root, "repo/", cfg["exclude"], cfg.get("keep_env_files", []))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        size = z.stat().st_size / 1024 / 1024
        say(f"\n✓ {'检查点包' if args.checkpoint else '结果包'}：{z}（{size:.1f} MB）")
        if size > 30:
            say("⚠ 超过 30 MB，用户可能下载不了：请检查是否把大文件提交进了仓库。")
        say("请把这个文件提供给用户下载，然后用大白话汇报。" if not args.checkpoint else
            "请把检查点包提供给用户下载（只用于沙箱重置后接续，不要拿去收包），然后继续工作。")
        return
    # 本地：直接集成
    if args.checkpoint:
        say("本地不需要检查点包：提交已保存在分支上。")
        return
    ref = sess["branch"]
    integrate(root, cfg, ref, rp.relative_to(root).as_posix(), zip_name=None, task=task, sess=sess)


# ───────────────────────── 集成（in / 本地 done 共用） ─────────────────────────

def integrate(root: Path, cfg: dict, ref: str, report_rel: str, zip_name: str | None, task: dict,
              sess: dict, zpath: Path | None = None, resume: bool = False) -> bool:
    main = cfg["main_branch"]
    if not resume:
        git(root, "checkout", "--quiet", main)
        git(root, "checkout", "--quiet", "-B", "bk/integrate", main)
        r = sh(["git", "merge", "--no-ff", "--no-edit", "-m", f"并入 {task['id']} r{sess['round']}：{task.get('title', '')}", ref],
               cwd=root, check=False)
        if r.returncode != 0:
            conflicts = git(root, "diff", "--name-only", "--diff-filter=U", check=False)
            save_json(bkdir(root) / "pending.json", {"ref": ref, "report": report_rel, "zip": zip_name,
                                                     "task": task["id"], "sess": sess,
                                                     "zpath": str(zpath) if zpath else None})
            say("✗ 合并有冲突（主干没有动）。冲突文件：\n  " + "\n  ".join(conflicts.splitlines() or ["（见 git status）"]))
            say("处理办法（让 Codex 做）：在当前分支 bk/integrate 上解决冲突，保留双方的改动；"
                "git add 之后运行：python3 tools/bk.py in --continue\n放弃这次合并：python3 tools/bk.py in --abort")
            return False
    # 进度文件只认主干上的版本
    for f in cfg["hub_only"]:
        if (root / f).exists() or git(root, "cat-file", "-e", f"{main}:{f}", check=False) == "":
            sh(["git", "checkout", main, "--", f], cwd=root, check=False)
    if git(root, "status", "--porcelain"):
        git(root, "commit", "-q", "-m", "还原进度文件（只由本地工具维护）")
    data_in = {}
    try:
        raw = git(root, "show", f"bk/integrate:{report_rel}", check=False)
        m_ = REPORT_RE.search(raw or "")
        data_in = json.loads(m_.group(1)) if m_ else {}
    except Exception:
        data_in = {}
    weak, frozen = guard_checks(root, cfg, main, "bk/integrate")
    if frozen or (weak and not data_in.get("allow_test_change")):
        git(root, "checkout", "--quiet", "-f", main)
        git(root, "branch", "-D", "bk/integrate", check=False)
        fake = {"results": [{"name": "护栏检查", "result": "fail", "note": "", "log": None}]}
        make_fix_package(root, cfg, ref, task, sess, fake, zip_name,
                         notes="## 护栏检查没通过\n\n" + "\n".join(f"- {x}" for x in frozen + weak) +
                               "\n\n恢复被删或被跳过的测试；冻结前不写迁移文件。")
        return False
    if weak:
        say("  ⚠ 这个结果改动了测试，理由：" + data_in.get("allow_test_change", ""))
    changed = git(root, "diff", "--name-only", main, "bk/integrate").splitlines()
    if any(x == "pnpm-lock.yaml" or x.endswith("package.json") for x in changed) or (
            (root / "package.json").exists() and not (root / "node_modules").exists()):
        caps = {}
        ensure_deps(root, caps, force=True)
    summary = do_verify(root, cfg, "full")
    if summary["verdict"] == "env":
        save_json(bkdir(root) / "pending.json", {"ref": ref, "report": report_rel, "zip": zip_name,
                                                 "task": task["id"], "sess": sess, "merged": True,
                                                 "zpath": str(zpath) if zpath else None})
        say("! 被环境问题卡住了（不是代码问题）。按上面的提示处理好环境后运行：python3 tools/bk.py in --continue")
        return False
    if summary["verdict"] == "fail":
        git(root, "checkout", "--quiet", "-f", main)
        git(root, "branch", "-D", "bk/integrate", check=False)
        make_fix_package(root, cfg, ref, task, sess, summary, zip_name)
        return False
    gate = task.get("gate")
    if gate in ("look", "review"):
        save_json(bkdir(root) / "pending.json", {"ref": ref, "report": report_rel, "zip": zip_name, "task": task["id"],
                                                 "sess": sess, "verified": True, "gate": gate, "summary": summary,
                                                 "zpath": str(zpath) if zpath else None})
        say("")
        say(f"✓ {task['id']} 已通过全部检查，按设定先停在合并前（现在仓库停在待合并的分支 bk/integrate 上）。")
        if gate == "look":
            say("  请你先看效果：运行 python3 tools/bk.py run，打开网址看这个任务的页面。")
        else:
            say("  这是规则类任务：请 Codex 先复查改动，只看三件事——和规则卡是否一致、有没有绕过地基（词汇、参数、组件、接口约定）、有没有明显的安全问题。")
        say("  满意：python3 tools/bk.py in --continue（合并、打版本号）")
        say("  不满意：python3 tools/bk.py in --reject \"你看到的问题\"（主干不动，出一个修复包回给 Claude）")
        return False
    complete_merge(root, cfg, ref, report_rel, summary, task, sess, zip_name, zpath)
    return True


def complete_merge(root: Path, cfg: dict, ref: str, report_rel: str, summary: dict, task: dict, sess: dict,
                   zip_name: str | None, zpath: Path | None) -> None:
    main = cfg["main_branch"]
    git(root, "checkout", "--quiet", main)
    git(root, "merge", "--quiet", "--ff-only", "bk/integrate")
    git(root, "branch", "-D", "bk/integrate", check=False)
    if ref.startswith("task/"):
        git(root, "branch", "-d", ref, check=False)
    (bkdir(root) / "pending.json").unlink(missing_ok=True)
    finalize(root, cfg, report_rel, summary, task, sess, zip_name, zpath)


def make_fix_package(root: Path, cfg: dict, ref: str, task: dict, sess: dict, summary: dict, zip_name: str | None,
                     notes: str = "") -> None:
    rnd = int(sess["round"]) + 1
    failed = load_json(bkdir(root) / "failed.json", {}) or {}
    key = f"{task['id']}-r{sess['round']}"
    failed[key] = {"ref": ref, "base": sess["base"], "version": sess["version"], "time": now()}
    save_json(bkdir(root) / "failed.json", failed)
    lines = [f"# 修复说明：{task['id']} 第 {sess['round']} 轮没通过本地完整验证", "",
             f"- 基于版本：{sess['version']}；你上一轮的提交都在当前分支上（第 {rnd} 轮）。",
             "- 主干没有合并这次结果。修好后照常 `python3 tools/bk.py done` 出结果包。",
             "- 修法：先读下面的失败日志，找到根因；能写复现测试的先写测试再修；改完先跑 `python3 tools/bk.py verify --level web`。",
             "- 本地完整验证比网页端多：数据库测试、完整画廊。网页端跑不了的，就把推断写进交接单。", "",
             ]
    if notes:
        lines += [notes, ""]
    if any(r["result"] == "fail" for r in summary["results"]) and not notes:
        lines += ["## 失败的检查", ""]
    for r in summary["results"]:
        if r["result"] == "fail":
            log = (root / r["log"]).read_text(encoding="utf-8", errors="replace") if r.get("log") else ""
            lines += [f"### {r['name']}", "", "```text", tail(log, 80), "```", ""]
    fix_text = "\n".join(lines)
    out = handoff(root, cfg, "fixes")
    name = f"bk-{sess['version']}-{task['id']}-r{rnd}-fix.zip"
    z = make_package(root, cfg, "fix", task, rnd, ref, sess["base"], sess["version"], out, name,
                     fix_text=fix_text, branch=f"task/{task['id']}-r{rnd}")
    inflight = load_json(bkdir(root) / "inflight.json", {}) or {}
    inflight[task["id"]] = {"status": "fixing", "round": rnd, "time": now(), "package": name}
    save_json(bkdir(root) / "inflight.json", inflight)
    if rnd > int(cfg.get("max_rounds", 3)):
        say(f"\n⚠ 熔断提醒：{task['id']} 已经到第 {rnd} 轮。建议先停一下，三选一（由你拍板）：拆成更小的任务；换工具（Claude 和 Codex 互换）；改规则卡或范围。")
    if notes and "老板看到的问题" in notes:
        say("\n✗ 已退回，主干没有动。")
    else:
        say("\n✗ 没通过本地检查，主干没有动。")
        say("  失败的检查：" + "、".join(r["name"] for r in summary["results"] if r["result"] == "fail"))
    print_handover(z, "fix", task)
    say("\n也可以让 Codex 直接修（适合报错明确、改动小的情况）：")
    say(f"  对 Codex 说：按修复说明修 {task['id']}（它会运行 python3 tools/bk.py start {task['id']} --from-failed {key}）")


def bump_page(cur: str, new: str) -> str:
    if new.endswith("!"):
        return new[:-1]
    if new not in PAGE_STATUS:
        return cur
    return new


def finalize(root: Path, cfg: dict, report_rel: str, summary: dict, task: dict, sess: dict,
             zip_name: str | None, zpath: Path | None) -> None:
    data, text = read_report(root / report_rel)
    newv = current_version(root) + 1
    vs = vstr(newv)
    # 任务
    tdoc = tasks_doc(root)
    tm = task_map(tdoc)
    t = tm.get(task["id"])
    st = {"done": "done", "partial": "doing", "blocked": "blocked"}.get(data.get("status", "done"), "done")
    if t is not None:
        t["status"] = st
        t.setdefault("history", []).append({"round": sess["round"], "version": vs, "tool": data.get("tool", ""),
                                            "date": now(), "status": data.get("status", "done")})
    # 页面
    pdoc = pages_doc(root)
    changed_pages = []
    for key, val in (data.get("pages") or {}).items():
        for p in pdoc.get("pages", []):
            if fnmatch.fnmatchcase(p["id"], key):
                old = p.get("status", "todo")
                new = bump_page(old, str(val))
                if "*" in key and PAGE_STATUS.index(new) <= PAGE_STATUS.index(old):
                    continue
                if new != old:
                    p["status"] = new
                    p["updated"] = vs
                    changed_pages.append(f"{p['id']} {p.get('name', '')}：{PAGE_STATUS_CN.get(new, new)}")
    # 问题
    qdoc = load_json(root / "progress" / "questions.json", {"questions": []}) or {"questions": []}
    qids = {q["id"] for q in qdoc["questions"]}
    newq = []
    for i, q in enumerate(data.get("questions") or [], 1):
        qid = q.get("id") or f"{task['id']}-Q{i}"
        if not qid.startswith(task["id"]):
            qid = f"{task['id']}-{qid}"
        if qid in qids:
            continue
        qdoc["questions"].append({"id": qid, "task": task["id"], "q": q.get("q") or q.get("text", ""),
                                  "options": q.get("options", []), "recommend": q.get("recommend", ""),
                                  "temp": q.get("temp", ""), "status": "open", "asked": vs})
        newq.append(qid)
    for qid, ans in (data.get("answers") or {}).items():
        for q in qdoc["questions"]:
            if q["id"] == qid:
                q.update({"status": "answered", "answer": ans, "answered": vs})
    save_json(root / "progress" / "questions.json", qdoc)
    save_json(root / "progress" / "tasks.json", tdoc)
    save_json(root / "progress" / "pages.json", pdoc)
    one = report_section(text, "一句话").splitlines()[0] if report_section(text, "一句话") else ""
    cl = root / "progress" / "changelog.md"
    if not cl.exists():
        cl.write_text("# 版本记录\n\n> 由 bk 自动追加，一行一个版本。\n\n", encoding="utf-8")
    with cl.open("a", encoding="utf-8") as f:
        f.write(f"- **{vs}** {now()} · {task['id']} 第 {sess['round']} 轮 · {task.get('title', '')} · "
                f"{TASK_STATUS_CN.get(st, st)} · {one}\n")
    write_board(root, cfg)
    git(root, "add", "-A", "progress")
    git(root, "commit", "-q", "-m", f"进度 {vs}：{task['id']} r{sess['round']} {task.get('title', '')}", check=False)
    git(root, "tag", "-a", f"bk-{vs}", "-m", f"{vs} {task['id']} r{sess['round']} {task.get('title', '')}")
    inflight = load_json(bkdir(root) / "inflight.json", {}) or {}
    inflight.pop(task["id"], None)
    save_json(bkdir(root) / "inflight.json", inflight)
    snap = make_package(root, cfg, "version", None, 0, cfg["main_branch"], git(root, "rev-parse", "HEAD"), vs,
                        handoff(root, cfg, "versions"), f"bk-{vs}.zip")
    if zpath and zpath.exists():
        dest = handoff(root, cfg, "applied") / zpath.name
        try:
            shutil.move(str(zpath), str(dest))
        except OSError:
            pass
    sess_file = bkdir(root) / "session.json"
    if sess_file.exists():
        s = load_json(sess_file, {})
        if s.get("task") == task["id"]:
            sess_file.unlink()
    # 汇报
    say("")
    say(f"✓ 已并入主干，新版本 {vs}（{zip_name or '本地任务'}）")
    say(f"  任务：{task['id']} {task.get('title', '')} → {TASK_STATUS_CN.get(st, st)}")
    if one:
        say(f"  一句话：{one}")
    say(f"  检查：{checks_brief(summary)}")
    if changed_pages:
        say("  页面变化：" + "；".join(changed_pages))
    if data.get("out_of_scope"):
        say("  ⚠ 范围外改动：" + "、".join(data["out_of_scope"][:8]))
    gal = root / ".bk" / "gallery" / "changes.json"
    if gal.exists():
        ch = load_json(gal, {}) or {}
        if ch.get("changed"):
            say("  画廊里画面有变化的页面：" + "、".join(ch["changed"][:20]) + "（打开 .bk/gallery/index.html 对照）")
    if newq:
        say(f"  需要你拍板：{len(newq)} 条 → 见 progress/questions.md")
        for q in qdoc["questions"]:
            if q["id"] in newq:
                say(f"    {q['id']}：{q['q']}  推荐 {q.get('recommend', '')}；已先按 {q.get('temp', '') or '推荐'} 做")
    look = report_section(text, "怎么看效果")
    if look:
        say("  怎么看效果：" + " ".join(look.split())[:300])
    say(f"  新版本包：{win_path(snap)}")
    nxt = ready_tasks(root)[:5]
    if nxt:
        say("  下一步可以做：" + "；".join(f"{t['id']} {t.get('title', '')}【{t.get('level', '')}·{t.get('tool', '')}】" for t in nxt))
    say("  看效果：python3 tools/bk.py run    上传 GitHub：python3 tools/bk.py ship")


# ───────────────────────── 命令：in ─────────────────────────

def inbox_dirs(root: Path, cfg: dict) -> list[Path]:
    ds = []
    if os.environ.get("BK_INBOX"):
        ds.append(Path(os.environ["BK_INBOX"]))
    ds.append(handoff(root, cfg, "inbox"))
    w = win_downloads()
    if w:
        ds.append(w)
    ds.append(Path.home() / "Downloads")
    return [d for d in ds if d.is_dir()]


def find_results(root: Path, cfg: dict) -> list[Path]:
    seen, res = set(), []
    for d in inbox_dirs(root, cfg):
        for p in d.glob("bk-v*-r*-done*.zip"):
            if p.name in seen:
                continue
            seen.add(p.name)
            res.append(p)
    return sorted(res, key=lambda p: p.stat().st_mtime)


def cmd_in(args) -> None:
    root = find_root()
    cfg = load_config(root)
    if args.abort:
        sh(["git", "merge", "--abort"], cwd=root, check=False)
        git(root, "checkout", "--quiet", "-f", cfg["main_branch"])
        git(root, "branch", "-D", "bk/integrate", check=False)
        (bkdir(root) / "pending.json").unlink(missing_ok=True)
        say("已放弃这次合并，主干没有变化。")
        return
    if args.reject is not None:
        p = load_json(bkdir(root) / "pending.json", None)
        if not p or not p.get("verified"):
            die("没有停在合并前的结果。")
        task = get_task(root, cfg, p["task"], p["sess"].get("title", ""))
        git(root, "checkout", "--quiet", "-f", cfg["main_branch"])
        git(root, "branch", "-D", "bk/integrate", check=False)
        (bkdir(root) / "pending.json").unlink(missing_ok=True)
        notes = ("## 老板看到的问题\n\n" + args.reject.strip() + "\n\n## 这一轮只修这些\n\n只处理上面列出的问题；"
                 "能写复现测试的先写测试再修。\n\n## 不要动\n\n已经通过检查、没被提到的部分不要改；不要借机重构。")
        make_fix_package(root, cfg, p["ref"], task, p["sess"], {"results": []}, p.get("zip"), notes=notes)
        return
    if args.cont:
        p = load_json(bkdir(root) / "pending.json", None)
        if not p:
            die("没有待继续的收包。")
        if p.get("verified"):
            task = get_task(root, cfg, p["task"], p["sess"].get("title", ""))
            complete_merge(root, cfg, p["ref"], p["report"], p.get("summary") or {"results": []}, task, p["sess"],
                           p.get("zip"), Path(p["zpath"]) if p.get("zpath") else None)
            return
        if git(root, "diff", "--name-only", "--diff-filter=U", check=False):
            die("还有没解决的冲突文件（git status 查看）。")
        if git(root, "status", "--porcelain"):
            git(root, "add", "-A")
            git(root, "commit", "-q", "--no-edit", check=False)
        task = get_task(root, cfg, p["task"], p["sess"].get("title", ""))
        integrate(root, cfg, p["ref"], p["report"], p.get("zip"), task, p["sess"],
                  Path(p["zpath"]) if p.get("zpath") else None, resume=True)
        return
    if (bkdir(root) / "pending.json").exists():
        p0 = load_json(bkdir(root) / "pending.json", {}) or {}
        if p0.get("verified"):
            die(f"{p0.get('task')} 停在合并前等你看或等复查：满意运行 bk in --continue，不满意运行 bk in --reject \"问题\"。")
        die("上一次收包还没处理完：解决后运行 bk in --continue，或 bk in --abort 放弃。")
    if current_branch(root) != cfg["main_branch"] or not worktree_clean(root):
        die(f"请先回到干净的 {cfg['main_branch']} 分支（git status 查看）。")
    if args.branch:
        apply_branch(root, cfg, args.branch)
        return
    if args.zip:
        zs = [Path(args.zip)]
    else:
        zs = find_results(root, cfg)
        if not zs:
            say("没找到结果包（bk-v*-r*-done*.zip）。查过这些位置：")
            for d in inbox_dirs(root, cfg):
                say(f"  {win_path(d)}")
            return
        if not args.all:
            zs = [zs[-1]]
    for z in zs:
        if not apply_zip(root, cfg, z):
            break


def apply_branch(root: Path, cfg: dict, branch: str) -> bool:
    """收 Claude Code 网页版推到 GitHub 的任务分支。"""
    say(f"· 收分支：origin/{branch}")
    m = re.search(r"task/(.+)-r(\d+)$", branch)
    if not m:
        die("分支名应当是 task/<任务>-r<轮次>，例如 task/U06-r1")
    task_id, rnd = m.group(1), int(m.group(2))
    ref = f"refs/bk/in/{task_id}-r{rnd}"
    sh(["git", "fetch", "--quiet", "--no-tags", "origin", f"+refs/heads/{branch}:{ref}"], cwd=root)
    report_rel = f"progress/reports/{task_id}-r{rnd}.md"
    raw = git(root, "show", f"{ref}:{report_rel}", check=False)
    mm = REPORT_RE.search(raw or "")
    if not mm:
        die(f"分支里没有交接单 {report_rel}，或数据块格式不对。")
    data = json.loads(mm.group(1))
    if not data.get("base"):
        die("交接单数据块里没有 base（请让 Claude 用 bk done 收工，它会自动填写）。")
    task = get_task(root, cfg, task_id, "")
    sess = {"task": task_id, "round": rnd, "base": data["base"], "version": data.get("version", ""),
            "branch": branch, "title": task.get("title", "")}
    return integrate(root, cfg, ref, report_rel, f"分支 {branch}", task, sess)


def apply_zip(root: Path, cfg: dict, z: Path) -> bool:
    if not z.exists():
        die(f"找不到 {z}")
    if "-ckpt" in z.name:
        say(f"跳过检查点包 {z.name}（只用于网页端接续）")
        return True
    say(f"· 收包：{z.name}")
    tmp = bkdir(root, "inbox") / z.stem
    if tmp.exists():
        shutil.rmtree(tmp)
    safe_extract(z, tmp)
    repo = tmp / "repo"
    meta = load_json(repo / ".bk" / "package.json", None)
    if not (repo / ".git").exists() or not meta:
        die("这不是 bk 生成的结果包（缺 repo/.git 或 .bk/package.json）。")
    task = get_task(root, cfg, meta["task"], meta.get("title", ""))
    sess = {"task": meta["task"], "round": meta["round"], "base": meta["base"], "version": meta["version"],
            "branch": meta["branch"], "title": meta.get("title", "")}
    if git(root, "cat-file", "-t", meta["base"], check=False) != "commit":
        die("这个包不是从本仓库出的（找不到它的基础提交）。")
    ref = f"refs/bk/in/{meta['task']}-r{meta['round']}"
    sh(["git", "fetch", "--quiet", "--no-tags", str(repo), f"+refs/heads/{meta['branch']}:{ref}"], cwd=root)
    if sh(["git", "merge-base", "--is-ancestor", ref, cfg["main_branch"]], cwd=root, check=False).returncode == 0:
        say(f"  这个结果已经收过了（或被更新的结果包包含），跳过：{z.name}")
        try:
            shutil.move(str(z), str(handoff(root, cfg, "applied") / z.name))
        except OSError:
            pass
        shutil.rmtree(tmp, ignore_errors=True)
        return True
    report_rel = f"progress/reports/{meta['task']}-r{meta['round']}.md"
    if not git(root, "cat-file", "-e", f"{ref}:{report_rel}", check=False) == "":
        die(f"结果里没有交接单 {report_rel}")
    data, text = (None, None)
    try:
        raw = git(root, "show", f"{ref}:{report_rel}")
        m = REPORT_RE.search(raw)
        data = json.loads(m.group(1)) if m else {}
    except Exception:
        data = {}
    if data.get("out_of_scope"):
        say("  ⚠ 这个结果有范围外改动：" + "、".join(data["out_of_scope"][:10]))
    if data.get("allow_hot"):
        say(f"  ⚠ 改了热点文件，理由：{data['allow_hot']}")
    ok = integrate(root, cfg, ref, report_rel, z.name, task, sess, z)
    shutil.rmtree(tmp, ignore_errors=True)
    return ok


# ───────────────────────── 命令：pack ─────────────────────────

def cmd_pack(args) -> None:
    root = find_root()
    cfg = load_config(root)
    main = cfg["main_branch"]
    if git(root, "rev-parse", "--verify", "-q", main, check=False) == "":
        die(f"仓库里没有 {main} 分支。")
    if current_branch(root) == main and not worktree_clean(root):
        die("主干有没提交的改动，先提交（git status 查看）。出包只打包已提交的内容。")
    ver = vstr(current_version(root)) if versions(root) else "v0000"
    base = git(root, "rev-parse", main)
    if not args.task:
        z = make_package(root, cfg, "version", None, 0, main, base, ver, handoff(root, cfg, "versions"), f"bk-{ver}.zip")
        print_handover(z, "version", None)
        return
    task_id = args.task
    title = args.title or ""
    if task_id == "fix":
        task_id = new_adhoc_id(root)
        if not title:
            die("临时修复要写一句话描述：bk pack fix --title \"今日页按钮颜色不对\"")
    task = get_task(root, cfg, task_id, title)
    if task.get("kind") == "fix" and task_id.startswith("X"):
        tdoc = tasks_doc(root)
        if task_id not in task_map(tdoc):
            task["goal"] = (title + ("。补充说明：" + args.note if args.note else ""))
            tdoc["tasks"].append(dict(task, status="todo"))
            save_json(root / "progress" / "tasks.json", tdoc)
            git(root, "add", "progress/tasks.json")
            git(root, "commit", "-q", "-m", f"登记临时修复 {task_id}：{title}")
            base = git(root, "rev-parse", main)
    tm = task_map(tasks_doc(root))
    undone = [d for d in task.get("deps", []) if tm.get(d, {}).get("status") != "done"]
    if undone and not args.force:
        die(f"{task_id} 依赖的任务还没完成：{'、'.join(undone)}。确实要先做，加 --force。")
    rule = task.get("rule")
    if rule and task.get("kind") == "backend" and not args.force:
        card = root / "docs" / "baseline" / "rule-cards" / f"{rule}.md"
        if not card.exists() or "状态：已定稿" not in card.read_text(encoding="utf-8"):
            die(f"规则卡 {rule} 还没定稿：先完成对应的 R 任务，你确认后让 Codex 运行 bk confirm {rule}。确实要先做，加 --force。")
    clash = owns_clash(root, cfg, task)
    if clash and not args.force:
        die("和正在进行的任务改动范围重叠，并行会冲突：\n  " + "\n  ".join(clash) + "\n等它们收包后再出，或加 --force。")
    rnd = next_round(root, task_id)
    if rnd > int(cfg.get("max_rounds", 3)):
        say(f"⚠ 熔断提醒：{task_id} 将是第 {rnd} 轮。建议先三选一（你拍板）：拆小、换工具、改规则或范围。")
    name = f"bk-{ver}-{task_id}.zip"
    z = make_package(root, cfg, "task", task, rnd, main, base, ver, handoff(root, cfg, "outbox"), name)
    inflight = load_json(bkdir(root) / "inflight.json", {}) or {}
    inflight[task_id] = {"status": "doing", "round": rnd, "time": now(), "package": name}
    save_json(bkdir(root) / "inflight.json", inflight)
    print_handover(z, "task", task)


def owns_clash(root: Path, cfg: dict, task: dict) -> list[str]:
    inflight = load_json(bkdir(root) / "inflight.json", {}) or {}
    tm = task_map(tasks_doc(root))
    shared = cfg.get("shared_ok", [])
    mine = [x for x in expand_task(task, cfg)["owns"] if x not in shared]
    res = []
    for tid, info in inflight.items():
        if tid == task["id"] or tid not in tm:
            continue
        theirs = [x for x in expand_task(tm[tid], cfg)["owns"] if x not in shared]
        for a in mine:
            for b in theirs:
                a0, b0 = a.replace("**", "").replace("*", ""), b.replace("**", "").replace("*", "")
                if a == "**" or b == "**" or a0.startswith(b0) or b0.startswith(a0):
                    res.append(f"{task['id']} 的 {a}  ⇄  {tid} 的 {b}")
    return res[:12]


# ───────────────────────── 看板与状态 ─────────────────────────

def ready_tasks(root: Path) -> list[dict]:
    tdoc = tasks_doc(root)
    tm = task_map(tdoc)
    inflight = load_json(root / ".bk" / "inflight.json", {}) or {}
    res = []
    for t in tdoc.get("tasks", []):
        if t.get("status", "todo") != "todo" or t["id"] in inflight or t.get("optional"):
            continue
        if all(tm.get(d, {}).get("status") == "done" for d in t.get("deps", [])):
            res.append(t)
    return res


STAGE_CN = {0: "地基", 1: "前端全貌", 2: "接通后端", 3: "上线准备", 4: "推广之后", 9: "临时修复"}


def write_board(root: Path, cfg: dict) -> None:
    tdoc, pdoc = tasks_doc(root), pages_doc(root)
    qdoc = load_json(root / "progress" / "questions.json", {"questions": []}) or {"questions": []}
    ver = vstr(current_version(root) + 0)
    pages = pdoc.get("pages", [])
    tasks = tdoc.get("tasks", [])
    # Markdown
    L = [f"# 进度看板（自动生成，勿手改）", "", f"> 生成于 {now()}，最新版本标签 {ver}。图形版：progress/board.html。", ""]
    L.append("## 页面")
    L.append("")
    for end, name in (("S", "学员端"), ("O", "机构端"), ("P", "平台后台")):
        ps = [p for p in pages if p["id"].startswith(end)]
        if not ps:
            continue
        cnt = {s: sum(1 for p in ps if p.get("status", "todo") == s) for s in PAGE_STATUS}
        L.append(f"### {name}（{len(ps)} 页）：" + "，".join(f"{PAGE_STATUS_CN[s]} {cnt[s]}" for s in PAGE_STATUS if cnt[s]))
        L.append("")
        L.append("| 页 | 名称 | 状态 | 功能点 P0/P1/P2 |")
        L.append("|---|---|---|---|")
        for p in ps:
            c = p.get("features", [0, 0, 0])
            L.append(f"| {p['id']} | {p.get('name', '')} | {PAGE_STATUS_CN.get(p.get('status', 'todo'))} | {c[0]}/{c[1]}/{c[2]} |")
        L.append("")
    L.append("## 任务")
    L.append("")
    for stg in sorted({t.get("stage", 0) for t in tasks}):
        ts = [t for t in tasks if t.get("stage", 0) == stg]
        done = sum(1 for t in ts if t.get("status") == "done")
        L.append(f"### 阶段 {stg} {STAGE_CN.get(stg, '')}：{done}/{len(ts)}")
        L.append("")
        for t in ts:
            L.append(f"- [{'x' if t.get('status') == 'done' else ' '}] {t['id']} {t.get('title', '')}"
                     f"（{TASK_STATUS_CN.get(t.get('status', 'todo'))}）{' · 选做' if t.get('optional') else ''}")
        L.append("")
    openq = [q for q in qdoc["questions"] if q.get("status") == "open"]
    L.append(f"## 等你拍板（{len(openq)}）")
    L.append("")
    for q in openq:
        L.append(f"- **{q['id']}** {q['q']}（推荐 {q.get('recommend', '')}；已先按 {q.get('temp', '') or '推荐'} 做）")
    (root / "progress" / "board.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    # 问题清单
    QL = ["# 等你拍板的问题（自动生成，勿手改）", "",
          "> 回答方式：在任何一个 Claude 对话里说“T032-Q1 选 A”，或对 Codex 说“拍板 T032-Q1：选 A”。", ""]
    for q in openq:
        QL += [f"## {q['id']}（来自 {q['task']}，{q.get('asked', '')}）", "", q["q"], ""]
        for o in q.get("options", []):
            QL.append(f"- {o}")
        QL += ["", f"推荐：{q.get('recommend', '')}；已先按：{q.get('temp', '') or '推荐'}", ""]
    done_q = [q for q in qdoc["questions"] if q.get("status") == "answered"]
    if done_q:
        QL += ["## 已拍板", ""] + [f"- {q['id']}：{q.get('answer', '')}（{q.get('answered', '')}）" for q in done_q]
    (root / "progress" / "questions.md").write_text("\n".join(QL) + "\n", encoding="utf-8")
    (root / "progress" / "board.html").write_text(board_html(cfg, pages, tasks, openq, ver), encoding="utf-8")


def esc(s: str) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def board_html(cfg: dict, pages: list, tasks: list, openq: list, ver: str) -> str:
    color = {"todo": "var(--m0)", "shell": "var(--m1)", "ui": "var(--m3)", "api": "var(--m4)", "ok": "var(--m5)"}
    groups = []
    for end, name in (("S", "学员端"), ("O", "机构端"), ("P", "平台后台")):
        ps = [p for p in pages if p["id"].startswith(end)]
        if not ps:
            continue
        cells = "".join(
            f'<a class="cell s-{p.get("status", "todo")}" title="{esc(p["id"] + " " + p.get("name", "") + " · " + PAGE_STATUS_CN.get(p.get("status", "todo"), ""))}">'
            f'<b>{p["id"]}</b><span>{esc(p.get("name", ""))}</span></a>' for p in ps)
        n_ok = sum(1 for p in ps if p.get("status") in ("ui", "api", "ok"))
        groups.append(f'<section><h2>{name}<small>{n_ok}/{len(ps)} 页前端已完成</small></h2><div class="grid">{cells}</div></section>')
    stages = []
    for stg in sorted({t.get("stage", 0) for t in tasks}):
        ts = [t for t in tasks if t.get("stage", 0) == stg]
        must = [t for t in ts if not t.get("optional")]
        done = sum(1 for t in must if t.get("status") == "done")
        pct = int(100 * done / len(must)) if must else 0
        items = "".join(f'<li class="t-{t.get("status", "todo")}{" opt" if t.get("optional") else ""}"><b>{esc(t["id"])}</b> {esc(t.get("title", ""))}'
                        f'<em>{TASK_STATUS_CN.get(t.get("status", "todo"))}</em></li>' for t in ts)
        stages.append(f'<details{" open" if 0 < pct < 100 else ""}><summary><span>阶段 {stg}　{STAGE_CN.get(stg, "")}</span>'
                      f'<span class="bar"><i style="width:{pct}%"></i></span><span class="num">{done}/{len(must)}</span></summary><ul>{items}</ul></details>')
    qs = "".join(f"<li><b>{esc(q['id'])}</b> {esc(q['q'])}<small>推荐 {esc(q.get('recommend', ''))}</small></li>" for q in openq) or "<li>暂无</li>"
    legend = "".join(f'<span><i style="background:{color[s]}"></i>{PAGE_STATUS_CN[s]}</span>' for s in PAGE_STATUS)
    return f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(cfg['project'])} · 进度看板 {ver}</title><style>
:root{{--bg:#EEF1F5;--surface:#fff;--ink:#1A2130;--ink2:#465064;--line:#D9DEE6;--pri:#2E4A8E;--amber:#9A6206;
--m0:#E3E7EC;--m1:#D2EBE1;--m2:#A9D8C5;--m3:#72BC9F;--m4:#35957A;--m5:#18664F;
--serif:"Songti SC","Noto Serif SC","Source Han Serif SC",STSong,serif;--sans:"HarmonyOS Sans SC","PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif}}
@media (prefers-color-scheme:dark){{:root{{--bg:#12161D;--surface:#1B212B;--ink:#E7EBF2;--ink2:#A9B3C3;--line:#2C3443;--pri:#8EA6E6;--m0:#2A313C}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 var(--sans)}}
header{{padding:28px 24px 8px;max-width:1180px;margin:auto}}h1{{font:700 26px var(--serif);letter-spacing:.12em;margin:0}}
header p{{color:var(--ink2);margin:4px 0 0}}main{{max-width:1180px;margin:auto;padding:8px 24px 40px}}
section,.card{{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px;margin:14px 0}}
h2{{font:600 17px var(--serif);margin:0 0 10px;display:flex;gap:12px;align-items:baseline}}h2 small{{font:13px var(--sans);color:var(--ink2)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px}}
.cell{{display:block;border-radius:7px;padding:7px 8px;min-height:54px;color:#1A2130;text-decoration:none}}
.cell b{{display:block;font-size:12px}}.cell span{{font-size:12.5px;line-height:1.3}}
.s-todo{{background:var(--m0);color:var(--ink2)}}.s-shell{{background:var(--m1)}}.s-ui{{background:var(--m3)}}.s-api{{background:var(--m4);color:#fff}}.s-ok{{background:var(--m5);color:#fff}}
.legend{{display:flex;flex-wrap:wrap;gap:14px;color:var(--ink2);font-size:13px}}.legend i{{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px}}
details{{background:var(--surface);border:1px solid var(--line);border-radius:10px;margin:10px 0;padding:10px 16px}}
summary{{cursor:pointer;display:grid;grid-template-columns:180px 1fr 70px;gap:12px;align-items:center;font-weight:600}}
.bar{{height:10px;background:var(--m0);border-radius:6px;overflow:hidden}}.bar i{{display:block;height:100%;background:var(--m4)}}
.num{{text-align:right;font-variant-numeric:tabular-nums}}ul{{margin:10px 0 0;padding:0;list-style:none}}
li{{padding:5px 0;border-top:1px solid var(--line);display:flex;gap:8px;align-items:baseline}}li b{{min-width:44px}}
li em{{margin-left:auto;font-style:normal;font-size:12px;color:var(--ink2)}}li.t-done em{{color:var(--m4)}}li.t-doing em,li.t-fixing em{{color:var(--amber)}}li.opt{{opacity:.7}}
li small{{margin-left:auto;color:var(--ink2)}}
</style></head><body><header><h1>{esc(cfg['project'])}</h1><p>进度看板 · 最新版本 {ver} · 生成于 {now()} · 每次收包自动更新</p></header>
<main><div class="legend">{legend}</div>{''.join(groups)}
<div class="card"><h2>等你拍板<small>{len(openq)} 条，详见 progress/questions.md</small></h2><ul>{qs}</ul></div>
<h2 style="margin-top:22px">任务</h2>{''.join(stages)}</main></body></html>"""


def cmd_board(args) -> None:
    root = find_root()
    write_board(root, load_config(root))
    if current_branch(root) == load_config(root)["main_branch"]:
        git(root, "add", "progress/board.md", "progress/board.html", "progress/questions.md")
        git(root, "commit", "-q", "-m", "刷新进度看板", check=False)
    say("已生成 progress/board.md、progress/board.html、progress/questions.md（用浏览器打开 board.html 看方格图）")


def cmd_status(args) -> None:
    root = find_root()
    cfg = load_config(root)
    tdoc, pdoc = tasks_doc(root), pages_doc(root)
    v = current_version(root)
    br = current_branch(root)
    say(f"{cfg['project']} · 当前版本 {vstr(v) if v else '（还没有版本）'} · 分支 {br} · {'工作区干净' if worktree_clean(root) else '有未提交改动'}")
    if env_kind() == "local" and git(root, "remote", check=False):
        ahead = git(root, "rev-list", "--count", f"origin/{cfg['main_branch']}..{cfg['main_branch']}", check=False)
        if ahead.isdigit():
            say(f"GitHub：{'已同步' if ahead == '0' else f'有 {ahead} 个提交没推送（运行 bk ship）'}")
    tasks = tdoc.get("tasks", [])
    for stg in sorted({t.get("stage", 0) for t in tasks}):
        ts = [t for t in tasks if t.get("stage", 0) == stg and not t.get("optional")]
        opt = [t for t in tasks if t.get("stage", 0) == stg and t.get("optional")]
        if not ts and not opt:
            continue
        d = sum(1 for t in ts if t.get("status") == "done")
        bar = "■" * d + "□" * (len(ts) - d)
        extra = f"（另有选做 {sum(1 for t in opt if t.get('status') == 'done')}/{len(opt)}）" if opt else ""
        say(f"  阶段 {stg} {STAGE_CN.get(stg, ''):<6} {bar[:40]} {d}/{len(ts)}{extra}")
    ps = [p for p in pdoc.get("pages", []) if p["id"].startswith("S")]
    if ps:
        c = {s: sum(1 for p in ps if p.get("status", "todo") == s) for s in PAGE_STATUS}
        say(f"学员端页面：前端完成 {c['ui'] + c['api'] + c['ok']}/{len(ps)} · 已接后端 {c['api'] + c['ok']}/{len(ps)} · 已验收 {c['ok']}/{len(ps)}")
    inflight = load_json(root / ".bk" / "inflight.json", {}) or {}
    tm = task_map(tdoc)
    if inflight:
        say("进行中：" + "；".join(f"{k} {tm.get(k, {}).get('title', '')}（{TASK_STATUS_CN.get(i['status'], i['status'])}，{i['time']}）" for k, i in inflight.items()))
    nxt = ready_tasks(root)
    if nxt:
        say("可以开始（依赖都已完成）：")
        for t in nxt[:8]:
            say(f"  {t['id']} {t.get('title', '')}【{t.get('level', '')}级 · 建议 {t.get('tool', '')} · 车道 {t.get('lane', '')}】")
    qdoc = load_json(root / "progress" / "questions.json", {"questions": []}) or {"questions": []}
    openq = [q for q in qdoc["questions"] if q.get("status") == "open"]
    if openq:
        say(f"等你拍板：{len(openq)} 条（progress/questions.md）")
        for q in openq[:5]:
            say(f"  {q['id']}：{q['q']}")
    pend = load_json(root / ".bk" / "pending.json", None)
    if pend:
        if pend.get("verified"):
            say(f"⚠ {pend.get('task')} 已通过检查，停在合并前等{'你看效果' if pend.get('gate') == 'look' else 'Codex 复查'}：满意 bk in --continue；不满意 bk in --reject \"问题\"")
        else:
            say("⚠ 有一次收包没处理完：bk in --continue 或 bk in --abort")


# ───────────────────────── 其他命令 ─────────────────────────

def cmd_accept(args) -> None:
    root = find_root()
    pdoc = pages_doc(root)
    hit = []
    for p in pdoc.get("pages", []):
        if p["id"] in [x.upper() for x in args.pages]:
            p["status"] = "ok"
            p["updated"] = vstr(current_version(root))
            hit.append(p["id"])
    if not hit:
        die("没有匹配的页面编号。")
    save_json(root / "progress" / "pages.json", pdoc)
    write_board(root, load_config(root))
    git(root, "add", "-A", "progress")
    git(root, "commit", "-q", "-m", "验收 " + " ".join(hit))
    say("已标记验收：" + "、".join(hit))


def cmd_confirm(args) -> None:
    root = find_root()
    tm = task_map(tasks_doc(root))
    rule = tm.get(args.what, {}).get("rule") or args.what
    card = root / "docs" / "baseline" / "rule-cards" / f"{rule}.md"
    if not card.exists():
        die(f"找不到规则卡 {card.relative_to(root)}")
    text = card.read_text(encoding="utf-8")
    stamp = f"- 状态：已定稿（{dt.date.today().isoformat()}，你已确认；再改需要你同意）"
    if re.search(r"^- 状态：.*$", text, re.M):
        text = re.sub(r"^- 状态：.*$", stamp, text, count=1, flags=re.M)
    else:
        text = re.sub(r"^(# .*\n)", r"\1\n" + stamp + "\n", text, count=1)
    card.write_text(text, encoding="utf-8")
    git(root, "add", str(card.relative_to(root)))
    git(root, "commit", "-q", "-m", f"规则确认：{rule}")
    say(f"✓ 规则卡 {rule} 已定稿并锁定。对应的后端任务现在可以出包了。")


def cmd_answer(args) -> None:
    root = find_root()
    qdoc = load_json(root / "progress" / "questions.json", {"questions": []}) or {"questions": []}
    for q in qdoc["questions"]:
        if q["id"] == args.qid:
            q.update({"status": "answered", "answer": args.text, "answered": vstr(current_version(root))})
            save_json(root / "progress" / "questions.json", qdoc)
            write_board(root, load_config(root))
            git(root, "add", "-A", "progress")
            git(root, "commit", "-q", "-m", f"拍板 {args.qid}：{args.text}")
            say(f"已记录：{args.qid} → {args.text}。如影响已有代码，记得开一个任务去改。")
            return
    die(f"没有问题 {args.qid}")


def cmd_where(args) -> None:
    root = find_root()
    cfg = load_config(root)
    say(f"仓库：{win_path(root)}")
    for sub, what in (("outbox", "任务包"), ("versions", "版本包（每次合并自动生成）"), ("fixes", "修复包"),
                      ("inbox", "结果包可以放这里"), ("applied", "已收的结果包")):
        say(f"{what}：{win_path(handoff(root, cfg, sub))}")
    say("收包时查找的位置：")
    for d in inbox_dirs(root, cfg):
        say(f"  {win_path(d)}")
    w = win_downloads()
    say(f"Windows 下载文件夹：{win_path(w) if w else '（未识别；可设 BK_WIN_DOWNLOADS）'}")


def pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def cmd_run(args) -> None:
    root = find_root()
    cfg = load_config(root)
    pidf = bkdir(root) / "dev.pid"
    if args.stop:
        if pidf.exists():
            pid = int(pidf.read_text().strip() or 0)
            try:
                os.killpg(pid, 15)
            except OSError:
                pass
            pidf.unlink(missing_ok=True)
            say("已停止本地预览。")
        else:
            say("没有在运行的预览。")
        return
    if not (root / "package.json").exists():
        die("还没有工程骨架（package.json），完成任务 F02 之后才能运行。")
    if pidf.exists() and pid_alive(int(pidf.read_text().strip() or 0)) and not args.fg:
        say("本地预览已经在运行（要重启：bk run --stop 后再 bk run）：")
        for k, u in cfg["run"]["urls"].items():
            say(f"  {k}：{u}")
        return
    mode = "real" if args.real else "mock"
    if mode == "real":
        comp = root / cfg["run"]["compose"]
        if comp.exists() and shutil.which("docker"):
            say("· 启动数据库与 Redis（docker compose）……")
            r = sh(["docker", "compose", "-f", str(comp), "up", "-d"], cwd=root, check=False)
            if r.returncode != 0:
                die("Docker 没起来：先打开 Docker Desktop，等它显示 running 再试。\n" + tail(r.stderr, 10))
    if not (root / "node_modules").exists():
        caps = {}
        ensure_deps(root, caps, force=True)
    def show_urls():
        say("打开这些网址看效果：")
        for k, u in cfg["run"]["urls"].items():
            say(f"  {k}：{u}")
        routes = cfg.get("routes") or {}
        if routes:
            say("页面直达示例（接在学员端网址后面）：" + "，".join(f"{k} {v}" for k, v in list(routes.items())[:6]))
        say("开发时可在网址后加 ?state=empty 之类看七态、?view=<视图> 切视图。")

    cmd = cfg["run"][mode]
    say(f"· 运行：{cmd}（{'真实后端' if mode == 'real' else '假数据'}模式）")
    if args.fg:
        show_urls()
        say("停止：按 Ctrl+C")
        os.chdir(root)
        os.execvp("bash", ["bash", "-lc", cmd])
    log = bkdir(root, "logs") / "dev.log"
    proc = subprocess.Popen(["bash", "-lc", cmd], cwd=root, stdout=open(log, "w"), stderr=subprocess.STDOUT,
                            start_new_session=True)
    pidf.write_text(str(proc.pid))
    first = next(iter(cfg["run"]["urls"].values()), "http://localhost:5173")
    m = re.search(r":(\d+)", first)
    port = int(m.group(1)) if m else 5173
    for _ in range(120):
        if tcp_ok("127.0.0.1", port):
            break
        if proc.poll() is not None:
            pidf.unlink(missing_ok=True)
            die("预览没起来，日志末尾：\n" + tail(log.read_text(encoding="utf-8", errors="replace"), 30))
        time.sleep(1)
    say("✓ 本地预览已在后台运行（日志 .bk/logs/dev.log；停止：python3 tools/bk.py run --stop）")
    show_urls()


def cmd_ship(args) -> None:
    root = find_root()
    cfg = load_config(root)
    if not git(root, "remote", check=False):
        die("还没有连 GitHub：先在 GitHub 网页上建一个私有仓库，然后运行\n"
            "  git remote add origin git@github.com:<你的账号>/exam-prep.git\n（或用 https 地址）再 bk ship。")
    if current_branch(root) != cfg["main_branch"]:
        die(f"请在 {cfg['main_branch']} 分支上运行。")
    r = sh(["git", "push", "origin", cfg["main_branch"], "--follow-tags"], cwd=root, check=False)
    if r.returncode != 0:
        die("推送失败：\n" + tail(r.stderr, 15))
    sh(["git", "push", "origin", "--tags"], cwd=root, check=False)
    say(f"✓ 已推送到 GitHub（{vstr(current_version(root))}）。在仓库的 Actions 页能看到自动检查结果。")


def cmd_init(args) -> None:
    root = find_root()
    cfg = load_config(root)
    ensure_local_exclude(root)
    gi = root / ".gitignore"
    text = gi.read_text(encoding="utf-8") if gi.exists() else ""
    need = [".bk/", "node_modules/", "dist/", "coverage/", "playwright-report/", "test-results/",
            ".env", ".env.*", "!.env.example", "packages/contract/src/generated/"]
    add = [x for x in need if x not in text.split("\n")]
    if add:
        gi.write_text(text + ("\n" if text and not text.endswith("\n") else "") + "\n".join(add) + "\n", encoding="utf-8")
    for sub in ("outbox", "versions", "fixes", "inbox", "applied"):
        handoff(root, cfg, sub)
    for f in ("progress/reports/.gitkeep", "docs/decisions/.gitkeep"):
        p = root / f
        p.parent.mkdir(parents=True, exist_ok=True)
        if not p.exists():
            p.write_text("", encoding="utf-8")
    if not (root / "progress" / "questions.json").exists():
        save_json(root / "progress" / "questions.json", {"questions": []})
    tdoc = tasks_doc(root)
    for t in tdoc.get("tasks", []):
        if t["id"] == "F00" and t.get("status") != "done":
            t["status"] = "done"
            t.setdefault("history", []).append({"round": 1, "version": "v0001", "tool": "codex", "date": now(), "status": "done"})
            save_json(root / "progress" / "tasks.json", tdoc)
    write_board(root, cfg)
    git(root, "add", "-A")
    if git(root, "status", "--porcelain"):
        git(root, "commit", "-q", "-m", "V4 初始化：bk 工具、进度文件")
    if not versions(root):
        git(root, "tag", "-a", "bk-v0001", "-m", "v0001 V4 起点")
        say("✓ 已打第一个版本标签 v0001")
    z = make_package(root, cfg, "version", None, 0, cfg["main_branch"], git(root, "rev-parse", "HEAD"),
                     vstr(current_version(root)), handoff(root, cfg, "versions"), f"bk-{vstr(current_version(root))}.zip")
    say(f"✓ 版本包：{win_path(z)}")
    say(f"中转文件夹：{win_path(handoff(root, cfg))}")


def cmd_doctor(args) -> None:
    root = find_root()
    cfg = load_config(root)
    ok = True

    def item(good: bool, text: str, fix: str = ""):
        nonlocal ok
        ok = ok and good
        say(f"{'✓' if good else '✗'} {text}" + ("" if good or not fix else f"\n    办法：{fix}"))

    item(sys.version_info >= (3, 10), f"Python {sys.version.split()[0]}", "装 Python 3.10 以上")
    item(bool(shutil.which("git")), "git", "sudo apt install git")
    name = git(root, "config", "user.name", check=False)
    item(bool(name), f"git 用户名：{name or '未设置'}", "git config --global user.name \"你的名字\"; git config --global user.email \"你的邮箱\"")
    node = sh(["node", "-v"], check=False).stdout.strip() if shutil.which("node") else ""
    nv = tuple(int(x) for x in re.findall(r"\d+", node)[:2]) if node else (0, 0)
    item(nv >= (22, 12), f"Node {node or '未安装'}（要求 22.12 以上；本地建议 24）", "按 docs/baseline/tech.md 安装 Node 24（推荐用 nvm 或 fnm）")
    pm = package_manager(root)
    if pm:
        has = shutil.which("pnpm")
        item(bool(has), f"pnpm（项目要求 {pm}）", f"corepack enable && corepack prepare {pm} --activate")
    if env_kind() == "local":
        dk = shutil.which("docker")
        item(bool(dk), "Docker（阶段 2 起需要：本地数据库）", "装 Docker Desktop，设置里启用 WSL2 集成")
        item(bool(git(root, "remote", check=False)), "GitHub 远端", "见手册 F00：在 GitHub 建私有仓库后 git remote add origin <地址>")
        if is_wsl():
            w = win_downloads()
            item(bool(w), f"Windows 下载文件夹：{win_path(w) if w else '未识别'}", "设置环境变量 BK_WIN_DOWNLOADS=/mnt/c/Users/<你>/Downloads")
    else:
        item(bool(find_chromium()), f"沙箱浏览器：{find_chromium() or '无'}", "没有也能写代码，只是浏览器测试会跳过")
        item(npm_registry_ok(), "沙箱能连 npm", "设置 → 功能 → 打开代码执行的网络访问")
    for f in ("progress/tasks.json", "progress/pages.json", "tools/bk.config.json", "AGENTS.md"):
        item((root / f).exists(), f"文件 {f}", "按工具包手册安装")
    tdoc = tasks_doc(root)
    ids = {t["id"] for t in tdoc.get("tasks", [])}
    bad = [f"{t['id']}→{d}" for t in tdoc.get("tasks", []) for d in t.get("deps", []) if d not in ids]
    item(not bad, "任务依赖都指向存在的任务" + (f"：{bad[:5]}" if bad else ""), "修 progress/tasks.json")
    proto = root / cfg["prototype"]
    item(proto.exists(), f"原型文件 {cfg['prototype']}", "把冻结原型复制到这个位置")
    say("\n" + ("全部正常。" if ok else "有 ✗ 的项按“办法”处理后再运行一次。"))


def cmd_map(args) -> None:
    root = find_root()
    skip = {".git", "node_modules", ".bk", "dist", "coverage", ".turbo", "playwright-report", "test-results"}
    depth = args.depth

    def walk(d: Path, lvl: int):
        if lvl > depth:
            return
        try:
            items = sorted([x for x in d.iterdir() if x.name not in skip], key=lambda x: (x.is_file(), x.name))
        except OSError:
            return
        for x in items:
            if x.is_dir():
                n = sum(1 for _ in x.rglob("*") if _.is_file() and not any(s in _.parts for s in skip))
                say("  " * lvl + f"{x.name}/  （{n} 个文件）")
                walk(x, lvl + 1)
            elif lvl < depth:
                say("  " * lvl + x.name)

    walk(root, 0)


# ───────────────────────── 原型：spec / proto ─────────────────────────

def js_literal(src: str, i: int):
    """解析原型脚本里的 JS 字面量（对象、数组、字符串、数字、标识符），返回 (值, 结束位置)。"""
    n = len(src)

    def ws(i):
        while i < n and src[i] in " \t\r\n":
            i += 1
        return i

    i = ws(i)
    c = src[i]
    if c == "{":
        obj, i = {}, i + 1
        while True:
            i = ws(i)
            if src[i] == "}":
                return obj, i + 1
            if src[i] in "'\"":
                key, i = js_literal(src, i)
            else:
                m = re.match(r"[A-Za-z_$][\w$]*", src[i:])
                key, i = m.group(0), i + m.end()
            i = ws(i)
            assert src[i] == ":", src[i:i + 30]
            val, i = js_literal(src, i + 1)
            obj[key] = val
            i = ws(i)
            if src[i] == ",":
                i += 1
    if c == "[":
        arr, i = [], i + 1
        while True:
            i = ws(i)
            if src[i] == "]":
                return arr, i + 1
            val, i = js_literal(src, i)
            arr.append(val)
            i = ws(i)
            if src[i] == ",":
                i += 1
    if c in "'\"`":
        q, i, buf = c, i + 1, []
        while src[i] != q:
            if src[i] == "\\":
                buf.append({"n": "\n", "t": "\t"}.get(src[i + 1], src[i + 1]))
                i += 2
            else:
                buf.append(src[i])
                i += 1
        return "".join(buf), i + 1
    m = re.match(r"-?\d+(\.\d+)?", src[i:])
    if m:
        return float(m.group(0)) if "." in m.group(0) else int(m.group(0)), i + m.end()
    m = re.match(r"[A-Za-z_$][\w$.]*", src[i:])
    word = m.group(0)
    return {"true": True, "false": False, "null": None}.get(word, word), i + m.end()


def proto_const(src: str, name: str):
    k = src.find(f"const {name}=")
    if k < 0:
        return None
    try:
        return js_literal(src, k + len(f"const {name}="))[0]
    except Exception:
        return None


def cmd_spec(args) -> None:
    root = find_root()
    cfg = load_config(root)
    p = root / cfg["prototype"]
    if not p.exists():
        die(f"找不到原型 {cfg['prototype']}")
    src = p.read_text(encoding="utf-8")
    m = re.search(r"const SPEC=(\{.*?\});?\n", src)
    spec = json.loads(m.group(1)) if m else {}
    nm = proto_const(src, "NM") or {}
    views = proto_const(src, "VIEWS") or {}
    stx = proto_const(src, "STX") or {}
    ends = proto_const(src, "ENDS") or {}
    extp = proto_const(src, "EXTP") or []
    for pid in [x.upper() for x in args.pages]:
        s = spec.get(pid)
        if not s:
            say(f"原型里没有 {pid}")
            continue
        grp = next((g[0] for g in ends.get(pid[0], {}).get("groups", []) if pid in g[2]), "")
        endname = ends.get(pid[0], {}).get("name", "")
        L = [f"# {pid} {nm.get(pid, '')}（{endname} · {grp}{' · 扩展包，部分考试才有' if pid in extp else ''}）", ""]
        L.append(f"目的：{s.get('why', '')}")
        if views.get(pid):
            L.append("视图（?view=）：" + " ｜ ".join(f"{v[0]} {v[1]}" for v in views[pid]))
        if s.get("lay"):
            L += ["", f"布局{s.get('layn', '')}："] + [f"- {x}" for x in s["lay"]]
        f = s.get("f", [])
        cnt = [sum(1 for x in f if x[2] == lv) for lv in (0, 1, 2)]
        L += ["", f"功能点（{len(f)} 项：P0 {cnt[0]} / P1 {cnt[1]} / P2 {cnt[2]}；P2 先不做）："]
        for i, x in enumerate(f, 1):
            L.append(f"- {pid}-{i:02d} [P{x[2]}] {x[0]}：{x[1]}")
        st = stx.get(pid)
        L += ["", "七态（加载、空、出错、离线、受限、数据不足，加正常）："]
        if st:
            e = st.get("e", ["", "", "", ""])
            L.append(f"- 空：{e[0]}｜{e[1]}" + (f"｜按钮“{e[2]}”" if len(e) > 2 and e[2] else "") + (f" → {e[3]}" if len(e) > 3 and e[3] else ""))
            L.append(f"- 出错：{nm.get(pid, '')}的数据暂时没取到：网络或服务异常。已保存的内容不受影响，点“重试”即可；连续失败会自动上报。")
            L.append(f"- 离线：{st.get('o', '')}")
            L.append(f"- 受限：{st.get('l', '')}")
            L.append(f"- 数据不足：{st.get('d', '')}")
        else:
            n_ = nm.get(pid, "")
            bx = proto_const(src, "BX") or {}
            if pid[0] == "O":
                L.append(f"- 空：{n_}暂无数据｜还没有班级或学员数据时，先导入学员或建班｜按钮“导入学员” → O03")
                L.append(f"- 出错：{n_}没能加载：服务暂时异常，已保存的内容不受影响；重试或稍后再来。")
                L.append("- 离线：离线时只能查看已缓存的待办与联系清单，提交与发布需要联网")
                L.append(f"- 受限：{bx.get('O', '')}")
                L.append("- 数据不足：不足 10 人的班级不显示汇总统计")
            elif pid[0] == "P":
                L.append(f"- 空：{n_}暂无数据｜当前筛选下没有记录，换个筛选条件试试")
                L.append(f"- 出错：{n_}没能加载：服务暂时异常，已保存的内容不受影响；重试或稍后再来。")
                L.append("- 离线：后台需要联网")
                L.append(f"- 受限：{bx.get('P', '')}")
                L.append("- 数据不足：样本不足时不出结论，只显示原始计数")
            else:
                L.append("- 原型未单独写，按 docs/baseline/ui-rules.md 的通用七态文案")
        L += ["", f"AI 做什么：{s.get('ai', '—')}", f"数据读写：{s.get('rw', '—')}"]
        link = lambda xs: "、".join(f"{u} {nm.get(u, '')}" for u in xs) or "无"
        L.append(f"入口（从哪些页跳来）：{link(s.get('ent') or [])}")
        L.append(f"出口（跳去哪些页）：{link(s.get('ext') or [])}")
        L.append(f"上下游：{link(s.get('up') or [])}")
        say("\n".join(L))
        say("")


def cmd_proto(args) -> None:
    root = find_root()
    cfg = load_config(root)
    script = root / "tools" / "proto-shots.cjs"
    if not script.exists():
        die("缺 tools/proto-shots.cjs")
    envx = dict(os.environ)
    c = find_chromium()
    if c:
        envx["BK_CHROMIUM"] = c
    cmd = ["node", str(script), *args.rest, "--proto", cfg["prototype"], "--out", ".bk/proto"]
    sys.exit(subprocess.call(cmd, cwd=root, env=envx))


# ───────────────────────── 自检 ─────────────────────────

def cmd_selftest(args) -> None:
    """在临时目录模拟：出包 → 网页端开工、改代码、收工 → 本地收包；并行两包；验证失败出修复包。"""
    me = Path(__file__).resolve()
    tmp = Path(tempfile.mkdtemp(prefix="bkselftest-"))
    hub = tmp / "hub" / "exam-prep"
    hub.mkdir(parents=True)
    py = sys.executable
    base_env = dict(os.environ, BK_ENV="local", BK_HANDOFF=str(tmp / "handoff"), BK_NO_INSTALL="1",
                    BK_WIN_DOWNLOADS="", BK_INBOX=str(tmp / "downloads"))
    (tmp / "downloads").mkdir()

    def run(args_, cwd, env=None, expect=0):
        r = subprocess.run([py, "tools/bk.py", *args_], cwd=cwd, capture_output=True, text=True, env=env or base_env)
        if r.returncode != expect:
            print(r.stdout[-3000:], r.stderr[-3000:])
            raise SystemExit(f"自检失败：bk {' '.join(args_)} 返回 {r.returncode}，期望 {expect}")
        return r.stdout

    def g(*a, cwd=hub):
        return subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()

    try:
        (hub / "tools").mkdir()
        shutil.copy2(me, hub / "tools" / "bk.py")
        save_json(hub / "tools" / "bk.config.json", {
            "project": "自检项目", "pack_depth": 1,
            "verify": {"quick": ["cmd:python3 -c pass"], "web": ["cmd:python3 -c pass"], "full": ["cmd:python3 check.py"]},
            "kinds": {"page": {"owns": ["app/{page}/**"], "reads": ["AGENTS.md"], "accept": ["页面 {page} 能显示"]}}})
        save_json(hub / "progress" / "tasks.json", {"tasks": [
            {"id": "U01", "title": "页面一", "stage": 1, "level": "B", "tool": "claude", "kind": "page", "pages": ["S01"], "deps": [], "status": "todo"},
            {"id": "U02", "title": "页面二", "stage": 1, "level": "B", "tool": "claude", "kind": "page", "pages": ["S02"], "deps": [], "status": "todo"},
            {"id": "U03", "title": "页面三（先看再合并）", "stage": 1, "level": "A", "tool": "claude", "kind": "page", "pages": ["S03"], "deps": [], "status": "todo", "gate": "look"},
            {"id": "B09", "title": "后端示例", "stage": 2, "level": "A", "tool": "claude", "kind": "backend", "rule": "demo-rule", "deps": [], "status": "todo", "owns": ["**"]}]})
        save_json(hub / "progress" / "pages.json", {"pages": [{"id": "S01", "name": "一", "status": "todo"},
                                                              {"id": "S02", "name": "二", "status": "todo"}]})
        (hub / "AGENTS.md").write_text("# 自检\n", encoding="utf-8")
        (hub / "check.py").write_text("import os, sys\nsys.exit(1 if os.path.exists('FAIL') else 0)\n", encoding="utf-8")
        (hub / "tests").mkdir()
        (hub / "tests" / "sample.test.ts").write_text("test('a', () => {})\n", encoding="utf-8")
        (hub / "docs" / "baseline" / "rule-cards").mkdir(parents=True)
        (hub / "docs" / "baseline" / "rule-cards" / "demo-rule.md").write_text("# 规则卡：示例\n\n- 状态：草稿\n", encoding="utf-8")
        g("init", "-q", "-b", "main")
        g("config", "user.name", "自检")
        g("config", "user.email", "selftest@bk.local")
        g("add", "-A")
        g("commit", "-q", "-m", "起点")
        run(["init"], hub)
        assert g("tag", "-l", "bk-v0001") == "bk-v0001"
        # 两个并行任务包
        run(["pack", "U01"], hub)
        run(["pack", "U02"], hub)
        outbox = tmp / "handoff" / "outbox"
        assert (outbox / "bk-v0001-U01.zip").exists() and (outbox / "bk-v0001-U02.zip").exists()

        def web_session(zipname, task, edit, fail=False):
            sbx = tmp / f"sbx-{task}"
            safe_extract(outbox / zipname, sbx)
            repo = sbx / "repo"
            wenv = dict(base_env, BK_ENV="web", BK_OUTPUTS=str(tmp / "downloads"), BK_UPLOADS=str(outbox))
            run(["start", task], repo, wenv)
            for rel, content in edit.items():
                p = repo / rel
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(content, encoding="utf-8")
            subprocess.run(["git", "add", "-A"], cwd=repo, check=True)
            subprocess.run(["git", "commit", "-q", "-m", "改动"], cwd=repo, check=True)
            rp = repo / "progress" / "reports" / f"{task}-r1.md"
            t = rp.read_text(encoding="utf-8")
            for sec in ("一句话", "怎么看效果", "做了什么"):
                t = re.sub(rf"(## {sec}\s*\n)（待填[^\n]*）", rf"\1自检：{sec}", t)
            rp.write_text(t, encoding="utf-8")
            if fail:
                (repo / "FAIL").write_text("1", encoding="utf-8")
                d, _ = read_report(rp)
                d["questions"] = [{"q": "按钮放左边还是右边？", "options": ["A 左", "B 右"], "recommend": "A", "temp": "A"}]
                write_report_data(rp, d)
            (repo / "app" / "node_modules").mkdir(parents=True, exist_ok=True)
            (repo / "app" / "node_modules" / "big.bin").write_bytes(b"0" * 1000)
            (repo / ".env").write_text("SECRET=1\n", encoding="utf-8")
            run(["done"], repo, wenv)
            return repo

        web_session("bk-v0001-U01.zip", "U01", {"app/S01/index.ts": "export const a = 1;\n"})
        with zipfile.ZipFile(tmp / "downloads" / "bk-v0001-U01-r1-done.zip") as zf:
            names = zf.namelist()
        assert not any("node_modules" in n or n.endswith("/.env") for n in names), "结果包里混进了 node_modules 或 .env"
        assert "repo/.bk/package.json" in names and "RESULT.md" in names
        time.sleep(1.1)
        r2 = web_session("bk-v0001-U02.zip", "U02", {"app/S02/index.ts": "export const b = 2;\n"}, fail=True)
        # 先收 U01（取最早的一个）
        z1 = tmp / "downloads" / "bk-v0001-U01-r1-done.zip"
        out = run(["in", str(z1)], hub)
        assert "v0002" in out, out
        assert (hub / "app" / "S01" / "index.ts").exists()
        # 收 U02：网页端验证被跳过时 FAIL 文件会让本地验证失败 → 出修复包
        z2 = tmp / "downloads" / "bk-v0001-U02-r1-done.zip"
        assert z2.exists(), "U02 结果包没生成"
        out = run(["in", str(z2)], hub)
        assert "修复包" in out, out
        fixz = tmp / "handoff" / "fixes" / "bk-v0001-U02-r2-fix.zip"
        assert fixz.exists()
        assert g("rev-parse", "--abbrev-ref", "HEAD") == "main" and current_version(hub) == 2
        # 网页端修复
        sbx = tmp / "sbx-fix"
        safe_extract(fixz, sbx)
        repo = sbx / "repo"
        wenv = dict(base_env, BK_ENV="web", BK_OUTPUTS=str(tmp / "downloads"), BK_UPLOADS=str(tmp / "handoff" / "fixes"))
        run(["start", "U02"], repo, wenv)
        (repo / "FAIL").unlink()
        rp = repo / "progress" / "reports" / "U02-r2.md"
        t = rp.read_text(encoding="utf-8")
        for sec in ("一句话", "怎么看效果", "做了什么"):
            t = re.sub(rf"(## {sec}\s*\n)（待填[^\n]*）", rf"\1修复：{sec}", t)
        rp.write_text(t, encoding="utf-8")
        run(["done"], repo, wenv)
        out = run(["in", "--latest"], hub)
        assert "v0003" in out, out
        assert (hub / "app" / "S02" / "index.ts").exists() and not (hub / "FAIL").exists()
        tm = task_map(load_json(hub / "progress" / "tasks.json"))
        assert tm["U01"]["status"] == "done" and tm["U02"]["status"] == "done"
        pm_ = {p["id"]: p["status"] for p in load_json(hub / "progress" / "pages.json")["pages"]}
        assert pm_ == {"S01": "ui", "S02": "ui"}, pm_
        q = load_json(hub / "progress" / "questions.json")["questions"]
        assert q and q[0]["id"].startswith("U02-"), q
        assert (tmp / "handoff" / "versions" / "bk-v0003.zip").exists()
        # 越权改进度文件会被拦下
        run(["pack", "fix", "--title", "自检临时修复"], hub)
        fz = sorted((tmp / "handoff" / "outbox").glob("bk-v0003-X*.zip"))[-1]
        sbx = tmp / "sbx-x"
        safe_extract(fz, sbx)
        repo = sbx / "repo"
        tid = fz.stem.split("-")[2]
        run(["start", tid], repo, wenv)
        (repo / "progress" / "pages.json").write_text("{}", encoding="utf-8")
        run(["done"], repo, wenv, expect=1)
        assert "RECENT.md" in zipfile.ZipFile(fz).namelist(), "任务包里缺 RECENT.md"
        # 护栏：跳过测试、冻结前写迁移会被拦；写明理由后可交
        base0 = load_json(repo / ".bk" / "session.json")["base"]
        subprocess.run(["git", "checkout", "-q", base0, "--", "progress/pages.json"], cwd=repo, check=True)
        (repo / "tests" / "sample.test.ts").write_text("test('a', () => {})\ntest.skip('b', () => {})\n", encoding="utf-8")
        run(["done"], repo, wenv, expect=1)
        mig = repo / "packages" / "db" / "prisma" / "migrations" / "001"
        mig.mkdir(parents=True)
        (mig / "migration.sql").write_text("select 1;\n", encoding="utf-8")
        run(["done", "--allow-test-change", "测试本身写错了"], repo, wenv, expect=1)
        shutil.rmtree(repo / "packages")
        rp = repo / "progress" / "reports" / f"{tid}-r1.md"
        t = rp.read_text(encoding="utf-8")
        for sec in ("一句话", "怎么看效果", "做了什么"):
            t = re.sub(rf"(## {sec}\s*\n)（待填[^\n]*）", rf"\1护栏：{sec}", t)
        rp.write_text(t, encoding="utf-8")
        run(["done", "--allow-test-change", "测试本身写错了"], repo, wenv)
        out = run(["in", "--latest"], hub)
        assert "改动了测试" in out and "v0004" in out, out
        # 闸门：先看再合并；退回出修复包；修好后再看、确认合并
        run(["pack", "U03"], hub)
        z3 = sorted((tmp / "handoff" / "outbox").glob("bk-v0004-U03.zip"))[-1]
        sbx = tmp / "sbx-u03"
        safe_extract(z3, sbx)
        repo = sbx / "repo"
        run(["start", "U03"], repo, wenv)
        (repo / "app" / "S03").mkdir(parents=True, exist_ok=True)
        (repo / "app" / "S03" / "index.ts").write_text("export const c = 3;\n", encoding="utf-8")
        rp = repo / "progress" / "reports" / "U03-r1.md"
        t = rp.read_text(encoding="utf-8")
        for sec in ("一句话", "怎么看效果", "做了什么"):
            t = re.sub(rf"(## {sec}\s*\n)（待填[^\n]*）", rf"\1闸门：{sec}", t)
        rp.write_text(t, encoding="utf-8")
        run(["done"], repo, wenv)
        out = run(["in", "--latest"], hub)
        assert "停在合并前" in out and current_version(hub) == 4, out
        out = run(["in", "--reject", "按钮颜色不对"], hub)
        assert (tmp / "handoff" / "fixes" / "bk-v0004-U03-r2-fix.zip").exists(), out
        sbx = tmp / "sbx-u03b"
        safe_extract(tmp / "handoff" / "fixes" / "bk-v0004-U03-r2-fix.zip", sbx)
        assert "老板看到的问题" in (sbx / "FIX.md").read_text(encoding="utf-8")
        repo = sbx / "repo"
        run(["start", "U03"], repo, dict(wenv, BK_UPLOADS=str(tmp / "handoff" / "fixes")))
        (repo / "app" / "S03" / "index.ts").write_text("export const c = 33;\n", encoding="utf-8")
        run(["done"], repo, dict(wenv, BK_UPLOADS=str(tmp / "handoff" / "fixes")))
        out = run(["in", "--latest"], hub)
        assert "停在合并前" in out, out
        out = run(["in", "--continue"], hub)
        assert "v0005" in out and (hub / "app" / "S03" / "index.ts").read_text(encoding="utf-8").strip() == "export const c = 33;", out
        # 规则卡没定稿，后端任务不出包；确认后可以
        run(["pack", "B09"], hub, expect=1)
        run(["confirm", "demo-rule"], hub)
        run(["pack", "B09"], hub)
        say(f"✓ 自检通过：出包、网页端开工与收工、并行两包、收包合并、失败出修复包、修复后合并、越权拦截、"
            f"跳过测试与冻结前迁移的护栏、先看再合并与退回、规则卡定稿检查都正常。（临时目录 {tmp}）")
    finally:
        if not args.keep:
            shutil.rmtree(tmp, ignore_errors=True)


# ───────────────────────── 入口 ─────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(prog="bk", description="备考助手 V4 交接与进度工具", formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("start", help="开工：探测环境、装依赖、建任务分支、打印任务简报")
    s.add_argument("task")
    s.add_argument("--title", default="")
    s.add_argument("--resume", action="store_true", help="沙箱重置后接续")
    s.add_argument("--install", action="store_true", help="本地也安装依赖")
    s.add_argument("--no-install", action="store_true")
    s.add_argument("--with-db", action="store_true", help="尝试在沙箱里启动数据库（需要 tools/sandbox-db.sh）")
    s.add_argument("--from-failed", default="", help="本地：从验证失败的结果接着修，如 U02-r1")
    s.add_argument("--force", action="store_true", help="本地：范围重叠也照样开工")
    s.set_defaults(fn=cmd_start)
    s = sub.add_parser("task", help="只打印任务简报")
    s.add_argument("task")
    s.set_defaults(fn=cmd_task)
    s = sub.add_parser("verify", help="跑检查：quick / web / full")
    s.add_argument("--level", choices=["quick", "web", "full"])
    s.set_defaults(fn=cmd_verify)
    s = sub.add_parser("done", help="收工")
    s.add_argument("--checkpoint", action="store_true", help="只出检查点包")
    s.add_argument("--allow-hot", nargs="?", const="未写理由", default=None, help="确需改热点文件时写理由")
    s.add_argument("--allow-test-change", nargs="?", const="未写理由", default=None, help="确需删改测试时写理由")
    s.add_argument("--level", choices=["quick", "web", "full"])
    s.add_argument("--force", action="store_true", help="验证没过也交（状态应写 partial）")
    s.set_defaults(fn=cmd_done)
    s = sub.add_parser("in", help="本地收结果包")
    s.add_argument("zip", nargs="?")
    s.add_argument("--latest", action="store_true")
    s.add_argument("--all", action="store_true", help="按时间顺序收所有没收过的结果包")
    s.add_argument("--branch", default="", help="收 GitHub 上的任务分支（Claude Code 网页版用）")
    s.add_argument("--continue", dest="cont", action="store_true")
    s.add_argument("--abort", action="store_true")
    s.add_argument("--reject", default=None, help="停在合并前的结果不满意：写下问题，出修复包")
    s.set_defaults(fn=cmd_in)
    s = sub.add_parser("pack", help="出包：不带任务=版本包；带任务=任务包；fix=临时修复包")
    s.add_argument("task", nargs="?")
    s.add_argument("--title", default="")
    s.add_argument("--note", default="")
    s.add_argument("--force", action="store_true")
    s.set_defaults(fn=cmd_pack)
    for name, fn, h in (("status", cmd_status, "现在到哪了"), ("board", cmd_board, "重新生成进度看板"),
                        ("where", cmd_where, "列出中转文件夹"), ("doctor", cmd_doctor, "环境检查"),
                        ("init", cmd_init, "第一次安装后初始化"), ("ship", cmd_ship, "推送 GitHub")):
        s = sub.add_parser(name, help=h)
        s.set_defaults(fn=fn)
    s = sub.add_parser("run", help="本地预览（后台运行）")
    s.add_argument("--real", action="store_true", help="真实后端模式（起数据库）")
    s.add_argument("--stop", action="store_true", help="停止预览")
    s.add_argument("--fg", action="store_true", help="在前台运行（按 Ctrl+C 停止）")
    s.set_defaults(fn=cmd_run)
    s = sub.add_parser("accept", help="把页面标记为你已验收")
    s.add_argument("pages", nargs="+")
    s.set_defaults(fn=cmd_accept)
    s = sub.add_parser("confirm", help="你确认规则卡后，把它标为已定稿（锁定）")
    s.add_argument("what", help="R 任务编号或规则名，如 R01 或 evidence-mastery")
    s.set_defaults(fn=cmd_confirm)
    s = sub.add_parser("answer", help="记录你对某个问题的拍板")
    s.add_argument("qid")
    s.add_argument("text")
    s.set_defaults(fn=cmd_answer)
    s = sub.add_parser("map", help="仓库地图")
    s.add_argument("--depth", type=int, default=2)
    s.set_defaults(fn=cmd_map)
    s = sub.add_parser("spec", help="打印原型里某页的说明")
    s.add_argument("pages", nargs="+")
    s.set_defaults(fn=cmd_spec)
    s = sub.add_parser("proto", help="原型截图（参数同 tools/proto-shots.cjs）")
    s.add_argument("rest", nargs=argparse.REMAINDER)
    s.set_defaults(fn=cmd_proto)
    s = sub.add_parser("selftest", help="自检")
    s.add_argument("--keep", action="store_true")
    s.set_defaults(fn=cmd_selftest)
    args = ap.parse_args()
    try:
        args.fn(args)
    except BkError as e:
        die(str(e))
    except subprocess.TimeoutExpired as e:
        die(f"命令超时：{e}")
    except KeyboardInterrupt:
        die("已中断", 130)


if __name__ == "__main__":
    main()
