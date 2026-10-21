// 页面画廊比对（F06）：把 .bk/gallery/<时间>/ 这一次的截图与上一次逐点比对；画面变化超过阈值的页面写进 .bk/gallery/changes.json，
// 并生成 .bk/gallery/index.html（上一次、这一次、差异三栏并排）。截图由 tests/e2e/gallery.spec.ts 拍（pnpm gallery），拍完自动调用本工具。
// 结果按每张截图汇总：没截到、旧图或新图读不了（没法比对）逐张写进 changes.json 的 problems，并让命令失败；画面变化只写进清单供人复核。
// 只用 Node 自带模块（PNG 的解码与编码用 zlib），不新增依赖。回归测试在 tests/tooling/gallery.test.ts（pnpm test 会跑）。
// 用法：node tools/gallery.mjs [--run <时间目录名>] [--threshold 0.001] [--keep 20] [--root .bk/gallery]
//   --run        要比对的这一次，默认最新一次；和它比的“上一次”是名字排在它前面的最近一次
//   --threshold  变化的像素占整张图的比例超过多少算“有变化”，默认 0.001（千分之一）；也可用环境变量 BK_GALLERY_THRESHOLD
//   --keep       只保留最近几次截图，更早的整次目录删掉；默认 20，0 表示全部保留
// 退出码：0 每张截图都截到并比对完（有画面变化也是 0）；2 有截图没截到或没法比对（changes.json 与 index.html 照常写出）；1 参数不对或比对没法进行
import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { crc32, deflateSync, inflateSync } from "node:zlib";

export const DEFAULTS = {
  /** 变化像素占比超过它，这一页算“有变化”。 */
  threshold: 0.001,
  /** 同一个像素四个通道（红绿蓝与透明度）里任一个相差超过它才算这个像素变了，滤掉肉眼看不出的细微差别。 */
  tolerance: 16,
  /** 保留最近几次截图。 */
  keep: 20,
};

const MANIFEST = "manifest.json";
const CHANGES = "changes.json";
const INDEX = "index.html";
const APP_NAMES = { learner: "学员端", org: "机构端", admin: "平台后台" };

// ───────── PNG ─────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** 颜色类型 → 每像素几个通道：0 灰度、2 RGB、4 灰度加透明度、6 RGBA。 */
const CHANNELS = new Map([
  [0, 1],
  [2, 3],
  [4, 2],
  [6, 4],
]);

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** 还原一行的滤波（PNG 规范的五种滤波）。line 是这一行的原始字节，previous 是已还原的上一行（第一行为 null）。 */
function unfilterLine(filter, line, previous, channels) {
  const out = Buffer.alloc(line.length);
  for (let x = 0; x < line.length; x += 1) {
    const left = x >= channels ? out[x - channels] : 0;
    const up = previous === null ? 0 : previous[x];
    const upLeft = previous === null || x < channels ? 0 : previous[x - channels];
    let base = 0;
    if (filter === 1) base = left;
    else if (filter === 2) base = up;
    else if (filter === 3) base = (left + up) >> 1;
    else if (filter === 4) base = paeth(left, up, upLeft);
    else if (filter !== 0) throw new Error(`PNG 里有不认识的滤波类型 ${filter}`);
    out[x] = (line[x] + base) & 0xff;
  }
  return out;
}

function readHeader(body) {
  return { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], color: body[9], interlace: body[12] };
}

/** 读 PNG（8 位、不隔行；灰度、RGB、带透明度的都认），返回 { width, height, data }，data 是 RGBA 字节。 */
export function decodePng(buffer) {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("不是 PNG 文件");
  }
  let header = null;
  const parts = [];
  for (let offset = PNG_SIGNATURE.length; offset + 8 <= buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === "IHDR") header = readHeader(body);
    else if (type === "IDAT") parts.push(body);
    else if (type === "IEND") break;
  }
  if (header === null) throw new Error("PNG 缺少文件头（IHDR）");
  const channels = CHANNELS.get(header.color);
  if (header.depth !== 8 || channels === undefined || header.interlace !== 0) {
    throw new Error(`不支持的 PNG：位深 ${header.depth}、颜色类型 ${header.color}、隔行 ${header.interlace}`);
  }
  const { width, height } = header;
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error("PNG 图像数据不完整");
  const data = Buffer.alloc(width * height * 4);
  let previous = null;
  for (let y = 0; y < height; y += 1) {
    const start = y * (stride + 1);
    const line = unfilterLine(raw[start], raw.subarray(start + 1, start + 1 + stride), previous, channels);
    for (let x = 0; x < width; x += 1) {
      const from = x * channels;
      const to = (y * width + x) * 4;
      const gray = channels < 3;
      data[to] = line[from];
      data[to + 1] = gray ? line[from] : line[from + 1];
      data[to + 2] = gray ? line[from] : line[from + 2];
      data[to + 3] = channels === 2 ? line[from + 1] : channels === 4 ? line[from + 3] : 255;
    }
    previous = line;
  }
  return { width, height, data };
}

function pngChunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** 写 PNG（RGBA，8 位，不滤波）。 */
export function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

// ───────── 比对 ─────────

/**
 * 逐点比对两张图：同一位置任一通道相差超过 tolerance 的像素算“变了”；尺寸不同时，只在一张图里有的部分都算变了。
 * 返回 { width, height, changed, ratio, diff }：ratio 是变了的像素占比，diff 是差异图（变了的标红，其余是淡化的这一次）。
 */
export function compareImages(before, after, tolerance = DEFAULTS.tolerance) {
  const width = Math.max(before.width, after.width);
  const height = Math.max(before.height, after.height);
  const data = Buffer.alloc(width * height * 4);
  let changed = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inBefore = x < before.width && y < before.height;
      const inAfter = x < after.width && y < after.height;
      const i = (y * before.width + x) * 4;
      const j = (y * after.width + x) * 4;
      let differs = !inBefore || !inAfter;
      for (let k = 0; k < 4 && !differs; k += 1) differs = Math.abs(before.data[i + k] - after.data[j + k]) > tolerance;
      const to = (y * width + x) * 4;
      if (differs) {
        changed += 1;
        data[to] = 220;
        data[to + 1] = 38;
        data[to + 2] = 38;
      } else {
        const gray = 0.3 * after.data[j] + 0.59 * after.data[j + 1] + 0.11 * after.data[j + 2];
        const faded = Math.round(255 - (255 - gray) * 0.25);
        data[to] = faded;
        data[to + 1] = faded;
        data[to + 2] = faded;
      }
      data[to + 3] = 255;
    }
  }
  const total = width * height;
  return { width, height, changed, ratio: total === 0 ? 0 : changed / total, diff: { width, height, data } };
}

// ───────── 读写一次截图 ─────────

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** 画廊目录里拍完了的各次截图（有 manifest.json 的子目录），按名字（即时间）从早到晚。 */
export function listRuns(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((item) => item.isDirectory() && existsSync(join(root, item.name, MANIFEST)))
    .map((item) => item.name)
    .sort();
}

function shotKey(page, width) {
  return `${page.app}/${page.id}/${width}`;
}

function pageTitle(page) {
  return `${page.id} ${page.name}`;
}

/** 一张截图与上一次比：changed、same、new（上一次没有）、failed（这一次没截到）、error（图读不了）。 */
function compareShot({ root, run, previous, shot, before, tolerance, threshold, page }) {
  const entry = { width: shot.width, status: "new", ratio: null, before: null, after: null, diff: null, error: null };
  if (shot.file === undefined) return { ...entry, status: "failed", error: shot.error ?? "没有截图" };
  entry.after = `${run}/${shot.file}`;
  if (before === undefined || before.file === undefined || previous === null) return entry;
  entry.before = `${previous}/${before.file}`;
  try {
    const older = decodePng(readFileSync(join(root, entry.before)));
    const newer = decodePng(readFileSync(join(root, entry.after)));
    const result = compareImages(older, newer, tolerance);
    entry.ratio = result.ratio;
    entry.status = result.ratio > threshold ? "changed" : "same";
    if (result.changed > 0) {
      entry.diff = `${run}/diff/${page.app}/${page.id}-${shot.width}.png`;
      writeText(join(root, entry.diff), encodePng(result.diff));
    }
  } catch (error) {
    entry.status = "error";
    entry.error = error instanceof Error ? error.message : String(error);
  }
  return entry;
}

/** 截图结果里算“出了问题”的：这一次没截到（failed）、图读不了或没法比对（error）。画面有变化（changed）不算问题，只供人复核。 */
const PROBLEM_STATUSES = new Set(["failed", "error"]);
/** 一页的总体状态取它各张截图里最要紧的一种，index.html 按它分组：出了问题的排最前，其次有变化、新增、没变。 */
const PAGE_ORDER = ["failed", "error", "changed", "new", "same"];
/** 有截图没截到或没法比对时命令行的退出码（参数不对、比对没法进行是 1）。 */
const EXIT_PROBLEMS = 2;

function pageStatus(shots) {
  return PAGE_ORDER.find((status) => shots.some((shot) => shot.status === status)) ?? "same";
}

/** 清单里登记了这一档宽度、这一页却没有这一档的截图记录：也算没截到。 */
function missingShot(width) {
  return { width, status: "failed", ratio: null, before: null, after: null, diff: null, error: "这一档没有截图记录" };
}

/** problems 里的一条：哪一页、哪一档、什么问题。 */
function problemOf(page, shot) {
  const error = shot.error ?? STATUS_NAMES[shot.status];
  return { app: page.app, id: page.id, name: page.name, width: shot.width, status: shot.status, error };
}

/**
 * 比对 run 与它前面最近的一次，写出 changes.json（画廊根目录一份、这一次目录里一份）与 index.html；返回 changes 的内容。
 * 结果按每张截图汇总：changed 是有一档画面变了的页面（供人复核），failed 是有一档没截到或没法比对的页面，problems 逐张列出这些问题；
 * 同一页一档有变化、另一档出了问题时两份清单里都有它，问题不会被“有变化”盖住。
 */
export function compareRuns({ root, run, threshold = DEFAULTS.threshold, tolerance = DEFAULTS.tolerance, keep = DEFAULTS.keep }) {
  const runs = listRuns(root);
  const current = run ?? runs.at(-1);
  if (current === undefined) throw new Error(`${root} 里还没有截图：先运行 pnpm gallery`);
  if (!runs.includes(current)) throw new Error(`${join(root, current)} 不是拍完的一次截图（缺 ${MANIFEST}）`);
  const manifest = readJson(join(root, current, MANIFEST));
  const widths = manifest.widths ?? [];
  const previous = runs.filter((name) => name < current).at(-1) ?? null;
  const previousPages = previous === null ? [] : readJson(join(root, previous, MANIFEST)).pages;
  const earlier = new Map();
  for (const page of previousPages) {
    for (const shot of page.shots) earlier.set(shotKey(page, shot.width), shot);
  }
  const pages = manifest.pages.map((page) => {
    const shots = page.shots.map((shot) => {
      const before = earlier.get(shotKey(page, shot.width));
      return compareShot({ root, run: current, previous, shot, before, tolerance, threshold, page });
    });
    for (const width of widths) {
      if (!page.shots.some((shot) => shot.width === width)) shots.push(missingShot(width));
    }
    return { app: page.app, id: page.id, name: page.name, path: page.path, status: pageStatus(shots), shots };
  });
  const pageKey = (page) => `${page.app}/${page.id}`;
  const seen = new Set(manifest.pages.map(pageKey));
  const known = new Set(previousPages.map(pageKey));
  const having = (matches) => pages.filter((page) => page.shots.some(matches)).map(pageTitle);
  const changes = {
    version: 2,
    generated: new Date().toISOString(),
    run: current,
    previous,
    browser: manifest.browser ?? null,
    threshold,
    tolerance,
    widths,
    changed: having((shot) => shot.status === "changed"),
    added: previous === null ? [] : pages.filter((page) => !known.has(pageKey(page))).map(pageTitle),
    removed: previousPages.filter((page) => !seen.has(pageKey(page))).map(pageTitle),
    failed: having((shot) => PROBLEM_STATUSES.has(shot.status)),
    problems: pages.flatMap((page) => page.shots.filter((shot) => PROBLEM_STATUSES.has(shot.status)).map((shot) => problemOf(page, shot))),
    pages,
  };
  const json = `${JSON.stringify(changes, null, 2)}\n`;
  writeText(join(root, current, CHANGES), json);
  writeText(join(root, CHANGES), json);
  writeText(join(root, INDEX), renderIndex(changes));
  changes.pruned = pruneRuns(root, keep, [current, ...(previous === null ? [] : [previous])]);
  return changes;
}

/** 只留最近 keep 次截图（这一次与上一次总会留下）；返回删掉的目录名。 */
export function pruneRuns(root, keep, protect) {
  if (!(keep > 0)) return [];
  const runs = listRuns(root);
  const excess = runs.slice(0, Math.max(0, runs.length - keep)).filter((name) => !protect.includes(name));
  for (const name of excess) rmSync(join(root, name), { recursive: true, force: true });
  return excess;
}

// ───────── index.html ─────────

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function percent(ratio) {
  if (ratio === null) return "";
  if (ratio > 0 && ratio < 0.0001) return "不到 0.01%";
  return `${(ratio * 100).toFixed(2)}%`;
}

const STATUS_NAMES = { changed: "有变化", same: "没变", new: "新增", failed: "没能截图", error: "没法比对" };

function picture(src, caption) {
  if (src === null) return `<figure class="empty"><div>（没有）</div><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
  const href = escapeHtml(src);
  return `<figure><a href="${href}"><img loading="lazy" src="${href}" alt="${escapeHtml(caption)}"></a><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
}

function renderShot(shot) {
  const label = `${shot.width} 宽 · ${STATUS_NAMES[shot.status]}${shot.ratio === null ? "" : ` · 变化 ${percent(shot.ratio)}`}`;
  const problem = shot.error === null ? "" : `<p class="problem">${escapeHtml(shot.error)}</p>`;
  const pictures = [picture(shot.before, "上一次"), picture(shot.after, "这一次"), picture(shot.diff, "差异（红色是变了的地方）")];
  return `<div class="shot s-${shot.status}"><h3>${escapeHtml(label)}</h3>${problem}<div class="row">${pictures.join("")}</div></div>`;
}

function renderPage(page) {
  const where = `${APP_NAMES[page.app] ?? page.app} · ${page.path}`;
  const shots = page.shots.map(renderShot).join("");
  return `<section class="page p-${page.status}" id="${escapeHtml(`${page.app}-${page.id}`)}"><h2>${escapeHtml(pageTitle(page))} <small>${escapeHtml(where)}</small></h2>${shots}</section>`;
}

/** 最上面的问题清单：哪一页哪一档没截到或没法比对（点页名跳到那一页）。 */
function renderProblems(problems) {
  if (problems.length === 0) return "";
  const items = problems.map((item) => {
    const anchor = escapeHtml(`${item.app}-${item.id}`);
    return `<li><a href="#${anchor}">${escapeHtml(`${item.id} ${item.name}`)}</a> ${item.width} 宽 · ${STATUS_NAMES[item.status]}：${escapeHtml(item.error)}</li>`;
  });
  return `<div class="problems"><p>有 ${problems.length} 张截图没能截到或没法和上一次比对，这一次的检查因此不通过：</p><ul>${items.join("")}</ul></div>`;
}

function renderIndex(changes) {
  const groups = PAGE_ORDER.map((status) => ({ status, pages: changes.pages.filter((page) => page.status === status) }));
  const counts = groups.map(({ status, pages }) => `${STATUS_NAMES[status]} ${pages.length} 页`).join(" · ");
  const previous = changes.previous === null ? "没有（这是第一次，只有这一次的截图）" : changes.previous;
  const removed = changes.removed.length === 0 ? "" : `<p>上一次有、这一次没有的页面：${escapeHtml(changes.removed.join("、"))}</p>`;
  const body = groups
    .filter(({ pages }) => pages.length > 0)
    .map(({ status, pages }) => {
      const sections = pages.map(renderPage).join("\n");
      const title = `${STATUS_NAMES[status]}（${pages.length} 页）`;
      // 没变的页面默认收起
      if (status === "same") return `<details><summary>${title}</summary>${sections}</details>`;
      return `<h2 class="group">${title}</h2>${sections}`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>页面画廊 · ${escapeHtml(changes.run)}</title>
<style>
:root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.6; }
body { margin: 0 auto; max-width: 1600px; padding: 16px 24px 48px; }
small { color: GrayText; font-weight: normal; }
.summary { padding: 12px 16px; border: 1px solid GrayText; border-radius: 8px; }
.page { margin: 24px 0; padding-top: 8px; border-top: 1px solid GrayText; }
.shot h3 { font-size: 14px; margin: 12px 0 4px; }
.s-changed h3, .s-failed h3, .s-error h3 { color: #b23e2e; }
.row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }
figure { margin: 0; }
figure img { display: block; max-width: 100%; height: auto; border: 1px solid GrayText; }
figure.empty div { padding: 24px; text-align: center; color: GrayText; border: 1px dashed GrayText; }
figcaption { font-size: 12px; color: GrayText; }
.problem { color: #b23e2e; font-size: 13px; white-space: pre-wrap; }
.problems { color: #b23e2e; }
details { margin: 24px 0; }
summary { cursor: pointer; font-weight: bold; font-size: 18px; }
</style>
</head>
<body>
<h1>页面画廊</h1>
<div class="summary">
<p>这一次：${escapeHtml(changes.run)}${changes.browser === null ? "" : `（${escapeHtml(changes.browser)}）`}；上一次：${escapeHtml(previous)}</p>
<p>${escapeHtml(counts)}。变化的像素超过整张图的 ${percent(changes.threshold)} 算“有变化”；红色标出的是变了的地方。</p>
${removed}
${renderProblems(changes.problems)}
</div>
${body}
</body>
</html>
`;
}

// ───────── 命令行 ─────────

function parseNumber(name, text, valid) {
  const value = Number(text);
  if (text === undefined || text === "" || !Number.isFinite(value) || !valid(value)) throw new Error(`${name} 的取值不对：${text}`);
  return value;
}

export function parseArgs(argv, env = {}) {
  const options = { root: resolve(".bk", "gallery"), run: undefined, threshold: DEFAULTS.threshold, keep: DEFAULTS.keep };
  if (env.BK_GALLERY_THRESHOLD !== undefined && env.BK_GALLERY_THRESHOLD !== "") {
    options.threshold = parseNumber("BK_GALLERY_THRESHOLD", env.BK_GALLERY_THRESHOLD, (value) => value >= 0 && value < 1);
  }
  for (let i = 0; i < argv.length; i += 2) {
    const [name, value] = [argv[i], argv[i + 1]];
    if (value === undefined) throw new Error(`${name} 后面缺取值`);
    if (name === "--root") options.root = resolve(value);
    else if (name === "--run") options.run = value;
    else if (name === "--threshold") options.threshold = parseNumber(name, value, (number) => number >= 0 && number < 1);
    else if (name === "--keep") options.keep = parseNumber(name, value, (number) => Number.isInteger(number) && number >= 0);
    else throw new Error(`不认识的参数：${name}`);
  }
  return options;
}

function summary(changes, root) {
  const previous = changes.previous === null ? "这是第一次截图，没有可比的上一次" : `和上一次 ${changes.previous} 比`;
  const lines = [
    `页面画廊：这一次 ${changes.run}，${previous}。`,
    `有变化 ${changes.changed.length} 页${changes.changed.length === 0 ? "" : `：${changes.changed.join("、")}`}`,
  ];
  if (changes.added.length > 0) lines.push(`新增 ${changes.added.length} 页：${changes.added.join("、")}`);
  if (changes.removed.length > 0) lines.push(`上一次有、这一次没有 ${changes.removed.length} 页：${changes.removed.join("、")}`);
  if (changes.problems.length > 0) {
    const list = changes.problems.map((item) => `${item.id} ${item.name} ${item.width} 宽（${STATUS_NAMES[item.status]}：${item.error}）`);
    lines.push(`没能截图或没法比对 ${changes.problems.length} 张：${list.join("、")}`);
  }
  if (changes.pruned.length > 0) lines.push(`按保留次数删掉了更早的 ${changes.pruned.length} 次截图：${changes.pruned.join("、")}`);
  lines.push(`前后对照：${join(root, INDEX)}`);
  return `${lines.join("\n")}\n`;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2), process.env);
    const changes = compareRuns(options);
    process.stdout.write(summary(changes, options.root));
    if (changes.problems.length > 0) {
      const message = `页面画廊比对不通过：${changes.problems.length} 张截图没能截到或没法和上一次比对（逐张见上面与 changes.json 的 problems）\n`;
      process.stderr.write(message);
      process.exitCode = EXIT_PROBLEMS;
    }
  } catch (error) {
    process.stderr.write(`页面画廊比对没完成：${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
