#!/usr/bin/env python3
"""spec_tool：文档体系的检查、任务包、生成与登记工具。

命令与检查规则见 docs/meta/doc-system.md 附录 J、附录 K。
依赖：Python 3.9+、PyYAML。所有命令从仓库根运行：python scripts/spec_tool.py <命令>。
"""
from __future__ import annotations

import argparse
import datetime as _dt
import fnmatch
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.stderr.write("需要 PyYAML：pip install pyyaml\n")
    sys.exit(2)

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
TOOL_REL = "scripts/spec_tool.py"
SKIP_DIRS = {".git", "node_modules", ".pack", ".trace", ".eval", ".test-results", "dist", "build",
             "coverage", ".venv", "venv", "__pycache__", ".next", ".turbo", ".plans"}
TEXT_EXT = {".md", ".yaml", ".yml", ".json", ".toml", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
            ".py", ".sh", ".html", ".css", ".txt", ".sql", ".prisma", ".vue", ".svelte", ".gitignore"}
CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".vue", ".svelte", ".sql", ".prisma"}
DOMAIN_CODE_RE = re.compile(r"^[A-Z]{2,6}$")
FEATURE_ID_RE = re.compile(r"^([A-Z]{2,6})-(\d{2,3})$")
ITEM_ID_RE = re.compile(r"^([SOP]\d{2})-(\d{2})$")
PAGE_ID_RE = re.compile(r"^[SOP]\d{2}$")
END_OF_PREFIX = {"S": "learner", "O": "org", "P": "admin"}


# ---------------------------------------------------------------- 基础工具

def rel(p) -> str:
    p = Path(p)
    try:
        return p.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return p.as_posix()


def read_text(p) -> str:
    return Path(p).read_text(encoding="utf-8")


def write_text(p, s: str) -> None:
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)


def utf8len(s: str) -> int:
    return len(s.encode("utf-8"))


def short_hash(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:12]


def today() -> str:
    return _dt.date.today().isoformat()


def is_text_file(p: Path) -> bool:
    return p.suffix.lower() in TEXT_EXT or p.name in {"pre-commit", "AGENTS.md", ".gitignore"}


def walk_files(base: Path | None = None, skip_dirs=SKIP_DIRS):
    base = ROOT if base is None else base
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = sorted(d for d in dirnames if d not in skip_dirs)
        for fn in sorted(filenames):
            yield Path(dirpath) / fn


def load_yaml_text(text: str, where: str = ""):
    return yaml.safe_load(text)


class YamlError(Exception):
    pass


def load_yaml(path, default=None):
    p = Path(path)
    if not p.exists():
        return default
    try:
        data = yaml.safe_load(read_text(p))
    except yaml.YAMLError as e:
        raise YamlError(f"{rel(p)}：YAML 解析失败：{str(e).splitlines()[0]}")
    return default if data is None else data


def split_front_matter(text: str):
    """返回 (front_matter_dict, body, body_start_line)。"""
    if text.startswith("---\n") or text.startswith("---\r\n"):
        end = re.search(r"^---\s*$", text[4:], re.M)
        if end:
            fm_text = text[4:4 + end.start()]
            body = text[4 + end.end():]
            if body.startswith("\n"):
                body = body[1:]
            try:
                fm = yaml.safe_load(fm_text) or {}
            except yaml.YAMLError as e:
                raise YamlError(f"front matter 解析失败：{str(e).splitlines()[0]}")
            line = fm_text.count("\n") + 3
            return fm, body, line
    return {}, text, 1


def md_sections(body: str, level: int = 2):
    """按标题切分：返回 [(标题文本, 内容)]，内容不含标题行。"""
    pat = re.compile(r"^(#{%d})\s+(.*?)\s*$" % level, re.M)
    out, matches = [], list(pat.finditer(body))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        out.append((m.group(2), body[m.end():end].strip("\n")))
    return out


def strip_code(text: str) -> str:
    """去掉围栏代码块与行内代码，用于扫描散文。"""
    text = re.sub(r"```.*?```", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    return re.sub(r"`[^`\n]*`", "", text)


# ---------------------------------------------------------------- 配置

DEFAULT_CONFIG = {
    "paths": {"prototype_source": "", "prototype_mode": "frozen", "archive": "../exam-prep-archive",
              "merge_history": "../exam-prep-archive/prototype/merge-history.yaml"},
    "deep_source": {"prototype": "", "refine_list": "", "forbidden_patterns": []},
    "budgets": {"root_agents_kib": 8, "end_agents_kib": 3, "pkg_agents_kib": 2, "codex_chain_kib": 12,
                "claude_resident_kib": 10, "skill_desc_total_chars": 3000, "skill_desc_max_chars": 300,
                "rules_concurrent_warn": 60, "rules_concurrent_error": 80, "convention_rules_max": 15,
                "spec_body_chars": 6000, "pack_chars": 15000, "pack_slice_chars": 2500},
    "shots": {"learner": [375, 1280], "org": [1280], "admin": [1280], "height": 900},
    "verify": {"lint": "", "lint_files": "", "typecheck": "", "test": "", "e2e_smoke": "",
               "results": ".test-results/results.json", "stack_marker": "package.json"},
    "eval": {"runner": "", "records": ".eval"},
    "git": {"main": "main"},
    "tools": {"claude_min_version": "2.1.283"},
    "check": {"history_words": ["原来", "改为", "之前", "原方案", "已调整", "调整为", "此前"],
              "term_scan": ["docs/**/*.md", "apps/**", "packages/ui/**", "design/screens/**/*.yaml"],
              "term_exclude": ["docs/meta/**", "docs/product/glossary.yaml", "docs/adr/**"],
              "copy_scan": ["apps/**", "packages/ui/**", "design/screens/**/*.yaml", "docs/product/brief.md"]},
    "gen": {"params_out": "packages/params/index.ts", "roadmap_out": "docs/product/roadmap.md"},
}


def _deep_merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def _mini_toml(text: str) -> dict:
    """tomllib 不可用时的最小解析：节、键 = 字符串/数字/布尔/数组。"""
    data, cur = {}, None
    cur = data
    buf = ""
    for raw in text.splitlines():
        line = raw.split("#", 1)[0] if not re.search(r"""['"][^'"]*#""", raw) else raw
        line = line.strip()
        if not line and not buf:
            continue
        if buf:
            buf += " " + line
            if buf.count("[") > buf.count("]"):
                continue
            line, buf = buf, ""
        m = re.match(r"^\[([^\]]+)\]$", line)
        if m:
            cur = data
            for part in m.group(1).split("."):
                cur = cur.setdefault(part.strip(), {})
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip()
        if v.startswith("[") and v.count("[") > v.count("]"):
            buf = f"{k}= {v}"
            continue
        cur[k.strip()] = _mini_toml_value(v)
    return data


def _mini_toml_value(v: str):
    v = v.strip()
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        items, cur, q = [], "", None
        for ch in inner:
            if q:
                cur += ch
                if ch == q:
                    q = None
            elif ch in "'\"":
                q = ch
                cur += ch
            elif ch == ",":
                if cur.strip():
                    items.append(_mini_toml_value(cur))
                cur = ""
            else:
                cur += ch
        if cur.strip():
            items.append(_mini_toml_value(cur))
        return items
    if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
        s = v[1:-1]
        return s if v[0] == "'" else bytes(s, "utf-8").decode("unicode_escape") if "\\" in s and not re.search(r"\\[dws]", s) else s
    if v in ("true", "false"):
        return v == "true"
    try:
        return float(v) if "." in v else int(v)
    except ValueError:
        return v


def load_config() -> dict:
    p = ROOT / "scripts" / "spec_tool.toml"
    data = {}
    if p.exists():
        text = read_text(p)
        try:
            import tomllib  # type: ignore
            data = tomllib.loads(text)
        except ModuleNotFoundError:
            try:
                import tomli  # type: ignore
                data = tomli.loads(text)
            except ModuleNotFoundError:
                data = _mini_toml(text)
    return _deep_merge(DEFAULT_CONFIG, data)


CFG = load_config()


# ---------------------------------------------------------------- git

def git(*args, check=False) -> tuple[int, str]:
    try:
        r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    except FileNotFoundError:
        return 127, ""
    if check and r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r.returncode, r.stdout


def in_git() -> bool:
    code, out = git("rev-parse", "--is-inside-work-tree")
    return code == 0 and out.strip() == "true"


def current_branch() -> str:
    if not in_git():
        return ""
    code, out = git("rev-parse", "--abbrev-ref", "HEAD")
    if code != 0:
        code, out = git("symbolic-ref", "--short", "HEAD")
    return out.strip() if code == 0 else ""


def main_branch() -> str:
    return CFG["git"].get("main", "main")


def ref_exists(ref: str) -> bool:
    code, _ = git("rev-parse", "--verify", "--quiet", ref + "^{commit}")
    return code == 0


def git_show(ref: str, path: str):
    code, out = git("show", f"{ref}:{path}")
    return out if code == 0 else None


def git_ls(ref: str, path: str) -> list[str]:
    code, out = git("ls-tree", "-r", "--name-only", ref, "--", path)
    return out.split() if code == 0 else []


def baseline_refs() -> list[str]:
    """“主干上一版”：在主干上取 HEAD 与 HEAD^；在其他分支上取主干。"""
    if not in_git():
        return []
    refs = []
    main = main_branch()
    br = current_branch()
    if ref_exists("HEAD"):
        refs.append("HEAD")
    if br == main:
        if ref_exists("HEAD^"):
            refs.append("HEAD^")
    else:
        for cand in (main, f"origin/{main}"):
            if ref_exists(cand):
                refs.append(cand)
                break
    return refs


def changed_files(staged: bool = False) -> list[str]:
    if not in_git():
        return []
    if staged:
        code, out = git("diff", "--cached", "--name-only", "--diff-filter=ACMRD")
        return [l.strip() for l in out.splitlines() if l.strip()]
    code, out = git("status", "--porcelain", "--untracked-files=all")
    files = []
    for line in out.splitlines():
        if not line.strip():
            continue
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        files.append(path.strip().strip('"'))
    return files


def branch_feature_id(branch: str):
    m = re.match(r"^(?:feat|spec)/([A-Z]{2,6}-\d{2,3})(?:-|$)", branch or "")
    return m.group(1) if m else None


def branch_refine_page(branch: str):
    m = re.match(r"^refine/([SOP]\d{2})$", branch or "")
    return m.group(1) if m else None


# ---------------------------------------------------------------- glob

_GLOB_CACHE: dict[str, re.Pattern] = {}


def glob_to_regex(glob: str) -> re.Pattern:
    if glob in _GLOB_CACHE:
        return _GLOB_CACHE[glob]
    i, out = 0, ""
    while i < len(glob):
        c = glob[i]
        if glob.startswith("**/", i):
            out += r"(?:.*/)?"
            i += 3
            continue
        if glob.startswith("**", i):
            out += r".*"
            i += 2
            continue
        if c == "*":
            out += r"[^/]*"
        elif c == "?":
            out += r"[^/]"
        elif c == "{":
            j = glob.find("}", i)
            if j > i:
                out += "(?:" + "|".join(re.escape(x) for x in glob[i + 1:j].split(",")) + ")"
                i = j + 1
                continue
            out += re.escape(c)
        else:
            out += re.escape(c)
        i += 1
    pat = re.compile("^" + out + "$")
    _GLOB_CACHE[glob] = pat
    return pat


def match_glob(path: str, glob: str) -> bool:
    return bool(glob_to_regex(glob).match(path))


_DIR_SAMPLES = ["index.ts", "index.tsx", "x.test.ts", "x.md", "x.yaml", "x.json", "x.py", "a/b.tsx", "a/b.ts"]


def path_matches_any(path: str, globs) -> bool:
    path = path.strip("/")
    for g in globs or []:
        if match_glob(path, g):
            return True
        if (ROOT / path).is_dir() or "." not in Path(path).name:
            if any(match_glob(f"{path}/{s}", g) for s in _DIR_SAMPLES):
                return True
    return False


# ---------------------------------------------------------------- YAML 输出（稳定、可读）

_YAML_RESERVED = {"true", "false", "yes", "no", "on", "off", "null", "~", "y", "n", ""}


def _plain_ok(s: str) -> bool:
    if s.lower() in _YAML_RESERVED or s != s.strip() or "\n" in s or "\t" in s:
        return False
    if re.match(r"^[-?:,\[\]{}#&*!|>'\"%@`]", s):
        return False
    if ": " in s or " #" in s or s.endswith(":"):
        return False
    if re.match(r"^[-+]?(\d[\d_]*)?(\.\d+)?([eE][-+]?\d+)?$", s) and any(ch.isdigit() for ch in s):
        return False
    if re.match(r"^\d{4}-\d{2}-\d{2}", s) or re.match(r"^0[0-7]+$|^0x", s):
        return False
    return True


def yaml_scalar(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v) if isinstance(v, float) else str(v)
    s = str(v)
    return s if _plain_ok(s) else json.dumps(s, ensure_ascii=False)


def _flow_list(lst) -> str:
    return "[" + ", ".join(yaml_scalar(x) for x in lst) + "]"


def dump_yaml(obj, indent: int = 0, flow_max: int = 110) -> str:
    sp = " " * indent
    lines = []
    if isinstance(obj, dict):
        if not obj:
            return sp + "{}\n"
        for k, v in obj.items():
            key = yaml_scalar(k)
            if isinstance(v, dict) and v:
                lines.append(f"{sp}{key}:\n" + dump_yaml(v, indent + 2, flow_max))
            elif isinstance(v, list) and v and not all(not isinstance(x, (dict, list)) for x in v):
                lines.append(f"{sp}{key}:\n" + dump_yaml(v, indent + 2, flow_max))
            elif isinstance(v, list):
                flow = _flow_list(v)
                if len(flow) + indent + len(key) + 2 <= flow_max or not v:
                    lines.append(f"{sp}{key}: {flow}\n")
                else:
                    lines.append(f"{sp}{key}:\n" + "".join(f"{sp}  - {yaml_scalar(x)}\n" for x in v))
            elif isinstance(v, dict):
                lines.append(f"{sp}{key}: {{}}\n")
            else:
                lines.append(f"{sp}{key}: {yaml_scalar(v)}\n")
        return "".join(lines)
    if isinstance(obj, list):
        if not obj:
            return sp + "[]\n"
        for v in obj:
            if isinstance(v, dict) and v:
                inner = dump_yaml(v, indent + 2, flow_max)
                lines.append(sp + "- " + inner[indent + 2:])
            elif isinstance(v, list):
                lines.append(f"{sp}- {_flow_list(v)}\n")
            else:
                lines.append(f"{sp}- {yaml_scalar(v)}\n")
        return "".join(lines)
    return sp + yaml_scalar(obj) + "\n"


# ---------------------------------------------------------------- 报错

class Finding:
    __slots__ = ("code", "file", "loc", "msg", "fix")

    def __init__(self, code, file, loc, msg, fix):
        self.code, self.file, self.loc, self.msg, self.fix = code, file, loc, msg, fix

    @property
    def is_error(self) -> bool:
        return self.code.startswith("E-")

    def __str__(self):
        where = f"{self.file}:{self.loc}" if self.loc not in (None, "") else self.file
        return f"{self.code} {where}：{self.msg}。改法：{self.fix}"


def F(code, file, loc, msg, fix) -> Finding:
    return Finding(code, file, loc, msg.rstrip("。"), fix.rstrip("。") + "")


def line_of(text: str, needle: str, default: int = 1) -> int:
    i = text.find(needle)
    return text.count("\n", 0, i) + 1 if i >= 0 else default


# ---------------------------------------------------------------- 仓库模型

SPEC_SECTIONS = ["1 目标与边界", "2 业务规则", "3 界面", "4 数据", "5 AI 行为", "6 验收", "7 不变量与合规"]
REF_TYPES = ["api", "schema", "permissions", "events", "errors", "domain_events", "params", "data_classes",
             "metrics", "ai", "models", "inv", "features", "adr"]
WORK_SECTIONS = ["计划", "决定", "进度", "交接记录", "包外读取", "复核", "未决"]
ROOT_AGENTS_SECTIONS = ["权威来源", "红线", "工作方式", "命令", "易错点", "Code Review Rules"]
SKILL_STD_FIELDS = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}
FORBIDDEN_INSTR = ["CLAUDE.md", "CLAUDE.local.md", "AGENTS.override.md", "AGENTS.local.md"]
AC_RE = re.compile(r"^\s*(?:[-*]\s+)?([A-Z]{2,6}-\d{2,3}-AC\d+)\b", re.M)
TAG_RE = re.compile(r"\[((?:[A-Z]{2,6}-\d{2,3}-AC\d+)|(?:INV-\d{2,3})|(?:GP-\d+))\]")
TEST_FILE_RE = re.compile(r"(\.test\.|\.spec\.|^test_|_test\.py$|\.e2e\.)")


class Spec:
    def __init__(self, path: Path):
        self.path = path
        self.rel = rel(path)
        self.text = read_text(path)
        self.error = None
        try:
            self.fm, self.body, self.body_line = split_front_matter(self.text)
        except YamlError as e:
            self.fm, self.body, self.body_line, self.error = {}, self.text, 1, str(e)
        self.id = str(self.fm.get("id", ""))
        self.status = str(self.fm.get("status", "draft"))
        self.refs = self.fm.get("refs") or {}
        if not isinstance(self.refs, dict):
            self.refs = {}
        self.oqs = self.fm.get("open_questions") or []
        self.sections = dict(md_sections(self.body, 2))
        self.acs = AC_RE.findall(self.body)

    def section(self, num: str) -> str:
        for k, v in self.sections.items():
            if k.startswith(num + " ") or k == num:
                return v
        return ""

    def ref_list(self, kind: str) -> list[str]:
        v = self.refs.get(kind) or []
        return [str(x) for x in v] if isinstance(v, list) else [str(v)]


class Repo:
    """按需加载仓库中的各类登记。解析错误记在 self.load_errors。"""

    def __init__(self, root: Path | None = None):
        self.root = ROOT if root is None else root
        self.load_errors: list[Finding] = []
        self._cache = {}

    # ---- 通用
    def _yaml(self, relpath: str, default):
        key = ("yaml", relpath)
        if key not in self._cache:
            try:
                self._cache[key] = load_yaml(self.root / relpath, default)
            except YamlError as e:
                self.load_errors.append(F("E-SCHEMA-01", relpath, 1, str(e).split("：", 1)[-1], "修正 YAML 语法"))
                self._cache[key] = default
        return self._cache[key]

    def _list(self, relpath: str, key_field: str, list_key: str | None = None) -> list[dict]:
        data = self._yaml(relpath, [] if list_key is None else {})
        if list_key is not None:
            data = (data or {}).get(list_key, []) if isinstance(data, dict) else []
        if not isinstance(data, list):
            self.load_errors.append(F("E-SCHEMA-01", relpath, 1, "顶层应为列表", "按 doc-system 附录模板改写"))
            return []
        out = []
        for i, e in enumerate(data):
            if not isinstance(e, dict) or key_field not in e:
                self.load_errors.append(F("E-SCHEMA-01", relpath, f"[{i}]", f"条目缺少 {key_field}", f"补上 {key_field}"))
                continue
            out.append(e)
        return out

    # ---- 产品登记
    @property
    def features(self) -> list[dict]:
        return self._list("docs/product/roadmap.yaml", "id")

    @property
    def feature_map(self) -> dict:
        return {str(f["id"]): f for f in self.features}

    @property
    def phases(self) -> list[dict]:
        data = self._yaml("docs/product/phases.yaml", {})
        return data.get("phases", []) if isinstance(data, dict) else []

    @property
    def rings(self) -> list[dict]:
        data = self._yaml("docs/product/phases.yaml", {})
        return data.get("rings", []) if isinstance(data, dict) else []

    def loops(self):
        for ph in self.phases:
            for lp in ph.get("loops", []) or []:
                yield ph, lp

    def loop_of_feature(self) -> dict:
        out = {}
        for ph, lp in self.loops():
            for fid in lp.get("features", []) or []:
                out.setdefault(str(fid), []).append((ph, lp))
        return out

    @property
    def domains(self) -> list[dict]:
        return self._list("docs/product/domain-map.yaml", "name")

    @property
    def domain_names(self) -> set:
        return {str(d["name"]) for d in self.domains}

    @property
    def domain_by_code(self) -> dict:
        return {str(d.get("code")): d for d in self.domains}

    @property
    def glossary(self) -> list[dict]:
        return self._list("docs/product/glossary.yaml", "term")

    @property
    def invariants(self) -> list[dict]:
        return self._list("docs/product/invariants.yaml", "id")

    @property
    def inv_map(self) -> dict:
        return {str(i["id"]): i for i in self.invariants}

    @property
    def cross_oqs(self) -> list[dict]:
        return self._list("docs/product/open-questions.yaml", "id")

    # ---- 契约
    @property
    def openapi(self) -> dict:
        return self._yaml("contracts/openapi.yaml", {}) or {}

    @property
    def operations(self) -> dict:
        out = {}
        for path, ops in (self.openapi.get("paths") or {}).items():
            if not isinstance(ops, dict):
                continue
            for method, op in ops.items():
                if isinstance(op, dict) and op.get("operationId"):
                    out[op["operationId"]] = {"method": method.upper(), "path": path, **op}
        return out

    @property
    def tables(self) -> dict:
        key = ("tables",)
        if key in self._cache:
            return self._cache[key]
        out = {}
        d = self.root / "contracts" / "schema"
        if d.exists():
            for p in sorted(d.glob("*.y*ml")):
                r = rel(p)
                try:
                    data = load_yaml(p, {})
                except YamlError as e:
                    self.load_errors.append(F("E-SCHEMA-01", r, 1, str(e).split("：", 1)[-1], "修正 YAML 语法"))
                    continue
                if not isinstance(data, dict) or "table" not in data:
                    self.load_errors.append(F("E-SCHEMA-01", r, 1, "缺少 table 字段", "按 docs/conventions/data.md 的表定义格式补齐"))
                    continue
                data["_file"] = r
                out[str(data["table"])] = data
        self._cache[key] = out
        return out

    @property
    def permissions(self) -> dict:
        return self._yaml("contracts/permissions.yaml", {}) or {}

    @property
    def actions(self) -> dict:
        acts = self.permissions.get("actions") or []
        return {str(a["id"]): a for a in acts if isinstance(a, dict) and "id" in a}

    @property
    def roles(self) -> dict:
        return self.permissions.get("roles") or {}

    @property
    def analytics_events(self) -> dict:
        return {str(e["name"]): e for e in self._list("contracts/events.yaml", "name")}

    @property
    def errors(self) -> dict:
        return {str(e["code"]): e for e in self._list("contracts/errors.yaml", "code")}

    @property
    def domain_events(self) -> dict:
        return {str(e["name"]): e for e in self._list("contracts/domain-events.yaml", "name")}

    @property
    def params(self) -> dict:
        return {str(e["name"]): e for e in self._list("contracts/params.yaml", "name")}

    @property
    def data_classes(self) -> dict:
        return {str(e["id"]): e for e in self._list("contracts/data-classes.yaml", "id")}

    @property
    def metrics(self) -> dict:
        return {str(e["id"]): e for e in self._list("contracts/metrics.yaml", "id")}

    @property
    def scenarios(self) -> dict:
        return {str(e["id"]): e for e in self._list("contracts/ai/scenarios.yaml", "id")}

    @property
    def actors(self) -> dict:
        return {str(e["id"]): e for e in self._list("contracts/ai/actors.yaml", "id")}

    # ---- 页面登记
    @property
    def screens(self) -> dict:
        key = ("screens",)
        if key in self._cache:
            return self._cache[key]
        out = {}
        for end in ("learner", "org", "admin"):
            d = self.root / "design" / "screens" / end
            if not d.exists():
                continue
            for p in sorted(d.glob("*.yaml")):
                r = rel(p)
                try:
                    data = load_yaml(p, {})
                except YamlError as e:
                    self.load_errors.append(F("E-SCHEMA-01", r, 1, str(e).split("：", 1)[-1], "修正 YAML 语法"))
                    continue
                if not isinstance(data, dict) or "id" not in data:
                    self.load_errors.append(F("E-SCHEMA-01", r, 1, "页面登记缺少 id", "按附录 C 补齐"))
                    continue
                data["_file"] = r
                out[str(data["id"])] = data
        self._cache[key] = out
        return out

    @property
    def items(self) -> dict:
        """条目编号 → (页 ID, 条目)。"""
        out = {}
        for pid, pg in self.screens.items():
            for it in pg.get("items", []) or []:
                if isinstance(it, dict) and it.get("id"):
                    out[str(it["id"])] = (pid, it)
        return out

    # ---- 规格、约定、skill、ADR、模型
    @property
    def specs(self) -> dict:
        key = ("specs",)
        if key in self._cache:
            return self._cache[key]
        out = {}
        for p in sorted((self.root / "docs" / "domains").glob("*/features/*.md")):
            s = Spec(p)
            out[s.id or p.stem] = s
        self._cache[key] = out
        return out

    def spec_path_for(self, fid: str):
        f = self.feature_map.get(fid)
        if not f:
            return None
        return self.root / "docs" / "domains" / str(f.get("domain", "")) / "features" / f"{fid}.md"

    @property
    def conventions(self) -> dict:
        key = ("conventions",)
        if key in self._cache:
            return self._cache[key]
        out = {}
        for p in sorted((self.root / "docs" / "conventions").glob("*.md")):
            text = read_text(p)
            try:
                fm, body, line = split_front_matter(text)
            except YamlError as e:
                self.load_errors.append(F("E-SCHEMA-01", rel(p), 1, str(e), "修正 front matter"))
                fm, body, line = {}, text, 1
            secs = dict(md_sections(body, 2))
            title = (re.search(r"^#\s+(.+)$", body, re.M) or [None, p.stem])[1]
            rules_text = secs.get("规则", "")
            rules = re.findall(r"^\s*(\d+)\.\s+(.+)$", rules_text, re.M)
            out[p.stem] = {"name": p.stem, "path": rel(p), "fm": fm, "applies_to": fm.get("applies_to") or [],
                           "title": title.strip(), "sections": secs, "rules_text": rules_text, "rules": rules,
                           "text": text}
        self._cache[key] = out
        return out

    @property
    def skills(self) -> dict:
        key = ("skills",)
        if key in self._cache:
            return self._cache[key]
        out = {}
        d = self.root / ".agents" / "skills"
        for p in sorted(d.glob("*/SKILL.md")) if d.exists() else []:
            text = read_text(p)
            try:
                fm, body, line = split_front_matter(text)
            except YamlError as e:
                self.load_errors.append(F("E-SCHEMA-01", rel(p), 1, str(e), "修正 front matter"))
                fm, body, line = {}, text, 1
            out[p.parent.name] = {"name": p.parent.name, "path": rel(p), "dir": p.parent, "fm": fm, "body": body,
                                  "text": text, "body_line": line}
        self._cache[key] = out
        return out

    @property
    def adrs(self) -> dict:
        out = {}
        for p in sorted((self.root / "docs" / "adr").glob("ADR-*.md")):
            m = re.match(r"^(ADR-\d{3})-", p.name)
            if m:
                text = read_text(p)
                out[m.group(1)] = {"id": m.group(1), "path": rel(p), "text": text,
                                   "sections": dict(md_sections(text, 2)),
                                   "title": (re.search(r"^#\s+(.+)$", text, re.M) or [None, p.stem])[1]}
        return out

    def model_section(self, ref: str):
        """ref 形如 srs#review-interval；返回 (路径, 节文本) 或 None。"""
        if "#" not in ref:
            return None
        model, anchor = ref.split("#", 1)
        p = self.root / "docs" / "models" / f"{model}.md"
        if not p.exists():
            return None
        text = read_text(p)
        m = re.search(r'^(#{2,4})\s+(.*?)<a id="' + re.escape(anchor) + r'"></a>\s*$', text, re.M)
        if not m:
            return None
        level = len(m.group(1))
        nxt = re.compile(r"^#{1,%d}\s" % level, re.M).search(text, m.end())
        body = text[m.start():nxt.start() if nxt else len(text)].strip()
        return rel(p), body

    def model_anchors(self) -> dict:
        out = {}
        for p in sorted((self.root / "docs" / "models").glob("*.md")):
            for a in re.findall(r'<a id="([\w-]+)"></a>', read_text(p)):
                out[f"{p.stem}#{a}"] = rel(p)
        return out

    # ---- 测试与结果
    @property
    def test_tags(self) -> dict:
        """标签 → [(文件, 行)]。扫描 tests/ 与源码中的测试文件。"""
        key = ("tests",)
        if key in self._cache:
            return self._cache[key]
        out: dict[str, list] = {}
        for base in ("tests", "apps", "packages", "evals"):
            d = self.root / base
            if not d.exists():
                continue
            for p in walk_files(d):
                if p.suffix.lower() not in CODE_EXT and p.suffix.lower() not in {".md", ".yaml", ".json"}:
                    continue
                r = rel(p)
                if not (r.startswith("tests/") or TEST_FILE_RE.search(p.name)):
                    continue
                try:
                    text = read_text(p)
                except UnicodeDecodeError:
                    continue
                for m in TAG_RE.finditer(text):
                    out.setdefault(m.group(1), []).append((r, text.count("\n", 0, m.start()) + 1))
        self._cache[key] = out
        return out

    @property
    def test_results(self) -> dict:
        p = self.root / CFG["verify"].get("results", ".test-results/results.json")
        if not p.exists():
            return {}
        try:
            data = json.loads(read_text(p))
        except Exception:
            return {}
        out = {}
        for t in data.get("tests", []):
            for m in TAG_RE.finditer(str(t.get("title", ""))):
                prev = out.get(m.group(1))
                st = t.get("status", "unknown")
                out[m.group(1)] = st if prev in (None, "passed") else prev
        return out

    # ---- 推导
    def feature_status(self, fid: str, with_results: bool = False) -> str:
        sp = self.specs.get(fid)
        f = self.feature_map.get(fid, {})
        if f.get("withdrawn"):
            return "已撤销"
        if not sp:
            return "待写"
        if sp.status != "ready":
            return "规格中"
        if with_results:
            res = self.test_results
            if sp.acs and all(res.get(a) == "passed" for a in sp.acs):
                return "完成"
        return "可实现"

    def feature_pages(self, fid: str) -> list[str]:
        f = self.feature_map.get(fid) or {}
        pages = []
        for iid in f.get("covers") or []:
            pid = str(iid)[:3]
            if pid not in pages:
                pages.append(pid)
        return pages

    def feature_layout_pages(self, fid: str) -> list[str]:
        """规格“3 界面”一节点名但未覆盖条目的页（ADR-008）。"""
        sp = self.specs.get(fid)
        if not sp:
            return []
        covered = set(self.feature_pages(fid))
        found = []
        for pid in re.findall(r"\b([SOP]\d{2})\b(?!-\d)", strip_code(sp.section("3"))):
            if pid in self.screens and pid not in covered and pid not in found:
                found.append(pid)
        return found

    def feature_paths(self, fid: str) -> list[str]:
        explicit = CFG.get("pack", {}).get("feature_paths", {}).get(fid)
        if explicit is not None:
            if not isinstance(explicit, list) or not explicit or any(
                not isinstance(p, str) or p.startswith(("/", "\\")) or ":" in p or ".." in p.replace("\\", "/").split("/")
                for p in explicit
            ):
                raise ValueError(f"[pack.feature_paths].{fid} 应为仓库内相对路径列表")
            return list(dict.fromkeys(explicit))
        f = self.feature_map.get(fid) or {}
        paths = []
        dom = f.get("domain")
        if dom:
            paths.append(f"packages/domains/{dom}/**")
        ends = []
        for pid in self.feature_pages(fid) + self.feature_layout_pages(fid):
            e = END_OF_PREFIX.get(pid[0])
            if e and e not in ends:
                ends.append(e)
        paths += [f"apps/{e}/**" for e in ends]
        sp = self.specs.get(fid)
        if sp:
            for sc in sp.ref_list("ai"):
                paths += [f"packages/ai/{sc}/**", f"evals/{sc}/**"]
        paths.append("tests/**")
        return paths


# ---------------------------------------------------------------- 检查（附录 K）

SLASH_CMD_RE = re.compile(
    r"(?<![\w/.\-~])/(?:clear|compact|memory|hooks|doctor|init|plan|review|model|permissions|config|agents|mcp|"
    r"resume|status|cost|login|logout|approvals|diff|mention|undo|prompts|skills|statusline|ide|context|"
    r"rewind|export|add-dir|bashes|vim|upgrade|security-review|output-style|pr-comments)\b")
TOOL_SYNTAX_RES = [
    (re.compile(r"\$ARGUMENTS"), "$ARGUMENTS"),
    (re.compile(r"(?<![\w$])\$\d\b"), "$0 等位置参数"),
    (re.compile(r"(?<![\w$(])\$[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b"), "$技能名"),
    (re.compile(r"计划模式|plan mode|Plan Mode"), "计划模式"),
]
IMPORT_RE = re.compile(r"(?:(?<=^)|(?<=[\s（(，,：:]))@[A-Za-z0-9_.~][A-Za-z0-9_./~-]*", re.M)


def _fenced_free(text: str) -> str:
    return re.sub(r"```.*?```", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)


def tool_syntax_hits(text: str):
    t = _fenced_free(text)
    for m in SLASH_CMD_RE.finditer(t):
        yield t.count("\n", 0, m.start()) + 1, m.group(0)
    for pat, label in TOOL_SYNTAX_RES:
        for m in pat.finditer(t):
            yield t.count("\n", 0, m.start()) + 1, m.group(0)


def agents_files(repo) -> list[Path]:
    return [p for p in walk_files(repo.root) if p.name == "AGENTS.md"]


def check_instr(repo, ctx):
    out = []
    for p in walk_files(repo.root):
        if p.name in FORBIDDEN_INSTR:
            out.append(F("E-INSTR-01", rel(p), "", f"仓库中出现了禁止的指令文件 {p.name}",
                         "删除；个人偏好放 ~/.claude/CLAUDE.md 或 ~/.codex/AGENTS.md"))
    for p in agents_files(repo):
        r, text = rel(p), read_text(p)
        body = strip_code(text)
        for m in IMPORT_RE.finditer(body):
            out.append(F("E-INSTR-02", r, body.count("\n", 0, m.start()) + 1, f"出现 @ 导入 {m.group(0)}",
                         "改成“见 <路径>”"))
        for ln, hit in tool_syntax_hits(text):
            out.append(F("E-INSTR-03", r, ln, f"出现工具专属语法 {hit}", "改成要达到的结果，不写斜杠命令、$技能名或计划模式"))
    for c in repo.conventions.values():
        for ln, hit in tool_syntax_hits(c["text"]):
            out.append(F("E-INSTR-03", c["path"], ln, f"出现工具专属语法 {hit}", "改成要达到的结果"))
    root_agents = repo.root / "AGENTS.md"
    if not root_agents.exists():
        out.append(F("E-INSTR-04", "AGENTS.md", "", "缺少根 AGENTS.md", "按附录 A.1 建立"))
    else:
        out += _check_agents_structure(read_text(root_agents), "AGENTS.md", root=True)
    for end in ("learner", "org", "admin"):
        p = repo.root / "apps" / end / "AGENTS.md"
        if p.exists():
            out += _check_agents_structure(read_text(p), rel(p), root=False)
    return out


def _count_items(text: str) -> int:
    return len(re.findall(r"^\s*(?:[-*]|\d+\.)\s+\S", text, re.M))


def _check_agents_structure(text: str, r: str, root: bool):
    out = []
    h2 = re.findall(r"^##\s+(.+?)\s*$", text, re.M)
    secs = dict(md_sections(text, 2))
    if root:
        names = [next((n for n in ROOT_AGENTS_SECTIONS if h.startswith(n)), None) for h in h2]
        got = [n for n in names if n]
        if got != ROOT_AGENTS_SECTIONS or None in names:
            out.append(F("E-INSTR-04", r, "", f"章节应依次为 {('、'.join(ROOT_AGENTS_SECTIONS))}，实际为 {('、'.join(h2))}",
                         "按附录 A.1 调整顺序与章节"))
        pre = text.split("\n## ", 1)[0]
        intro = [l for l in pre.splitlines() if l.strip() and not l.startswith("#")]
        if not intro or len(intro) > 2:
            out.append(F("E-INSTR-04", r, 2, "项目一句话应为 1–2 行", "在标题与第一节之间写 1–2 行项目说明"))
        limits = {"权威来源": 12, "红线": 10, "Code Review Rules": 8}
        for k, lim in limits.items():
            body = next((v for h, v in secs.items() if h.startswith(k)), "")
            n = _count_items(body)
            if n > lim:
                out.append(F("E-INSTR-04", r, line_of(text, "## " + k), f"“{k}”有 {n} 条，上限 {lim}", "删减到上限以内"))
    else:
        want = ["本端要点", "Code Review Rules"]
        if [h for h in h2] != want:
            out.append(F("E-INSTR-04", r, "", f"端级 AGENTS.md 只有“本端要点”“Code Review Rules”两节，实际为 {('、'.join(h2))}",
                         "按附录 A.2 调整"))
        for k, lim in (("本端要点", 8), ("Code Review Rules", 5)):
            n = _count_items(secs.get(k, ""))
            if n > lim:
                out.append(F("E-INSTR-04", r, line_of(text, "## " + k), f"“{k}”有 {n} 条，上限 {lim}", "删减到上限以内"))
    return out


def check_gen(repo, ctx):
    out = []
    expected = gen_outputs(repo)
    for path, (content, src_hash, srcs) in expected.items():
        p = repo.root / path
        if not p.exists():
            out.append(F("E-GEN-01", path, "", f"生成物缺失（来源：{', '.join(srcs)}）", "运行 python scripts/spec_tool.py gen"))
            continue
        cur = read_text(p)
        if cur != content:
            m = re.search(r"source-sha[:=]\s*\"?([0-9a-f]{12})", cur)
            if m and m.group(1) == src_hash:
                out.append(F("E-GEN-02", path, "", "生成物与源不符且源未改动，疑似被手改", "把改动移到源，再运行 gen"))
            else:
                out.append(F("E-GEN-01", path, "", f"生成物已过期（来源：{', '.join(srcs)}）", "运行 python scripts/spec_tool.py gen"))
    for path in stale_generated(repo, expected):
        out.append(F("E-GEN-01", path, "", "多余的生成物：源已不存在", "运行 python scripts/spec_tool.py gen 清理"))
    return out


def check_skills(repo, ctx):
    out = []
    budget = CFG["budgets"]
    for name, sk in repo.skills.items():
        fm, r = sk["fm"], sk["path"]
        extra = set(fm) - SKILL_STD_FIELDS
        if extra:
            out.append(F("E-SKILL-01", r, 1, f"使用了开放标准以外的字段 {', '.join(sorted(extra))}", "移入 metadata 或删除"))
        if fm.get("name") != name:
            out.append(F("E-SKILL-01", r, 1, f"name 应与目录名 {name} 一致", "改 name 或目录名"))
        md = fm.get("metadata") or {}
        for k in md:
            if k in SKILL_STD_FIELDS or k in {"disable-model-invocation", "argument-hint"}:
                out.append(F("E-SKILL-01", r, 1, f"metadata 的键 {k} 复用了 frontmatter 字段名", "换一个键名"))
        for ln, hit in tool_syntax_hits(sk["body"]):
            out.append(F("E-SKILL-02", r, ln + sk["body_line"] - 1, f"正文出现 {hit}", "改写为工具中立的描述"))
        desc = str(fm.get("description", ""))
        if len(desc) > budget["skill_desc_max_chars"]:
            out.append(F("E-SKILL-04", r, 1, f"描述 {len(desc)} 字符，上限 {budget['skill_desc_max_chars']}", "精简，把用途和触发词放在开头"))
        if not re.search(r"[\u4e00-\u9fff]", desc) or not re.search(r"[A-Za-z]{3,}", desc):
            out.append(F("E-SKILL-04", r, 1, "描述缺少中英文触发词", "开头写用途和触发词，中英文关键词都放"))
    for dirpath, dirnames, _ in os.walk(repo.root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        base = Path(dirpath)
        if base == repo.root:
            continue
        for top in (".agents", ".claude"):
            if (base / top / "skills").is_dir():
                out.append(F("E-SKILL-03", rel(base / top / "skills"), "", "仓库根以外出现 skill 目录", "移到仓库根的 .agents/skills"))
    return out


def _hook_commands(path: Path) -> list[tuple[str, str]]:
    if not path.exists():
        return []
    try:
        data = json.loads(read_text(path))
    except Exception:
        return [("__invalid__", "")]
    out = []

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("command", "commandWindows") and isinstance(v, str):
                    out.append((k, v))
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(data.get("hooks", {}))
    return out


def check_hooks(repo, ctx):
    out = []
    cpath, xpath = repo.root / ".claude/settings.json", repo.root / ".codex/hooks.json"
    cl, cx = _hook_commands(cpath), _hook_commands(xpath)
    for path, cmds in ((cpath, cl), (xpath, cx)):
        if cmds and cmds[0][0] == "__invalid__":
            out.append(F("E-SCHEMA-01", rel(path), 1, "JSON 解析失败", "修正 JSON 语法"))
            return out
    norm = lambda s: set(x.replace("\\", "/") for x in re.findall(r"scripts[\\/][\w\\/.-]+\.py", s))
    s1 = set().union(*[norm(c) for _, c in cl]) if cl else set()
    s2 = set().union(*[norm(c) for _, c in cx]) if cx else set()
    if s1 != s2:
        out.append(F("E-HOOK-01", ".codex/hooks.json", "", f"两边 hooks 指向的脚本不一致：Claude {sorted(s1)}，Codex {sorted(s2)}",
                     "对齐附录 I"))
    for k, c in cl:
        if "scripts/" in c and "$CLAUDE_PROJECT_DIR" not in c:
            out.append(F("E-HOOK-02", ".claude/settings.json", "", f"命令未从仓库根解析：{c}", "用 \"$CLAUDE_PROJECT_DIR/scripts/…\""))
    for k, c in cx:
        if k == "command" and "scripts/" in c and "$(git rev-parse --show-toplevel)" not in c:
            out.append(F("E-HOOK-02", ".codex/hooks.json", "", f"命令未从仓库根解析：{c}", "用 \"$(git rev-parse --show-toplevel)/scripts/…\""))
    return out


def _ref_index(repo) -> dict:
    return {
        "api": set(repo.operations), "schema": set(repo.tables), "permissions": set(repo.actions),
        "events": set(repo.analytics_events), "errors": set(repo.errors), "domain_events": set(repo.domain_events),
        "params": set(repo.params), "data_classes": set(repo.data_classes), "metrics": set(repo.metrics),
        "ai": set(repo.scenarios), "models": set(repo.model_anchors()), "inv": set(repo.inv_map),
        "features": set(repo.feature_map), "adr": set(repo.adrs),
    }


def _token_in(body: str, name: str) -> bool:
    return re.search(r"(?<![\w.\-])" + re.escape(name) + r"(?![\w]|\.[A-Za-z_])", body) is not None


def check_refs(repo, ctx):
    out = []
    idx = _ref_index(repo)
    for fid, sp in repo.specs.items():
        if sp.error:
            out.append(F("E-SCHEMA-01", sp.rel, 1, sp.error, "修正 front matter"))
            continue
        for kind, val in sp.refs.items():
            if kind not in REF_TYPES:
                out.append(F("E-REF-01", sp.rel, f"refs.{kind}", f"未知的 refs 类型 {kind}", f"只用 {', '.join(REF_TYPES)}"))
                continue
            for name in sp.ref_list(kind):
                if name not in idx[kind]:
                    hint = _did_you_mean(name, idx[kind])
                    out.append(F("E-REF-01", sp.rel, f"refs.{kind}", f"{name} 不存在",
                                 (f"可能是 {hint}；" if hint else "") + "修正拼写；如果是新条目，按重型通道先登记"))
        body = sp.body
        for kind in ("params", "ai", "schema", "api", "errors", "events", "domain_events", "data_classes", "metrics"):
            listed = set(sp.ref_list(kind))
            for name in idx[kind]:
                if name not in listed and len(name) >= 4 and _token_in(body, name):
                    out.append(F("E-REF-02", sp.rel, line_of(sp.text, name), f"正文提到 {name}，但没有列入 refs.{kind}",
                                 f"补进 refs.{kind}，否则任务包里缺这一项"))
        for kind, pat in (("inv", r"\bINV-\d{2,3}\b"), ("adr", r"\bADR-\d{3}\b")):
            listed = set(sp.ref_list(kind))
            for name in sorted(set(re.findall(pat, body))):
                if name not in listed:
                    out.append(F("E-REF-02", sp.rel, line_of(sp.text, name), f"正文提到 {name}，但没有列入 refs.{kind}", f"补进 refs.{kind}"))
    return out


def _did_you_mean(name: str, pool) -> str:
    import difflib
    m = difflib.get_close_matches(name, list(pool), n=1, cutoff=0.8)
    return m[0] if m else ""


def check_owner(repo, ctx):
    out = []
    names = repo.domain_names
    groups = [("表", repo.tables, lambda t: t.get("_file", "contracts/schema")),
              ("业务事件", repo.domain_events, lambda e: "contracts/domain-events.yaml"),
              ("参数", repo.params, lambda e: "contracts/params.yaml"),
              ("AI 场景", repo.scenarios, lambda e: "contracts/ai/scenarios.yaml"),
              ("指标", repo.metrics, lambda e: "contracts/metrics.yaml")]
    for label, reg, fileof in groups:
        for k, e in reg.items():
            o = e.get("owner")
            if not o:
                out.append(F("E-OWN-01", fileof(e), k, f"{label} {k} 没有 owner", "补上 owner（domain-map.yaml 中的领域名）"))
            elif o not in names:
                out.append(F("E-OWN-01", fileof(e), k, f"{label} {k} 的 owner {o} 不是登记的领域名", "改为 domain-map.yaml 中的领域名"))
    learner_tables = [t for t, d in repo.tables.items() if d.get("owner") == "learner"]
    if learner_tables:
        alts = []
        for t in learner_tables:
            camel = re.sub(r"_([a-z])", lambda m: m.group(1).upper(), t)
            alts += [re.escape(t), re.escape(camel)]
        tab = "(?:" + "|".join(alts) + ")"
        pats = [re.compile(r"\b(?:insert\s+into|update|delete\s+from|upsert\s+into)\s+[\"'`]?" + tab + r"\b", re.I),
                re.compile(r"\b" + tab + r"\s*\.\s*(?:insert|create|update|upsert|delete|save)\w*\s*\(", re.I)]
        base = repo.root / "packages" / "domains"
        if base.exists():
            for p in walk_files(base):
                parts = rel(p).split("/")
                if len(parts) < 4 or parts[2] == "learner" or p.suffix not in CODE_EXT or TEST_FILE_RE.search(p.name):
                    continue
                text = read_text(p)
                for pat in pats:
                    for m in pat.finditer(text):
                        out.append(F("E-OWN-02", rel(p), text.count("\n", 0, m.start()) + 1,
                                     f"learner 以外的领域直接写证据或掌握档表：{m.group(0)[:60]}", "改为调用 learner 的接口提交证据"))
    return out


def coverage_index(repo):
    cov: dict[str, list[str]] = {}
    for f in repo.features:
        if f.get("withdrawn"):
            continue
        for iid in f.get("covers") or []:
            cov.setdefault(str(iid), []).append(str(f["id"]))
    return cov


def _baseline_item_ids(ref: str) -> dict:
    out = {}
    for path in git_ls(ref, "design/screens"):
        if not re.match(r"design/screens/(learner|org|admin)/[SOP]\d{2}\.yaml$", path):
            continue
        text = git_show(ref, path)
        if not text:
            continue
        try:
            data = yaml.safe_load(text) or {}
        except yaml.YAMLError:
            continue
        for it in data.get("items", []) or []:
            if isinstance(it, dict) and it.get("id"):
                out[str(it["id"])] = (path, it)
    return out


def _id_baseline(ref):
    """编号基线标记（design/screens/ID_BASELINE，见 ADR-023）；ref 为 None 时读工作区。"""
    rel_path = "design/screens/ID_BASELINE"
    if ref is None:
        f = ROOT / rel_path
        return read_text(f).strip() if f.exists() else ""
    return (git_show(ref, rel_path) or "").strip()


def check_coverage(repo, ctx):
    out = []
    cov = coverage_index(repo)
    items = repo.items
    fmap = repo.feature_map
    for iid, (pid, it) in items.items():
        f = repo.screens[pid]["_file"]
        if it.get("removed"):
            if iid in cov:
                out.append(F("E-COV-03", "docs/product/roadmap.yaml", iid, f"covers 指向已删除的条目 {iid}（{', '.join(cov[iid])}）",
                             "从 covers 移除"))
            continue
        states = (1 if iid in cov else 0) + (1 if it.get("ui_only") else 0) + (1 if it.get("out_of_scope") else 0)
        if states == 0:
            out.append(F("E-COV-01", f, iid, f"条目 {iid}「{it.get('name', '')}」既未被覆盖，也未标 ui_only 或 out_of_scope",
                         "在 roadmap.yaml 中分配到功能，或在页面登记中标注"))
        elif len(cov.get(iid, [])) > 1:
            out.append(F("E-COV-02", "docs/product/roadmap.yaml", iid, f"条目 {iid} 被多个功能覆盖：{', '.join(cov[iid])}", "只保留一个"))
        elif states > 1:
            out.append(F("E-COV-02", f, iid, f"条目 {iid} 同时处于多种状态（覆盖、ui_only、out_of_scope 只能选一）", "只保留一种"))
    for iid, fids in cov.items():
        if iid not in items:
            out.append(F("E-COV-03", "docs/product/roadmap.yaml", iid, f"covers 指向不存在的条目 {iid}（{', '.join(fids)}）", "修正编号"))
    if ctx.full:
        per_page: dict[str, list[str]] = {}
        for iid, (pid, it) in items.items():
            if it.get("removed") or it.get("page_priority") != "P0":
                continue
            for fid in cov.get(iid, []):
                if fmap.get(fid, {}).get("release") != "R1":
                    per_page.setdefault(pid, []).append(iid)
        for pid, ids in sorted(per_page.items()):
            out.append(F("W-COV-04", repo.screens[pid]["_file"], "", f"页内 P0 条目由不在 R1 的功能覆盖：{len(ids)} 项（{', '.join(ids[:6])}{' …' if len(ids) > 6 else ''}）",
                         "人工确认首发范围；分期见 docs/product/phases.yaml"))
    cur_ids = set(items)
    cur_base = _id_baseline(None)
    for ref in ctx.baselines:
        if _id_baseline(ref) != cur_base:
            continue  # 编号基线不同（一次性重置，见 ADR-023），不比对
        for iid, (path, it) in _baseline_item_ids(ref).items():
            if iid not in cur_ids:
                out.append(F("E-COV-05", path, iid, f"与 {ref} 相比，已分配的条目编号 {iid} 消失了", "恢复该条目并标 removed: true；条目编号只增不减"))
    return out


def check_refine(repo, ctx):
    out = []
    cov_pages = {}
    for f in repo.features:
        for iid in f.get("covers") or []:
            cov_pages.setdefault(str(f["id"]), set()).add(str(iid)[:3])
    for fid, sp in repo.specs.items():
        if sp.status != "ready":
            continue
        for pid in sorted(cov_pages.get(fid, [])):
            pg = repo.screens.get(pid)
            if pg and pg.get("refine") == "pending":
                out.append(F("E-REFINE-01", sp.rel, "status", f"{fid} 为 ready，但覆盖条目所在页 {pid} 的 refine 为 pending",
                             "先用 refine-page 完成该页深化，再改为 ready；该页若无需深化，从深化清单移除并去掉 refine 字段"))
    if ctx.baselines and _id_baseline(ctx.baselines[0]) == _id_baseline(None):
        base = _baseline_item_ids(ctx.baselines[0])
        cov = coverage_index(repo)
        for iid, (pid, it) in repo.items.items():
            if iid not in base:
                continue
            old = base[iid][1]
            if (old.get("text"), old.get("name")) != (it.get("text"), it.get("name")):
                fids = [f for f in cov.get(iid, []) if (repo.specs.get(f) and repo.specs[f].status == "ready")]
                if fids:
                    out.append(F("W-REFINE-02", repo.screens[pid]["_file"], iid,
                                 f"条目文本有变化，受影响的功能：{', '.join(fids)}", "按标准通道在同一次提交里更新受影响的规格，或撤回该改动"))
    pats = []
    for s in CFG["deep_source"].get("forbidden_patterns", []) or []:
        try:
            pats.append(re.compile(s))
        except re.error as e:
            out.append(F("E-SCHEMA-01", "scripts/spec_tool.toml", "deep_source.forbidden_patterns", f"正则无效 {s}：{e}", "修正正则"))
    if pats:
        for p in walk_files(repo.root):
            if not is_text_file(p):
                continue
            try:
                text = read_text(p)
            except (UnicodeDecodeError, OSError):
                continue
            for pat in pats:
                for m in pat.finditer(text):
                    out.append(F("E-REFINE-03", rel(p), text.count("\n", 0, m.start()) + 1, f"出现深化来源的外部编号 {m.group(0)}",
                                 "翻译为本仓库的 ID（表名、ADR、参数名）或删除"))
    return out


def scope_features(repo) -> list[str]:
    """“本次改动涉及的功能”：当前分支的功能 ID，以及 work/ 下有交接文件的功能。"""
    out = []
    fid = branch_feature_id(current_branch())
    if fid:
        out.append(fid)
    wd = repo.root / "work"
    if wd.exists():
        for p in wd.glob("*.md"):
            if FEATURE_ID_RE.match(p.stem) and p.stem not in out:
                out.append(p.stem)
    return out


def check_ac_inv(repo, ctx):
    out = []
    tags = repo.test_tags
    all_acs = {a for sp in repo.specs.values() for a in sp.acs}
    for fid in scope_features(repo):
        sp = repo.specs.get(fid)
        if not sp or sp.status != "ready":
            continue
        for ac in sp.acs:
            if ac not in tags:
                out.append(F("E-AC-01", sp.rel, ac, f"{ac} 没有对应测试", f"补测试，测试标题含 [{ac}]"))
        for inv in sp.ref_list("inv"):
            e = repo.inv_map.get(inv) or {}
            if "test" in (e.get("enforcement") or []) and inv not in tags:
                out.append(F("E-INV-01", "docs/product/invariants.yaml", inv, f"{inv} 的执行方式含 test，但没有测试（{fid} 引用了它）",
                             f"补测试，测试标题含 [{inv}]"))
    for tag, locs in tags.items():
        if tag.startswith("INV-") and tag not in repo.inv_map:
            for f, ln in locs:
                out.append(F("E-AC-02", f, ln, f"测试引用了不存在的 {tag}", "修正编号"))
        elif "-AC" in tag and tag not in all_acs:
            for f, ln in locs:
                out.append(F("E-AC-02", f, ln, f"测试引用了不存在的 {tag}", "修正编号，或在规格中补上该 AC"))
    return out


def _content_hash(d: Path) -> str:
    h = hashlib.sha256()
    for p in sorted(walk_files(d)):
        h.update(rel(p).encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:16]


def check_ai(repo, ctx):
    out = []
    sf = "contracts/ai/scenarios.yaml"
    actors, dcs, params = repo.actors, repo.data_classes, repo.params
    direct_ok = set(CFG.get("check", {}).get("direct_writers", ["planner"]))
    for sid, sc in repo.scenarios.items():
        ev = repo.root / "evals" / sid
        if not ev.is_dir() or not (ev / "thresholds.yaml").exists():
            out.append(F("E-AI-01", sf, sid, f"场景 {sid} 缺少评测目录或 thresholds.yaml", f"在 evals/{sid}/ 建 cases/、graders/、thresholds.yaml、baseline.json"))
        lab = sc.get("labeling") or {}
        if (sc.get("screens") or sc.get("export")) and not (isinstance(lab, dict) and lab.get("explicit") is True and "on_export" in lab):
            out.append(F("E-AI-02", sf, sid, f"场景 {sid} 有展示或导出输出，但没有声明标识", "补 labeling: {explicit: true, implicit: …, on_export: …}"))
        a = sc.get("actor")
        if a and a not in actors:
            out.append(F("E-AI-05", sf, sid, f"场景引用的执行者 {a} 不存在", "修正，或在 contracts/ai/actors.yaml 登记"))
        for c in sc.get("reads") or []:
            if c not in dcs:
                out.append(F("E-AI-05", sf, sid, f"场景读取的数据类别 {c} 不存在", "修正，或在 contracts/data-classes.yaml 登记"))
        flag = (sc.get("rollout") or {}).get("flag") if isinstance(sc.get("rollout"), dict) else None
        if flag and flag not in params:
            out.append(F("E-AI-05", sf, sid, f"场景开关 {flag} 未在 params.yaml 登记", "在 contracts/params.yaml 登记该开关"))
        for inv in sc.get("invariants") or []:
            if inv not in repo.inv_map:
                out.append(F("E-AI-05", sf, sid, f"场景引用的不变量 {inv} 不存在", "修正编号"))
        code_dir = repo.root / "packages" / "ai" / sid
        if code_dir.is_dir() and not os.environ.get("CI"):
            touched = any(c.startswith(f"packages/ai/{sid}/") for c in ctx.changed)
            if touched:
                rec = repo.root / CFG["eval"].get("records", ".eval") / f"{sid}.json"
                ok = False
                if rec.exists():
                    try:
                        r = json.loads(read_text(rec))
                        ok = r.get("code_hash") == _content_hash(code_dir) and r.get("suite") == "regression" and r.get("passed")
                    except Exception:
                        ok = False
                if not ok:
                    out.append(F("E-AI-04", f"packages/ai/{sid}/", "", "有改动，但没有本次的回归评测记录", f"运行 python scripts/spec_tool.py eval {sid} --suite regression"))
    af = "contracts/ai/actors.yaml"
    for aid, a in actors.items():
        for w in a.get("writes") or []:
            if not isinstance(w, dict):
                continue
            tgt, mode = str(w.get("target", "")), w.get("mode")
            if mode == "direct" and aid not in direct_ok and (tgt.startswith("plan.") or "mastery" in tgt or tgt.startswith("learner.")):
                out.append(F("E-AI-03", af, aid, f"执行者 {aid} 对 {tgt} 拥有 direct 写权限", "改为 propose（INV-01）"))
            if mode not in ("direct", "propose", "none"):
                out.append(F("E-SCHEMA-01", af, aid, f"写方式 {mode} 无效", "取 direct、propose 或 none"))
        for c in a.get("reads") or []:
            if c not in dcs:
                out.append(F("E-DC-02", af, aid, f"执行者可读的数据类别 {c} 不存在", "修正，或在 contracts/data-classes.yaml 登记"))
        for s in a.get("scenarios") or []:
            if s not in repo.scenarios:
                out.append(F("E-AI-05", af, aid, f"执行者参与的场景 {s} 不存在", "修正，或按重型通道登记场景"))
    return out


def check_dc(repo, ctx):
    out = []
    dcs = repo.data_classes
    for t, d in repo.tables.items():
        for i, fld in enumerate(d.get("fields") or []):
            if not isinstance(fld, dict):
                continue
            dc = fld.get("x-data-class")
            name = fld.get("name", f"[{i}]")
            if not dc:
                out.append(F("E-DC-01", d["_file"], f"{t}.{name}", "字段没有标注数据类别", "补 x-data-class"))
            elif dc not in dcs:
                out.append(F("E-DC-01", d["_file"], f"{t}.{name}", f"数据类别 {dc} 不存在", "改为 contracts/data-classes.yaml 中的类别"))
    for cid, c in dcs.items():
        vis = c.get("visibility") or {}
        if "org" not in vis:
            out.append(F("E-DC-02", "contracts/data-classes.yaml", cid, "数据类别缺少机构可见默认值 visibility.org", "补 always、by_consent、masked 或 never"))
    return out


PARAM_USE_RE = re.compile(r"""\bparams?\s*(?:\.\s*get\s*)?\(\s*['"]([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)['"]""")


def _strip_code_literals(text: str, suffix: str) -> str:
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    text = re.sub(r"(?m)//.*$", "", text)
    if suffix == ".py":
        text = re.sub(r"(?m)#.*$", "", text)
    text = re.sub(r"`(?:\\.|[^`\\])*`", '""', text, flags=re.S)
    text = re.sub(r"'(?:\\.|[^'\\\n])*'", '""', text)
    text = re.sub(r'"(?:\\.|[^"\\\n])*"', '""', text)
    return text


def check_params(repo, ctx):
    out = []
    params = repo.params
    gen_out = CFG["gen"].get("params_out", "packages/params/index.ts")
    used = set()
    for base in ("apps", "packages"):
        d = repo.root / base
        if not d.exists():
            continue
        for p in walk_files(d):
            if p.suffix not in CODE_EXT or rel(p) == gen_out:
                continue
            text = read_text(p)
            for m in PARAM_USE_RE.finditer(text):
                used.add(m.group(1))
                if m.group(1) not in params:
                    out.append(F("E-PARAM-01", rel(p), text.count("\n", 0, m.start()) + 1, f"引用了未登记的参数 {m.group(1)}", "先在 contracts/params.yaml 登记"))
            if rel(p).startswith("packages/domains/") and not TEST_FILE_RE.search(p.name):
                stripped = _strip_code_literals(text, p.suffix)
                lines = text.splitlines()
                for ln, line in enumerate(stripped.splitlines(), 1):
                    if ln <= len(lines) and "param-exempt" in lines[ln - 1]:
                        continue
                    if re.match(r"^\s*(import|from|export\s+\*)\b", line):
                        continue
                    for m in re.finditer(r"(?<![\w.$])(-?\d+(?:\.\d+)?)(?![\w.])", line):
                        if m.group(1) not in ("0", "1", "-1"):
                            out.append(F("E-PARAM-03", rel(p), ln, f"领域规则代码中出现数值字面量 {m.group(1)}",
                                         "改为参数访问器；确属非阈值常量时在该行注明 param-exempt: <理由>"))
    refd = set(used)
    for sp in repo.specs.values():
        refd |= set(sp.ref_list("params"))
    texts = [read_text(p) for p in (repo.root / "docs" / "models").glob("*.md")]
    texts += [c["text"] for c in repo.conventions.values()]
    texts += [read_text(p) for p in (repo.root / "docs" / "domains").glob("*/README.md")]
    blob = "\n".join(texts)
    for sc in repo.scenarios.values():
        fl = (sc.get("rollout") or {}).get("flag") if isinstance(sc.get("rollout"), dict) else None
        if fl:
            refd.add(fl)
    for name in params:
        if name not in refd and not _token_in(blob, name):
            out.append(F("W-PARAM-02", "contracts/params.yaml", name, "登记的参数没有任何引用", "确认后删除，或在规格、算法规格中引用"))
    for name, e in params.items():
        for fld in ("default", "unit", "tunable_by", "rollout", "reason_required"):
            if fld not in e:
                out.append(F("E-SCHEMA-01", "contracts/params.yaml", name, f"参数缺少字段 {fld}", "按附录 D.2 补齐"))
        rng, dft = e.get("range"), e.get("default")
        if isinstance(rng, list) and len(rng) == 2 and isinstance(dft, (int, float)) and not isinstance(dft, bool):
            if not (rng[0] <= dft <= rng[1]):
                out.append(F("E-SCHEMA-01", "contracts/params.yaml", name, f"默认值 {dft} 不在区间 {rng} 内", "调整默认值或区间"))
        lr = e.get("learner_range")
        if isinstance(lr, list) and isinstance(rng, list) and len(lr) == 2 and len(rng) == 2 and not (rng[0] <= lr[0] <= lr[1] <= rng[1]):
            out.append(F("E-SCHEMA-01", "contracts/params.yaml", name, f"学员可调区间 {lr} 必须落在 {rng} 之内", "修正 learner_range"))
    return out


def _json_schema_errors(inst, schema, root, path="$"):
    errs = []
    if "$ref" in schema:
        ref = schema["$ref"]
        node = root
        for part in ref.lstrip("#/").split("/"):
            node = node.get(part, {})
        return _json_schema_errors(inst, node, root, path)
    for key in ("allOf",):
        for s in schema.get(key, []):
            errs += _json_schema_errors(inst, s, root, path)
    if "anyOf" in schema or "oneOf" in schema:
        opts = schema.get("anyOf") or schema.get("oneOf")
        results = [_json_schema_errors(inst, s, root, path) for s in opts]
        ok = sum(1 for r in results if not r)
        if ok == 0 or ("oneOf" in schema and ok > 1):
            errs.append(f"{path}：不符合 {'oneOf' if 'oneOf' in schema else 'anyOf'} 中的{'任何一项' if ok == 0 else '唯一一项'}")
    t = schema.get("type")
    tmap = {"string": str, "integer": int, "number": (int, float), "boolean": bool, "object": dict, "array": list, "null": type(None)}
    if t:
        ts = t if isinstance(t, list) else [t]
        okt = any(isinstance(inst, tmap[x]) and not (x in ("integer", "number") and isinstance(inst, bool)) for x in ts)
        if not okt:
            return errs + [f"{path}：类型应为 {t}"]
    if "enum" in schema and inst not in schema["enum"]:
        errs.append(f"{path}：取值 {inst!r} 不在 {schema['enum']}")
    if "const" in schema and inst != schema["const"]:
        errs.append(f"{path}：应为 {schema['const']!r}")
    if isinstance(inst, (int, float)) and not isinstance(inst, bool):
        if "minimum" in schema and inst < schema["minimum"]:
            errs.append(f"{path}：小于最小值 {schema['minimum']}")
        if "maximum" in schema and inst > schema["maximum"]:
            errs.append(f"{path}：大于最大值 {schema['maximum']}")
    if isinstance(inst, str):
        if "minLength" in schema and len(inst) < schema["minLength"]:
            errs.append(f"{path}：长度不足 {schema['minLength']}")
        if "pattern" in schema and not re.search(schema["pattern"], inst):
            errs.append(f"{path}：不匹配 {schema['pattern']}")
    if isinstance(inst, list):
        if "minItems" in schema and len(inst) < schema["minItems"]:
            errs.append(f"{path}：至少 {schema['minItems']} 项")
        if "items" in schema:
            for i, v in enumerate(inst):
                errs += _json_schema_errors(v, schema["items"], root, f"{path}[{i}]")
    if isinstance(inst, dict):
        for k in schema.get("required", []):
            if k not in inst:
                errs.append(f"{path}：缺少 {k}")
        props = schema.get("properties", {})
        for k, v in inst.items():
            if k in props:
                errs += _json_schema_errors(v, props[k], root, f"{path}.{k}")
            elif schema.get("additionalProperties") is False:
                errs.append(f"{path}：不允许的字段 {k}")
            elif isinstance(schema.get("additionalProperties"), dict):
                errs += _json_schema_errors(v, schema["additionalProperties"], root, f"{path}.{k}")
    return errs


def exam_fixtures(repo) -> dict:
    out = {}
    d = repo.root / "fixtures" / "exams"
    for p in sorted(d.glob("*/profile.json")) if d.exists() else []:
        try:
            out[p.parent.name] = (p, json.loads(read_text(p)))
        except Exception as e:
            out[p.parent.name] = (p, {"__error__": str(e)})
    return out


def check_exam(repo, ctx):
    out = []
    sp = repo.root / "contracts" / "exam-profile.schema.json"
    schema = None
    if sp.exists():
        try:
            schema = json.loads(read_text(sp))
        except Exception as e:
            out.append(F("E-SCHEMA-01", rel(sp), 1, f"JSON 解析失败：{e}", "修正 JSON"))
    fx = exam_fixtures(repo)
    terms = set()
    for eid, (p, data) in fx.items():
        if "__error__" in data:
            out.append(F("E-EXAM-02", rel(p), 1, f"JSON 解析失败：{data['__error__']}", "修正数据"))
            continue
        if schema:
            for e in _json_schema_errors(data, schema, schema)[:20]:
                out.append(F("E-EXAM-02", rel(p), "", f"不符合 exam-profile.schema.json：{e}", "修正数据，或按重型通道修改结构"))
        terms.add(eid)
        for k in ("name", "short_name"):
            if data.get(k):
                terms.add(str(data[k]))
        terms |= {str(a) for a in data.get("aliases", []) or []}
    terms = {t for t in terms if len(t) >= 3}
    base = repo.root / "packages" / "domains"
    if terms and base.exists():
        pat = re.compile("|".join(re.escape(t) for t in sorted(terms, key=len, reverse=True)))
        for p in walk_files(base):
            parts = rel(p).split("/")
            if len(parts) < 4 or parts[2] == "exam" or p.suffix not in CODE_EXT:
                continue
            text = read_text(p)
            for m in pat.finditer(text):
                out.append(F("E-EXAM-01", rel(p), text.count("\n", 0, m.start()) + 1, f"核心领域代码出现考试 ID 或考试名「{m.group(0)}」",
                             "改为画像数据或 variation-points.md 登记的扩展点"))
    return out


def check_work(repo, ctx):
    out = []
    wd = repo.root / "work"
    files = [p for p in wd.glob("*.md")] if wd.exists() else []
    br = current_branch()
    if br and br == main_branch() and files:
        for p in files:
            out.append(F("E-WORK-01", rel(p), "", "主干上 work/ 应为空", "收尾时运行 python scripts/spec_tool.py work close <ID>"))
    elif br:
        fid = branch_feature_id(br)
        for p in files:
            if p.stem != fid:
                out.append(F("E-WORK-02", rel(p), "", f"分支 {br} 上存在与分支功能 ID 不符的 work 文件", "移走或删除"))
    for p in files:
        text = read_text(p)
        try:
            fm, body, _ = split_front_matter(text)
        except YamlError as e:
            out.append(F("E-WORK-03", rel(p), 1, str(e), "修正 front matter"))
            continue
        heads = [h for h, _ in md_sections(body, 2)]
        missing = [s for s in WORK_SECTIONS if not any(h.startswith(s) for h in heads)]
        miss_fm = [k for k in ("id", "branch", "lane", "started") if k not in fm]
        if missing or miss_fm:
            out.append(F("E-WORK-03", rel(p), "", f"缺少章节 {('、'.join(missing)) or '无'}；缺少字段 {('、'.join(miss_fm)) or '无'}", "按附录 G 补齐"))
    return out


def check_oq(repo, ctx):
    out = []
    seen: dict[str, str] = {}
    for fid, sp in repo.specs.items():
        for i, q in enumerate(sp.oqs if isinstance(sp.oqs, list) else []):
            qid = str((q or {}).get("id", ""))
            if not re.match(r"^OQ-" + re.escape(fid) + r"-\d+$", qid):
                out.append(F("E-OQ-02", sp.rel, f"open_questions[{i}]", f"编号 {qid or '（空）'} 应为 OQ-{fid}-<n>", "修正编号"))
            if qid in seen:
                out.append(F("E-OQ-02", sp.rel, qid, f"待定问题编号重复（另见 {seen[qid]}）", "修正编号"))
            seen[qid] = sp.rel
            if not str((q or {}).get("default", "")).strip() and sp.status == "ready":
                out.append(F("E-OQ-01", sp.rel, qid, "ready 的规格带有没有临时默认的待定问题", "补 default"))
    for q in repo.cross_oqs:
        qid = str(q["id"])
        if not re.match(r"^OQ-\d{3}$", qid):
            out.append(F("E-OQ-02", "docs/product/open-questions.yaml", qid, "跨功能待定问题编号应为 OQ-<nnn>", "修正编号"))
        if qid in seen:
            out.append(F("E-OQ-02", "docs/product/open-questions.yaml", qid, f"待定问题编号重复（另见 {seen[qid]}）", "修正编号"))
        seen[qid] = "docs/product/open-questions.yaml"
        if not str(q.get("default", "")).strip():
            out.append(F("E-OQ-01", "docs/product/open-questions.yaml", qid, "待定问题没有临时默认", "补 default"))
        for fid in q.get("features") or []:
            if fid not in repo.feature_map:
                out.append(F("E-REF-01", "docs/product/open-questions.yaml", qid, f"涉及的功能 {fid} 不存在", "修正编号"))
    return out


_PROHIBIT_RE = re.compile(r"(禁用|拦截|禁止|不得|不出现|不用|屏蔽)[^。；;\n]{0,8}$")
_MENTION_RE = re.compile(r"`[^`\n]*`|「[^」\n]*」|“[^”\n]*”|\"[^\"\n]*\"")


def _files_by_globs(repo, include, exclude):
    for p in walk_files(repo.root):
        r = rel(p)
        if not is_text_file(p) or any(match_glob(r, g) for g in exclude):
            continue
        if any(match_glob(r, g) for g in include):
            yield p, r


def check_terms(repo, ctx):
    out = []
    banned, syn = [], []
    for g in repo.glossary:
        words = [str(w) for w in (g.get("forbidden") or [])]
        (banned if g.get("category") == "banned_copy" else syn).extend((w, g["term"]) for w in words)
    chk = CFG["check"]
    excl = list(chk.get("term_exclude", []))
    if syn:
        pat = re.compile("|".join(re.escape(w) for w, _ in sorted(syn, key=lambda x: -len(x[0]))))
        lookup = dict(syn)
        for p, r in _files_by_globs(repo, chk.get("term_scan", []), excl):
            text = read_text(p)
            masked = re.sub(r"`[^`\n]*`|「[^」\n]*」", lambda m: " " * len(m.group(0)), text)
            for m in pat.finditer(masked):
                out.append(F("E-TERM-01", r, text.count("\n", 0, m.start()) + 1, f"使用了禁用同义词「{m.group(0)}」",
                             f"换成 glossary 中的术语「{lookup[m.group(0)]}」"))
    if banned:
        pat = re.compile("|".join(re.escape(w) for w, _ in banned))
        for p, r in _files_by_globs(repo, chk.get("copy_scan", []), excl):
            text = read_text(p)
            masked = _MENTION_RE.sub(lambda m: " " * len(m.group(0)), text)
            for m in pat.finditer(masked):
                before, after = masked[max(0, m.start() - 12):m.start()], masked[m.end():m.end() + 2]
                if _PROHIBIT_RE.search(before) or after.startswith(("类", "等")):
                    continue  # 禁令中的提及（如“禁用某某类表述”），不是文案用语
                out.append(F("E-TERM-02", r, text.count("\n", 0, m.start()) + 1, f"界面或宣传文案出现禁用语「{m.group(0)}」", "删除（INV-11）"))
    return out


def _ids_at(ref: str, repo) -> dict:
    out = {"features": set(), "inv": set(), "oq": set(), "adr": set()}
    for path, key, field in (("docs/product/roadmap.yaml", "features", "id"), ("docs/product/invariants.yaml", "inv", "id"),
                             ("docs/product/open-questions.yaml", "oq", "id")):
        text = git_show(ref, path)
        if text:
            try:
                data = yaml.safe_load(text) or []
                out[key] = {str(e.get(field)) for e in data if isinstance(e, dict)}
            except yaml.YAMLError:
                pass
    for p in git_ls(ref, "docs/adr"):
        m = re.search(r"(ADR-\d{3})-", p)
        if m:
            out["adr"].add(m.group(1))
    return out


def check_ids(repo, ctx):
    out = []
    def dups(vals, file, label):
        seen = set()
        for v in vals:
            if v in seen:
                out.append(F("E-ID-01", file, v, f"{label}编号重复", "在主干重新分配"))
            seen.add(v)
    dups([str(f["id"]) for f in repo.features], "docs/product/roadmap.yaml", "功能")
    dups([str(i["id"]) for i in repo.invariants], "docs/product/invariants.yaml", "不变量")
    dups([str(q["id"]) for q in repo.cross_oqs], "docs/product/open-questions.yaml", "待定问题")
    adr_nums = [re.match(r"^(ADR-\d{3})-", p.name).group(1) for p in (repo.root / "docs/adr").glob("ADR-*.md") if re.match(r"^(ADR-\d{3})-", p.name)]
    dups(adr_nums, "docs/adr/", "ADR ")
    br, main = current_branch(), main_branch()
    if in_git() and ref_exists(main):
        base = _ids_at(main, repo)
        if br and br != main:
            now = {"features": set(repo.feature_map), "inv": set(repo.inv_map), "oq": {str(q["id"]) for q in repo.cross_oqs}, "adr": set(adr_nums)}
            for k, label, file in (("features", "功能", "docs/product/roadmap.yaml"), ("inv", "不变量", "docs/product/invariants.yaml"),
                                   ("oq", "待定问题", "docs/product/open-questions.yaml"), ("adr", "ADR ", "docs/adr/")):
                for v in sorted(now[k] - base[k]):
                    out.append(F("E-ID-01", file, v, f"{label}编号 {v} 在非主干分支 {br} 上分配", "回到主干用 python scripts/spec_tool.py new 分配并立即提交，再合入本分支"))
    for ref in ctx.baselines:
        ids = _ids_at(ref, repo)["features"]
        for v in sorted(ids - set(repo.feature_map)):
            out.append(F("E-ID-02", "docs/product/roadmap.yaml", v, f"与 {ref} 相比，已分配的功能编号 {v} 消失了", "恢复该条目；不做的功能写 withdrawn 并清空 covers"))
    return out


def check_conventions(repo, ctx):
    out = []
    lim = CFG["budgets"]["convention_rules_max"]
    for name, c in repo.conventions.items():
        if not c["applies_to"]:
            out.append(F("E-CONV-01", c["path"], 1, "缺少 applies_to", "在 front matter 写 applies_to（glob 列表）"))
        if len(c["rules"]) > lim:
            out.append(F("E-CONV-01", c["path"], line_of(c["text"], "## 规则"), f"“## 规则”有 {len(c['rules'])} 条，上限 {lim}", "把可检查的规则移入 lint，或拆分约定"))
        for s in ("规则", "示例", "理由"):
            if s not in c["sections"]:
                out.append(F("E-CONV-01", c["path"], "", f"缺少“## {s}”一节", "按附录 F.1 补齐"))
    return out


def concurrent_rules(repo, paths) -> tuple[int, list]:
    detail = []
    red = 0
    root = repo.root / "AGENTS.md"
    if root.exists():
        secs = dict(md_sections(read_text(root), 2))
        red = _count_items(next((v for k, v in secs.items() if k.startswith("红线")), ""))
    detail.append(("根红线", red))
    total = red
    for c in repo.conventions.values():
        if any(path_matches_any(p.rstrip("*").rstrip("/") or p, c["applies_to"]) for p in paths):
            n = len(c["rules"])
            detail.append((f"约定 {c['name']}", n))
            total += n
    for p in paths:
        m = re.match(r"apps/(learner|org|admin)/", p)
        if m:
            f = repo.root / "apps" / m.group(1) / "AGENTS.md"
            if f.exists():
                n = _count_items(dict(md_sections(read_text(f), 2)).get("本端要点", ""))
                detail.append((f"{m.group(1)} 端要点", n))
                total += n
    return total, detail


def typical_task_paths(end: str) -> list[str]:
    return [f"apps/{end}/**", "packages/domains/practice/**", "packages/ui/**", "contracts/openapi.yaml", "tests/**"]


def check_budget_static(repo, ctx):
    out = []
    b = CFG["budgets"]
    for p in agents_files(repo):
        r = rel(p)
        size = utf8len(read_text(p))
        if r == "AGENTS.md":
            lim = b["root_agents_kib"] * 1024
        elif re.match(r"^apps/[^/]+/AGENTS\.md$", r):
            lim = b["end_agents_kib"] * 1024
        else:
            lim = b["pkg_agents_kib"] * 1024
        if size > lim:
            out.append(F("E-BUD-01", r, "", f"{size} 字节，超出 {lim} 字节", "删减，优先删能推导的内容"))
    for end in ("learner", "org", "admin"):
        n, detail = concurrent_rules(repo, typical_task_paths(end))
        if n > b["rules_concurrent_error"]:
            out.append(F("E-BUD-02", f"apps/{end}/", "", f"典型全栈任务同时生效规则 {n} 条，超过报错线 {b['rules_concurrent_error']}", "把可检查的规则移入 lint，或拆分约定"))
        elif n > b["rules_concurrent_warn"]:
            out.append(F("W-BUD-03", f"apps/{end}/", "", f"典型全栈任务同时生效规则 {n} 条，超过告警线 {b['rules_concurrent_warn']}", "精简"))
    total = sum(len(str(s["fm"].get("description", ""))) for s in repo.skills.values())
    if total > b["skill_desc_total_chars"]:
        out.append(F("W-BUD-03", ".agents/skills/", "", f"skill 描述合计 {total} 字符，超出 {b['skill_desc_total_chars']}", "精简描述"))
    return out


def check_specs(repo, ctx):
    out = []
    lim = CFG["budgets"]["spec_body_chars"]
    words = CFG["check"].get("history_words", [])
    fmap = repo.feature_map
    for key, sp in repo.specs.items():
        if sp.error:
            continue
        if not sp.id:
            out.append(F("E-SCHEMA-01", sp.rel, 1, "front matter 缺少 id", "补 id"))
            continue
        if sp.path.stem != sp.id:
            out.append(F("E-SCHEMA-01", sp.rel, 1, f"文件名应为 {sp.id}.md", "改文件名或 id"))
        f = fmap.get(sp.id)
        if not f:
            out.append(F("E-SCHEMA-01", sp.rel, 1, f"{sp.id} 不在 roadmap.yaml 中", "先在主干用 new feature 登记"))
        elif sp.path.parent.parent.name != f.get("domain"):
            out.append(F("E-SCHEMA-01", sp.rel, 1, f"规格应位于 docs/domains/{f.get('domain')}/features/", "移动文件"))
        if sp.status not in ("draft", "ready"):
            out.append(F("E-SCHEMA-01", sp.rel, "status", f"status 只取 draft 或 ready，实际为 {sp.status}", "done 由脚本推导，不手填"))
        for k in sp.fm:
            if k not in ("id", "status", "refs", "open_questions"):
                out.append(F("E-SCHEMA-01", sp.rel, k, f"front matter 不放 {k}（以 roadmap.yaml 为准）", "删除该字段"))
        missing = [s for s in SPEC_SECTIONS if not any(h.startswith(s.split(" ")[0] + " ") for h in sp.sections)]
        if missing:
            out.append(F("E-SCHEMA-01", sp.rel, "", f"缺少章节：{('、'.join(missing))}", "按附录 B 补齐七节"))
        n = len(sp.body)
        if n > lim:
            out.append(F("W-SPEC-01", sp.rel, "", f"正文 {n} 字符，超出 {lim}", "拆分功能或删去能推导的内容"))
        prose = strip_code(sp.body)
        for w in words:
            for m in re.finditer(re.escape(w), prose):
                out.append(F("W-SPEC-01", sp.rel, line_of(sp.text, w), f"出现历史性措辞「{w}」", "改写为现状；理由写进 ADR"))
                break
        if sp.status == "ready" and not sp.acs:
            out.append(F("E-SCHEMA-01", sp.rel, "6 验收", "ready 的规格没有 AC", f"按 {sp.id}-AC<n> 写验收"))
    return out


RELEASES = ("R1", "R2", "R3", "later")


def check_roadmap(repo, ctx):
    out = []
    rf = "docs/product/roadmap.yaml"
    fmap = repo.feature_map
    codes = {str(d.get("code")): str(d.get("name")) for d in repo.domains}
    for f in repo.features:
        fid = str(f["id"])
        for fld in ("title", "domain", "release", "depends", "covers"):
            if fld not in f:
                out.append(F("E-SCHEMA-01", rf, fid, f"缺少字段 {fld}", "按 5.5 补齐"))
        extra = set(f) - {"id", "title", "domain", "release", "depends", "covers", "withdrawn"}
        if extra:
            out.append(F("E-SCHEMA-01", rf, fid, f"不认识的字段 {', '.join(sorted(extra))}", "路线图只放 id、title、domain、release、depends、covers、withdrawn"))
        m = FEATURE_ID_RE.match(fid)
        if not m:
            out.append(F("E-SCHEMA-01", rf, fid, "功能 ID 应为 <领域代码>-<两位序号>", "修正编号"))
        elif codes.get(m.group(1)) != f.get("domain"):
            out.append(F("E-SCHEMA-01", rf, fid, f"ID 前缀 {m.group(1)} 与领域 {f.get('domain')} 不符", "改领域，或回主干重新分配编号"))
        if f.get("domain") not in repo.domain_names:
            out.append(F("E-SCHEMA-01", rf, fid, f"领域 {f.get('domain')} 不在 domain-map.yaml 中", "修正领域名"))
        if f.get("release") not in RELEASES:
            out.append(F("E-SCHEMA-01", rf, fid, f"release 只取 {('、'.join(RELEASES))}", "修正 release"))
        if f.get("withdrawn") and f.get("covers"):
            out.append(F("E-SCHEMA-01", rf, fid, "撤销的功能仍有 covers", "清空 covers"))
        for d in f.get("depends") or []:
            if str(d) not in fmap:
                out.append(F("E-REF-01", rf, fid, f"依赖 {d} 不存在", "修正编号"))
    state = {}
    def visit(n, stack):
        if state.get(n) == 1:
            out.append(F("E-SCHEMA-01", rf, n, f"依赖成环：{' → '.join(stack + [n])}", "拆掉其中一条依赖"))
            return
        if state.get(n) == 2:
            return
        state[n] = 1
        for d in (fmap.get(n) or {}).get("depends") or []:
            if str(d) in fmap:
                visit(str(d), stack + [n])
        state[n] = 2
    for fid in fmap:
        visit(fid, [])
    return out


VALID_STATES = {"loading", "empty", "error", "offline", "restricted", "insufficient_data", "locked"}
VALID_MODES = {"guided", "immersive", "standalone", "standard"}


def check_screens(repo, ctx):
    out = []
    for pid, pg in repo.screens.items():
        r = pg["_file"]
        exp_end = END_OF_PREFIX.get(pid[0])
        if not PAGE_ID_RE.match(pid) or Path(r).stem != pid:
            out.append(F("E-SCHEMA-01", r, "id", f"页 ID {pid} 与文件名不符", "修正"))
        if pg.get("end") != exp_end or f"/{exp_end}/" not in r:
            out.append(F("E-SCHEMA-01", r, "end", f"所属端应为 {exp_end}", "修正 end 或移动文件"))
        if pg.get("mode") not in VALID_MODES:
            out.append(F("E-SCHEMA-01", r, "mode", f"模式 {pg.get('mode')} 无效", f"取 {', '.join(sorted(VALID_MODES))}"))
        if "refine" in pg and pg["refine"] not in ("pending", "refined"):
            out.append(F("E-SCHEMA-01", r, "refine", "refine 只取 pending 或 refined", "修正"))
        bad = set(pg.get("states") or []) - VALID_STATES
        if bad:
            out.append(F("E-SCHEMA-01", r, "states", f"未知状态 {', '.join(sorted(bad))}", f"取 {', '.join(sorted(VALID_STATES))}"))
        seen = set()
        for i, it in enumerate(pg.get("items") or []):
            iid = str((it or {}).get("id", ""))
            mm = ITEM_ID_RE.match(iid)
            if not mm or mm.group(1) != pid:
                out.append(F("E-SCHEMA-01", r, f"items[{i}]", f"条目编号 {iid or '（缺）'} 应为 {pid}-<两位序号>，由 import-prototype 分配",
                             "运行 python scripts/spec_tool.py import-prototype --write-ids 分配编号"))
                continue
            if iid in seen:
                out.append(F("E-SCHEMA-01", r, iid, "条目编号重复", "修正"))
            seen.add(iid)
            if it.get("page_priority") not in ("P0", "P1", "P2"):
                out.append(F("E-SCHEMA-01", r, iid, "page_priority 只取 P0、P1、P2", "修正"))
        nums = [int(ITEM_ID_RE.match(str(it.get("id"))).group(2)) for it in pg.get("items") or [] if ITEM_ID_RE.match(str(it.get("id", "")))]
        if nums != sorted(nums):
            out.append(F("E-SCHEMA-01", r, "items", "条目应按编号顺序排列，新条目只在末尾追加", "按编号重排"))
        for ai in pg.get("ai") or []:
            sc = (ai or {}).get("scenario")
            if sc and sc not in repo.scenarios:
                out.append(F("E-REF-01", r, "ai", f"场景 {sc} 不存在", "修正，或按重型通道登记场景"))
    return out


def check_phases(repo, ctx):
    out = []
    pf = "docs/product/phases.yaml"
    if not repo.phases:
        return out
    lf = repo.loop_of_feature()
    fmap = repo.feature_map
    for fid, f in fmap.items():
        if f.get("withdrawn"):
            continue
        n = len(lf.get(fid, []))
        if n == 0:
            out.append(F("E-PHASE-01", pf, fid, f"功能 {fid} 不属于任何闭环", "把它放进某个闭环的 features"))
        elif n > 1:
            out.append(F("E-PHASE-01", pf, fid, f"功能 {fid} 属于多个闭环", "只保留一个"))
    for ph, lp in repo.loops():
        for fid in lp.get("features") or []:
            if str(fid) not in fmap:
                out.append(F("E-PHASE-02", pf, lp.get("id"), f"闭环引用了不存在的功能 {fid}", "修正编号，或先在主干 new feature"))
        if not lp.get("demo") or not lp.get("budget_rounds"):
            out.append(F("W-PHASE-04", pf, lp.get("id"), "闭环缺少一句话演示或预算", "补 demo 与 budget_rounds"))
    for ph in repo.phases:
        rels = sorted({str(fmap[str(fid)].get("release")) for lp in ph.get("loops") or [] for fid in lp.get("features") or []
                       if str(fid) in fmap and not fmap[str(fid)].get("withdrawn")})
        if len(rels) > 1:
            out.append(F("E-PHASE-03", pf, ph.get("id"), f"同一期的功能 release 不一致：{', '.join(rels)}", "按 ADR-008 的映射统一 release"))
    return out


def check_domain_map(repo, ctx):
    out = []
    df = "docs/product/domain-map.yaml"
    codes, names = set(), set()
    for d in repo.domains:
        c, n = str(d.get("code", "")), str(d.get("name", ""))
        if not DOMAIN_CODE_RE.match(c):
            out.append(F("E-SCHEMA-01", df, n, f"领域代码 {c} 应为大写字母", "修正"))
        if not re.match(r"^[a-z][a-z0-9]*$", n):
            out.append(F("E-SCHEMA-01", df, n, "领域名应为小写", "修正"))
        if c in codes or n in names:
            out.append(F("E-SCHEMA-01", df, n, "领域代码或领域名重复", "修正"))
        codes.add(c)
        names.add(n)
    for d in repo.domains:
        for dep in d.get("depends") or []:
            if dep not in names:
                out.append(F("E-SCHEMA-01", df, d["name"], f"依赖的领域 {dep} 不存在", "修正"))
    return out


class CheckCtx:
    def __init__(self, changed=None, full=False):
        self.changed = changed or []
        self.full = full
        self.baselines = baseline_refs()


CHECKS = [check_instr, check_gen, check_skills, check_hooks, check_refs, check_owner, check_coverage, check_refine,
          check_ac_inv, check_ai, check_dc, check_params, check_exam, check_work, check_oq, check_terms, check_ids,
          check_conventions, check_budget_static, check_specs, check_roadmap, check_screens, check_phases,
          check_domain_map]


def run_checks(repo, changed_only=False, full=False, staged=False) -> list[Finding]:
    changed = changed_files(staged=staged)
    ctx = CheckCtx(changed=changed, full=full)
    out = []
    for fn in CHECKS:
        try:
            out += fn(repo, ctx)
        except YamlError as e:
            out.append(F("E-SCHEMA-01", str(e).split("：", 1)[0], 1, str(e).split("：", 1)[-1], "修正 YAML 语法"))
    out = repo.load_errors + out
    uniq, seen = [], set()
    for f in out:
        k = str(f)
        if k not in seen:
            seen.add(k)
            uniq.append(f)
    return uniq


# ---------------------------------------------------------------- 生成（gen）

GEN_MARK = "GENERATED by spec_tool gen"


def _fm_block(d: dict) -> str:
    return "---\n" + dump_yaml(d, flow_max=200) + "---\n"


def gen_skill_outputs(repo) -> dict:
    out = {}
    for name, sk in repo.skills.items():
        fm = dict(sk["fm"])
        md = dict(fm.get("metadata") or {})
        src_files = sorted(p for p in walk_files(sk["dir"]) if "agents" not in p.relative_to(sk["dir"]).parts)
        h = short_hash("".join(rel(p) + read_text(p) for p in src_files if is_text_file(p)))
        manual = md.get("invocation") == "manual"
        cfm = {"name": fm.get("name"), "description": fm.get("description")}
        if md.get("args"):
            cfm["argument-hint"] = md["args"]
        if manual:
            cfm["disable-model-invocation"] = True
        for k in ("license", "compatibility", "allowed-tools"):
            if k in fm:
                cfm[k] = fm[k]
        cmd = dict(md)
        cmd["generated_from"] = sk["path"]
        cmd["source_sha"] = h
        cfm["metadata"] = cmd
        out[f".claude/skills/{name}/SKILL.md"] = (_fm_block(cfm) + sk["body"], h, [sk["path"]])
        for p in src_files:
            if p.name == "SKILL.md" or not is_text_file(p):
                continue
            sub = p.relative_to(sk["dir"]).as_posix()
            out[f".claude/skills/{name}/{sub}"] = (read_text(p), h, [rel(p)])
        oy = (f"# {GEN_MARK}，来源：SKILL.md 的 metadata.invocation；勿手改\n# source-sha: {h}\n"
              f"policy:\n  allow_implicit_invocation: {'false' if manual else 'true'}\n")
        out[f".agents/skills/{name}/agents/openai.yaml"] = (oy, h, [sk["path"]])
    return out


def gen_rule_outputs(repo) -> dict:
    out = {}
    for name, c in repo.conventions.items():
        h = short_hash(c["text"])
        fm = "---\npaths:\n" + "".join(f"  - {json.dumps(g, ensure_ascii=False)}\n" for g in c["applies_to"]) + "---\n"
        body = (f"<!-- {GEN_MARK}，来源：{c['path']} 的“## 规则”；勿手改。source-sha: {h} -->\n"
                f"# {c['title']}（规则摘录）\n\n{c['rules_text'].strip()}\n")
        out[f".claude/rules/conv-{name}.md"] = (fm + body, h, [c["path"]])
    return out


def _ts(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, list):
        return "[" + ", ".join(_ts(x) for x in v) + "]"
    if isinstance(v, dict):
        return "{ " + ", ".join(f"{json.dumps(str(k))}: {_ts(x)}" for k, x in v.items()) + " }"
    return json.dumps(str(v), ensure_ascii=False)


def gen_params_output(repo) -> dict:
    path = CFG["gen"].get("params_out", "packages/params/index.ts")
    src = repo.root / "contracts" / "params.yaml"
    if not src.exists():
        return {}
    h = short_hash(read_text(src))
    lines = [f"// {GEN_MARK}，来源：contracts/params.yaml；勿手改。source-sha: {h}",
             "// 参数的类型化访问器：默认值与区间以 contracts/params.yaml 为准；运行时取值由参数中心注入，数值夹在登记区间内。", "",
             "export const PARAMS = {"]
    for name, e in repo.params.items():
        lines.append(f"  {json.dumps(name)}: {{ owner: {_ts(e.get('owner'))}, default: {_ts(e.get('default'))}, range: {_ts(e.get('range'))}, "
                     f"unit: {_ts(e.get('unit'))}, tunableBy: {_ts(e.get('tunable_by') or [])}, learnerRange: {_ts(e.get('learner_range'))}, "
                     f"rollout: {_ts(e.get('rollout'))}, reasonRequired: {_ts(bool(e.get('reason_required')))} }},")
    lines += ["} as const;", "",
              "export type ParamName = keyof typeof PARAMS;",
              "type Widen<T> = T extends number ? number : T extends boolean ? boolean : T extends string ? string :",
              "  T extends readonly (infer U)[] ? Widen<U>[] : T;",
              "export type ParamValue<K extends ParamName> = Widen<(typeof PARAMS)[K][\"default\"]>;",
              "export type ParamSource = (name: ParamName) => unknown;", "",
              "let source: ParamSource = () => undefined;", "",
              "/** 由运行时（参数中心）注入当前取值；未注入时取默认值。 */",
              "export function setParamSource(fn: ParamSource): void {", "  source = fn;", "}", "",
              "/** 读取参数。数值取值被夹在登记区间内。 */",
              "export function param<K extends ParamName>(name: K): ParamValue<K> {",
              "  const spec = PARAMS[name];", "  const raw = source(name);",
              "  if (raw === undefined || raw === null) return spec.default as unknown as ParamValue<K>;",
              "  const range = spec.range as unknown as readonly [number, number] | null;",
              "  if (typeof raw === \"number\" && range) {",
              "    return Math.min(range[1], Math.max(range[0], raw)) as unknown as ParamValue<K>;", "  }",
              "  return raw as ParamValue<K>;", "}", ""]
    return {path: ("\n".join(lines), h, ["contracts/params.yaml"])}


def gen_roadmap_output(repo, with_results: bool = False) -> dict:
    path = CFG["gen"].get("roadmap_out", "docs/product/roadmap.md")
    rpath, ppath = repo.root / "docs/product/roadmap.yaml", repo.root / "docs/product/phases.yaml"
    if not rpath.exists():
        return {}
    fmap = repo.feature_map
    status = {fid: repo.feature_status(fid, with_results) for fid in fmap}
    h = short_hash(read_text(rpath) + (read_text(ppath) if ppath.exists() else "") + json.dumps(status, ensure_ascii=False, sort_keys=True))
    L = [f"<!-- {GEN_MARK}，来源：docs/product/roadmap.yaml、docs/product/phases.yaml 与各规格的 status；勿手改。source-sha: {h} -->",
         "# 路线图（生成物，只读）", "",
         "状态按 docs/meta/doc-system.md 8.6 推导：待写＝规格不存在，规格中＝draft，可实现＝ready。"
         + ("“完成”按本次测试结果推导。" if with_results else "“完成”需要测试结果，见 CI 在主干发布的构建产物。"), ""]
    cov = coverage_index(repo)
    items = repo.items
    L += ["| 期 | 主题 | release | 闭环 | 功能 | 覆盖条目 | 待写 | 规格中 | 可实现 |", "|---|---|---|---|---|---|---|---|---|"]
    lf = repo.loop_of_feature()
    for ph in repo.phases:
        fids = [str(f) for lp in ph.get("loops") or [] for f in lp.get("features") or []]
        rels = sorted({str(fmap[f].get("release")) for f in fids if f in fmap})
        ncov = sum(len(fmap[f].get("covers") or []) for f in fids if f in fmap)
        cnt = lambda s: sum(1 for f in fids if status.get(f) == s)
        L.append(f"| {ph.get('id')} | {ph.get('title')} | {', '.join(rels) or '—'} | {len(ph.get('loops') or [])} | {len(fids)} | {ncov} | {cnt('待写')} | {cnt('规格中')} | {cnt('可实现')} |")
    L.append("")
    for ph in repo.phases:
        L += [f"## {ph.get('id')} 期　{ph.get('title')}", ""]
        if ph.get("hypothesis"):
            L += [f"假设：{ph['hypothesis']}", ""]
        for lp in ph.get("loops") or []:
            L += [f"### {lp.get('id')} {lp.get('title')}", ""]
            if lp.get("demo"):
                L += [f"演示：{lp['demo']}", ""]
            fids = [str(f) for f in lp.get("features") or []]
            if not fids:
                L += ["（本闭环不含功能，见 phases.yaml 的 tasks。）", ""]
                continue
            L += ["| 功能 | 标题 | 领域 | release | 覆盖 | 依赖 | 状态 |", "|---|---|---|---|---|---|---|"]
            for fid in fids:
                f = fmap.get(fid, {})
                deps = "、".join(str(d) for d in f.get("depends") or []) or "—"
                L.append(f"| {fid} | {f.get('title', '（未登记）')} | {f.get('domain', '')} | {f.get('release', '')} | {len(f.get('covers') or [])} | {deps} | {status.get(fid, '')} |")
            L.append("")
    orphan = [fid for fid in fmap if fid not in lf]
    if orphan:
        L += ["## 未归入闭环的功能", "", "| 功能 | 标题 | 领域 | release | 状态 |", "|---|---|---|---|---|"]
        L += [f"| {fid} | {fmap[fid].get('title')} | {fmap[fid].get('domain')} | {fmap[fid].get('release')} | {status[fid]} |" for fid in orphan]
        L.append("")
    total = sum(1 for i in items.values() if not i[1].get("removed"))
    L += [f"条目合计：{total} 个在用条目，其中 {sum(1 for i in items if i in cov)} 个由功能覆盖。", ""]
    return {path: ("\n".join(L), h, ["docs/product/roadmap.yaml", "docs/product/phases.yaml"])}


def gen_outputs(repo) -> dict:
    out = {}
    out.update(gen_skill_outputs(repo))
    out.update(gen_rule_outputs(repo))
    out.update(gen_params_output(repo))
    out.update(gen_roadmap_output(repo))
    out.update(gen_progress_output(repo))
    return out


def stale_generated(repo, expected: dict) -> list[str]:
    stale = []
    cands = []
    d = repo.root / ".claude" / "skills"
    if d.exists():
        cands += [rel(p) for p in walk_files(d)]
    d = repo.root / ".claude" / "rules"
    if d.exists():
        cands += [rel(p) for p in d.glob("conv-*.md")]
    d = repo.root / ".agents" / "skills"
    if d.exists():
        cands += [rel(p) for p in d.glob("*/agents/openai.yaml")]
    for c in cands:
        if c not in expected:
            stale.append(c)
    return stale


def cmd_gen(args):
    repo = Repo()
    expected = gen_outputs(repo)
    isolated = getattr(args, "root", None) is not None
    art = Path(args.artifacts) if args.artifacts else None
    stale = stale_generated(repo, expected)
    if isolated:
        if art is not None and not art.is_absolute():
            art = repo.root / art
        try:
            for target in [repo.root / p for p in [*expected, *stale]] + ([art] if art is not None else []):
                target.resolve().relative_to(repo.root.resolve())
        except ValueError:
            print("隔离生成拒绝写入临时根目录之外的路径。")
            return 2
    if args.check:
        fs = check_gen(repo, CheckCtx())
        for f in fs:
            print(f)
        print(f"gen --check：{len(fs)} 处过期或被手改。" if fs else "gen --check：生成物与源一致。")
        return 1 if fs else 0
    n = 0
    for path, (content, h, srcs) in expected.items():
        p = repo.root / path
        if not p.exists() or read_text(p) != content:
            write_text(p, content)
            n += 1
            print(f"写入 {path}")
    for path in stale:
        (repo.root / path).unlink()
        print(f"删除 {path}")
        n += 1
    for d in sorted((repo.root / ".claude" / "skills").glob("*"), reverse=True) if (repo.root / ".claude" / "skills").exists() else []:
        if d.is_dir() and not any(d.rglob("*")):
            shutil.rmtree(d)
    if art is not None:
        art.mkdir(parents=True, exist_ok=True)
        rm = gen_roadmap_output(repo, with_results=True)
        for _, (content, _, _) in rm.items():
            write_text(art / "roadmap.md", content)
        write_text(art / "coverage.md", coverage_report(repo))
        print(f"构建产物已写入 {art}")
    print(f"gen 完成：{n} 个文件有变化。")
    return 0


# ---------------------------------------------------------------- 预算（budget）

def _skill_desc(sk) -> str:
    return str(sk["fm"].get("description", ""))


def budget_report(repo, tool: str | None = None) -> tuple[str, bool]:
    b = CFG["budgets"]
    lines, bad = [], False
    root = repo.root / "AGENTS.md"
    root_bytes = utf8len(read_text(root)) if root.exists() else 0

    def row(label, val, lim, unit):
        nonlocal bad
        ok = val <= lim
        bad = bad or not ok
        lines.append(f"| {label} | {val:,} {unit} | {lim:,} {unit} | {'通过' if ok else '超出'} |")

    tools = [tool] if tool else ["claude", "codex"]
    for t in tools:
        lines += ["", f"## {t} 预算", "", "| 项 | 当前 | 上限 | 结论 |", "|---|---|---|---|"]
        row("根 AGENTS.md", root_bytes, b["root_agents_kib"] * 1024, "字节")
        for p in agents_files(repo):
            r = rel(p)
            if r == "AGENTS.md":
                continue
            lim = b["end_agents_kib"] * 1024 if re.match(r"^apps/[^/]+/AGENTS\.md$", r) else b["pkg_agents_kib"] * 1024
            row(r, utf8len(read_text(p)), lim, "字节")
        if t == "claude":
            res = root_bytes
            rd = repo.root / ".claude" / "rules"
            for p in sorted(rd.glob("*.md")) if rd.exists() else []:
                fm, _, _ = split_front_matter(read_text(p))
                if not fm.get("paths"):
                    res += utf8len(read_text(p))
            res += sum(utf8len(_skill_desc(s)) for s in repo.skills.values()
                       if (s["fm"].get("metadata") or {}).get("invocation") != "manual")
            row("Claude 常驻（根 AGENTS.md＋无 paths 规则＋非手动 skill 描述）", res, b["claude_resident_kib"] * 1024, "字节")
        else:
            chain = 0
            for p in agents_files(repo):
                parts = Path(rel(p)).parent.parts
                tot = 0
                for i in range(len(parts) + 1):
                    f = repo.root.joinpath(*parts[:i], "AGENTS.md")
                    if f.exists():
                        tot += utf8len(read_text(f))
                chain = max(chain, tot)
            row("Codex 指令链（根到最深启动目录）", chain, b["codex_chain_kib"] * 1024, "字节")
            total = sum(len(_skill_desc(s)) for s in repo.skills.values())
            row("skill 描述合计（含手动）", total, b["skill_desc_total_chars"], "字符")
        for s in repo.skills.values():
            row(f"skill {s['name']} 描述", len(_skill_desc(s)), b["skill_desc_max_chars"], "字符")
    lines += ["", "## 规则与规格", "", "| 项 | 当前 | 上限 | 结论 |", "|---|---|---|---|"]
    for end in ("learner", "org", "admin"):
        n, _ = concurrent_rules(repo, typical_task_paths(end))
        row(f"同时生效规则（{end} 典型全栈任务）", n, b["rules_concurrent_error"], "条")
    for c in repo.conventions.values():
        row(f"约定 {c['name']} 规则", len(c["rules"]), b["convention_rules_max"], "条")
    for fid, sp in sorted(repo.specs.items()):
        row(f"规格 {fid} 正文", len(sp.body), b["spec_body_chars"], "字符")
    lines += ["", "## 任务包", "", "| 功能 | 状态 | 字符 | 字节 | 同时生效规则 | 结论 |", "|---|---|---|---|---|---|"]
    for fid, sp in sorted(repo.specs.items()):
        try:
            text, meta = build_pack(repo, fid)
        except Exception as e:  # pragma: no cover
            lines.append(f"| {fid} | {sp.status} | — | — | — | 生成失败：{e} |")
            continue
        n = len(text)
        ok = n <= b["pack_chars"]
        if sp.status == "ready" and not ok:
            bad = True
        lines.append(f"| {fid} | {sp.status} | {n:,} | {utf8len(text):,} | {meta['rules']} | {'通过' if ok else '超出'} |")
    return "\n".join(lines), bad


def cmd_budget(args):
    repo = Repo()
    text, bad = budget_report(repo, args.tool)
    print(f"# 预算报告（{args.tool or 'claude 与 codex'}）")
    print(text)
    return 1 if bad else 0


# ---------------------------------------------------------------- 任务包（pack）

def _commit() -> str:
    if in_git() and ref_exists("HEAD"):
        code, out = git("rev-parse", "--short", "HEAD")
        dirty = bool(changed_files())
        return out.strip() + ("+工作区改动" if dirty else "")
    return "未提交的工作区"


def _clean(d: dict) -> dict:
    return {k: v for k, v in d.items() if not str(k).startswith("_")}


def _yaml_block(d) -> str:
    return "```yaml\n" + dump_yaml(_clean(d) if isinstance(d, dict) else d, flow_max=140).rstrip() + "\n```"


def page_slice(repo, pid: str, item_ids=None, header_only=False, header_keys=None) -> str:
    pg = repo.screens.get(pid)
    if not pg:
        return f"（页面登记 {pid} 不存在）"
    keys = ["id", "end", "title", "mode", "purpose", "refine", "views", "states", "state_overrides", "layout_notes",
            "data", "ai", "entries", "exits"]
    if header_keys is not None:
        keys = header_keys
    head = {k: pg[k] for k in keys if k in pg and pg[k] not in (None, [], {})}
    parts = [_yaml_block(head)]
    if not header_only:
        its = [it for it in pg.get("items") or [] if item_ids is None or it.get("id") in item_ids]
        lines = []
        for it in its:
            flags = [k for k in ("ui_only", "removed") if it.get(k)] + ([f"out_of_scope: {it['out_of_scope']}"] if it.get("out_of_scope") else [])
            lines.append(f"- {it['id']} {it.get('name', '')}（{it.get('page_priority', '')}{'，' + '，'.join(flags) if flags else ''}）：{it.get('text', '')}")
        parts.append("条目：\n" + "\n".join(lines))
    return "\n\n".join(parts)


def _slice_excerpt(repo, pid: str) -> str:
    p = repo.root / "design" / "screens" / "slices" / f"{pid}.html"
    if not p.exists():
        return "（无原型切片）"
    text = read_text(p)
    m = re.search(r"<pre class=\"render\"><code>(.*?)</code></pre>", text, re.S)
    src = m.group(1) if m else text
    import html as _html
    src = _html.unescape(src).strip()
    lim = CFG["budgets"].get("pack_slice_chars", 2500)
    more = "" if len(src) <= lim else f"\n…（已截断，全文见 {rel(p)}）"
    return f"原型切片 {rel(p)}（渲染函数，只作布局参考）：\n```js\n{src[:lim]}{more}\n```"


def _shots(repo, pid: str) -> str:
    d = repo.root / "design" / "screens" / "shots" / pid
    files = sorted(rel(p) for p in d.glob("*.png")) if d.exists() else []
    return "截图：" + ("、".join(files) if files else "（尚未生成，运行 python scripts/spec_tool.py shots --page " + pid + "）")


def _rules_for_paths(repo, paths, exclude_root=True):
    secs, sources, count = [], [], 0
    for c in repo.conventions.values():
        if any(path_matches_any(p.rstrip("*").rstrip("/") or p, c["applies_to"]) for p in paths):
            secs.append(f"### 约定 {c['name']}（{c['path']}）\n{c['rules_text'].strip()}")
            sources.append(c["path"])
            count += len(c["rules"])
    agents = []
    for p in paths:
        parts = Path(p.rstrip("*").rstrip("/")).parts
        for i in range(1, len(parts) + 1):
            f = repo.root.joinpath(*parts[:i], "AGENTS.md")
            r = rel(f)
            if f.exists() and r not in agents and (r != "AGENTS.md" or not exclude_root):
                agents.append(r)
    for r in agents:
        text = read_text(repo.root / r)
        secs.append(f"### {r}\n" + re.sub(r"^#\s.*\n+", "", text).strip())
        sources.append(r)
        m = re.match(r"apps/[^/]+/AGENTS\.md", r)
        if m:
            count += _count_items(dict(md_sections(text, 2)).get("本端要点", ""))
    return secs, sources, count


def _domain_points(repo, domain: str):
    p = repo.root / "docs" / "domains" / domain / "README.md"
    if not p.exists():
        return "", None
    secs = dict(md_sections(read_text(p), 2))
    return secs.get("要点", "").strip(), rel(p)


def _local_ref_closure(document, seeds):
    """保留 OpenAPI 本地引用的递归闭包；循环引用只收录一次。"""
    found, pending = {}, list(seeds)
    while pending:
        value = pending.pop()
        if isinstance(value, list):
            pending.extend(value)
        elif isinstance(value, dict):
            pending.extend(v for k, v in value.items() if k != "$ref")
            ref = value.get("$ref")
            if not isinstance(ref, str) or not ref.startswith("#/") or ref in found:
                continue
            node = document
            try:
                for token in ref[2:].split("/"):
                    node = node[token.replace("~1", "/").replace("~0", "~")]
            except (KeyError, TypeError):
                found[ref] = {"未解析引用": ref}
            else:
                found[ref] = node
                pending.append(node)
    return dict(sorted(found.items()))


def _contract_slices(repo, sp) -> tuple[str, list]:
    out, srcs = [], []
    if sp.ref_list("api"):
        ops = repo.operations
        lines = []
        for op in sp.ref_list("api"):
            o = ops.get(op)
            if not o:
                lines.append(f"- {op}：（未登记）")
                continue
            d = {k: o[k] for k in ("method", "path", "summary", "x-owner", "x-public", "parameters", "security", "requestBody", "responses", "x-errors") if k in o}
            lines.append(f"- {op}\n" + _yaml_block(d))
        out.append("### api\n" + "\n".join(lines))
        components = _local_ref_closure(repo._yaml("contracts/openapi.yaml", {}),
                                        [ops[n] for n in sp.ref_list("api") if n in ops])
        if components:
            out.append("### OpenAPI 被引用组件（递归闭包）\n" + _yaml_block(components))
        srcs.append("contracts/openapi.yaml")
    if sp.ref_list("schema"):
        blocks = []
        for t in sp.ref_list("schema"):
            d = repo.tables.get(t)
            blocks.append(f"- {t}" + ("\n" + _yaml_block(d) if d else "：（未登记）"))
            if d:
                srcs.append(d["_file"])
        out.append("### schema\n" + "\n".join(blocks))
    for kind, reg, label, src in (("permissions", repo.actions, "permissions", "contracts/permissions.yaml"),
                                  ("events", repo.analytics_events, "events", "contracts/events.yaml"),
                                  ("errors", repo.errors, "errors", "contracts/errors.yaml"),
                                  ("domain_events", repo.domain_events, "domain_events", "contracts/domain-events.yaml")):
        names = sp.ref_list(kind)
        if names:
            out.append(f"### {label}\n" + _yaml_block([_clean(reg[n]) if n in reg else {"未登记": n} for n in names]))
            srcs.append(src)
    return ("\n\n".join(out) or "（规格未引用契约条目）"), srcs


def build_pack(repo, fid: str) -> tuple[str, dict]:
    f = repo.feature_map.get(fid)
    sp = repo.specs.get(fid)
    if not f:
        raise KeyError(f"{fid} 不在 roadmap.yaml 中")
    if not sp:
        raise FileNotFoundError(f"{fid} 还没有规格；写规格阶段用 pack {fid} --spec-mode")
    sources = ["docs/product/roadmap.yaml", sp.rel]
    loops = repo.loop_of_feature().get(fid, [])
    loop_txt = "；".join(f"{lp.get('id')} {lp.get('title')}（{ph.get('id')} 期）" for ph, lp in loops) or "未归入闭环"
    paths = repo.feature_paths(fid)
    S = {}
    fm = {k: v for k, v in sp.fm.items() if k not in ("refs", "open_questions")}
    S["1 规格全文（refs 按后文展开，待定问题见第 11 节）"] = _fm_block(fm) + sp.body.strip()
    secs, rsrc, rule_count = _rules_for_paths(repo, paths)
    pts, psrc = _domain_points(repo, str(f.get("domain")))
    red = 0
    if (repo.root / "AGENTS.md").exists():
        red = _count_items(next((v for k, v in md_sections(read_text(repo.root / "AGENTS.md"), 2) if k.startswith("红线")), ""))
    rule_count += red
    S["2 适用规则（约定规则摘录 + 端、包级 AGENTS.md）"] = (f"### 领域要点（{psrc}）\n{pts}\n\n" if pts else "") + "\n\n".join(secs)
    sources += rsrc + ([psrc] if psrc else [])
    txt, csrc = _contract_slices(repo, sp)
    S["3 契约切片（api / schema / permissions / events / errors / domain_events）"] = txt
    sources += csrc
    pd = []
    for n in sp.ref_list("params"):
        pd.append(_clean(repo.params[n]) if n in repo.params else {"未登记": n})
    dd = [_clean(repo.data_classes[n]) if n in repo.data_classes else {"未登记": n} for n in sp.ref_list("data_classes")]
    mm = [_clean(repo.metrics[n]) if n in repo.metrics else {"未登记": n} for n in sp.ref_list("metrics")]
    blk = []
    if pd:
        blk.append("### 参数\n" + _yaml_block(pd))
        sources.append("contracts/params.yaml")
    if dd:
        blk.append("### 数据类别\n" + _yaml_block(dd))
        sources.append("contracts/data-classes.yaml")
    if mm:
        blk.append("### 指标\n" + _yaml_block(mm))
        sources.append("contracts/metrics.yaml")
    for model_ref in sp.ref_list("models"):
        model = repo.model_section(model_ref)
        if model:
            model_path, model_text = model
            blk.append(f"### 模型原文 {model_ref}（{model_path}）\n{model_text}")
            sources.append(model_path)
    S["4 参数与数据类别"] = "\n\n".join(blk) or "（未引用参数或数据类别）"
    ai = []
    for sid in sp.ref_list("ai"):
        sc = repo.scenarios.get(sid)
        if not sc:
            ai.append(f"- {sid}：（未登记）")
            continue
        ai.append(f"### 场景 {sid}\n" + _yaml_block(sc))
        act = repo.actors.get(str(sc.get("actor")))
        if act:
            ai.append(f"执行者 {act['id']}：\n" + _yaml_block(act))
        th = repo.root / "evals" / sid / "thresholds.yaml"
        if th.exists():
            ai.append(f"评测阈值（{rel(th)}）：\n```yaml\n{read_text(th).strip()}\n```")
            sources.append(rel(th))
    if ai:
        sources += ["contracts/ai/scenarios.yaml", "contracts/ai/actors.yaml"]
    S["5 AI 场景、执行者与评测阈值"] = "\n\n".join(ai) or "（不涉及 AI 场景）"
    pages = []
    covers = [str(i) for i in f.get("covers") or []]
    for pid in repo.feature_pages(fid):
        ids = [i for i in covers if i.startswith(pid + "-")]
        pg = repo.screens.get(pid, {})
        pages.append(f"### {pid} {pg.get('title', '')}\n" + page_slice(repo, pid, set(ids)) + "\n\n" + _slice_excerpt(repo, pid) + "\n\n" + _shots(repo, pid))
        sources += [pg.get("_file", ""), f"design/screens/slices/{pid}.html"]
    for pid in repo.feature_layout_pages(fid):
        pg = repo.screens.get(pid, {})
        header_keys = CFG.get("pack", {}).get("layout_header_keys", {}).get(fid)
        pages.append(f"### {pid} {pg.get('title', '')}（布局参考，本功能不覆盖其条目）\n" + page_slice(repo, pid, header_only=True, header_keys=header_keys) + "\n\n" + _shots(repo, pid))
        sources.append(pg.get("_file", ""))
    S["6 页面（登记切片 + 原型切片 + 截图路径）"] = "\n\n".join(pages) or "（不覆盖页面条目）"
    invs = [f"- {i}：{repo.inv_map[i].get('statement')}（执行：{'、'.join(repo.inv_map[i].get('enforcement') or [])}）" if i in repo.inv_map else f"- {i}：（未登记）"
            for i in sp.ref_list("inv")]
    S["7 不变量"] = "\n".join(invs) or "（未引用不变量）"
    if invs:
        sources.append("docs/product/invariants.yaml")
    deps = list(dict.fromkeys([str(d) for d in f.get("depends") or []] + sp.ref_list("features")))
    dl = []
    for d in deps:
        ds = repo.specs.get(d)
        df = repo.feature_map.get(d, {})
        if ds:
            first = ds.section("1").strip().split("\n\n")[0]
            dl.append(f"- {d} {df.get('title', '')}（{repo.feature_status(d)}）：{first}\n  接口：{'、'.join(ds.ref_list('api')) or '无'}")
            sources.append(ds.rel)
        else:
            dl.append(f"- {d} {df.get('title', '')}（{repo.feature_status(d)}）：规格未写")
    S["8 依赖功能的接口摘要"] = "\n".join(dl) or "（无依赖）"
    gl = []
    for g in repo.glossary:
        if g.get("category") == "banned_copy":
            continue
        if g["term"] in sp.body or (g.get("code") and str(g["code"]) in sp.body):
            line = f"- {g['term']}（`{g.get('code', '')}`）：{g.get('definition', '')}"
            if g.get("forbidden"):
                line += f" 禁用：{'、'.join(g['forbidden'])}"
            gl.append(line)
    S["9 术语"] = "\n".join(gl) or "（正文未命中术语表）"
    if gl:
        sources.append("docs/product/glossary.yaml")
    al = []
    required_sources = list(CFG.get("pack", {}).get("context_sources", {}).get(fid, []))
    external_adr = set(CFG.get("pack", {}).get("external_adr", {}).get(fid, []))
    adr_ids = list(dict.fromkeys(sp.ref_list("adr") + re.findall(r"\bADR-\d{3}\b", sp.body)))
    for a in adr_ids:
        ad = repo.adrs.get(a)
        if ad:
            if a in external_adr:
                al.append(f"### {a} {ad['title']}\n必读共同基线原文：{ad['path']}（交接包 repo/ 下）。")
                required_sources.append(ad["path"])
            else:
                al.append(f"### {a} {ad['title']}\n" + ad["sections"].get("决定", "（无“决定”一节）").strip())
            sources.append(ad["path"])
    S["10 相关 ADR 的决定"] = "\n\n".join(al) or "（未引用 ADR）"
    oq = [f"- {q.get('id')}：{q.get('q')}　临时默认：{q.get('default') or '（缺）'}" for q in (sp.oqs or []) if isinstance(q, dict)]
    oq += [f"- {q['id']}：{q.get('q')}　临时默认：{q.get('default') or '（缺）'}（跨功能，{q.get('status', 'open')}）"
           for q in repo.cross_oqs if fid in (q.get("features") or [])]
    S["11 待定问题与临时默认"] = "\n".join(oq) or "（无）"
    tags, res = repo.test_tags, repo.test_results
    tl = []
    for ac in sp.acs:
        locs = tags.get(ac, [])
        tl.append(f"- {ac}：" + ("、".join(f"{a}:{b}" for a, b in locs[:3]) + f"（最近结果：{res.get(ac, '未知')}）" if locs else "尚无测试"))
    S["12 AC 与测试现状"] = "\n".join(tl) or "（规格中没有 AC）"
    required_sources = list(dict.fromkeys(required_sources))
    for source in required_sources:
        try:
            if not isinstance(source, str) or Path(source).is_absolute() or ":" in source:
                raise ValueError(source)
            (repo.root / source).resolve().relative_to(repo.root.resolve())
            if not (repo.root / source).is_file():
                raise ValueError(source)
        except (ValueError, OSError):
            raise ValueError(f"{fid} 缺少或存在非法必读配套来源：{source}") from None
    if required_sources:
        S["13 必读配套来源"] = "这些原文与本包共同组成任务输入，交接包中位于 repo/ 下，须在实现或复核前阅读：\n" + "\n".join(f"- {p}" for p in required_sources)
        sources += required_sources
    lim = CFG["budgets"]["pack_chars"]
    header = (f"- 功能：{fid} {f.get('title')}；领域 {f.get('domain')}；release {f.get('release')}；闭环 {loop_txt}\n"
              f"- 依赖：{'、'.join(deps) or '无'}\n- 涉及路径：{'、'.join(paths)}\n"
              "- 本包及第 13 节配套来源共同构成任务输入；约定已摘录，不必再读约定全文。额外包外读取在 work 文件中记录原因。\n"
              f"- 同时生效规则：{rule_count} 条（根红线 {red} 条已常驻）。")
    body = "\n\n".join(f"## {k}\n\n{v}" for k, v in S.items())
    title = f"# 任务包 {fid} {f.get('title')}（由 {_commit()} 生成，勿手改）"
    draft = f"{title}\n\n## 0 读法与体量\n\n{header}\n- 体量：{{CHARS}} 字符（{{BYTES}} 字节），上限 {lim} 字符。\n\n{body}\n"
    approx = len(draft)
    text = draft.replace("{CHARS}", f"{approx:,}").replace("{BYTES}", f"{utf8len(draft):,}")
    sizes = {k: len(v) for k, v in S.items()}
    return text, {"chars": len(text), "bytes": utf8len(text), "sizes": sizes, "rules": rule_count,
                  "sources": sorted(set(s for s in sources if s)), "required_sources": required_sources}


def build_spec_pack(repo, fid: str) -> tuple[str, dict]:
    f = repo.feature_map.get(fid)
    if not f:
        raise KeyError(f"{fid} 不在 roadmap.yaml 中")
    dom = str(f.get("domain"))
    loops = repo.loop_of_feature().get(fid, [])
    S = {}
    S["1 路线图条目"] = _yaml_block(f) + ("\n\n所属闭环：\n" + "\n".join(
        f"- {lp.get('id')} {lp.get('title')}：{lp.get('demo', '')}" for ph, lp in loops) if loops else "")
    pages = []
    covers = [str(i) for i in f.get("covers") or []]
    for pid in repo.feature_pages(fid):
        pages.append(f"### {pid} {repo.screens.get(pid, {}).get('title', '')}\n" +
                     page_slice(repo, pid, {i for i in covers if i.startswith(pid + '-')}) + "\n\n" + _shots(repo, pid))
    S["2 覆盖的页面条目"] = "\n\n".join(pages) or "（不覆盖页面条目）"
    owned = []
    for label, reg in (("表", repo.tables), ("业务事件", repo.domain_events), ("参数", repo.params), ("AI 场景", repo.scenarios), ("指标", repo.metrics)):
        names = [k for k, v in reg.items() if v.get("owner") == dom]
        owned.append(f"- {label}：{'、'.join(names) or '（暂无）'}")
    errs = [k for k, v in repo.errors.items() if v.get("owner") == dom]
    owned.append(f"- 错误码：{'、'.join(errs) or '（暂无）'}")
    S[f"3 相关契约现状（{dom} 领域已登记的条目）"] = "\n".join(owned)
    invs = [f"- {i['id']}：{i.get('statement')}" for i in repo.invariants if dom in (i.get("scope") or [])]
    S["4 相关不变量"] = "\n".join(invs) or "（无）"
    oq = [f"- {q['id']}：{q.get('q')}　临时默认：{q.get('default')}" for q in repo.cross_oqs if fid in (q.get("features") or [])]
    S["5 待定问题"] = "\n".join(oq) or "（无）"
    secs, _, _ = _rules_for_paths(repo, ["docs/domains/x/features/x.md"])
    pts, _ = _domain_points(repo, dom)
    S["6 写规格适用的规则"] = (f"### 领域要点\n{pts}\n\n" if pts else "") + "\n\n".join(secs)
    S["7 规格模板"] = "见 docs/meta/doc-system.md 附录 B；默认值写参数名，每条 R 与 AC 可测，状态保持 draft。"
    body = "\n\n".join(f"## {k}\n\n{v}" for k, v in S.items())
    text = f"# 任务包 {fid} {f.get('title')}（写规格阶段，由 {_commit()} 生成，勿手改）\n\n{body}\n"
    return text, {"chars": len(text), "bytes": utf8len(text), "sizes": {k: len(v) for k, v in S.items()}, "rules": 0, "sources": []}


def cmd_pack(args):
    repo = Repo()
    fid = args.id
    f = repo.feature_map.get(fid)
    if not f:
        print(f"E-REF-01 docs/product/roadmap.yaml：{fid} 不存在。改法：先在主干运行 python scripts/spec_tool.py new feature 登记")
        return 2
    if args.spec_mode or fid not in repo.specs:
        pending = [pid for pid in repo.feature_pages(fid) if repo.screens.get(pid, {}).get("refine") == "pending"]
        if args.spec_mode and pending:
            print(f"E-REFINE-01 {fid}：覆盖条目所在页 {'、'.join(pending)} 的 refine 为 pending，拒绝生成写规格任务包。"
                  f"改法：先用 refine-page 技能完成该页深化（分支 refine/<页ID>），再写规格")
            return 2
        if not args.spec_mode:
            print(f"{fid} 还没有规格。写规格阶段请用：python scripts/spec_tool.py pack {fid} --spec-mode")
            return 2
        text, meta = build_spec_pack(repo, fid)
    else:
        text, meta = build_pack(repo, fid)
    out = repo.root / ".pack" / f"{fid}.md"
    write_text(out, text)
    write_text(repo.root / ".pack" / f"{fid}.json", json.dumps({"id": fid, "generated_at": _dt.datetime.now().isoformat(timespec="seconds"),
                                                                "commit": _commit(), "sources": meta["sources"],
                                                                "required_sources": meta.get("required_sources", [])}, ensure_ascii=False, indent=1))
    lim = CFG["budgets"]["pack_chars"]
    print(f"任务包：{rel(out)}　{meta['chars']:,} 字符（{meta['bytes']:,} 字节），上限 {lim:,} 字符")
    if meta["chars"] > lim and not args.allow_over and not args.spec_mode:
        top = sorted(meta["sizes"].items(), key=lambda x: -x[1])[:4]
        print("超出预算，最大的几块：" + "；".join(f"{k} {v:,} 字符" for k, v in top))
        print("功能涉及面太宽，应当拆分；确需保留时由人决定并记入 work 文件，再用 --allow-over 生成。")
        return 2
    return 0


# ---------------------------------------------------------------- rules

def cmd_rules(args):
    repo = Repo()
    paths = [p.replace("\\", "/").strip("./") or "." for p in args.paths]
    secs, srcs, count = _rules_for_paths(repo, paths)
    print(f"# 适用规则：{' '.join(paths)}\n")
    print(f"同时生效：约定与端级规则 {count} 条（根 AGENTS.md 已常驻，不重复）。\n")
    print("\n\n".join(secs) if secs else "（没有约定适用于这些路径）")
    return 0


# ---------------------------------------------------------------- coverage

def coverage_report(repo) -> str:
    cov = coverage_index(repo)
    items, fmap = repo.items, repo.feature_map
    ctx = CheckCtx(full=True)
    errs = [f for f in check_coverage(repo, ctx) if f.code.startswith(("E-COV", "W-COV"))]
    live = {i: v for i, v in items.items() if not v[1].get("removed")}
    n_cov = sum(1 for i in live if i in cov)
    n_ui = sum(1 for i, v in live.items() if v[1].get("ui_only"))
    n_oos = sum(1 for i, v in live.items() if v[1].get("out_of_scope"))
    L = ["# 页面条目覆盖报告", "", f"在用条目 {len(live)} 个（另有已删除 {len(items) - len(live)} 个保留编号）：被功能覆盖 {n_cov}，ui_only {n_ui}，out_of_scope {n_oos}，"
         f"未处理 {len(live) - n_cov - n_ui - n_oos}。", ""]
    e = [f for f in errs if f.is_error]
    L += [f"## 错误（{len(e)}）", ""] + ([f"- {f}" for f in e] or ["- 无"]) + [""]
    L += ["## 各页", "", "| 页 | 标题 | 在用 | 覆盖 | ui_only | out_of_scope | 已删除 | 深化 |", "|---|---|---|---|---|---|---|---|"]
    for pid, pg in repo.screens.items():
        its = pg.get("items") or []
        lv = [i for i in its if not i.get("removed")]
        L.append(f"| {pid} | {pg.get('title')} | {len(lv)} | {sum(1 for i in lv if i['id'] in cov)} | {sum(1 for i in lv if i.get('ui_only'))} | "
                 f"{sum(1 for i in lv if i.get('out_of_scope'))} | {len(its) - len(lv)} | {pg.get('refine', '')} |")
    L += ["", "## 页内 P0 但不在 R1", ""]
    p0 = []
    for iid, (pid, it) in live.items():
        if it.get("page_priority") == "P0":
            for fid in cov.get(iid, []):
                if fmap.get(fid, {}).get("release") != "R1":
                    p0.append((iid, it.get("name"), fid, fmap[fid].get("release")))
    L.append(f"共 {len(p0)} 项。首发范围按 docs/product/phases.yaml 的分期确认；下表供逐项复核。")
    L += ["", "| 条目 | 名称 | 覆盖功能 | release |", "|---|---|---|---|"] + [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in p0]
    L += ["", "## 待深化页及覆盖它们的功能", ""]
    pend = [(pid, pg) for pid, pg in repo.screens.items() if pg.get("refine") == "pending"]
    if not pend:
        L.append("- 无")
    for pid, pg in pend:
        fids = sorted({fid for iid in (i["id"] for i in pg.get("items") or []) for fid in cov.get(iid, [])})
        labels = [f"{x}（{fmap[x].get('release')}）" for x in fids]
        L.append(f"- {pid} {pg.get('title')}：{'、'.join(labels) or '（尚无功能覆盖）'}")
    nocov = [fid for fid, f in fmap.items() if not f.get("covers") and not f.get("withdrawn")]
    L += ["", "## 不覆盖页面条目的功能（地基类）", "", "- " + ("、".join(nocov) if nocov else "无"), ""]
    return "\n".join(L)


def cmd_coverage(args):
    repo = Repo()
    text = coverage_report(repo)
    if args.out:
        write_text(Path(args.out), text)
        print(f"覆盖报告已写入 {args.out}")
    else:
        print(text)
    errs = [f for f in check_coverage(repo, CheckCtx()) if f.is_error]
    return 1 if errs else 0


# ---------------------------------------------------------------- show

def cmd_show(args):
    repo = Repo()
    regs = {
        "roadmap": (lambda: repo.feature_map), "features": (lambda: repo.feature_map),
        "glossary": (lambda: {g["term"]: g for g in repo.glossary}), "domain-map": (lambda: {d["name"]: d for d in repo.domains}),
        "invariants": (lambda: repo.inv_map), "open-questions": (lambda: {q["id"]: q for q in repo.cross_oqs}),
        "params": (lambda: repo.params), "data-classes": (lambda: repo.data_classes), "metrics": (lambda: repo.metrics),
        "domain-events": (lambda: repo.domain_events), "scenarios": (lambda: repo.scenarios), "actors": (lambda: repo.actors),
        "events": (lambda: repo.analytics_events), "errors": (lambda: repo.errors), "permissions": (lambda: repo.actions),
        "tables": (lambda: repo.tables), "screens": (lambda: repo.screens), "items": (lambda: {k: v[1] for k, v in repo.items.items()}),
        "phases": (lambda: {ph["id"]: ph for ph in repo.phases}),
        "loops": (lambda: {lp["id"]: lp for _, lp in repo.loops()}),
    }
    if args.registry not in regs:
        print(f"未知登记 {args.registry}。可选：{', '.join(sorted(regs))}")
        return 2
    data = regs[args.registry]()
    if args.id:
        if args.id not in data:
            print(f"{args.registry} 中没有 {args.id}")
            return 1
        print(dump_yaml(_clean(data[args.id]), flow_max=140))
    else:
        for k, v in data.items():
            label = v.get("title") or v.get("statement") or v.get("q") or v.get("definition") or v.get("purpose") or v.get("name") or ""
            print(f"{k}\t{str(label)[:70]}")
    return 0


# ---------------------------------------------------------------- 原型解析（import-prototype）

class _JS:
    """最小 JS 字面量解析：对象、数组、字符串、数字、布尔、null。"""

    def __init__(self, s, i=0):
        self.s, self.i = s, i

    def ws(self):
        s = self.s
        while self.i < len(s):
            if s[self.i] in " \t\r\n":
                self.i += 1
            elif s.startswith("//", self.i):
                j = s.find("\n", self.i)
                self.i = len(s) if j < 0 else j
            elif s.startswith("/*", self.i):
                j = s.find("*/", self.i)
                self.i = len(s) if j < 0 else j + 2
            else:
                break

    def value(self):
        self.ws()
        c = self.s[self.i]
        if c == "{":
            return self.obj()
        if c == "[":
            return self.arr()
        if c in "'\"`":
            return self.string()
        m = re.compile(r"-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?").match(self.s, self.i)
        if m:
            self.i = m.end()
            t = m.group(0)
            return float(t) if any(ch in t for ch in ".eE") else int(t)
        for lit, val in (("true", True), ("false", False), ("null", None), ("undefined", None)):
            if self.s.startswith(lit, self.i):
                self.i += len(lit)
                return val
        raise ValueError(f"无法解析的 JS 字面量：{self.s[self.i:self.i + 40]!r}")

    def string(self):
        q = self.s[self.i]
        self.i += 1
        out = []
        while True:
            c = self.s[self.i]
            if c == "\\":
                n = self.s[self.i + 1]
                if n == "u":
                    out.append(chr(int(self.s[self.i + 2:self.i + 6], 16)))
                    self.i += 6
                    continue
                out.append({"n": "\n", "t": "\t", "r": "\r"}.get(n, n))
                self.i += 2
                continue
            if q == "`" and self.s.startswith("${", self.i):
                raise ValueError("模板字符串含表达式")
            if c == q:
                self.i += 1
                return "".join(out)
            out.append(c)
            self.i += 1

    def key(self):
        self.ws()
        if self.s[self.i] in "'\"":
            return self.string()
        m = re.compile(r"[A-Za-z_$\u4e00-\u9fff][\w$\u4e00-\u9fff]*|\d+").match(self.s, self.i)
        self.i = m.end()
        return m.group(0)

    def obj(self):
        self.i += 1
        d = {}
        while True:
            self.ws()
            if self.s[self.i] == "}":
                self.i += 1
                return d
            k = self.key()
            self.ws()
            self.i += 1  # :
            d[k] = self.value()
            self.ws()
            if self.s[self.i] == ",":
                self.i += 1
            elif self.s[self.i] == "}":
                self.i += 1
                return d

    def arr(self):
        self.i += 1
        a = []
        while True:
            self.ws()
            if self.s[self.i] == "]":
                self.i += 1
                return a
            a.append(self.value())
            self.ws()
            if self.s[self.i] == ",":
                self.i += 1
            elif self.s[self.i] == "]":
                self.i += 1
                return a


def js_const(js: str, name: str):
    m = re.search(r"(?m)^\s*const\s+" + re.escape(name) + r"\s*=\s*", js)
    if not m:
        return None
    return _JS(js, m.end()).value()


MODE_MAP = {"solo": "standalone", "flow": "guided", "imm": "immersive", "std": "standard"}
STATE_KEYS = [("e", "empty"), ("o", "offline"), ("l", "restricted"), ("d", "insufficient_data")]
SPEC_LINE_RE = re.compile(r"(?m)^const SPEC=(\{.*\});\s*$")
ID_EXPR_OLD = "${id}-${String(i+1).padStart(2,'0')}"
ID_EXPR_NEW = "${(f[3]&&f[3].id)||id+'-'+String(i+1).padStart(2,'0')}"


def parse_prototype(path: Path) -> dict:
    html = read_text(path)
    m = re.search(r"<script>(.*?)</script>", html, re.S)
    if not m:
        raise ValueError("原型中找不到 <script>")
    js = m.group(1)
    sm = SPEC_LINE_RE.search(html)
    if not sm:
        raise ValueError("原型中找不到 const SPEC= 一行")
    spec = json.loads(sm.group(1))
    modes = {}
    mm = re.search(r"(?m)^const MODE=\{(.*)\};\s*$", js)
    if mm:
        for pid, body in re.findall(r"([SOP]\d{2}):(\(\)=>'\w+'|v=>v[!=]==?'\w+'\?'\w+':'\w+')", mm.group(1)):
            c = re.match(r"\(\)=>'(\w+)'", body)
            if c:
                modes[pid] = {"*": c.group(1)}
            else:
                cm = re.match(r"v=>v(!==|===)'(\w+)'\?'(\w+)':'(\w+)'", body)
                op, val, a, b = cm.groups()
                modes[pid] = {"eq": val, "op": op, "a": a, "b": b}
    locked = []
    lm = re.search(r"\[([^\]]*)\]\.includes\(id\)\?'<dt>锁定</dt><dd>([^<]*)</dd>'", js)
    if lm:
        locked = re.findall(r"'([SOP]\d{2})'", lm.group(1))
    renders = {}
    for rm in re.finditer(r"(?m)^PAGES\.([SOP]\d{2})=", js):
        start = rm.start()
        nxt = re.compile(r"(?m)^(?:PAGES\.|/\*|function |const |let |window\.|document\.)").search(js, rm.end())
        renders[rm.group(1)] = js[start:nxt.start() if nxt else len(js)].rstrip()
    return {"path": path, "html": html, "js": js, "spec": spec, "names": js_const(js, "NM") or {},
            "views": js_const(js, "VIEWS") or {}, "stx": js_const(js, "STX") or {}, "extp": js_const(js, "EXTP") or [],
            "modes": modes, "locked": locked, "locked_text": lm.group(2) if lm else "", "renders": renders}


def _view_mode(modes: dict, pid: str, view: str):
    m = modes.get(pid)
    if not m:
        return "std"
    if "*" in m:
        return m["*"]
    hit = (view == m["eq"]) if m["op"] == "===" else (view != m["eq"])
    return m["a"] if hit else m["b"]


def _parse_rw(text: str) -> dict:
    out = {}
    for part in re.split(r"[；;]", (text or "").strip().rstrip("。")):
        part = part.strip()
        m = re.match(r"^(读写|读|写)[:：](.*)$", part)
        if not m:
            if part:
                out.setdefault("notes", []).append(part)
            continue
        key = {"读": "reads", "写": "writes", "读写": "read_writes"}[m.group(1)]
        out.setdefault(key, []).extend(x.strip() for x in re.split(r"[、，,]", m.group(2)) if x.strip())
    return out


def stable_ids(pdata: dict) -> tuple[dict, dict]:
    """返回 ({页: [(id, 条目)]}, {页: {位置编号: 稳定编号}})。"""
    out, posmap = {}, {}
    for pid, page in pdata["spec"].items():
        removed = {r["id"]: r for r in page.get("removed", []) or []}
        seq, n, pm, live_pos = [], 0, {}, 0
        used = set(removed)
        explicit = [f for f in page["f"] if len(f) > 3 and isinstance(f[3], dict) and f[3].get("id")]
        if explicit and len(explicit) != len(page["f"]):
            mx = max([int(str(f[3]["id"])[-2:]) for f in explicit] + [int(i[-2:]) for i in removed] + [0])
        else:
            mx = 0
        for f in page["f"]:
            live_pos += 1
            meta = f[3] if len(f) > 3 and isinstance(f[3], dict) else {}
            if meta.get("id"):
                sid = meta["id"]
            elif explicit:
                mx += 1
                sid = f"{pid}-{mx:02d}"
            else:
                n += 1
                while f"{pid}-{n:02d}" in used:
                    n += 1
                sid = f"{pid}-{n:02d}"
            used.add(sid)
            pm[f"{pid}-{live_pos:02d}"] = sid
            seq.append((sid, {"name": f[0], "text": f[1], "page_priority": f"P{f[2]}", **{k: v for k, v in meta.items() if k != "id"}}))
        for rid, r in removed.items():
            seq.append((rid, {"name": r.get("name", ""), "text": r.get("text", ""), "page_priority": r.get("page_priority", "P2"), "removed": True}))
        seq.sort(key=lambda x: int(x[0][-2:]))
        out[pid] = seq
        posmap[pid] = {k: v for k, v in pm.items() if k != v}
    return out, posmap


def translate_refs(text: str, posmap: dict) -> str:
    def rep(m):
        ref = m.group(0)
        return posmap.get(ref[:3], {}).get(ref, ref)
    return re.sub(r"\b[SOP]\d{2}-\d{2}\b", rep, text)


def write_ids_back(pdata: dict, ids: dict, posmap: dict) -> tuple[str, int, int]:
    spec = pdata["spec"]
    first = not any(len(f) > 3 and isinstance(f[3], dict) and f[3].get("id") for pg in spec.values() for f in pg["f"])
    nref = 0
    for pid, page in spec.items():
        if first and any(posmap.values()):
            for k in ("why", "ai", "rw", "layn"):
                if isinstance(page.get(k), str):
                    new = translate_refs(page[k], posmap)
                    nref += new != page[k]
                    page[k] = new
            page["lay"] = [translate_refs(x, posmap) for x in page.get("lay", [])]
            for f in page["f"]:
                for j in (0, 1):
                    new = translate_refs(f[j], posmap)
                    nref += new != f[j]
                    f[j] = new
        live = [sid for sid, it in ids[pid] if not it.get("removed")]
        for f, sid in zip(page["f"], live):
            meta = f[3] if len(f) > 3 and isinstance(f[3], dict) else {}
            meta = {"id": sid, **{k: v for k, v in meta.items() if k != "id"}}
            if len(f) > 3:
                f[3] = meta
            else:
                f.append(meta)
    html = pdata["html"]
    sm = SPEC_LINE_RE.search(html)
    html = html[:sm.start()] + "const SPEC=" + json.dumps(spec, ensure_ascii=False, separators=(", ", ": ")) + ";" + html[sm.end():]
    patched = 0
    if ID_EXPR_OLD in html:
        html = html.replace(ID_EXPR_OLD, ID_EXPR_NEW)
        patched = 1
    return html, nref, patched


def build_registry(pdata: dict, pid: str, seq: list, old: dict | None) -> dict:
    page = pdata["spec"][pid]
    end = END_OF_PREFIX[pid[0]]
    views = pdata["views"].get(pid) or []
    default_mode = _view_mode(pdata["modes"], pid, views[0][0] if views else "")
    reg = {"id": pid, "end": end, "title": pdata["names"].get(pid, pid), "mode": MODE_MAP.get(default_mode, "standard"),
           "purpose": page.get("why", "")}
    refine = page.get("refine") or (old or {}).get("refine")
    if refine:
        reg["refine"] = refine
    if pid in pdata["extp"]:
        reg["extension_pack"] = True
    if views:
        vs = []
        for vid, label in views:
            v = {"id": vid, "when": label}
            vm = MODE_MAP.get(_view_mode(pdata["modes"], pid, vid), "standard")
            if vm != reg["mode"]:
                v["mode"] = vm
            vs.append(v)
        reg["views"] = vs
    stx = pdata["stx"].get(pid)
    states, overrides = ["loading"], {}
    if stx:
        e = stx.get("e") or ["", "", "", ""]
        states.append("empty")
        ov = f"{e[0]}：{e[1]}" if e[1] else e[0]
        if len(e) > 2 and e[2]:
            ov += f"；主按钮“{e[2]}”" + (f"（去 {e[3]}）" if len(e) > 3 and e[3] else "")
        overrides["empty"] = ov
        states.append("error")
        for k, st in STATE_KEYS[1:]:
            t = stx.get(k, "")
            if t and t != "不适用":
                states.append(st)
                overrides[st] = t
    else:
        states += ["empty", "error", "offline", "restricted", "insufficient_data"]
    if pid in pdata["locked"]:
        states.append("locked")
        overrides["locked"] = pdata["locked_text"]
    reg["states"] = states
    if overrides:
        reg["state_overrides"] = overrides
    lay = list(page.get("lay") or [])
    if page.get("layn"):
        lay = [f"版式：{page['layn'].strip('（）()')}"] + lay
    if lay:
        reg["layout_notes"] = lay
    data = _parse_rw(page.get("rw", ""))
    if data:
        reg["data"] = data
    if page.get("ai"):
        ai = {"role": page["ai"]}
        for o in (old or {}).get("ai") or []:
            if o.get("scenario"):
                ai = {"scenario": o["scenario"], **ai}
                break
        reg["ai"] = [ai]
    reg["entries"] = page.get("ent") or []
    reg["exits"] = page.get("ext") or []
    if page.get("upx"):
        reg["unresolved_links"] = page["upx"]
    old_items = {str(i.get("id")): i for i in (old or {}).get("items") or [] if isinstance(i, dict)}
    items = []
    for sid, it in seq:
        d = {"id": sid, "name": it["name"], "text": it["text"], "page_priority": it["page_priority"]}
        if it.get("removed"):
            d["removed"] = True
        prev = old_items.get(sid, {})
        for k in ("ui_only", "out_of_scope"):
            if prev.get(k) and not d.get("removed"):
                d[k] = prev[k]
        items.append(d)
    for sid, prev in old_items.items():
        if sid not in {x["id"] for x in items}:
            items.append({**prev, "removed": True})
    items.sort(key=lambda x: int(x["id"][-2:]))
    reg["items"] = items
    reg["slice"] = f"design/screens/slices/{pid}.html"
    reg["shots"] = f"design/screens/shots/{pid}/"
    return reg


REGISTRY_HEADER = ("# 页面登记：范围的唯一来源（ADR-001，原型冻结后以本文件为准）。条目编号只增不减；"
                   "删除的条目标 removed: true；新条目只在末尾追加，编号用 import-prototype --write-ids 分配。\n")


def write_registry(reg: dict) -> str:
    path = ROOT / "design" / "screens" / reg["end"] / f"{reg['id']}.yaml"
    text = REGISTRY_HEADER + dump_yaml(reg, flow_max=120)
    old = read_text(path) if path.exists() else None
    if old != text:
        write_text(path, text)
    return "unchanged" if old == text else ("new" if old is None else "changed")


def build_slice(pdata: dict, pid: str, seq: list) -> str:
    import html as _html
    page = pdata["spec"][pid]
    title = pdata["names"].get(pid, pid)
    items = "\n".join(f'<li data-id="{sid}" data-p="{it["page_priority"]}"><b>{_html.escape(it["name"])}</b>：{_html.escape(it["text"])}</li>'
                      for sid, it in seq if not it.get("removed"))
    src = pdata["renders"].get(pid)
    render = (f'<pre class="render"><code>{_html.escape(src)}</code></pre>' if src else
              '<p class="wire">原型中此页为线框：按布局要点与本页条目实现。</p>')
    lay = "".join(f"<li>{_html.escape(x)}</li>" for x in page.get("lay") or [])
    h = short_hash((src or "") + items)
    return (f"<!-- GENERATED by spec_tool import-prototype，来源：原型 PAGES.{pid} 渲染函数与本页条目；只作布局参考，公共样式与辅助函数不随切片下发。source-sha: {h} -->\n"
            f'<!doctype html>\n<meta charset="utf-8">\n<title>{pid} {_html.escape(title)}（原型切片）</title>\n'
            f'<section data-page="{pid}">\n<h1>{pid} {_html.escape(title)}</h1>\n<p class="purpose">{_html.escape(page.get("why", ""))}</p>\n'
            f'<ul class="layout">{lay}</ul>\n<ol class="items">\n{items}\n</ol>\n{render}\n</section>\n')


def oq_candidates(pdata: dict, ids: dict) -> list[str]:
    out = []
    for pid, seq in ids.items():
        for sid, it in seq:
            if "待定" in it.get("text", "") or "待定" in it.get("name", ""):
                out.append(f"{sid} {it['name']}：{it['text']}")
    return out


def _archive_path(p: str) -> Path:
    q = Path(p)
    return q if q.is_absolute() else (ROOT / q).resolve()


def cmd_import_prototype(args):
    mode = CFG["paths"].get("prototype_mode", "frozen")
    reg_dir = ROOT / "design" / "screens"
    existing = list(reg_dir.glob("*/*.yaml"))
    src = args.src or (CFG["paths"].get("prototype_source") if mode == "editing" else "")
    if not src:
        if not args.write_ids:
            print("原型已冻结（见 ADR-001）：页面登记是唯一来源。为新条目分配编号请运行 import-prototype --write-ids。")
            return 2
        return _allocate_registry_ids()
    path = _archive_path(src)
    if not path.exists():
        print(f"找不到原型：{path}")
        return 2
    if mode == "frozen" and existing and not args.force_baseline:
        print("原型已冻结（见 ADR-001）：页面登记已存在，拒绝从原型重新导入。"
              "新条目直接追加到页面登记，再运行 import-prototype --write-ids（不带 --from）分配编号。")
        return 2
    pdata = parse_prototype(path)
    ids, posmap = stable_ids(pdata)
    if args.write_ids:
        html, nref, patched = write_ids_back(pdata, ids, posmap)
        write_text(path, html)
        print(f"已把稳定编号写回原型 {path}：翻译正文中的条目引用 {nref} 处；{'已' if patched else '未'}改写功能说明面板的编号显示。")
        pdata = parse_prototype(path)
        ids, _ = stable_ids(pdata)
    stats = {"new": 0, "changed": 0, "unchanged": 0}
    for pid in pdata["spec"]:
        end = END_OF_PREFIX[pid[0]]
        old_path = reg_dir / end / f"{pid}.yaml"
        old = load_yaml(old_path, {}) if old_path.exists() else None
        reg = build_registry(pdata, pid, ids[pid], old)
        stats[write_registry(reg)] += 1
        sl = reg_dir / "slices" / f"{pid}.html"
        content = build_slice(pdata, pid, ids[pid])
        if not sl.exists() or read_text(sl) != content:
            write_text(sl, content)
    print(f"页面登记：新建 {stats['new']}，更新 {stats['changed']}，未变 {stats['unchanged']}；切片已同步。请审查 git diff 后提交。")
    mh = _archive_path(CFG["paths"].get("merge_history", ""))
    markers = []
    pats = [re.compile(p) for p in CFG["paths"].get("merge_markers", []) or []]
    for pid, seq in ids.items():
        for sid, it in seq:
            for p in pats:
                for m in p.finditer(it.get("text", "")):
                    markers.append({"item": sid, "marker": m.group(0)})
    if str(mh) and mh.parent.exists():
        write_text(mh, "# 合并来历：import-prototype 从原型条目中剥离的合并来源标记（只存于归档，开发仓库不引用）。\n"
                   + dump_yaml({"source": path.name, "exported": today(), "markers": markers}))
        print(f"合并来历已导出到 {mh}（{len(markers)} 条标记）。")
    cands = oq_candidates(pdata, ids)
    if cands:
        print("待定问题候选（转为规格 open_questions 或 docs/product/open-questions.yaml）：")
        for c in cands:
            print("  - " + c)
    return 0


def _allocate_registry_ids():
    n = 0
    for p in sorted((ROOT / "design" / "screens").glob("*/*.yaml")):
        reg = load_yaml(p, {})
        pid = str(reg.get("id"))
        items = reg.get("items") or []
        nums = [int(str(i["id"])[-2:]) for i in items if isinstance(i, dict) and ITEM_ID_RE.match(str(i.get("id", "")))]
        mx = max(nums or [0])
        changed = False
        for it in items:
            if isinstance(it, dict) and not it.get("id"):
                mx += 1
                new = {"id": f"{pid}-{mx:02d}"}
                new.update({k: v for k, v in it.items() if k != "id"})
                it.clear()
                it.update(new)
                it.setdefault("page_priority", "P1")
                changed = True
                n += 1
                print(f"分配 {pid}-{mx:02d}：{it.get('name', '')}")
        if changed:
            write_text(p, REGISTRY_HEADER + dump_yaml(reg, flow_max=120))
    print(f"共分配 {n} 个新条目编号。" if n else "没有待分配编号的条目。")
    return 0


# ---------------------------------------------------------------- 截图（shots）

def _quantize_png(path: Path) -> None:
    """[shots].quantize 为真且装有 Pillow 时，把截图压成 256 色调色板 PNG（界面截图足够清晰，体积约为原来的三分之一）。"""
    if not CFG["shots"].get("quantize", True):
        return
    try:
        from PIL import Image
    except ImportError:
        return
    img = Image.open(path).convert("RGB")
    img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path, optimize=True)


def cmd_shots(args):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("需要 Playwright：pip install playwright && python -m playwright install chromium")
        return 2
    src = args.src or CFG["paths"].get("prototype_source", "")
    path = _archive_path(src) if src else None
    if not path or not path.exists():
        print(f"找不到原型：{path}（见 scripts/spec_tool.toml [paths].prototype_source）")
        return 2
    pdata = parse_prototype(path)
    pages = [args.page] if args.page else list(pdata["spec"])
    hide = ".pbar,.pnote,.spec,#fab,.tutor,.scrim{display:none!important}"
    n = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for pid in pages:
            end = END_OF_PREFIX[pid[0]]
            widths = CFG["shots"].get(end, [1280])
            views = [v[0] for v in pdata["views"].get(pid) or []] or ["default"]
            outdir = ROOT / "design" / "screens" / "shots" / pid
            outdir.mkdir(parents=True, exist_ok=True)
            for w in widths:
                hgt = 812 if w < 600 else int(CFG["shots"].get("height", 900))
                page = browser.new_page(viewport={"width": int(w), "height": hgt}, device_scale_factor=1)
                page.goto(path.as_uri() + "#" + pid)
                page.add_style_tag(content=hide)
                for v in views:
                    if v != "default":
                        page.evaluate(f"() => {{ ST.v['{pid}'] = '{v}'; render(); }}")
                    page.wait_for_timeout(250)
                    out_png = outdir / f"{v}@{w}.png"
                    page.screenshot(path=str(out_png))
                    _quantize_png(out_png)
                    n += 1
                page.close()
        browser.close()
    print(f"截图完成：{n} 张，存于 design/screens/shots/。")
    return 0


# ---------------------------------------------------------------- new（只在主干分配编号）

def _require_main() -> bool:
    if not in_git():
        print("提示：不在 git 仓库中，无法确认是否在主干；继续分配。")
        return True
    br = current_branch()
    if br != main_branch():
        print(f"E-ID-01：编号只在主干分配，当前分支是 {br}。改法：切到 {main_branch()} 运行本命令并立即提交，再合入你的分支。")
        return False
    return True


def _header_lines(path: Path) -> str:
    if not path.exists():
        return ""
    head = []
    for line in read_text(path).splitlines():
        if line.startswith("#"):
            head.append(line)
        else:
            break
    return "\n".join(head) + ("\n" if head else "")


def _rewrite_yaml(path: Path, data) -> None:
    write_text(path, _header_lines(path) + dump_yaml(data, flow_max=120))


def cmd_new(args):
    if not _require_main():
        return 2
    repo = Repo()
    kind = args.kind
    if kind == "feature":
        if len(args.rest) < 2:
            print('用法：new feature <领域名或领域代码> "<标题>" [--release R1|R2|R3|later] [--loop 1.3] [--depends A,B]')
            return 2
        dom_arg, title = args.rest[0], " ".join(args.rest[1:])
        dom = next((d for d in repo.domains if d["name"] == dom_arg or d.get("code") == dom_arg.upper()), None)
        if not dom:
            print(f"领域 {dom_arg} 不在 domain-map.yaml 中")
            return 2
        code = dom["code"]
        nums = [int(FEATURE_ID_RE.match(f["id"]).group(2)) for f in repo.features if str(f["id"]).startswith(code + "-") and FEATURE_ID_RE.match(f["id"])]
        nxt = max(nums or [0]) + 1
        fid = f"{code}-{nxt:02d}"
        entry = {"id": fid, "title": title, "domain": dom["name"], "release": args.release or "later",
                 "depends": [d for d in (args.depends or "").split(",") if d], "covers": []}
        path = repo.root / "docs/product/roadmap.yaml"
        data = load_yaml(path, []) or []
        data.append(entry)
        _rewrite_yaml(path, data)
        if args.loop:
            pp = repo.root / "docs/product/phases.yaml"
            pdat = load_yaml(pp, {})
            hit = False
            for ph in pdat.get("phases", []):
                for lp in ph.get("loops", []) or []:
                    if str(lp.get("id")) == args.loop:
                        lp.setdefault("features", []).append(fid)
                        hit = True
            if not hit:
                print(f"提示：phases.yaml 中没有闭环 {args.loop}，未登记闭环归属。")
            else:
                _rewrite_yaml(pp, pdat)
        print(f"已分配 {fid}「{title}」。下一步：确定 covers 与 release，立即在主干提交。")
        return 0
    if kind == "adr":
        if len(args.rest) < 2:
            print('用法：new adr <slug> "<标题>"')
            return 2
        slug, title = args.rest[0], " ".join(args.rest[1:])
        nums = [int(k[4:]) for k in repo.adrs]
        nid = f"ADR-{max(nums or [0]) + 1:03d}"
        p = repo.root / "docs" / "adr" / f"{nid}-{slug}.md"
        write_text(p, f"# {nid} {title}\n\n## 背景\n\n（要解决什么问题，有哪些约束。）\n\n## 决定\n\n（一到三句。）\n\n## 后果\n\n（好处、代价、什么情况下重新考虑。）\n")
        print(f"已创建 {rel(p)}。写完后立即在主干提交。")
        return 0
    if kind == "oq":
        if not args.rest or not args.default:
            print('用法：new oq "<问题>" --default "<临时默认>" [--features A,B] [--owner 负责人]')
            return 2
        path = repo.root / "docs/product/open-questions.yaml"
        data = load_yaml(path, []) or []
        nums = [int(str(q["id"])[3:]) for q in data if re.match(r"^OQ-\d{3}$", str(q.get("id")))]
        qid = f"OQ-{max(nums or [0]) + 1:03d}"
        data.append({"id": qid, "q": " ".join(args.rest), "features": [f for f in (args.features or "").split(",") if f],
                     "owner": args.owner or "产品负责人", "default": args.default, "status": "open"})
        _rewrite_yaml(path, data)
        print(f"已登记 {qid}。")
        return 0
    if kind == "inv":
        if not args.rest or not args.source or not args.enforcement:
            print('用法：new inv "<陈述>" --source "<来源>" --enforcement test,check [--scope learner,plan]')
            return 2
        path = repo.root / "docs/product/invariants.yaml"
        data = load_yaml(path, []) or []
        nums = [int(str(i["id"])[4:]) for i in data if re.match(r"^INV-\d{2,3}$", str(i.get("id")))]
        iid = f"INV-{max(nums or [0]) + 1:02d}"
        data.append({"id": iid, "statement": " ".join(args.rest), "scope": [s for s in (args.scope or "").split(",") if s],
                     "source": args.source, "enforcement": [e for e in args.enforcement.split(",") if e]})
        _rewrite_yaml(path, data)
        print(f"已登记 {iid}。")
        return 0
    if kind == "scenario":
        if not args.rest or not args.actor:
            print("用法：new scenario <领域>.<名称> --actor <执行者>")
            return 2
        sid = args.rest[0]
        dom = sid.split(".", 1)[0]
        if dom not in repo.domain_names or "." not in sid:
            print("场景 ID 应为 <领域名>.<名称>，领域名见 domain-map.yaml")
            return 2
        if args.actor not in repo.actors:
            print(f"执行者 {args.actor} 不存在，先在 contracts/ai/actors.yaml 登记")
            return 2
        path = repo.root / "contracts/ai/scenarios.yaml"
        data = load_yaml(path, []) or []
        if any(s.get("id") == sid for s in data):
            print(f"场景 {sid} 已存在")
            return 2
        data.append({"id": sid, "owner": dom, "actor": args.actor, "purpose": "（用途）", "screens": [],
                     "input_schema": f"packages/ai/{sid}/input.schema.json", "output_schema": f"packages/ai/{sid}/output.schema.json",
                     "numbers_from": [], "model_tier": "small", "metering": {"ai_points": 0},
                     "fallback": {"mode": "template", "copy_key": f"{sid}.fallback"}, "confirmation": "none",
                     "labeling": {"explicit": True, "implicit": True, "on_export": True}, "reads": [], "invariants": ["INV-05"],
                     "eval": f"evals/{sid}/"})
        _rewrite_yaml(path, data)
        for d in (f"packages/ai/{sid}", f"evals/{sid}/cases", f"evals/{sid}/graders"):
            (repo.root / d).mkdir(parents=True, exist_ok=True)
        for f, c in ((f"evals/{sid}/thresholds.yaml", "# 各指标阈值；回归集每次改动都跑\nmetrics: {}\n"), (f"evals/{sid}/baseline.json", "{\"metrics\": {}}\n"),
                     (f"evals/{sid}/cases/.gitkeep", ""), (f"evals/{sid}/graders/.gitkeep", ""),
                     (f"packages/ai/{sid}/input.schema.json", "{\"type\": \"object\"}\n"), (f"packages/ai/{sid}/output.schema.json", "{\"type\": \"object\"}\n")):
            if not (repo.root / f).exists():
                write_text(repo.root / f, c)
        print(f"已登记场景 {sid}，并建好 packages/ai/{sid}/ 与 evals/{sid}/。这是重型通道变更：先补齐字段与评测，再走规格先行 PR。")
        return 0
    print(f"未知类型 {kind}")
    return 2


# ---------------------------------------------------------------- work

WORK_TEMPLATE = """---
id: {id}
branch: {branch}
lane: {lane}
started: {date}
---
# {id} 进行中

## 计划（确认后才动代码）
- 改动文件：
- 契约变更：
- AC → 测试：
- 风险与不确定：
- 确认：（谁、何时）

## 决定
（会话中做的取舍，一行一条，行尾写去向：→ 规格 R<n> / → ADR-<nnn> / → 不保留。）

## 进度
- [ ] 

## 交接记录
| 时间 | 工具 | 做了什么 | 下一步 |
|---|---|---|---|

## 包外读取
（读了任务包以外的文件时记一行：文件与原因。）

## 复核
（冷启动复核与异构复查的结论。）

## 未决
"""


def cmd_work(args):
    repo = Repo()
    fid = args.id
    p = repo.root / "work" / f"{fid}.md"
    if args.action == "start":
        if fid not in repo.feature_map:
            print(f"{fid} 不在 roadmap.yaml 中")
            return 2
        if p.exists():
            print(f"{rel(p)} 已存在：完整阅读它，从“下一步”继续。")
            return 0
        br = current_branch() or "（未在 git 中）"
        if branch_feature_id(br) != fid:
            print(f"提示：当前分支 {br} 不是 feat/{fid}-<短名> 或 spec/{fid}；建议在独立 worktree 的功能分支上工作。")
        write_text(p, WORK_TEMPLATE.format(id=fid, branch=br, lane=args.lane, date=today()))
        print(f"已创建 {rel(p)}。")
        return 0
    if not p.exists():
        print(f"{rel(p)} 不存在")
        return 2
    text = read_text(p)
    fm, body, _ = split_front_matter(text)
    secs = {h.split("（")[0]: v for h, v in md_sections(body, 2)}
    problems = []
    for line in secs.get("决定", "").splitlines():
        s = line.strip()
        if s.startswith(("-", "*")) and len(s) > 2 and "→" not in s:
            problems.append(f"决定未写去向：{s}")
    for line in secs.get("未决", "").splitlines():
        s = line.strip()
        if s.startswith(("-", "*")) and len(s) > 2 and "→" not in s:
            problems.append(f"未决事项未转为待定问题：{s}")
    if problems:
        print("work close 未通过：值得长期保留的决定要先提升到规格或 ADR，未决事项要转为待定问题，并在行尾写“→ 去向”。")
        for x in problems:
            print("  - " + x)
        return 1
    p.unlink()
    print(f"已删除 {rel(p)}。提交本次改动；主干上的 work/ 应保持为空。")
    return 0


# ---------------------------------------------------------------- check / verify

def print_findings(fs: list[Finding]) -> tuple[int, int]:
    fs = sorted(fs, key=lambda f: (not f.is_error, f.code, f.file, str(f.loc)))
    for f in fs:
        print(f)
    e = sum(1 for f in fs if f.is_error)
    return e, len(fs) - e


def cmd_check(args):
    repo = Repo()
    if args.changed and not changed_files(staged=args.staged):
        print("检查完成：工作区没有改动。")
        return 0
    fs = run_checks(repo, changed_only=args.changed, full=args.full, staged=args.staged)
    e, w = print_findings(fs)
    print(f"检查完成：{e} 个错误，{w} 个告警。")
    return 1 if e else 0


def _run(label: str, cmd: str) -> bool:
    print(f"▶ {label}：{cmd}")
    r = subprocess.run(cmd, shell=True, cwd=ROOT)
    print(f"  {'通过' if r.returncode == 0 else '失败'}（退出码 {r.returncode}）")
    return r.returncode == 0


def cmd_verify(args):
    v = CFG["verify"]
    stack = (ROOT / v.get("stack_marker", "package.json")).exists()
    ok = True
    files = changed_files(staged=args.staged)
    python_cmd = f'"{sys.executable}"'
    me = f"{python_cmd} {TOOL_REL}"
    if v.get("tooling_test"):
        ok = _run("工具回归测试", v["tooling_test"].replace("{python}", python_cmd)) and ok
    def stack_step(label, key, extra=""):
        nonlocal ok
        cmd = v.get(key, "")
        if not cmd:
            print(f"▷ {label}：未配置（scripts/spec_tool.toml [verify].{key}），跳过")
            return
        if not stack:
            print(f"▷ {label}：技术栈尚未接入（缺 {v.get('stack_marker')}），跳过")
            return
        ok = _run(label, cmd + extra) and ok
    if args.fast:
        code_files = [f for f in files if Path(f).suffix in CODE_EXT]
        if code_files and v.get("lint_files") and stack:
            ok = _run("改动文件 lint", v["lint_files"].replace("{files}", " ".join(code_files))) and ok
        elif code_files:
            print("▷ 改动文件 lint：未配置 [verify].lint_files 或技术栈尚未接入，跳过")
        stack_step("类型检查", "typecheck")
        stack_step("单元测试", "test")
        ok = _run("文档检查（改动）", f"{me} check --changed" + (" --staged" if args.staged else "")) and ok
        ok = _run("生成物校验", f"{me} gen --check") and ok
    else:
        stack_step("lint", "lint")
        stack_step("类型检查", "typecheck")
        stack_step("单元测试", "test")
        ok = _run("文档检查", f"{me} check" + (" --full" if args.full else "")) and ok
        ok = _run("生成物校验", f"{me} gen --check") and ok
        if any(f.startswith(("packages/ai/", "evals/")) for f in files) and not args.full:
            ok = _run("相关场景回归评测", f"{me} eval --affected --suite regression") and ok
        if args.full:
            stack_step("端到端冒烟（四个演示考试）", "e2e_smoke")
            ok = _run("预算", f"{me} budget") and ok
            ok = _run("覆盖报告", f"{me} coverage --out .pack/coverage.md") and ok
    print("verify：全部通过。" if ok else "verify：有失败项，修复后重跑。")
    return 0 if ok else 1


# ---------------------------------------------------------------- eval

def _affected_scenarios(repo) -> list[str]:
    files = set(changed_files())
    if in_git() and ref_exists(main_branch()):
        code, out = git("diff", "--name-only", f"{main_branch()}...HEAD")
        files |= set(out.split())
    out = []
    for sid in repo.scenarios:
        if any(f.startswith((f"packages/ai/{sid}/", f"evals/{sid}/")) for f in files):
            out.append(sid)
    return out


def cmd_eval(args):
    repo = Repo()
    sids = _affected_scenarios(repo) if args.affected else [args.scenario] if args.scenario else []
    if not sids:
        print("没有需要评测的场景。")
        return 0
    runner = CFG["eval"].get("runner", "")
    recdir = repo.root / CFG["eval"].get("records", ".eval")
    ok_all = True
    for sid in sids:
        if sid not in repo.scenarios:
            print(f"E-REF-01 contracts/ai/scenarios.yaml：场景 {sid} 不存在")
            ok_all = False
            continue
        if not runner:
            print(f"评测执行器未配置：在 scripts/spec_tool.toml [eval].runner 填写命令（可用 {{scenario}} {{suite}} {{out}} 占位）。")
            return 2
        out = recdir / f"{sid}.{args.suite}.report.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        if not _run(f"评测 {sid}（{args.suite}）", runner.format(scenario=sid, suite=args.suite, out=out)):
            ok_all = False
            continue
        report = json.loads(read_text(out)) if out.exists() else {}
        metrics = report.get("metrics", {})
        th = load_yaml(repo.root / "evals" / sid / "thresholds.yaml", {}) or {}
        base = json.loads(read_text(repo.root / "evals" / sid / "baseline.json")).get("metrics", {}) if (repo.root / "evals" / sid / "baseline.json").exists() else {}
        passed, notes = True, []
        for name, rule in (th.get("metrics") or {}).items():
            val = metrics.get(name)
            if val is None:
                passed = False
                notes.append(f"{name} 缺少结果")
                continue
            if "min" in rule and val < rule["min"]:
                passed = False
                notes.append(f"{name}={val} 低于阈值 {rule['min']}")
            if "max" in rule and val > rule["max"]:
                passed = False
                notes.append(f"{name}={val} 高于阈值 {rule['max']}")
            if name in base:
                worse = val < base[name] if "min" in rule or "max" not in rule else val > base[name]
                if worse:
                    passed = False
                    notes.append(f"{name}={val} 低于基线 {base[name]}")
        code_dir = repo.root / "packages" / "ai" / sid
        rec = {"scenario": sid, "suite": args.suite, "passed": passed, "metrics": metrics, "notes": notes,
               "code_hash": _content_hash(code_dir) if code_dir.exists() else "", "at": _dt.datetime.now().isoformat(timespec="seconds")}
        write_text(recdir / f"{sid}.json", json.dumps(rec, ensure_ascii=False, indent=1))
        print(f"{sid}：{'达标' if passed else '未达标'}" + ("；" + "；".join(notes) if notes else ""))
        if passed and args.update_baseline:
            write_text(repo.root / "evals" / sid / "baseline.json", json.dumps({"metrics": metrics}, ensure_ascii=False, indent=1) + "\n")
            print(f"已更新 evals/{sid}/baseline.json：基线变化须人确认后提交。")
        ok_all = ok_all and passed
    return 0 if ok_all else 1


# ---------------------------------------------------------------- trace-report

def cmd_trace_report(args):
    d = ROOT / ".trace"
    files = sorted(d.glob("*.jsonl")) if d.exists() else []
    if not files:
        print("没有读取轨迹（.trace/ 为空）。hooks 生效后才会采集。")
        return 0
    sessions: dict[str, list] = {}
    for p in files:
        for line in read_text(p).splitlines():
            try:
                e = json.loads(line)
            except Exception:
                continue
            sessions.setdefault(e.get("session") or p.stem, []).append(e)
    if args.session:
        sessions = {k: v for k, v in sessions.items() if k == args.session}
    doc_prefix = ("docs/", "contracts/", "design/", "AGENTS.md", "apps/learner/AGENTS.md", "apps/org/AGENTS.md", "apps/admin/AGENTS.md")
    print("| 会话 | 工具 | 功能 | 读取 | 包外读取（文档与登记） | 代码读取 |\n|---|---|---|---|---|---|")
    outside_all: dict[str, int] = {}
    for sid, evs in sessions.items():
        br = next((e.get("branch") for e in evs if e.get("branch")), "")
        fid = branch_feature_id(br) or "—"
        mf = ROOT / ".pack" / f"{fid}.json"
        srcs = set(json.loads(read_text(mf)).get("sources", [])) if mf.exists() else set()
        reads = [f for e in evs for f in e.get("files", [])]
        outside = sorted({f for f in reads if f.startswith(doc_prefix) and f not in srcs})
        code = sorted({f for f in reads if not f.startswith(doc_prefix)})
        for f in outside:
            outside_all[f] = outside_all.get(f, 0) + 1
        tool = next((e.get("tool") for e in evs if e.get("tool")), "")
        print(f"| {sid[:12]} | {tool} | {fid} | {len(reads)} | {len(outside)} | {len(code)} |")
    if outside_all:
        print("\n包外读取最多的文件（refs 可能有缺口，或功能太宽）：")
        for f, n in sorted(outside_all.items(), key=lambda x: -x[1])[:15]:
            print(f"- {f}：{n} 个会话")
    return 0


# ---------------------------------------------------------------- doctor

def _ver(s: str):
    m = re.search(r"(\d+)\.(\d+)\.(\d+)", s or "")
    return tuple(int(x) for x in m.groups()) if m else None


def cmd_doctor(args):
    rows, bad = [], False
    def ok(msg): rows.append("✓ " + msg)
    def warn(msg): rows.append("！ " + msg)
    def fail(msg):
        nonlocal bad
        bad = True
        rows.append("✗ " + msg)
    minv = _ver(CFG["tools"].get("claude_min_version", "2.1.283"))
    try:
        r = subprocess.run(["claude", "--version"], capture_output=True, text=True, timeout=20)
        v = _ver(r.stdout)
        if v and minv and v < minv:
            fail(f"Claude Code {'.'.join(map(str, v))} 低于下限 {'.'.join(map(str, minv))}：升级后重启一次再用")
        elif v:
            ok(f"Claude Code {'.'.join(map(str, v))}")
        else:
            warn("无法识别 Claude Code 版本")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        warn("未找到 claude 命令（只用 Codex 时可忽略）")
    try:
        r = subprocess.run(["codex", "--version"], capture_output=True, text=True, timeout=20)
        ok(f"Codex {r.stdout.strip() or '已安装'}；首次使用与每次修改 hooks 后，在 Codex 中审阅并信任项目 hooks")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        warn("未找到 codex 命令（只用 Claude Code 时可忽略）")
    cfg = Path.home() / ".codex" / "config.toml"
    if cfg.exists():
        t = read_text(cfg)
        if re.search(r"(?m)^\s*memories\s*=\s*true", t) or re.search(r"(?m)^\s*(use_memories|generate_memories)\s*=\s*true", t):
            fail("Codex 开启了 memories：在 ~/.codex/config.toml 关闭 [features] memories，或至少对本项目关闭 use_memories 与 generate_memories")
        else:
            ok("Codex memories 未开启")
    found = [rel(p) for p in walk_files(ROOT) if p.name in FORBIDDEN_INSTR]
    if found:
        fail("工作区存在禁止的指令文件：" + "、".join(found) + "（删除；个人偏好放 ~/.claude/CLAUDE.md 或 ~/.codex/AGENTS.md）")
    else:
        ok("工作区没有 CLAUDE.md、CLAUDE.local.md、AGENTS.override.md、AGENTS.local.md")
    if in_git():
        code, out = git("config", "core.hooksPath")
        if out.strip() == ".githooks":
            ok("git core.hooksPath 指向 .githooks")
        else:
            fail("git core.hooksPath 未指向 .githooks：运行 git config core.hooksPath .githooks")
    else:
        fail("不在 git 仓库中：先 git init -b main 并提交，再配置 core.hooksPath")
    try:
        s = json.loads(read_text(ROOT / ".claude/settings.json"))
        (ok if s.get("autoMemoryEnabled") is False else fail)("Claude 项目设置 autoMemoryEnabled: false" if s.get("autoMemoryEnabled") is False
                                                              else "Claude 项目设置未关闭 autoMemoryEnabled")
    except Exception:
        fail("读不到 .claude/settings.json")
    py = shutil.which("python3")
    (ok if py else fail)(f"python3 在 PATH 中（{py}）" if py else "PATH 中没有 python3：hooks 命令写的是 python3")
    if os.name == "nt":
        (ok if shutil.which("py") else warn)("Windows：py 启动器可用" if shutil.which("py") else "Windows：没有 py 启动器，Codex 的 commandWindows 需要它")
    ok(f"PyYAML {yaml.__version__}")
    proto = CFG["paths"].get("prototype_source", "")
    (ok if proto and _archive_path(proto).exists() else warn)(f"原型归档：{proto or '未配置'}")
    ds = CFG["deep_source"].get("prototype", "")
    (ok if ds and _archive_path(ds).exists() else warn)(f"深化来源原型：{ds or '未配置'}（只有 refine-page 需要）")
    for r in rows:
        print(r)
    print("另外请手工确认：Claude 中查看已加载的指令应包含 AGENTS.md；在仓库根让 Codex 复述当前指令，应与根 AGENTS.md 一致。")
    return 1 if bad else 0


# ---------------------------------------------------------------- 入口


# ---------------------------------------------------------------- 分期执行：status、进度表与切片检查（ADR-008）

def _calibration(repo) -> dict:
    d = repo._yaml("docs/product/calibration.yaml", {})
    return d if isinstance(d, dict) else {}


def _carrier_ok(repo, c: str) -> bool:
    c = str(c)
    if c in repo.feature_map:
        return True
    if re.fullmatch(r"ADR-\d{3}", c):
        return any((repo.root / "docs" / "adr").glob(f"{c}-*.md"))
    if re.fullmatch(r"OQ-\d{3}", c):
        return any(str(q.get("id")) == c for q in repo.cross_oqs)
    if re.fullmatch(r"GP-\d+", c):
        return any((lp.get("golden_path") or {}).get("id") == c for _, lp in repo.loops())
    return (repo.root / c).exists()


def _carriers(sl) -> list:
    c = sl.get("carrier")
    return [str(x) for x in (c if isinstance(c, list) else [c])] if c else []


def check_phase_slices(repo, ctx):
    out = []
    pf, cf = "docs/product/phases.yaml", "docs/product/calibration.yaml"
    if not repo.phases:
        return out
    cov = coverage_index(repo)
    items = repo.items
    seen = {}
    loop_ids = set()
    for ph, lp in repo.loops():
        lid = str(lp.get("id"))
        loop_ids.add(lid)
        feats = {str(f) for f in lp.get("features") or []}
        for sl in lp.get("slices") or []:
            sid = str(sl.get("id", ""))
            if not sid.startswith(lid):
                out.append(F("E-PHASE-05", pf, sid or lid, f"切片编号 {sid or '（空）'} 不以所属闭环 {lid} 开头", "按“闭环编号＋字母”编号"))
            if sid in seen:
                out.append(F("E-PHASE-05", pf, sid, f"切片编号重复（另见闭环 {seen[sid]}）", "修正编号"))
            seen[sid] = lid
            its = [str(i) for i in sl.get("items") or []]
            for i in its:
                if i not in items:
                    out.append(F("E-PHASE-05", pf, sid, f"切片条目 {i} 不在页面登记中", "修正编号（条目编号以原型 v1.0 为基线，见 ADR-001）"))
                elif not (set(cov.get(i) or []) & feats):
                    out.append(F("E-PHASE-05", pf, sid, f"切片条目 {i} 由 {'、'.join(cov.get(i) or ['无功能'])} 覆盖，不属于闭环 {lid} 的功能", "把条目移到正确的切片，或调整 roadmap.yaml 的 covers"))
            if not its:
                cs = _carriers(sl)
                if not cs:
                    out.append(F("E-PHASE-05", pf, sid, "没有条目的切片缺少 carrier", "写明承担它的功能、ADR、待定问题、黄金路径或文件"))
                for c in cs:
                    if not _carrier_ok(repo, c):
                        out.append(F("E-PHASE-05", pf, sid, f"carrier {c} 无法解析", "改为存在的功能 ID、ADR、OQ、GP 编号或文件路径"))
            if sl.get("type") not in ("eng", "probe", "view", "vert", "rule", "ai", "integ"):
                out.append(F("E-PHASE-05", pf, sid, f"切片类型 {sl.get('type')} 不合法", "取 eng/probe/view/vert/rule/ai/integ"))
    cal = _calibration(repo)
    if cal:
        coef = cal.get("coefficient", 1.0)
        if not isinstance(coef, (int, float)) or coef <= 0:
            out.append(F("E-PHASE-06", cf, "coefficient", "校准系数应为正数", "改为正数，默认 1.0"))
            coef = 1.0
        lmap = {str(lp.get("id")): lp for _, lp in repo.loops()}
        for i, e in enumerate(cal.get("loops") or []):
            lid = str((e or {}).get("loop", ""))
            if lid not in loop_ids:
                out.append(F("E-PHASE-06", cf, f"loops[{i}]", f"闭环 {lid or '（空）'} 不存在", "改为 phases.yaml 中的闭环编号"))
                continue
            for k in ("budget",):
                v = e.get(k)
                if v is not None and not (isinstance(v, list) and len(v) == 2 and all(isinstance(x, (int, float)) for x in v)):
                    out.append(F("E-PHASE-06", cf, lid, f"{k} 应为 [下限, 上限]", "按示例改写"))
            for k in ("actual_rounds", "slices_done"):
                v = e.get(k)
                if v is not None and not isinstance(v, int):
                    out.append(F("E-PHASE-06", cf, lid, f"{k} 应为整数", "填整数"))
            act, lp = e.get("actual_rounds"), lmap[lid]
            fuse = lp.get("fuse_rounds") or (round((lp.get("budget_rounds") or [0, 0])[-1] * 1.5) if lp.get("budget_rounds") else None)
            if isinstance(act, int) and fuse and act > fuse * coef and not e.get("fused"):
                out.append(F("W-PHASE-07", cf, lid, f"实际 {act} 轮超过熔断线 {round(fuse * coef)} 轮，却没有熔断记录",
                             "写 fused（移回待办的切片）；以后同类闭环按规划 3.3 先熔断再关上"))
        allowed = {"handshake_ok", "tracks_started", "phase_start", "phase_end", "gate_passed", "decision", "preauthorized", "fuse", "coefficient"}
        for i, e in enumerate(cal.get("events") or []):
            ev = (e or {}).get("event") if isinstance(e, dict) else None
            if ev not in allowed:
                out.append(F("E-PHASE-06", cf, f"events[{i}]", f"事件类型 {ev} 不合法", "取 " + "、".join(sorted(allowed)) + "（ADR-024）"))
            elif not e.get("date"):
                out.append(F("E-PHASE-06", cf, f"events[{i}]", "事件缺少 date", "写事件日期 YYYY-MM-DD"))
    return out


CHECKS.insert(CHECKS.index(check_phases) + 1, check_phase_slices)


def _results_ready(repo) -> bool:
    p = CFG.get("verify", {}).get("results", "")
    return bool(p) and (repo.root / p).exists()


def _phase_state(repo):
    """返回 (功能状态, 闭环状态, 当前在制闭环列表, 下一个闭环, 校准)。"""
    wr = _results_ready(repo)
    fst = {fid: repo.feature_status(fid, wr) for fid in repo.feature_map}
    cal = _calibration(repo)
    rec = {str(e.get("loop")): e for e in cal.get("loops") or [] if isinstance(e, dict)}
    lst, open_, nxt = {}, [], None
    for ph, lp in repo.loops():
        lid = str(lp.get("id"))
        if str(ph.get("id")).startswith("8"):
            lst[lid] = "主题池"
            continue
        e = rec.get(lid, {})
        feats = [str(f) for f in lp.get("features") or []]
        if e.get("closed"):
            lst[lid] = "已关上"
        elif e.get("opened"):
            lst[lid] = "进行中"
            open_.append((ph, lp))
        elif feats and all(fst.get(f) == "完成" for f in feats):
            lst[lid] = "功能已完成，待收尾"
        else:
            lst[lid] = "未开卡"
            if nxt is None:
                nxt = (ph, lp)
    return fst, lst, open_, nxt, cal


def _slice_done(repo, sl, fst, cov, closed: bool = False) -> bool:
    """切片是否完成：条目或承担它的功能全部完成；ADR 已写、待定问题已决；黄金路径与文件类承担者要等闭环关上。"""
    if closed:
        return True
    its = [str(i) for i in sl.get("items") or []]
    feats = {f for i in its for f in (cov.get(i) or [])} | {c for c in _carriers(sl) if c in repo.feature_map}
    if feats:
        return all(fst.get(f) == "完成" for f in feats)
    cs = _carriers(sl)
    if not cs:
        return False
    for c in cs:
        if re.fullmatch(r"ADR-\d{3}", c):
            if not any((repo.root / "docs" / "adr").glob(f"{c}-*.md")):
                return False
        elif re.fullmatch(r"OQ-\d{3}", c):
            q = next((q for q in repo.cross_oqs if str(q.get("id")) == c), {})
            if q.get("status") != "resolved":
                return False
        else:
            return False
    return True


def _scaled(budget, coef):
    return [round(x * coef) for x in budget] if budget else None


def _loop_card(repo, lid: str) -> str:
    fst, lst, _, _, cal = _phase_state(repo)
    coef = cal.get("coefficient", 1.0) or 1.0
    found = [(ph, lp) for ph, lp in repo.loops() if str(lp.get("id")) == lid]
    if not found:
        return f"没有闭环 {lid}。可选：" + "、".join(str(lp.get("id")) for _, lp in repo.loops())
    ph, lp = found[0]
    cov = coverage_index(repo)
    pages_pending = {pid for pid, pg in repo.screens.items() if pg.get("refine") == "pending"}
    b = _scaled(lp.get("budget_rounds"), coef)
    fuse = lp.get("fuse_rounds")
    L = [f"# 闭环卡 {lid} {lp.get('title')}（{ph.get('id')} 期 {ph.get('title')}；状态：{lst.get(lid)}）", ""]
    if lp.get("demo"):
        L.append(f"一句话演示：{lp['demo']}")
    L.append(f"新引入的核心：{lp.get('introduces') or '—'}")
    deps = [f"{d}（{lst.get(str(d), '?')}）" for d in lp.get("depends") or []]
    L.append(f"依赖：{'、'.join(deps) or '无'}")
    if b:
        L.append(f"预算：{b[0]}–{b[1]} 轮（规划 {lp['budget_rounds'][0]}–{lp['budget_rounds'][1]} 轮 × 校准系数 {coef}）" + (f"；熔断线约 {round(fuse * coef)} 轮" if fuse else ""))
    gp = lp.get("golden_path") or {}
    if gp:
        L.append(f"黄金路径 {gp.get('id')}：{gp.get('path')}（测试标题带 [{gp.get('id')}]）")
    if lp.get("not_doing"):
        L.append("本闭环不做：" + "；".join(lp["not_doing"]))
    L += ["", "| 功能 | 标题 | 状态 | 覆盖条目 |", "|---|---|---|---|"]
    fmap = repo.feature_map
    for f in lp.get("features") or []:
        f = str(f)
        L.append(f"| {f} | {fmap.get(f, {}).get('title', '')} | {fst.get(f, '')} | {len(fmap.get(f, {}).get('covers') or [])} |")
    if lp.get("slices"):
        L += ["", "| 切片 | 类型 | 标题 | 条目或承担者 | 轮次 | 完成 | 验收 |", "|---|---|---|---|---|---|---|"]
        for sl in lp["slices"]:
            its = sl.get("items") or []
            who = " ".join(its) if its else "、".join(_carriers(sl))
            r = sl.get("rounds") or []
            L.append(f"| {sl.get('id')} | {sl.get('type')} | {sl.get('title')}{'（建议稿）' if sl.get('suggested') else ''} | {who} | {'–'.join(str(x) for x in r)} | {'是' if _slice_done(repo, sl, fst, cov, lst.get(lid) == '已关上') else '否'} | {sl.get('accept', '')} |")
    pend = sorted({i[:3] for sl in lp.get("slices") or [] for i in sl.get("items") or []} & pages_pending)
    L += ["", f"待深化的页（写规格前先用 refine-page）：{'、'.join(pend) if pend else '无'}"]
    return "\n".join(L)


def cmd_status(args):
    repo = Repo()
    if args.loop:
        print(_loop_card(repo, args.loop))
        return 0
    fst, lst, open_, nxt, cal = _phase_state(repo)
    coef = cal.get("coefficient", 1.0) or 1.0
    cov = coverage_index(repo)
    cur = open_[0] if open_ else nxt
    if not cur:
        print("全部闭环已关上；按 phases.yaml 的 8+ 主题池滚动规划下一期。")
        return 0
    ph, lp = cur
    lid = str(lp.get("id"))
    ring = next((r for r in repo.rings if r.get("id") == ph.get("ring")), {})
    nslice = next((sl for sl in lp.get("slices") or [] if not _slice_done(repo, sl, fst, cov, lst.get(lid) == "已关上")), None)
    pend = sorted({i[:3] for sl in lp.get("slices") or [] for i in sl.get("items") or []}
                  & {pid for pid, pg in repo.screens.items() if pg.get("refine") == "pending"})
    state = "进行中" if open_ else "待开卡（用 open-loop 技能）"
    sl_txt = f"{nslice.get('id')} {nslice.get('title')}" if nslice else "无（本闭环待收尾，用 close-loop 技能）"
    if args.brief:
        print(f"当前：{ph.get('id')} 期 {ph.get('title')} · 闭环 {lid} {lp.get('title')}（{state}） · 下一切片 {sl_txt} · 校准系数 {coef}"
              + (f" · 待深化页 {'、'.join(pend)}" if pend else "") + "。详情：python scripts/spec_tool.py status")
        return 0
    L = ["# 当前位置（由 roadmap、phases、calibration 与规格状态推导；ADR-008）", "",
         f"- 期：{ph.get('id')} 期 {ph.get('title')}；受众环 {ph.get('ring')}（{ring.get('audience', '')}）",
         f"- 假设：{ph.get('hypothesis', '')}",
         f"- 闭环：{lid} {lp.get('title')}（{state}）",
         f"- 下一个切片：{sl_txt}",
         f"- 校准系数：{coef}"]
    if len(open_) > 1:
        L.append(f"- 注意：同时有 {len(open_)} 个闭环在制（{'、'.join(str(l.get('id')) for _, l in open_)}），在制品上限为 1")
    done = [e for e in cal.get("loops") or [] if isinstance(e, dict) and e.get("closed") and e.get("actual_rounds")]
    if done:
        last = done[-1]
        lp2 = next((l for _, l in repo.loops() if str(l.get("id")) == str(last.get("loop"))), {})
        hi = (lp2.get("budget_rounds") or [0, 0])[-1]
        if hi:
            L.append(f"- 最近关上的闭环 {last.get('loop')}：实际 {last['actual_rounds']} 轮，规划上限 {hi} 轮，建议系数 {max(1.0, round(last['actual_rounds'] / hi, 2))}")
    L.append(f"- 当前闭环的待深化页：{'、'.join(pend) if pend else '无'}")
    rest = [str(l.get("id")) for p2, l in repo.loops() if p2 is ph and lst.get(str(l.get("id"))) not in ("已关上",)]
    L += [f"- 本期未关上的闭环：{'、'.join(rest)}", "", f"闭环卡：python scripts/spec_tool.py status --loop {lid}"]
    print("\n".join(L))
    return 0


def gen_progress_output(repo) -> dict:
    path = CFG["gen"].get("progress_out", "docs/product/progress.md")
    if not repo.phases:
        return {}
    fst, lst, _, _, cal = _phase_state(repo)
    cov = coverage_index(repo)
    items = repo.items
    fmap = repo.feature_map
    srcs = ["docs/product/roadmap.yaml", "docs/product/phases.yaml", "docs/product/calibration.yaml"]
    h = short_hash("".join(read_text(repo.root / s) for s in srcs if (repo.root / s).exists())
                   + json.dumps({k: [v[1].get("name"), v[1].get("page_priority")] for k, v in items.items()}, ensure_ascii=False, sort_keys=True)
                   + json.dumps(fst, ensure_ascii=False, sort_keys=True))
    L = [f"<!-- {GEN_MARK}，来源：{'、'.join(srcs)}、页面登记与各规格的 status；勿手改。source-sha: {h} -->",
         "# 进度表（生成物，只读）", "",
         "条目的状态取覆盖它的功能的状态：待写＝规格不存在，规格中＝draft，可实现＝ready，完成＝所有 AC 有通过的测试（需要测试结果）。闭环状态取 calibration.yaml（ADR-008）。", ""]
    slice_of = {}
    for _, lp in repo.loops():
        for sl in lp.get("slices") or []:
            for i in sl.get("items") or []:
                slice_of[str(i)] = str(sl.get("id"))
    L += ["| 期 | 主题 | 受众环 | 闭环 | 切片 | 条目 | 待写 | 规格中 | 可实现 | 完成 |", "|---|---|---|---|---|---|---|---|---|---|"]
    for ph in repo.phases:
        its = [i for lp in ph.get("loops") or [] for f in lp.get("features") or [] for i in fmap.get(str(f), {}).get("covers") or []]
        c = lambda s: sum(1 for i in its if fst.get((cov.get(i) or [""])[0]) == s)
        nsl = sum(len(lp.get("slices") or []) for lp in ph.get("loops") or [])
        L.append(f"| {ph.get('id')} | {ph.get('title')} | {ph.get('ring', '—')} | {len(ph.get('loops') or [])} | {nsl} | {len(its)} | {c('待写')} | {c('规格中')} | {c('可实现')} | {c('完成')} |")
    L.append("")
    for ph in repo.phases:
        L += [f"## {ph.get('id')} 期　{ph.get('title')}", ""]
        for lp in ph.get("loops") or []:
            lid = str(lp.get("id"))
            b = lp.get("budget_rounds")
            L += [f"### {lid} {lp.get('title')}（{lst.get(lid, '')}" + (f"；预算 {b[0]}–{b[1]} 轮" if b else "") + "）", ""]
            rows = []
            for f in lp.get("features") or []:
                for i in fmap.get(str(f), {}).get("covers") or []:
                    it = items.get(str(i), (None, {}))[1]
                    rows.append((slice_of.get(str(i), "—"), str(i), it.get("name", ""), it.get("page_priority", ""), str(f), fst.get(str(f), "")))
            noitem = [sl for sl in lp.get("slices") or [] if not sl.get("items")]
            if noitem:
                L += ["| 切片 | 标题 | 承担 |", "|---|---|---|"]
                L += [f"| {sl.get('id')} | {sl.get('title')} | {'、'.join(_carriers(sl))} |" for sl in noitem]
                L.append("")
            if rows:
                rows.sort(key=lambda r: (r[0] == "—", r[0], r[1]))
                L += ["| 条目 | 功能名 | 优先级 | 切片 | 功能 | 状态 |", "|---|---|---|---|---|---|"]
                L += [f"| {r[1]} | {r[2]} | {r[3]} | {r[0]} | {r[4]} | {r[5]} |" for r in rows]
                L.append("")
    L += ["## 校准表", "", f"当前校准系数：{cal.get('coefficient', 1.0)}", "",
          "| 闭环 | 预算 | 实际 | 切片 | 轮／切片 | 处理 |", "|---|---|---|---|---|---|"]
    for e in cal.get("loops") or []:
        if not isinstance(e, dict):
            continue
        a, s = e.get("actual_rounds"), e.get("slices_done")
        rps = f"{a / s:.1f}" if isinstance(a, int) and isinstance(s, int) and s else "—"
        bud = "–".join(str(x) for x in e.get("budget") or []) or "—"
        L.append(f"| {e.get('loop')} | {bud} | {a if a is not None else '—'} | {s if s is not None else '—'} | {rps} | {e.get('note') or ('熔断：' + '、'.join(e['fused']) if e.get('fused') else ('进行中' if not e.get('closed') else ''))} |")
    L.append("")
    return {path: ("\n".join(L), h, srcs)}


def main(argv=None):
    global ROOT, CFG
    ap = argparse.ArgumentParser(prog="spec_tool", description="文档体系工具（见 docs/meta/doc-system.md 附录 J）")
    ap.add_argument("--root", type=Path, help="隔离夹具根目录，仅用于 gen/check/pack/rules")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pack", help="生成任务包到 .pack/<ID>.md")
    p.add_argument("id")
    p.add_argument("--spec-mode", action="store_true")
    p.add_argument("--allow-over", action="store_true")
    p.set_defaults(fn=cmd_pack)
    p = sub.add_parser("rules", help="输出路径适用的约定规则与各级 AGENTS.md")
    p.add_argument("paths", nargs="+")
    p.set_defaults(fn=cmd_rules)
    p = sub.add_parser("check", help="运行附录 K 的检查")
    p.add_argument("--changed", action="store_true")
    p.add_argument("--full", action="store_true")
    p.add_argument("--staged", action="store_true")
    p.set_defaults(fn=cmd_check)
    p = sub.add_parser("verify", help="完成标准")
    p.add_argument("--staged", action="store_true")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--fast", action="store_true")
    g.add_argument("--full", action="store_true")
    p.set_defaults(fn=cmd_verify)
    p = sub.add_parser("gen", help="重新生成派生物")
    p.add_argument("--check", action="store_true")
    p.add_argument("--artifacts", help="同时把带测试结果的 roadmap.md 与覆盖报告写到该目录（CI 构建产物）")
    p.set_defaults(fn=cmd_gen)
    p = sub.add_parser("budget", help="预算报告")
    p.add_argument("--tool", choices=["claude", "codex"])
    p.set_defaults(fn=cmd_budget)
    p = sub.add_parser("eval", help="运行 AI 场景评测")
    p.add_argument("scenario", nargs="?")
    p.add_argument("--affected", action="store_true")
    p.add_argument("--suite", choices=["regression", "quality"], default="regression")
    p.add_argument("--update-baseline", action="store_true")
    p.set_defaults(fn=cmd_eval)
    p = sub.add_parser("new", help="分配编号并按模板创建（只在主干）")
    p.add_argument("kind", choices=["feature", "adr", "oq", "inv", "scenario"])
    p.add_argument("rest", nargs="*")
    p.add_argument("--release", choices=list(RELEASES))
    p.add_argument("--loop")
    p.add_argument("--depends")
    p.add_argument("--default")
    p.add_argument("--features")
    p.add_argument("--owner")
    p.add_argument("--source")
    p.add_argument("--enforcement")
    p.add_argument("--scope")
    p.add_argument("--actor")
    p.set_defaults(fn=cmd_new)
    p = sub.add_parser("work", help="work 文件开始与收尾")
    p.add_argument("action", choices=["start", "close"])
    p.add_argument("id")
    p.add_argument("--lane", default="标准", choices=["标准", "重型"])
    p.set_defaults(fn=cmd_work)
    p = sub.add_parser("import-prototype", help="原型同步到页面登记；--write-ids 分配并写回条目编号")
    p.add_argument("--from", dest="src")
    p.add_argument("--write-ids", action="store_true")
    p.add_argument("--force-baseline", action="store_true", help=argparse.SUPPRESS)
    p.set_defaults(fn=cmd_import_prototype)
    p = sub.add_parser("shots", help="无头浏览器截图")
    p.add_argument("--page")
    p.add_argument("--from", dest="src")
    p.set_defaults(fn=cmd_shots)
    p = sub.add_parser("coverage", help="页面条目覆盖报告")
    p.add_argument("--out")
    p.set_defaults(fn=cmd_coverage)
    p = sub.add_parser("trace-report", help="读取轨迹汇总")
    p.add_argument("--session")
    p.set_defaults(fn=cmd_trace_report)
    p = sub.add_parser("show", help="以可读形式显示登记")
    p.add_argument("registry")
    p.add_argument("id", nargs="?")
    p.set_defaults(fn=cmd_show)
    p = sub.add_parser("status", help="当前期、闭环、下一切片与校准（ADR-008）")
    p.add_argument("--loop", help="输出某个闭环的闭环卡")
    p.add_argument("--brief", action="store_true", help="一行摘要（供 SessionStart hook）")
    p.set_defaults(fn=cmd_status)
    p = sub.add_parser("doctor", help="本地环境检查")
    p.set_defaults(fn=cmd_doctor)
    args = ap.parse_args(argv)
    if args.root is not None:
        if args.cmd not in {"gen", "check", "pack", "rules"} or not args.root.is_dir():
            ap.error("--root 需要现有目录，且仅支持 gen/check/pack/rules")
        ROOT = args.root.resolve()
        CFG = load_config()
    return args.fn(args) or 0


if __name__ == "__main__":
    sys.exit(main())
