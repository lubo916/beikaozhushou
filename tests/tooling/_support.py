"""tests/tooling 的公共辅助：定位仓库根、导入 scripts/engineering 下的脚本、构造临时仓库。"""
from __future__ import annotations

import importlib.util
import shutil
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_engineering(name: str):
    path = ROOT / "scripts" / "engineering" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"engineering_{name}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def temp_repo(test, copies=()) -> Path:
    """在系统临时目录建一个最小仓库，复制 copies 中列出的仓库相对路径（文件或目录）；测试结束自动删除。"""
    tmp = Path(tempfile.mkdtemp(prefix="exam-prep-tooling-"))
    test.addCleanup(shutil.rmtree, tmp, True)
    for rel in copies:
        src, dst = ROOT / rel, tmp / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir():
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
    return tmp


def write(root: Path, rel: str, text: str) -> Path:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p
