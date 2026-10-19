#!/usr/bin/env python3
"""依赖登记检查（ADR-025 决定 1、2）：版本锁与禁用库，含版本陷阱。由 verify 运行，不依赖安装。

规则见同目录 dependency-policy.json：
1. 工作区每个 package.json 的依赖都在允许清单中，版本写精确版本（不写 ^、~、范围、标签或预发布版本），
   大版本落在登记的大版本内；工作区包之间写 workspace:*。
2. 禁用清单中的包不出现在任何 package.json；配置陷阱（.eslintrc、tailwind.config、npm/yarn/Bun/Deno 的文件）不出现。
3. package.json 不写 pnpm 字段（pnpm 11 不读）；根 package.json 的 packageManager 为登记的 pnpm 大版本、engines.node 为登记的 Node 大版本；
   根目录有 pnpm-lock.yaml（锁文件由 pnpm install 生成）。
用法：python3 scripts/engineering/check_dependencies.py [仓库根]
"""
from __future__ import annotations

import fnmatch
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POLICY = Path(__file__).resolve().with_name("dependency-policy.json")
DEP_FIELDS = ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies")
EXACT_RE = re.compile(r"^\d+\.\d+\.\d+$")
SKIP_DIRS = {".git", "node_modules", ".pnpm-store", "dist", "build", ".test-results", ".cache"}


def load_policy(path: Path = POLICY) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _workspace_globs(root: Path) -> list[str]:
    p = root / "pnpm-workspace.yaml"
    if not p.exists():
        return []
    globs, in_packages = [], False
    for line in p.read_text(encoding="utf-8").splitlines():
        if re.match(r"^packages:\s*$", line):
            in_packages = True
            continue
        if in_packages:
            m = re.match(r"^\s+-\s+[\"']?([^\"'#]+?)[\"']?\s*(?:#.*)?$", line)
            if m:
                globs.append(m.group(1).strip())
            elif line.strip() and not line.startswith((" ", "\t", "#")):
                in_packages = False
    return globs


def workspace_manifests(root: Path) -> list[Path]:
    out = [root / "package.json"] if (root / "package.json").exists() else []
    for g in _workspace_globs(root):
        for d in sorted(root.glob(g)):
            if (d / "package.json").exists() and d / "package.json" not in out:
                out.append(d / "package.json")
    return out


def _line_ok(version: str, line) -> bool:
    if line is None:
        return True
    return version == line or version.startswith(f"{line}.")


def _allowed_entry(name: str, policy: dict):
    if name in policy["allowed"]:
        return policy["allowed"][name]
    for pat, entry in (policy.get("allowed_patterns") or {}).items():
        if re.search(pat, name):
            return entry
    return None


def _banned_reason(name: str, policy: dict):
    if name in policy["banned"]:
        return policy["banned"][name]
    for pat, reason in (policy.get("banned_patterns") or {}).items():
        if re.search(pat, name):
            return reason
    return None


def check(root: Path = ROOT, policy: dict | None = None) -> list[str]:
    policy = policy or load_policy()
    out: list[str] = []
    manifests = workspace_manifests(root)
    data = {}
    for m in manifests:
        r = m.relative_to(root).as_posix()
        try:
            data[r] = json.loads(m.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            out.append(f"{r}：JSON 解析失败（{e}）")
    names = {d.get("name") for d in data.values() if isinstance(d, dict)}
    scope = policy.get("workspace_scope", "@exam-prep/")
    for r, pkg in data.items():
        if "pnpm" in pkg:
            out.append(f"{r}：写了 pnpm 字段；pnpm 11 不读 package.json 的 pnpm 字段，设置写进 pnpm-workspace.yaml")
        for field in DEP_FIELDS:
            for name, version in (pkg.get(field) or {}).items():
                where = f"{r} {field}.{name}"
                version = str(version)
                if name.startswith(scope):
                    if version != "workspace:*":
                        out.append(f"{where}：工作区包之间写 workspace:*，实际为 {version}")
                    elif name not in names:
                        out.append(f"{where}：工作区里没有这个包")
                    continue
                reason = _banned_reason(name, policy)
                if reason:
                    out.append(f"{where}：禁用库（{reason}）")
                    continue
                entry = _allowed_entry(name, policy)
                if entry is None:
                    out.append(f"{where}：未登记的依赖；先在 ADR 登记并加入 scripts/engineering/dependency-policy.json")
                    continue
                if not EXACT_RE.match(version):
                    out.append(f"{where}：版本 {version} 不是精确版本（不写 ^、~、范围、标签或预发布版本）")
                    continue
                if not _line_ok(version, entry.get("line")):
                    out.append(f"{where}：版本 {version} 不在登记的大版本 {entry.get('line')} 内（版本陷阱，升级先写 ADR）")
    root_pkg = data.get("package.json")
    if root_pkg is not None:
        rt = policy.get("runtime") or {}
        pm = str(root_pkg.get("packageManager") or "")
        m = re.match(r"^pnpm@(\d+)\.\d+\.\d+(?:\+\S+)?$", pm)
        if not m or int(m.group(1)) != int(rt.get("pnpm", 0)):
            out.append(f"package.json：packageManager 应为 pnpm@{rt.get('pnpm')}.x.y 的精确版本，实际为 {pm or '（未写）'}")
        node = str((root_pkg.get("engines") or {}).get("node") or "")
        if not re.search(rf"(?<!\d){rt.get('node')}(?!\d)", node):
            out.append(f"package.json：engines.node 应限定 Node {rt.get('node')}，实际为 {node or '（未写）'}")
        if not (root / "pnpm-lock.yaml").exists():
            out.append("pnpm-lock.yaml：缺少锁文件；运行 pnpm install 生成并提交")
    banned_files = policy.get("banned_files") or {}
    for p in _walk(root):
        for pat, reason in banned_files.items():
            if fnmatch.fnmatch(p.name, pat):
                out.append(f"{p.relative_to(root).as_posix()}：{reason}")
                break
    return out


def _walk(root: Path):
    stack = [root]
    while stack:
        d = stack.pop()
        for p in sorted(d.iterdir()):
            if p.is_dir():
                if p.name not in SKIP_DIRS:
                    stack.append(p)
            else:
                yield p


def main(argv: list[str]) -> int:
    root = Path(argv[1]).resolve() if len(argv) > 1 else ROOT
    problems = check(root)
    for line in problems:
        print(f"✗ {line}")
    print(f"依赖登记检查：{len(problems)} 处问题。" if problems else "依赖登记检查：通过。")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
