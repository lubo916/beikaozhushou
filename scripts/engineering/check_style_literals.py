#!/usr/bin/env python3
"""样式字面量检查（docs/conventions/ui.md 规则 1）：颜色、间距、圆角、字号只用 design/tokens.json 的令牌。

扫描 apps/ 与 packages/ui/ 下的 CSS、HTML 与 TS/TSX（字符串里的 className、class 与样式值，以及 style 对象），生成物除外
（路径含 /generated/，或文件头带 spec_tool 的生成标记）。拦截：十六进制色值、非零像素字面量、颜色函数字面量（rgb()、hsl()、oklch() 等，
不含 var()）、Tailwind 默认调色板类名、style 对象里尺寸属性的数字。确属例外的行写 style-exempt: <理由>。
用法：python3 scripts/engineering/check_style_literals.py [仓库根]
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCAN_DIRS = ("apps", "packages/ui")
SKIP_DIRS = {"node_modules", "dist", "build", "generated", ".cache", "coverage"}
SUFFIXES = {".css", ".html", ".ts", ".tsx"}
EXEMPT = "style-exempt:"
GEN_MARK = "GENER" + "ATED"  # 生成标记（拆开写，避免本文件被当成生成物）

HEX_RE = re.compile(r"(?<![\w&/#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])")
PX_RE = re.compile(r"(?<![\w.-])(-?(?:\d+(?:\.\d+)?|\.\d+))px\b")
COLOR_FN_RE = re.compile(r"\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*(?!var\()[^)]*\)", re.I)
_PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"
_UTIL = "bg|text|border|border-[trblxyse]|ring|ring-offset|fill|stroke|outline|decoration|divide|from|via|to|shadow|accent|caret|placeholder"
PALETTE_RE = re.compile(rf"(?<![\w-])(?:{_UTIL})-(?:(?:{_PALETTE})-(?:50|[1-9]00|950)|black|white)(?![\w-])")
_SIZE_KEYS = (r"(?:width|height|minWidth|minHeight|maxWidth|maxHeight|margin\w*|padding\w*|top|right|bottom|left|inset\w*|gap|"
              r"rowGap|columnGap|fontSize|lineHeight|letterSpacing|borderRadius|border\w*Radius|border\w*Width|outlineWidth|"
              r"outlineOffset|flexBasis)")
STYLE_NUM_RE = re.compile(rf"\b{_SIZE_KEYS}\s*:\s*(-?\d+(?:\.\d+)?)\b")


def _nonzero(num: str) -> bool:
    try:
        return float(num) != 0
    except ValueError:
        return True


def _value_findings(text: str) -> list[str]:
    found = [f"十六进制色值 {m.group(0)}" for m in HEX_RE.finditer(text)]
    found += [f"像素字面量 {m.group(0)}" for m in PX_RE.finditer(text) if _nonzero(m.group(1))]
    found += [f"颜色函数字面量 {m.group(0)[:40]}" for m in COLOR_FN_RE.finditer(text)]
    return found


def _strip_css_comments(text: str) -> str:
    return re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)


def _iter_strings(text: str):
    """TS/TSX 的字符串字面量（含模板字符串）：(起始行, 内容)；跳过注释。"""
    i, n, line = 0, len(text), 1
    while i < n:
        c = text[i]
        if c == "\n":
            line += 1
            i += 1
        elif text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            end = n if j < 0 else j + 2
            line += text.count("\n", i, end)
            i = end
        elif c in "'\"`":
            start, j, buf = line, i + 1, []
            while j < n and text[j] != c:
                if text[j] == "\\" and j + 1 < n:
                    buf.append(text[j:j + 2])
                    j += 2
                    continue
                if text[j] == "\n":
                    if c != "`":
                        break
                    line += 1
                buf.append(text[j])
                j += 1
            yield start, "".join(buf)
            i = j + 1
        else:
            i += 1


def _strip_ts_comments(text: str) -> str:
    out, i, n = [], 0, len(text)
    while i < n:
        if text[i] in "'\"`":
            quote, j = text[i], i + 1
            while j < n:
                if text[j] == "\\":
                    j = min(j + 2, n)
                elif text[j] == quote:
                    j += 1
                    break
                else:
                    j += 1
            out.append(text[i:j])
            i = j
        elif text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            end = n if j < 0 else j + 2
            out.append("\n" * text.count("\n", i, end))
            i = end
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def check_text(rel: str, text: str) -> list[tuple[str, int, str]]:
    if GEN_MARK in text[:400]:
        return []
    lines = text.splitlines()
    exempt = {i + 1 for i, ln in enumerate(lines) if EXEMPT in ln}
    out: list[tuple[str, int, str]] = []

    def add(line: int, msg: str):
        if line not in exempt:
            out.append((rel, line, msg))

    suffix = Path(rel).suffix
    if suffix in (".css", ".html"):
        for no, ln in enumerate(_strip_css_comments(text).splitlines(), 1):
            if "url(" in ln or re.match(r"^\s*@(?:import|source|plugin|custom-variant|reference)\b", ln):
                continue
            for msg in _value_findings(ln):
                add(no, msg)
        return out
    for start, s in _iter_strings(text):
        for sub_no, part in enumerate(s.split("\n")):
            for msg in _value_findings(part):
                add(start + sub_no, msg)
            for m in PALETTE_RE.finditer(part):
                add(start + sub_no, f"Tailwind 默认调色板类 {m.group(0)}（默认调色板已清空，用登记的令牌类）")
    code = _strip_ts_comments(text)
    for m in re.finditer(r"style=\{\{(.*?)\}\}", code, flags=re.S):
        body_start = code.count("\n", 0, m.start(1)) + 1
        for k in STYLE_NUM_RE.finditer(m.group(1)):
            if _nonzero(k.group(1)):
                add(body_start + m.group(1).count("\n", 0, k.start()), f"style 对象的尺寸数字 {k.group(0)}（数字按像素解释）")
    return out


def scan(root: Path = ROOT) -> list[tuple[str, int, str]]:
    out = []
    for base in SCAN_DIRS:
        d = root / base
        if not d.exists():
            continue
        for p in sorted(d.rglob("*")):
            parts = set(p.relative_to(root).parts)
            if not p.is_file() or p.suffix not in SUFFIXES or parts & SKIP_DIRS:
                continue
            out += check_text(p.relative_to(root).as_posix(), p.read_text(encoding="utf-8"))
    return out


def main(argv: list[str]) -> int:
    root = Path(argv[1]).resolve() if len(argv) > 1 else ROOT
    found = scan(root)
    for rel, line, msg in found:
        print(f"✗ {rel}:{line}：{msg}；改用 design/tokens.json 的令牌（docs/conventions/ui.md 规则 1），确属例外在该行写 {EXEMPT} <理由>")
    print(f"样式字面量检查：{len(found)} 处问题。" if found else "样式字面量检查：通过。")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
