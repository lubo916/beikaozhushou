// 页面画廊比对工具 tools/gallery.mjs 的回归测试（F06 第 2 轮，按第 1 轮收包复核的反例补）：照 pnpm gallery 的用法直接跑命令行，核对退出码与 changes.json。
// 截图没截到、旧图损坏没法比，都必须让命令失败并逐张写进清单，不能被同一页另一档的“有变化”盖住；单纯的画面变化只写进清单供人复核，不算失败。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TOOL = join(ROOT, "tools", "gallery.mjs");
const WIDTHS = [375, 1280];
/** 命令行的退出码：0 每张截图都比对完（有画面变化也是 0），2 有截图没截到或没法比对。 */
const EXIT_OK = 0;
const EXIT_PROBLEMS = 2;
/** 两次截图的目录名：按时间排，后一次和前一次比。 */
const FIRST = "2026-10-21_09-00-00";
const SECOND = "2026-10-21_10-00-00";
const PAGE = "S10 知识点主页";

type Rgba = readonly [number, number, number, number];
const BLUE: Rgba = [46, 74, 142, 255];
const RED: Rgba = [178, 62, 46, 255];
const BROKEN = Buffer.from("这不是 PNG 文件");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface ShotResult {
  readonly width: number;
  readonly status: string;
  readonly error: string | null;
  readonly diff: string | null;
}

interface Problem {
  readonly width: number;
  readonly status: string;
  readonly error: string;
}

interface Changes {
  readonly previous: string | null;
  readonly changed: readonly string[];
  readonly added: readonly string[];
  readonly failed: readonly string[];
  readonly problems: readonly Problem[];
  readonly pages: readonly { readonly status: string; readonly shots: readonly ShotResult[] }[];
}

/** 一次截图里 S10 的一张：有图，或没截到（写明原因）。 */
type Shot = { readonly width: number; readonly bytes: Buffer } | { readonly width: number; readonly error: string };

function pngChunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** 一张 2×2 的纯色 PNG（RGBA、8 位、不滤波）。 */
function png(color: Rgba): Buffer {
  const side = 2;
  const stride = side * 4 + 1;
  const raw = Buffer.alloc(stride * side);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) raw.set(color, y * stride + 1 + x * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** 一个空的画廊目录（测试完删掉）。 */
function galleryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "bk-gallery-"));
  roots.push(root);
  return root;
}

/** 写一次截图：S10 一页，各档的图或没截到的原因，加上 manifest.json（结构与 tests/e2e/gallery.spec.ts 写的一致）。 */
function writeRun(root: string, run: string, shots: readonly Shot[]): void {
  mkdirSync(join(root, run, "learner"), { recursive: true });
  const entries = shots.map((shot) => {
    if ("error" in shot) return { width: shot.width, error: shot.error };
    const file = `learner/S10-${shot.width}.png`;
    writeFileSync(join(root, run, file), shot.bytes);
    return { width: shot.width, file };
  });
  const page = { app: "learner", id: "S10", name: "知识点主页", path: "/kp/demo", shots: entries };
  const manifest = { version: 1, run, browser: "chromium 141", widths: WIDTHS, pages: [page] };
  writeFileSync(join(root, run, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** 照 pnpm gallery 的用法跑命令行（--keep 0：不删旧的），读回它写的 changes.json。 */
function compare(root: string, run: string): { readonly status: number | null; readonly stderr: string; readonly changes: Changes } {
  const result = spawnSync(process.execPath, [TOOL, "--root", root, "--run", run, "--keep", "0"], { encoding: "utf8" });
  const changes = JSON.parse(readFileSync(join(root, "changes.json"), "utf8")) as Changes;
  return { status: result.status, stderr: result.stderr, changes };
}

/** 各张截图的结果，写成“宽度:状态”。 */
function shotStatuses(changes: Changes): string[] {
  return changes.pages.flatMap((page) => page.shots.map((shot) => `${shot.width}:${shot.status}`));
}

/** 逐张列出的问题，写成“宽度:状态”。 */
function problemsOf(changes: Changes): string[] {
  return changes.problems.map((problem) => `${problem.width}:${problem.status}`);
}

describe("页面画廊比对 tools/gallery.mjs（命令行）", () => {
  it("第一次运行：没有上一次可比，两档都记为新增，命令成功", () => {
    const root = galleryRoot();
    writeRun(root, FIRST, [
      { width: 375, bytes: png(BLUE) },
      { width: 1280, bytes: png(BLUE) },
    ]);
    const { status, changes } = compare(root, FIRST);
    expect(status).toBe(EXIT_OK);
    expect(changes.previous).toBeNull();
    expect(shotStatuses(changes)).toEqual(["375:new", "1280:new"]);
    expect([changes.changed, changes.added, changes.failed, problemsOf(changes)]).toEqual([[], [], [], []]);
    expect(existsSync(join(root, "index.html"))).toBe(true);
  });

  it("两次一模一样：两档都没变，命令成功", () => {
    const root = galleryRoot();
    const same: Shot[] = [
      { width: 375, bytes: png(BLUE) },
      { width: 1280, bytes: png(BLUE) },
    ];
    writeRun(root, FIRST, same);
    writeRun(root, SECOND, same);
    const { status, changes } = compare(root, SECOND);
    expect(status).toBe(EXIT_OK);
    expect(changes.previous).toBe(FIRST);
    expect(shotStatuses(changes)).toEqual(["375:same", "1280:same"]);
    expect([changes.changed, changes.failed, problemsOf(changes)]).toEqual([[], [], []]);
  });

  it("画面真的变了：写进有变化清单并生成差异图，不算失败，命令成功", () => {
    const root = galleryRoot();
    writeRun(root, FIRST, [
      { width: 375, bytes: png(BLUE) },
      { width: 1280, bytes: png(BLUE) },
    ]);
    writeRun(root, SECOND, [
      { width: 375, bytes: png(BLUE) },
      { width: 1280, bytes: png(RED) },
    ]);
    const { status, changes } = compare(root, SECOND);
    expect(status).toBe(EXIT_OK);
    expect(shotStatuses(changes)).toEqual(["375:same", "1280:changed"]);
    expect(changes.changed).toEqual([PAGE]);
    expect([changes.failed, problemsOf(changes)]).toEqual([[], []]);
    const diff = changes.pages[0]?.shots[1]?.diff ?? null;
    expect(diff).toBe(`${SECOND}/diff/learner/S10-1280.png`);
    expect(existsSync(join(root, diff ?? "")), "差异图要写出来").toBe(true);
  });

  it("上一次的 375 截图损坏、1280 没变（复核反例 A）：375 记为没法比对、写进失败清单，命令失败", () => {
    const root = galleryRoot();
    writeRun(root, FIRST, [
      { width: 375, bytes: BROKEN },
      { width: 1280, bytes: png(BLUE) },
    ]);
    writeRun(root, SECOND, [
      { width: 375, bytes: png(BLUE) },
      { width: 1280, bytes: png(BLUE) },
    ]);
    const { status, stderr, changes } = compare(root, SECOND);
    expect(status).toBe(EXIT_PROBLEMS);
    expect(stderr).toContain("页面画廊比对不通过");
    expect(shotStatuses(changes)).toEqual(["375:error", "1280:same"]);
    expect(changes.failed).toEqual([PAGE]);
    expect(problemsOf(changes)).toEqual(["375:error"]);
    expect(changes.changed).toEqual([]);
    expect(existsSync(join(root, "index.html")), "出了问题也照常写出前后对照页").toBe(true);
  });

  it("上一次的 375 截图损坏、1280 有变化（复核反例 B）：两份清单都有这一页，失败不被“有变化”盖住，命令失败", () => {
    const root = galleryRoot();
    writeRun(root, FIRST, [
      { width: 375, bytes: BROKEN },
      { width: 1280, bytes: png(BLUE) },
    ]);
    writeRun(root, SECOND, [
      { width: 375, bytes: png(BLUE) },
      { width: 1280, bytes: png(RED) },
    ]);
    const { status, changes } = compare(root, SECOND);
    expect(status).toBe(EXIT_PROBLEMS);
    expect(shotStatuses(changes)).toEqual(["375:error", "1280:changed"]);
    expect(changes.changed).toEqual([PAGE]);
    expect(changes.failed).toEqual([PAGE]);
    expect(problemsOf(changes)).toEqual(["375:error"]);
    expect(changes.pages[0]?.status, "这一页总体按最要紧的算：没法比对").toBe("error");
  });

  it("这一次 375 没截到：逐张写进失败清单并带上原因，命令失败", () => {
    const root = galleryRoot();
    writeRun(root, FIRST, [
      { width: 375, bytes: png(BLUE) },
      { width: 1280, bytes: png(BLUE) },
    ]);
    writeRun(root, SECOND, [
      { width: 375, error: "截图超时" },
      { width: 1280, bytes: png(BLUE) },
    ]);
    const { status, changes } = compare(root, SECOND);
    expect(status).toBe(EXIT_PROBLEMS);
    expect(shotStatuses(changes)).toEqual(["375:failed", "1280:same"]);
    expect(changes.problems).toEqual([{ app: "learner", id: "S10", name: "知识点主页", width: 375, status: "failed", error: "截图超时" }]);
    expect(changes.failed).toEqual([PAGE]);
  });

  it("这一页少了一档的截图记录：也算没截到，命令失败", () => {
    const root = galleryRoot();
    writeRun(root, FIRST, [
      { width: 375, bytes: png(BLUE) },
      { width: 1280, bytes: png(BLUE) },
    ]);
    writeRun(root, SECOND, [{ width: 1280, bytes: png(BLUE) }]);
    const { status, changes } = compare(root, SECOND);
    expect(status).toBe(EXIT_PROBLEMS);
    expect(shotStatuses(changes)).toEqual(["1280:same", "375:failed"]);
    expect(changes.problems.map((problem) => problem.error)).toEqual(["这一档没有截图记录"]);
  });
});
