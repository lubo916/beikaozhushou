// P07 内容生产流水线（W04）：假数据过生成的 Zod、七态判断逐态喂结果、挂在本页地址走一遍正常与各状态、主要按钮。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { P07Pipeline } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { getP07PipelineResponse } from "@exam-prep/contract/zod";
import { click, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/P07.json";
import { handleP07, p07Fixture } from "../../mocks/pages/P07.ts";
import { pipelineView, shouldRetry } from "./view.ts";

const ask = (query: string) =>
  handleP07({ method: "GET", url: `http://localhost/api/v1/admin/pipeline?${query}`, headers: new Headers(), body: undefined });
const json = async (query: string): Promise<P07Pipeline> => {
  const outcome = await ask(query);
  if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
  return outcome.body as P07Pipeline;
};
const waiting = { data: undefined, error: null, status: "pending" as const, fetchStatus: "fetching" as const };
const done = (data: P07Pipeline) => ({ data, error: null, status: "success" as const, fetchStatus: "idle" as const });
const byText = (host: ParentNode, selector: string, text: string) =>
  [...host.querySelectorAll<HTMLElement>(selector)].find((element) => element.textContent?.trim() === text);
/** 筛选片的按钮里还带接口给的条数，按开头的名称找。 */
const chip = (host: ParentNode, label: string) =>
  [...host.querySelectorAll<HTMLElement>(".ui-chip")].find((element) => element.textContent?.trim().startsWith(label) === true);
const detail = (host: ParentNode) => host.querySelector("main article")?.getAttribute("aria-label");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("P07 假数据与七态判断", () => {
  it("四个演示考试 × 正常、空、数据不足 × 条目类型筛选都符合生成的契约", async () => {
    for (const exam of ["kj", "js", "en", "ds"])
      for (const state of ["normal", "empty", "insufficient_data"])
        for (const kind of ["", "solution", "card", "slice_mount"]) {
          const outcome = await ask(`exam=${exam}&state=${state}${kind === "" ? "" : `&kind=${kind}`}`);
          if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
          const parsed = getP07PipelineResponse.safeParse(outcome.body);
          expect(parsed.success, `${exam}/${state}/${kind}：${String(parsed.error)}`).toBe(true);
          const body = outcome.body as P07Pipeline;
          if (kind !== "") expect(body.review.items.every((item) => item.kind === kind)).toBe(true);
        }
  });

  it("按条目类型筛选：条目换成该类型，待审数取接口给的分类计数", async () => {
    const all = await json("exam=kj");
    const cards = await json("exam=kj&kind=card");
    expect(cards.review.total_count).toBe(all.review.kind_counts.card);
    expect(cards.review.items.length).toBeGreaterThan(0);
    expect(cards.review.items.every((item) => item.kind === "card")).toBe(true);
  });

  it("加载、离线、出错、受限由假数据层统一制造；别的地址放行", async () => {
    expect((await ask("state=loading")).kind).toBe("hang");
    expect((await ask("state=offline")).kind).toBe("network_error");
    expect(await ask("state=error")).toMatchObject({ kind: "json", status: 500, body: { code: "COMMON_INTERNAL" } });
    expect(await ask("state=restricted")).toMatchObject({ kind: "json", status: 403, body: { code: "COMMON_FORBIDDEN" } });
    const other = await handleP07({ method: "GET", url: "http://localhost/api/v1/other", headers: new Headers(), body: undefined });
    expect(other.kind).toBe("passthrough");
  });

  it("校准样本不足时不返回置信度、改按入队时间排序，只留原始计数", async () => {
    const body = await json("state=insufficient_data");
    expect(body.sample_sufficient).toBe(false);
    expect(body.sample_count).toBeLessThan(body.minimum_sample_size);
    expect(body.review.sort).toBe("queued_at");
    expect(body.review.items.every((item) => item.confidence === undefined)).toBe(true);
  });

  it("四个演示考试的审核条目都标了 AI 起草，草稿里都有标出补写或改写的分段", async () => {
    for (const exam of ["kj", "js", "en", "ds"]) {
      const body = await json(`exam=${exam}`);
      expect(body.review.items.length).toBeGreaterThan(0);
      expect(body.review.items.every((item) => item.ai_generated && item.draft.some((segment) => segment.change !== "same"))).toBe(true);
    }
  });

  it("请求结果逐态映射；权限拒绝优先于旧数据，断网时保留旧数据并提示", () => {
    const normal = p07Fixture().normal;
    expect(pipelineView(waiting).state).toBe("loading");
    expect(pipelineView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(pipelineView({ ...waiting, status: "error", fetchStatus: "idle", error: new TypeError("offline") }).state).toBe("offline");
    expect(pipelineView({ ...waiting, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
    expect(pipelineView({ data: normal, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_FORBIDDEN") }).state).toBe(
      "restricted",
    );
    expect(pipelineView(done(normal)).state).toBe("normal");
    expect(pipelineView(done({ ...normal, materials: [], productions: [], review: { ...normal.review, items: [] } })).state).toBe("empty");
    expect(pipelineView(done({ ...normal, review: { ...normal.review, items: [] } })).state).toBe("normal");
    expect(pipelineView(done(p07Fixture().insufficient)).state).toBe("insufficient_data");
    expect(pipelineView({ data: normal, status: "error", fetchStatus: "idle", error: new TypeError("offline") })).toMatchObject({
      state: "normal",
      stale: true,
    });
  });

  it("网络和服务异常重试一次，权限错误不重试", () => {
    expect(shouldRetry(0, new TypeError("offline"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(1, new ApiError("COMMON_INTERNAL"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});

describe("P07 挂在本页地址", () => {
  it("正常态：待办数、审核台（原文与 AI 草稿、高亮）、教材处理、解析与卡组；切条目类型与换一条审；写操作提示即将上线", async () => {
    const fixture = p07Fixture().normal;
    const first = fixture.review.items[0];
    const card = fixture.review.items.find((item) => item.kind === "card");
    if (first === undefined || card === undefined) throw new Error("fixture 应有审核条目");
    const { host, unmount } = await mountAt("/pipeline");
    try {
      await settle(() => detail(host) === first.title);
      expect(host.textContent).toContain(copy.queue.parse);
      expect(host.textContent).toContain(copy.queue.review);
      expect(host.textContent).toContain(first.source_text);
      expect(host.querySelectorAll("main .ui-ai").length).toBeGreaterThan(0);
      expect(host.querySelectorAll("main mark").length).toBeGreaterThan(0);
      expect(host.textContent).toContain(copy.materials.stages.mounting);
      expect(host.textContent).toContain(copy.productions.title);
      await click(byText(host, "button", copy.review.approve));
      expect(host.querySelector('[role="status"]')?.textContent).toContain(copy.soon);
      await click(chip(host, copy.review.kinds.card));
      await settle(() => detail(host) === card.title);
      expect(detail(host)).toBe(card.title);
      await click(chip(host, copy.review.kinds.all));
      await settle(() => detail(host) === first.title);
      await click(byText(host, "button", copy.review.open));
      await settle(() => detail(host) !== first.title);
      expect(detail(host)).not.toBe(first.title);
    } finally {
      await unmount();
    }
  });

  const STATES = [
    ["loading", undefined],
    ["empty", copy.state.empty.body],
    ["error", copy.state.error.body],
    ["offline", copy.state.offline.title],
    ["restricted", copy.state.restricted.body],
    ["insufficient_data", copy.state.insufficient_data.body],
  ] as const;
  for (const [state, text] of STATES) {
    it(`?state=${state} 显示对应的公共状态组件与文案`, async () => {
      const { host, unmount } = await mountAt(`/pipeline?state=${state}`);
      try {
        await settle(() => host.querySelector(`.ui-state--${state}`) !== null);
        expect(host.querySelector(`.ui-state--${state}`), host.textContent ?? "").not.toBeNull();
        if (text !== undefined) expect(host.textContent).toContain(text);
      } finally {
        await unmount();
      }
    });
  }

  it("关掉假数据层时走生成的请求函数：请求发到 /api/v1/admin/pipeline，结果照常显示", async () => {
    vi.stubEnv("VITE_MOCKS", "off");
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      asked.push(url);
      const outcome = await handleP07({
        method: init?.method ?? "GET",
        url: new URL(url, window.location.origin).href,
        headers: new Headers(),
        body: undefined,
      });
      if (outcome.kind !== "json") throw new TypeError("mock network unavailable");
      return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
    });
    const first = p07Fixture().normal.review.items[0]?.title ?? "";
    const { host, unmount } = await mountAt("/pipeline");
    try {
      await settle(() => host.textContent?.includes(first) === true);
      expect(host.textContent).toContain(first);
      expect(asked.some((url) => url.startsWith("/api/v1/admin/pipeline"))).toBe(true);
    } finally {
      await unmount();
    }
  });
});
