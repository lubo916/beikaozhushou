// 精简的 YAML 解析器：只认仓库登记文件（contracts/、design/screens/、docs/product/）用到的写法——块映射、块序列、
// 行内 [] 与 {}、注释、单双引号、null、布尔与数字。锚点、多行文本块、制表符缩进、重复键等一律报错，不静默读错。
// 数字保留原文（Num）：生成物据此区分整数与小数（参数表里 1 与 1.0 不同）。按 YAML 1.2 读：off、yes 这类是文字，不是布尔。
// 不引入第三方库，没装依赖也能跑。

const INT_RE = /^[-+]?\d+$/;
const FLOAT_RE = /^[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?$/;
const NULLS = new Set(["", "~", "null", "Null", "NULL"]);
const TRUES = new Set(["true", "True", "TRUE"]);
const FALSES = new Set(["false", "False", "FALSE"]);
const UNSUPPORTED_START = new Set(["&", "*", "!", "|", ">", "%", "@", "`"]);
const HEX_WIDTH: Record<string, number> = { x: 2, u: 4, U: 8 };

/** YAML 里的数字：raw 是原文，integer 表示写成了整数。 */
export class Num {
  readonly raw: string;
  readonly value: number;
  readonly integer: boolean;

  constructor(raw: string) {
    this.raw = raw;
    this.value = Number(raw);
    this.integer = INT_RE.test(raw);
  }
}

export type YamlValue = string | boolean | null | Num | YamlValue[] | { [key: string]: YamlValue };

interface Line {
  readonly indent: number;
  readonly text: string;
  readonly no: number;
}

interface State {
  readonly file: string;
  readonly lines: Line[];
  i: number;
}

interface Cursor {
  readonly s: string;
  i: number;
}

function fail(file: string, no: number, message: string): never {
  throw new Error(`${file} 第 ${no} 行：${message}`);
}

/** 去掉注释：# 在行首或前面是空白、且不在引号里时才是注释。 */
function stripComment(raw: string): string {
  let quote = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote) {
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || raw[i - 1] === " ")) return raw.slice(0, i);
  }
  return raw;
}

/** 引号与括号之外的 [ { 减 ] } 的差，用来把跨行的行内列表拼成一行。 */
function flowDepth(text: string): number {
  let depth = 0;
  let quote = "";
  for (const c of text) {
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
  }
  return depth;
}

function toLines(text: string, file: string): Line[] {
  const raws = text.replace(/\r\n?/g, "\n").split("\n");
  const lines: Line[] = [];
  for (let i = 0; i < raws.length; i++) {
    const raw = raws[i] ?? "";
    const no = i + 1;
    const lead = /^[ \t]*/.exec(raw)?.[0] ?? "";
    if (lead.includes("\t")) fail(file, no, "缩进里有制表符，只能用空格");
    let content = stripComment(raw).trimEnd();
    if (content.trim() === "") continue;
    if (/^(?:---|\.\.\.)(?:\s|$)/.test(content.trim())) fail(file, no, "不支持多文档标记 --- 或 ...");
    while (flowDepth(content) > 0 && i + 1 < raws.length) {
      i++;
      content = `${content} ${stripComment(raws[i] ?? "").trim()}`;
    }
    lines.push({ indent: lead.length, text: content.slice(lead.length), no });
  }
  return lines;
}

function isSeqItem(text: string): boolean {
  return text === "-" || text.startsWith("- ");
}

/** “键: 值”里冒号的位置（冒号后面是空格或行尾，且不在引号、括号里）；不是键值行时为 -1。 */
function findMapColon(text: string): number {
  if (text.startsWith("[") || text.startsWith("{")) return -1;
  let quote = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    else if (c === ":" && depth === 0 && (i + 1 === text.length || text[i + 1] === " ")) return i;
  }
  return -1;
}

function resolvePlain(raw: string): YamlValue {
  if (NULLS.has(raw)) return null;
  if (TRUES.has(raw)) return true;
  if (FALSES.has(raw)) return false;
  if (INT_RE.test(raw) || FLOAT_RE.test(raw)) return new Num(raw);
  return raw;
}

function skipSpaces(cur: Cursor): void {
  while (cur.s[cur.i] === " ") cur.i++;
}

function quoted(cur: Cursor, file: string, no: number): string {
  const q = cur.s[cur.i];
  let out = "";
  cur.i++;
  while (cur.i < cur.s.length) {
    const c = cur.s[cur.i] ?? "";
    cur.i++;
    if (q === "'" && c === "'") {
      if (cur.s[cur.i] !== "'") return out;
      out += "'";
      cur.i++;
    } else if (q === '"' && c === '"') return out;
    else if (q === '"' && c === "\\") out += escape(cur, file, no);
    else out += c;
  }
  return fail(file, no, "引号没有闭合");
}

function escape(cur: Cursor, file: string, no: number): string {
  const c = cur.s[cur.i] ?? "";
  cur.i++;
  const simple: Record<string, string> = { n: "\n", t: "\t", r: "\r", "0": "\0", '"': '"', "\\": "\\", "/": "/", " ": " " };
  if (c in simple) return simple[c] ?? "";
  const width = HEX_WIDTH[c] ?? 0;
  const hex = cur.s.slice(cur.i, cur.i + width);
  if (!width || !/^[0-9a-fA-F]+$/.test(hex) || hex.length !== width) fail(file, no, `不支持的转义 \\${c}`);
  cur.i += width;
  return String.fromCodePoint(parseInt(hex, 16));
}

function plainUntil(cur: Cursor, inFlow: boolean): string {
  const start = cur.i;
  while (cur.i < cur.s.length) {
    const c = cur.s[cur.i] ?? "";
    const next = cur.s[cur.i + 1] ?? "";
    if (inFlow && (c === "," || c === "]" || c === "}")) break;
    if (inFlow && c === ":" && (next === "" || next === " " || next === "," || next === "]" || next === "}")) break;
    cur.i++;
  }
  return cur.s.slice(start, cur.i).trim();
}

function flowValue(cur: Cursor, inFlow: boolean, file: string, no: number): YamlValue {
  skipSpaces(cur);
  const c = cur.s[cur.i] ?? "";
  if (c === "[") return flowSeq(cur, file, no);
  if (c === "{") return flowMap(cur, file, no);
  if (c === '"' || c === "'") return quoted(cur, file, no);
  if (UNSUPPORTED_START.has(c)) fail(file, no, `不支持以 ${c} 开头的写法（锚点、标签、多行文本块等）`);
  return resolvePlain(plainUntil(cur, inFlow));
}

function flowSeq(cur: Cursor, file: string, no: number): YamlValue[] {
  const items: YamlValue[] = [];
  cur.i++;
  for (;;) {
    skipSpaces(cur);
    if (cur.s[cur.i] === "]") break;
    items.push(flowValue(cur, true, file, no));
    skipSpaces(cur);
    if (cur.s[cur.i] === ",") cur.i++;
    else if (cur.s[cur.i] !== "]") fail(file, no, "行内列表缺少 , 或 ]");
  }
  cur.i++;
  return items;
}

function flowMap(cur: Cursor, file: string, no: number): { [key: string]: YamlValue } {
  const out: { [key: string]: YamlValue } = {};
  cur.i++;
  for (;;) {
    skipSpaces(cur);
    if (cur.s[cur.i] === "}") break;
    const c = cur.s[cur.i] ?? "";
    const key = c === '"' || c === "'" ? quoted(cur, file, no) : plainUntil(cur, true);
    skipSpaces(cur);
    if (cur.s[cur.i] !== ":") fail(file, no, `行内映射的键 ${key} 后面缺少冒号`);
    cur.i++;
    skipSpaces(cur);
    const end = cur.s[cur.i];
    const value = end === "," || end === "}" ? null : flowValue(cur, true, file, no);
    if (Object.hasOwn(out, key)) fail(file, no, `重复的键 ${key}`);
    out[key] = value;
    skipSpaces(cur);
    if (cur.s[cur.i] === ",") cur.i++;
    else if (cur.s[cur.i] !== "}") fail(file, no, "行内映射缺少 , 或 }");
  }
  cur.i++;
  return out;
}

/** 解析一行里冒号后或 “- ” 后的值；普通文字可以接续到后面缩进更深的行。 */
function inlineValue(st: State, text: string, line: Line, indent: number): YamlValue {
  const cur: Cursor = { s: text, i: 0 };
  const value = flowValue(cur, false, st.file, line.no);
  skipSpaces(cur);
  if (cur.i !== text.length) fail(st.file, line.no, `多余的内容：${text.slice(cur.i)}`);
  st.i++;
  const parts: string[] = [];
  while (st.i < st.lines.length && (st.lines[st.i]?.indent ?? 0) > indent) {
    const next = st.lines[st.i] as Line;
    if (typeof value !== "string" || /^["']/.test(text) || isSeqItem(next.text) || findMapColon(next.text) >= 0) {
      fail(st.file, next.no, "缩进不对");
    }
    parts.push(next.text);
    st.i++;
  }
  return parts.length ? [text, ...parts].join(" ") : value;
}

function parseKey(raw: string, st: State, line: Line): string {
  const text = raw.trim();
  if (text.startsWith('"') || text.startsWith("'")) {
    const cur: Cursor = { s: text, i: 0 };
    const key = quoted(cur, st.file, line.no);
    if (cur.i !== text.length) fail(st.file, line.no, `键 ${text} 写法不对`);
    return key;
  }
  if (text === "" || UNSUPPORTED_START.has(text[0] ?? "") || text.startsWith("? ")) fail(st.file, line.no, `不支持的键写法：${text}`);
  return text;
}

function parseBlock(st: State, indent: number): YamlValue {
  const line = st.lines[st.i] as Line;
  return isSeqItem(line.text) ? parseSeq(st, indent) : parseMap(st, indent);
}

function parseSeq(st: State, indent: number): YamlValue[] {
  const items: YamlValue[] = [];
  while (st.i < st.lines.length) {
    const line = st.lines[st.i] as Line;
    if (line.indent < indent || !isSeqItem(line.text)) break;
    if (line.indent > indent) fail(st.file, line.no, "缩进不对");
    const rest = line.text === "-" ? "" : line.text.slice(2);
    const content = rest.trimStart();
    const contentIndent = indent + 2 + rest.length - content.length;
    if (content === "") {
      st.i++;
      const next = st.lines[st.i];
      items.push(next && next.indent > indent ? parseBlock(st, next.indent) : null);
    } else if (isSeqItem(content) || findMapColon(content) >= 0) {
      st.lines[st.i] = { indent: contentIndent, text: content, no: line.no };
      items.push(parseBlock(st, contentIndent));
    } else {
      items.push(inlineValue(st, content, line, indent));
    }
  }
  return items;
}

function parseMap(st: State, indent: number): { [key: string]: YamlValue } {
  const out: { [key: string]: YamlValue } = {};
  while (st.i < st.lines.length) {
    const line = st.lines[st.i] as Line;
    if (line.indent < indent || isSeqItem(line.text)) break;
    if (line.indent > indent) fail(st.file, line.no, "缩进不对");
    const colon = findMapColon(line.text);
    if (colon < 0) fail(st.file, line.no, `这一行不是“键: 值”：${line.text}`);
    const key = parseKey(line.text.slice(0, colon), st, line);
    if (Object.hasOwn(out, key)) fail(st.file, line.no, `重复的键 ${key}`);
    const rest = line.text.slice(colon + 1).trim();
    if (rest !== "") {
      out[key] = inlineValue(st, rest, line, indent);
      continue;
    }
    st.i++;
    const next = st.lines[st.i];
    if (next && next.indent > indent) out[key] = parseBlock(st, next.indent);
    else if (next && next.indent === indent && isSeqItem(next.text)) out[key] = parseSeq(st, indent);
    else out[key] = null;
  }
  return out;
}

/** 解析 YAML 文本；file 只用于报错信息。 */
export function parseYaml(text: string, file = "<yaml>"): YamlValue {
  const st: State = { file, lines: toLines(text, file), i: 0 };
  const first = st.lines[0];
  if (!first) return null;
  const inline = !isSeqItem(first.text) && findMapColon(first.text) < 0;
  const value = inline ? inlineValue(st, first.text, first, -1) : parseBlock(st, first.indent);
  const extra = st.lines[st.i];
  if (extra) fail(file, extra.no, "缩进不对或多余的内容");
  return value;
}

/** 把 Num 换成普通数字（比对、测试与只读数据的地方用）。 */
export function plain(value: YamlValue): unknown {
  if (value instanceof Num) return value.value;
  if (Array.isArray(value)) return value.map(plain);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}
