"""Shared acceptance primitives. No cross-run reuse or reduced verification policy."""
from __future__ import annotations

import contextlib
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tempfile
import threading
import time
import uuid
import zipfile
import zlib

POLICY_VERSION = "2026-10-24.1"


class AcceptanceError(RuntimeError):
    pass


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _sha(value):
    return hashlib.sha256(value).hexdigest()


def _now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def atomic_json(path, data):
    """Serialize first, then atomically replace; a failed write preserves the old file."""
    path = Path(path)
    payload = (_canonical(data) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix="." + path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
        try:
            directory = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        except OSError:
            pass  # Atomic replacement is still complete on filesystems without directory fsync.
    finally:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass


def _git(root, *args):
    proc = subprocess.run(["git", "-C", str(root), *args], capture_output=True)
    if proc.returncode:
        raise AcceptanceError(proc.stderr.decode("utf-8", "replace").strip() or "Git identity unavailable")
    return proc.stdout


def common_repo_root(root):
    """All linked worktrees resolve to the primary checkout's Git common directory."""
    root = Path(root).resolve()
    try:
        common = Path(os.fsdecode(_git(root, "rev-parse", "--path-format=absolute", "--git-common-dir")).strip())
        if common.name == ".git":
            return common.parent.resolve()
        # Nonstandard Git directories: discover the primary worktree rather than guessing its parent.
        first = _git(root, "worktree", "list", "--porcelain").decode("utf-8", "replace").splitlines()[0]
        if first.startswith("worktree "):
            return Path(first[9:]).resolve()
    except (AcceptanceError, OSError, IndexError):
        pass
    return root


def new_run(root, operation, task=None):
    base = Path(root).resolve() / ".bk" / "acceptance" / "runs"
    base.mkdir(parents=True, exist_ok=True)
    run_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex
    path = base / run_id
    path.mkdir()
    info = {"id": run_id, "run_id": run_id, "path": str(path), "operation": str(operation),
            "task": task, "created_at": _now(), "policy_version": POLICY_VERSION,
            "worktree": str(Path(root).resolve())}
    atomic_json(path / "run.json", info)
    return info


def _file_digest(path):
    path = Path(path)
    if path.is_symlink():
        return _sha(b"symlink\0" + os.fsencode(os.readlink(path)))
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _runtime_inputs(root, environment):
    # Hash private dotenv/dependency inputs; never persist their contents or URLs.
    names = [".env", ".env.local", ".env.test", ".env.test.local", ".env.development",
             ".env.development.local", ".env.production", ".env.production.local",
             ".nvmrc", ".node-version", ".tool-versions", ".bk/env.json",
             "node_modules/.modules.yaml", ".pnpm-workspace-state-v1.json",
             "node_modules/.pnpm-workspace-state-v1.json", "node_modules/.pnpm/lock.yaml",
             "node_modules/playwright/package.json", "node_modules/@playwright/test/package.json"]
    values = {}
    for name in names:
        path = root / name
        values[name] = _sha(path.read_bytes()) if path.is_file() else None
    browser_roots = {root / ".bk/browsers"}
    configured = environment.get("PLAYWRIGHT_BROWSERS_PATH")
    if configured and configured != "0":
        browser_path = Path(configured)
        browser_roots.add(browser_path if browser_path.is_absolute() else root / browser_path)
    for path in sorted(browser_roots):
        try:
            values["browser:" + str(path)] = sorted(entry.name for entry in path.iterdir())
        except OSError:
            values["browser:" + str(path)] = None
    node = shutil.which("node", path=environment.get("PATH"))
    values["node_executable"] = str(Path(node).resolve()) if node else None
    if node:
        try:
            version = subprocess.run([node, "--version"], capture_output=True, timeout=2, check=False)
            values["node_version"] = version.stdout.decode("ascii", "replace").strip() if version.returncode == 0 else None
        except (OSError, subprocess.TimeoutExpired):
            values["node_version"] = None
    return _sha(_canonical(values).encode())


def fingerprint(root, config=None, commands=None, run_id=None, *, environment=None):
    """Bind this run to HEAD, tested tracked/untracked content, configuration and commands."""
    root = Path(root).resolve()
    digest = hashlib.sha256()
    try:
        head = os.fsdecode(_git(root, "rev-parse", "HEAD")).strip()
        tree = os.fsdecode(_git(root, "rev-parse", "HEAD^{tree}")).strip()
        digest.update(_git(root, "diff", "--binary", "HEAD", "--", ".", ":(exclude).bk"))
        files = _git(root, "ls-files", "--others", "--exclude-standard", "-z").split(b"\0")
        for name in sorted(filter(None, files)):
            if name == b".bk" or name.startswith(b".bk/"):
                continue
            digest.update(name + b"\0")
            digest.update(_file_digest(root / os.fsdecode(name)).encode())
        git_available = True
    except AcceptanceError:
        # Temporary no-Git fixtures are supported; actual delivery still needs Git candidate identity.
        head = tree = None
        git_available = False
        excluded = {".bk", ".git", "node_modules", "__pycache__", ".pytest_cache"}
        for path in sorted(root.rglob("*")):
            rel = path.relative_to(root)
            if any(part in excluded for part in rel.parts) or not (path.is_file() or path.is_symlink()):
                continue
            digest.update(os.fsencode(rel.as_posix()) + b"\0")
            digest.update(_file_digest(path).encode())
    selected_env = {key: os.environ[key] for key in (
        "CI", "TZ", "LANG", "PATH", "NODE_OPTIONS", "PLAYWRIGHT_BROWSERS_PATH",
        "BK_ENV", "BK_CHROMIUM", "BK_VERIFY_RUNTIME", "VITE_REAL", "EXAM_PREP_SCREENSHOT_IMAGE",
        "E2E_SHARD", "DATABASE_URL", "TEST_DATABASE_URL", "REDIS_URL",
        "FONTCONFIG_FILE", "LD_LIBRARY_PATH", "E2E_BROWSERS", "E2E_WORKERS",
        "E2E_API_PORT", "E2E_LEARNER_PORT", "E2E_ORG_PORT", "E2E_ADMIN_PORT"
    ) if key in os.environ}
    if environment:
        selected_env.update(environment)
    return {"policy_version": POLICY_VERSION, "run_id": run_id,
            "git_available": git_available, "head": head, "tree": tree,
            "tested_state_sha256": digest.hexdigest(),
            "config_sha256": _sha(_canonical(config or {}).encode()),
            "commands": list(commands or []),
            "commands_sha256": _sha(_canonical(commands or []).encode()),
            "environment_sha256": _sha(_canonical(selected_env).encode()),
            "runtime_inputs_sha256": _runtime_inputs(root, selected_env)}


def validate_summary(summary, identity, *, require_pass=True):
    """Return rejection reasons; old or incomplete greens never authorize delivery."""
    errors = []
    if not isinstance(identity, dict):
        return ["expected identity is not an object"]
    if not isinstance(summary, dict):
        return ["summary is not an object"]
    if summary.get("policy_version") != POLICY_VERSION:
        errors.append("policy_version mismatch or missing")
    if not identity.get("run_id") or summary.get("run_id") != identity.get("run_id"):
        errors.append("run_id mismatch or missing")
    if identity.get("policy_version") != POLICY_VERSION:
        errors.append("identity policy_version mismatch")
    if summary.get("identity") != identity:
        errors.append("tested identity mismatch or missing")
    required = {"policy_version", "run_id", "git_available", "head", "tree",
                "tested_state_sha256", "config_sha256", "commands", "commands_sha256", "environment_sha256", "runtime_inputs_sha256"}
    if not required.issubset(identity):
        errors.append("identity fields incomplete")
    if summary.get("status") != "completed":
        errors.append("run is not completed")
    if summary.get("mode") != "normal":
        errors.append("diagnostic or unknown mode cannot authorize delivery")
    results = summary.get("results")
    if not isinstance(results, list) or not results:
        errors.append("results missing")
    elif require_pass:
        if [item.get("name") if isinstance(item, dict) else None for item in results] != identity.get("commands"):
            errors.append("results do not match the complete ordered check plan")
        if any(not isinstance(item, dict) or item.get("result") != "pass" for item in results):
            errors.append("not all checks passed")
        if summary.get("verdict") != "pass":
            errors.append("verdict is not pass")
    return errors


def triage(output, returncode=None):
    """Conservative signature routing, never automatic retry or flaky exoneration."""
    text = str(output or "")
    lowered = text.lower()
    signatures = [
        ("environment", ("cannot connect to the docker daemon", "docker: command not found",
                         "err_pnpm_no_tty",
                         "executable doesn't exist at", "host system is missing dependencies"),
         "Explicit runtime or dependency prerequisite failure"),
        ("tool", ("fileexistserror", "no fresh verification summary", "无本次新鲜汇总"),
         "Explicit report/controller failure"),
        ("guard", ("禁止零值", "零值类名", "zero-value class", "no-restricted-imports"),
         "Explicit guard failure"),
        ("test", ("assertionerror", "expect(received)", "expected:"),
         "Explicit assertion failure; product versus test error still needs diagnosis"),
    ]
    # Process signals, broad timeouts and a passing retry are not environment diagnoses.
    if returncode in (139, -11) or "timed out" in lowered or "timeout" in lowered:
        return {"category": "unknown", "reason": "Signal or timeout does not establish a root cause",
                "auto_retry": False, "can_release": False}
    if (("jsondecodeerror" in lowered or "unexpected end of json input" in lowered) and
            any(marker in lowered for marker in ("report", "summary", ".bk/", "gallery", "清单", "报告"))):
        return {"category": "report", "reason": "Malformed verification report; origin still needs inspection",
                "auto_retry": False, "can_release": False}
    for category, needles, reason in signatures:
        if any(needle in lowered for needle in needles):
            return {"category": category, "reason": reason, "auto_retry": False, "can_release": False}
    return {"category": "unknown", "reason": "No unambiguous failure signature",
            "auto_retry": False, "can_release": False}


def _check_package_runtime(archive, names, meta):
    """Validate the shipped authority runtime; archive CRC alone is not runtime identity."""
    version = re.fullmatch(r"(\d+)\.(\d+)(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?", str(meta["tool"]))
    tool_version = tuple(int(part or 0) for part in version.groups()) if version else None
    has_runtime = any(name == "BK_RUNTIME" or name.startswith("BK_RUNTIME/") for name in names)
    if not has_runtime and (tool_version is None or tool_version < (4, 2, 0)):
        return None
    expected = {"bk.py", "bk_acceptance.py", "AGENTS.md", "acceptance-flow.md"}
    required = {"BK_RUNTIME/" + name for name in expected | {"runtime.json"}}
    if not required.issubset(names):
        raise AcceptanceError("Authority runtime files missing: " + ", ".join(sorted(required - set(names))))
    actual = {name[len("BK_RUNTIME/"):] for name in names
              if name.startswith("BK_RUNTIME/") and not name.endswith("/")}
    if actual != expected | {"runtime.json"}:
        raise AcceptanceError("Authority runtime contains files not covered by its manifest")
    manifest_bytes = archive.read("BK_RUNTIME/runtime.json")
    manifest = json.loads(manifest_bytes.decode("utf-8"))
    if not isinstance(manifest, dict):
        raise AcceptanceError("Authority runtime manifest is not an object")
    if manifest.get("policy_version") != POLICY_VERSION:
        raise AcceptanceError("Authority runtime policy version is unsupported or missing")
    if manifest.get("tool_version") != meta["tool"] or not str(manifest.get("tool_version", "")).startswith("4."):
        raise AcceptanceError("Authority runtime tool version disagrees with the V4 package")
    if manifest.get("entry") != "python3 ../BK_RUNTIME/bk.py":
        raise AcceptanceError("Authority runtime entry is not the declared package driver")
    entries = manifest.get("files")
    if not isinstance(entries, dict) or set(entries) != expected:
        raise AcceptanceError("Authority runtime manifest does not cover exactly the required files")
    files = {}
    for name in sorted(expected):
        record = entries[name]
        raw = archive.read("BK_RUNTIME/" + name)
        if (not isinstance(record, dict) or type(record.get("size_bytes")) is not int or
                record["size_bytes"] <= 0 or not isinstance(record.get("sha256"), str) or
                not re.fullmatch(r"[0-9a-f]{64}", record["sha256"])):
            raise AcceptanceError("Authority runtime manifest entry is incomplete: " + name)
        if len(raw) != record["size_bytes"] or _sha(raw) != record["sha256"]:
            raise AcceptanceError("Authority runtime hash or length mismatch: " + name)
        files[name] = raw.decode("utf-8")
    driver_version = re.search(r'(?m)^TOOL_VERSION\s*=\s*["\x27]([^"\x27]+)["\x27]', files["bk.py"])
    helper_policy = re.search(r'(?m)^POLICY_VERSION\s*=\s*["\x27]([^"\x27]+)["\x27]', files["bk_acceptance.py"])
    if not driver_version or driver_version.group(1) != manifest["tool_version"]:
        raise AcceptanceError("Authority runtime driver does not identify the declared V4 tool")
    if not helper_policy or helper_policy.group(1) != POLICY_VERSION:
        raise AcceptanceError("Authority runtime helper does not identify the current policy")
    if "V4" not in files["AGENTS.md"] or "bk.py" not in files["AGENTS.md"]:
        raise AcceptanceError("Authority runtime AGENTS does not identify the V4 entry")
    if not files["acceptance-flow.md"].strip():
        raise AcceptanceError("Authority runtime acceptance protocol is empty")
    return {"verified": True, "tool_version": manifest["tool_version"],
            "policy_version": manifest["policy_version"], "entry": manifest["entry"],
            "manifest_sha256": _sha(manifest_bytes), "files": entries}


def check_zip(path, *, expected_task=None, expected_version=None, expected_baseline=None, require_v4=True):
    """Check every CRC, unsafe/duplicate members, V4 source markers and declared package identity."""
    path = Path(path)
    try:
        if not path.is_file() or path.stat().st_size == 0:
            raise AcceptanceError("ZIP is missing or empty")
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)):
                raise AcceptanceError("ZIP contains duplicate entries")
            for info in archive.infolist():
                name = info.filename
                member = PurePosixPath(name)
                if (member.is_absolute() or ".." in member.parts or "\\" in name or
                        re.match(r"^[A-Za-z]:", name)):
                    raise AcceptanceError("ZIP contains an unsafe member: " + name)
                if stat.S_ISLNK(info.external_attr >> 16):
                    raise AcceptanceError("ZIP contains a symbolic link: " + name)
            bad = archive.testzip()
            if bad:
                raise AcceptanceError("ZIP CRC failed: " + bad)
            required = {"VERSION.txt", "repo/.bk/package.json"}
            if require_v4:
                required.update({"repo/tools/bk.py", "repo/AGENTS.md"})
            if not required.issubset(names):
                raise AcceptanceError("ZIP identity files missing: " + ", ".join(sorted(required - set(names))))
            meta = json.loads(archive.read("repo/.bk/package.json").decode("utf-8"))
            version_text = archive.read("VERSION.txt").decode("utf-8")
            if not isinstance(meta, dict) or not all(meta.get(key) for key in ("kind", "version", "base", "tool")):
                raise AcceptanceError("Package metadata is incomplete")
            if require_v4:
                tool = archive.read("repo/tools/bk.py").decode("utf-8")
                agents = archive.read("repo/AGENTS.md").decode("utf-8")
                if not str(meta["tool"]).startswith("4.") or not re.search(r'TOOL_VERSION\s*=\s*["\x27]4\.', tool):
                    raise AcceptanceError("Package tool identity is not V4")
                if "V4" not in agents or "tools/bk.py" not in agents:
                    raise AcceptanceError("Package AGENTS identity is not V4")
            runtime_evidence = _check_package_runtime(archive, names, meta)
            expected = {"task": expected_task, "version": expected_version, "base": expected_baseline}
            for key, value in expected.items():
                if value is not None and meta.get(key) != value:
                    raise AcceptanceError("Package " + key + " does not match the requested identity")
            # Compare declarations, not incidental substrings in a package filename.
            version_match = re.search(r"(?m)^版本[：:]\s*(\S+)\s*$", version_text)
            if version_match is None:
                version_match = re.search(r"(?m)^基于[：:]\s*([^\s（(]+)", version_text)
            base_match = re.search(r"(?m)^基于提交[：:]\s*([0-9a-fA-F]+)\s*$", version_text)
            if base_match is None:
                base_match = re.search(r"(?m)^基于[：:][^\n]*[（(]([0-9a-fA-F]{10,64})[）)]", version_text)
            task_match = re.search(r"(?m)^任务[：:]\s*(\S+)", version_text)
            if not version_match or version_match.group(1) != str(meta["version"]):
                raise AcceptanceError("VERSION.txt disagrees with package version")
            if not base_match or not str(meta["base"]).startswith(base_match.group(1)):
                raise AcceptanceError("VERSION.txt disagrees with package baseline")
            if meta.get("task") and (not task_match or task_match.group(1) != str(meta["task"])):
                raise AcceptanceError("VERSION.txt disagrees with package task")
        return {"path": str(path), "size_bytes": path.stat().st_size, "sha256": _file_digest(path),
                "members": len(names), "metadata": meta, "valid": True,
                "runtime_verified": runtime_evidence is not None, "runtime": runtime_evidence}
    except AcceptanceError:
        raise
    except (OSError, ValueError, UnicodeError, zipfile.BadZipFile, RuntimeError, zlib.error, EOFError) as exc:
        raise AcceptanceError("ZIP integrity check failed: " + str(exc)) from exc


def _proc_identity(pid):
    try:
        fields = Path("/proc/" + str(pid) + "/stat").read_text().rsplit(")", 1)[1].split()
        return {"state": fields[0], "ppid": int(fields[1]), "start_ticks": fields[19]}
    except (OSError, ValueError, IndexError):
        return None


def _alive(record):
    current = _proc_identity(record.get("pid"))
    return bool(current and current["state"] != "Z" and current["start_ticks"] == record.get("start_ticks"))


def _ancestors():
    result = set()
    pid = os.getppid()
    while pid > 0 and pid not in result:
        result.add(pid)
        info = _proc_identity(pid)
        if not info:
            break
        pid = info["ppid"]
    return result


def _legacy_owner(path):
    """Use kernel lock ownership, not an environment marker or an open descriptor alone."""
    try:
        target = path.stat()
        expected = (os.major(target.st_dev), os.minor(target.st_dev), target.st_ino)
        for line in Path("/proc/locks").read_text().splitlines():
            fields = line.split()
            if len(fields) < 6 or "->" in fields or fields[1] != "FLOCK" or fields[3] != "WRITE":
                continue
            dev = fields[5].split(":")
            actual = (int(dev[0], 16), int(dev[1], 16), int(dev[2]))
            if actual == expected:
                return int(fields[4])
    except (OSError, ValueError, IndexError):
        pass
    return None


def _ancestor_has_fd(path, ancestors):
    try:
        target = path.stat()
    except OSError:
        return False
    for pid in ancestors:
        try:
            descriptors = list(Path("/proc/" + str(pid) + "/fd").iterdir())
        except OSError:
            continue
        for descriptor in descriptors:
            try:
                current = descriptor.stat()
                if (current.st_dev, current.st_ino) == (target.st_dev, target.st_ino):
                    return True
            except OSError:
                pass
    return False


def _queue_records(directory):
    records = []
    for path in directory.glob("*.json"):
        try:
            record = json.loads(path.read_text())
            if record.get("status") not in ("waiting", "running"):
                continue
            if not _alive(record):
                record.update(status="abandoned", finished_at=_now())
                atomic_json(path, record)
                continue
            records.append((path, record))
        except (OSError, ValueError, TypeError):
            # Malformed state must not authorize bypassing an actual live legacy flock.
            continue
    return sorted(records, key=lambda item: (item[1].get("queued_ns", 0), item[1].get("request_id", "")))


_OWNED_FDS = set()
_PROCESS_LOCKS = {}


def _inherited_lock_fd(path, ancestors):
    """Duplicate only an actually inherited flock open-file-description, proved by kernel fdinfo."""
    target = path.stat()
    expected = (os.major(target.st_dev), os.minor(target.st_dev), target.st_ino)
    try:
        descriptors = list(Path("/proc/self/fd").iterdir())
    except OSError:
        return None
    for descriptor in descriptors:
        try:
            current = descriptor.stat()
            if (current.st_dev, current.st_ino) != (target.st_dev, target.st_ino):
                continue
            details = Path("/proc/self/fdinfo/" + descriptor.name).read_text()
            match = re.search(r"FLOCK\s+\S+\s+WRITE\s+(-?\d+)\s+([0-9a-fA-F]+):([0-9a-fA-F]+):(\d+)", details)
            if not match:
                continue
            identity = (int(match[2], 16), int(match[3], 16), int(match[4]))
            holder = int(match[1])
            if identity == expected and (holder in ancestors or (holder == os.getpid() and int(descriptor.name) not in _OWNED_FDS)):
                # dup retains the same kernel flock even if the ancestor is killed.
                return os.dup(int(descriptor.name))
        except (OSError, ValueError):
            pass
    return None


_LOCAL = threading.local()


@contextlib.contextmanager
def _serial_queue(root, operation, task=None, *, poll_seconds=0.1, timeout=None):
    """FIFO plus legacy flock. Cross-process nesting requires a proven inherited lock FD."""
    try:
        import fcntl
    except ImportError as exc:
        raise AcceptanceError("The acceptance queue must run inside Linux/WSL") from exc
    common = common_repo_root(root)
    key = (os.getpid(), str(common))
    active = getattr(_LOCAL, "active", None)
    if active is None:
        active = _LOCAL.active = {}
    if key in active:
        yield dict(active[key], nested=True)
        return
    directory = common / ".bk" / "acceptance" / "queue"
    directory.mkdir(parents=True, exist_ok=True)
    legacy = common / ".bk" / "parallel" / "verify.lock"
    legacy.parent.mkdir(parents=True, exist_ok=True)
    legacy.touch(exist_ok=True)
    ancestors = _ancestors()
    guard_path = directory / ".queue.lock"
    inherited = _inherited_lock_fd(legacy, ancestors)
    owner = _legacy_owner(legacy)
    if inherited is None and (owner in ancestors or owner == os.getpid()):
        raise AcceptanceError("An ancestor owns verify.lock but this process has no proven inherited lock FD; "
                              "invoke nested operations in the same process or explicitly pass the lock FD.")
    lock = os.fdopen(inherited, "a+b") if inherited is not None else None
    acquired = False
    preowned = inherited is not None
    request_id = str(time.time_ns()) + "-" + str(os.getpid()) + "-" + uuid.uuid4().hex[:12]
    request_path = directory / (request_id + ".json")
    proc = _proc_identity(os.getpid())
    if not proc:
        if lock is not None:
            lock.close()
        raise AcceptanceError("Cannot establish queue process identity")
    record = {"request_id": request_id, "operation": str(operation), "task": task,
              "pid": os.getpid(), "start_ticks": proc["start_ticks"],
              "queued_at": _now(), "status": "waiting", "policy_version": POLICY_VERSION,
              "worktree": str(Path(root).resolve()), "queue_path": str(request_path), "wait_seconds": 0.0,
              "legacy_lock_borrowed": preowned}
    started = time.monotonic()
    try:
        with guard_path.open("a+b") as guard:
            fcntl.flock(guard.fileno(), fcntl.LOCK_EX)
            records = _queue_records(directory)
            record["queued_ns"] = time.time_ns()
            parent = next((r for _, r in records if r.get("status") == "running" and r.get("pid") in ancestors), None)
            if parent:
                record["parent_request_id"] = parent["request_id"]
            if preowned:
                # This operation already owns the legacy resource. Queuing behind its waiter would deadlock.
                record.update(status="running", started_at=_now(), preowned_resource=True, nested=bool(parent))
            atomic_json(request_path, record)
        while not preowned:
            with guard_path.open("a+b") as guard:
                fcntl.flock(guard.fileno(), fcntl.LOCK_EX)
                records = _queue_records(directory)
                if records and records[0][1]["request_id"] == request_id:
                    lock = legacy.open("a+b")
                    try:
                        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                        acquired = True
                    except BlockingIOError:
                        owner = _legacy_owner(legacy)
                        if owner in ancestors or (owner is None and _ancestor_has_fd(legacy, ancestors)):
                            raise AcceptanceError("An ancestor owns or may own verify.lock without a proven inherited FD; "
                                                  "use one queue entry or explicitly pass the lock FD.")
                        lock.close()
                        lock = None
                    if acquired:
                        record.update(status="running", started_at=_now(),
                                      wait_seconds=round(time.monotonic() - started, 6))
                        atomic_json(request_path, record)
                        break
            if timeout is not None and time.monotonic() - started >= timeout:
                raise AcceptanceError("Timed out waiting for the acceptance queue; live owners were not interrupted")
            elapsed_wait = round(time.monotonic() - started, 6)
            if elapsed_wait - record["wait_seconds"] >= 1:
                record.update(wait_seconds=elapsed_wait, updated_at=_now())
                atomic_json(request_path, record)
            time.sleep(max(0.01, poll_seconds))
        _OWNED_FDS.add(lock.fileno())
        ticket = dict(record, lock_fd=lock.fileno())
        active[key] = ticket
        yield ticket
    except BaseException as exc:
        record.update(status="interrupted" if isinstance(exc, (KeyboardInterrupt, SystemExit)) else "failed",
                      error=type(exc).__name__, finished_at=_now(),
                      wait_seconds=round(time.monotonic() - started, 6) if record["status"] == "waiting" else record["wait_seconds"])
        atomic_json(request_path, record)
        raise
    else:
        record.update(status="completed", finished_at=_now())
        atomic_json(request_path, record)
    finally:
        active.pop(key, None)
        if lock is not None:
            _OWNED_FDS.discard(lock.fileno())
            # Never LOCK_UN an inherited open-file-description shared with the parent.
            if acquired:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
            lock.close()


@contextlib.contextmanager
def serial_queue(root, operation, task=None, *, poll_seconds=0.1, timeout=None):
    """Serialize threads too; same-thread nested calls reuse the active ticket."""
    key = (os.getpid(), str(common_repo_root(root)))
    process_lock = _PROCESS_LOCKS.setdefault(key, threading.RLock())
    with process_lock:
        with _serial_queue(root, operation, task, poll_seconds=poll_seconds, timeout=timeout) as ticket:
            yield ticket

