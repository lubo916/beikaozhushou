"""Route bk to the existing V4 repository; never discover or fall back to V3."""

import ast
import hashlib
import json
import tempfile
import os
from pathlib import Path
import subprocess
import sys


V4_ROOT = Path("/home/administrator/备考助手/exam-prep")
V4_HANDOFF = V4_ROOT.parent / "handoff"
# Immutable commit recorded from the actual bk-v0001 initialization tag.
V4_ANCHOR = "d2f74520eed40472d0aab5cbc29668e7cb50eba5"
V4_ORIGINS = {
    "https://github.com/lubo916/beikaozhushou.git",
    "git@github.com:lubo916/beikaozhushou.git",
}


REQUIRED_ACCEPTANCE_POLICY = "2026-10-24.1"
AUTHORITATIVE_TOOLS = ("bk.py", "bk_acceptance.py")


class RepositoryError(Exception):
    pass


def git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise RepositoryError(f"Git 身份检查失败：{' '.join(args)}\n{result.stderr.strip()}")
    return result.stdout.strip()


def validate_repository(root: Path) -> None:
    if not root.is_dir() or root.resolve() != V4_ROOT:
        raise RepositoryError(f"V4 仓库不存在或路径不是固定的 Ubuntu 仓库：{root}")
    if Path(git(root, "rev-parse", "--show-toplevel")).resolve() != V4_ROOT:
        raise RepositoryError("Git 根目录与固定的 V4 路径不一致。")
    required = (
        "tools/bk.py",
        "tools/bk.config.json",
        "progress/tasks.json",
        "docs/baseline/tech.md",
        "design/prototype/prototype.html",
        "AGENTS.md",
    )
    for rel in required:
        if not (root / rel).is_file():
            raise RepositoryError(f"缺少 V4 文件：{rel}")
    if "备考助手 V4 常驻规则" not in (root / "AGENTS.md").read_text(encoding="utf-8"):
        raise RepositoryError("AGENTS.md 不是 V4 常驻规则。")
    if (root / "scripts/spec_tool.py").exists():
        raise RepositoryError("发现仍可执行的 V3 流程 scripts/spec_tool.py，需核查版本。")
    progress = json.loads((root / "progress/tasks.json").read_text(encoding="utf-8"))
    if not isinstance(progress.get("tasks"), list) or not any(
        task.get("id") == "F00" and task.get("status") == "done"
        for task in progress["tasks"]
    ):
        raise RepositoryError("V4 初始化任务 F00 未完成，禁止出包或继续开发。")
    if git(root, "remote", "get-url", "origin") not in V4_ORIGINS:
        raise RepositoryError("origin 与已确认的备考助手仓库不一致。")
    config = json.loads((root / "tools/bk.config.json").read_text(encoding="utf-8"))
    if config.get("main_branch", "main") != "main":
        raise RepositoryError("出包主干不再是已确认的 main，需先核查配置。")
    main_ref = "refs/heads/main"
    for ref in ("HEAD", main_ref):
        git(root, "merge-base", "--is-ancestor", V4_ANCHOR, ref)
    for rel in required:
        git(root, "cat-file", "-e", f"{main_ref}:{rel}")
    main_agents = git(root, "show", f"{main_ref}:AGENTS.md")
    if "备考助手 V4 常驻规则" not in main_agents:
        raise RepositoryError("实际出包主干不是 V4。")
    if (root / config.get("handoff_dir", "../handoff")).resolve() != V4_HANDOFF:
        raise RepositoryError("中转目录配置偏离已确认的 Ubuntu V4 目录。")
    # Reject links that would silently send an otherwise valid V4 package elsewhere.
    for base in (V4_HANDOFF, root / ".bk/handoff"):
        for path in (base, *(base / name for name in ("outbox", "versions", "fixes", "inbox", "applied"))):
            if path.resolve() != path:
                raise RepositoryError(f"中转目录被链接到其他位置：{path}")


def main_tool_bytes(root: Path, name: str, ref: str = "refs/heads/main") -> bytes:
    """Always read the deployed policy from main, even on an old task branch."""
    result = subprocess.run(
        ["git", "-C", str(root), "show", f"{ref}:tools/{name}"],
        capture_output=True, check=False,
    )
    if result.returncode:
        raise RepositoryError(f"主干缺少已部署的验收工具 tools/{name}；停止，禁止回退旧流程。")
    return result.stdout


def policy_version(source: bytes) -> str:
    try:
        tree = ast.parse(source.decode("utf-8"))
        for node in tree.body:
            if isinstance(node, ast.Assign) and any(
                isinstance(target, ast.Name) and target.id == "POLICY_VERSION"
                for target in node.targets
            ):
                value = ast.literal_eval(node.value)
                if isinstance(value, str):
                    return value
    except (SyntaxError, UnicodeError, ValueError):
        pass
    raise RepositoryError("验收策略没有合法的 POLICY_VERSION；禁止按旧流程继续。")


def atomic_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        raise RepositoryError(f"验收运行时文件不允许是链接：{path}")
    fd, temporary = tempfile.mkstemp(prefix=".entry-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def authoritative_tool(root: Path) -> tuple[Path, str]:
    """Materialize immutable main tools; never execute task-branch tool copies."""
    main_commit = git(root, "rev-parse", "refs/heads/main")
    sources = {name: main_tool_bytes(root, name, main_commit) for name in AUTHORITATIVE_TOOLS}
    version = policy_version(sources["bk_acceptance.py"])
    if version != REQUIRED_ACCEPTANCE_POLICY:
        raise RepositoryError(
            f"验收策略版本不匹配：主干 {version}，入口要求 {REQUIRED_ACCEPTANCE_POLICY}；请同步入口和主干。"
        )
    digest = hashlib.sha256()
    for name, content in sorted(sources.items()):
        digest.update(name.encode("utf-8") + b"\0" + content + b"\0")
    token = digest.hexdigest()
    base = root / ".bk" / "entry-runtime"
    runtime = base / token
    if base.resolve() != base or runtime.resolve() != runtime:
        raise RepositoryError("验收运行时目录被链接到其他位置，停止。")
    runtime.mkdir(parents=True, exist_ok=True)
    for name, content in sources.items():
        target = runtime / name
        if target.is_symlink():
            raise RepositoryError(f"验收运行时文件不允许是链接：{target}")
        if not target.exists() or target.read_bytes() != content:
            atomic_bytes(target, content)
    if any((runtime / name).read_bytes() != content for name, content in sources.items()):
        raise RepositoryError("验收运行时校验失败；不会执行旧工具。")
    state = {
        "policy_version": version,
        "tool_digest": token,
        "authoritative_ref": "refs/heads/main",
        "main": main_commit,
        "workspace_head": git(root, "rev-parse", "HEAD"),
        "driver": str(runtime / "bk.py"),
    }
    atomic_bytes(
        root / ".bk" / "acceptance-entry.json",
        (json.dumps(state, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
    )
    return runtime / "bk.py", version


def main() -> int:
    # Ignore Git path overrides inherited from an unrelated terminal/repository.
    for name in (
        "GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    ):
        os.environ.pop(name, None)
    os.environ["BK_ENV"] = "local"
    os.environ["BK_HANDOFF"] = str(V4_HANDOFF)
    try:
        validate_repository(V4_ROOT)
        branch = git(V4_ROOT, "branch", "--show-current") or "detached HEAD"
        commit = git(V4_ROOT, "rev-parse", "--short=12", "HEAD")
        print(f"[V4 身份校验通过] Ubuntu:{V4_ROOT}", flush=True)
        print(f"[分支与提交] {branch} / {commit}", flush=True)
        args = sys.argv[1:] or ["status"]
        driver, policy = authoritative_tool(V4_ROOT)
        print(f"[验收策略] {policy}（主干权威工具，默认优化流程）", flush=True)
        command = [sys.executable, str(driver), *args]
        # Reuse the existing Node/pnpm/browser setup used by V4's local checks.
        launcher = V4_ROOT / ".bk/local-run"
        if launcher.is_file():
            command = [sys.executable, str(launcher), *command]
        return subprocess.call(command, cwd=V4_ROOT)
    except (RepositoryError, OSError, ValueError, TypeError, AttributeError) as error:
        print(f"[V4 已停止] {error}\n不会改用 D 盘 V3 副本。", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

