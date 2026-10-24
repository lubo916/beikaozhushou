// P06 变更影响分析（W03）：假数据过生成的 Zod、按变更类型筛选在接口层完成、样本不足不估算受影响学员、七态判断、挂在本页地址走一遍。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { P06ChangeImpact } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { getP06ChangeImpactResponse } from "@exam-prep/contract/zod";
import { findForbiddenWords } from "@exam-prep/shared/vocab";
import { click, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/P06.json";
import { handleP06, p06Fixture } from "../../mocks/pages/P06.ts";
import { impactView, shouldRetry } from "./view.ts";

const EXAMS = ["kj", "js", "en", "ds"] as const;
const ask = (query: string) =>
  handleP06({ method: "GET", url: `http://localhost/api/v1/admin/change-impact?${query}`, headers: new Headers(), body: undefined });
const body = async (query: string): Promise<P06ChangeImpact> => {
  const outcome = await ask(query);
  if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
  return outcome.body as P06ChangeImpact;
};
const waiting = { data: undefined, error: null, status: "pending" as const, fetchStatus: "fetching" as const };
const done = (data: P06ChangeImpact) => ({ data, error: null, status: "success" as const, fetchStatus: "idle" as const });
const button = (host: HTMLElement, label: string) =>
  [...host.querySelectorAll("button")].find((item) => item.textContent?.trim().startsWith(label));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("P06 假数据与七态判断", () => {
  it("四个演示考试 × 正常、空、数据不足 × 各变更类型都符合生成的契约", async () => {
    for (const exam of EXAMS)
      for (const state of ["normal", "empty", "insufficient_data"])
        for (const kind of ["", "syllabus", "textbook", "rule"]) {
          const outcome = await ask(`exam=${exam}&state=${state}${kind === "" ? "" : `&kind=${kind}`}`);
          if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
          const parsed = getP06ChangeImpactResponse.safeParse(outcome.body);
          expect(parsed.success, `${exam}/${state}/${kind}：${String(parsed.error)}`).toBe(true);
        }
  });

  it("按变更类型筛选由接口完成；总数与各类型条数不随筛选变", async () => {
    const all = await body("exam=kj");
    const textbook = await body("exam=kj&kind=textbook");
    expect(textbook.events.map((event) => event.kind)).toEqual(["textbook"]);
    expect(textbook.total_count).toBe(all.total_count);
    expect(textbook.kind_counts).toEqual(all.kind_counts);
    expect((await body("exam=ds&kind=textbook")).events).toEqual([]);
  });

  it("每个事件都附官方文件与生效日；处理完成前标“待更新”，完成后撤下", async () => {
    for (const exam of EXAMS)
      for (const event of (await body(`exam=${exam}`)).events) {
        expect(event.official_document, event.title).not.toBe("");
        expect(event.pending_update.marked, event.title).toBe(event.stage !== "done");
        expect(event.progress === undefined, event.title).toBe(event.stage === "done");
      }
  });

  it("学习记录样本不足时不估算受影响学员，也不给 AI 摘要，只留内容计数", async () => {
    const forced = await body("exam=kj&state=insufficient_data");
    expect(forced.analysis.sample_sufficient).toBe(false);
    expect(forced.events.length).toBeGreaterThan(0);
    for (const event of forced.events) {
      expect(event.impact.learner_count).toBeUndefined();
      expect(event.impact_summary).toBeUndefined();
    }
    const custom = await body("exam=ds");
    expect(custom.analysis.sample_sufficient).toBe(false);
    expect(custom.events.every((event) => event.impact.learner_count === undefined)).toBe(true);
    expect((await body("exam=kj")).events.every((event) => event.impact.learner_count !== undefined)).toBe(true);
  });

  it("示例数据与文案里没有宣传禁用语", async () => {
    for (const exam of EXAMS) expect(findForbiddenWords(JSON.stringify(p06Fixture(exam)))).toEqual([]);
    expect(findForbiddenWords(JSON.stringify(copy))).toEqual([]);
  });

  it("加载、离线、出错、受限由假数据层统一制造；请求结果逐态映射", async () => {
    expect((await ask("state=loading")).kind).toBe("hang");
    expect((await ask("state=offline")).kind).toBe("network_error");
    expect(await ask("state=error")).toMatchObject({ kind: "json", status: 500 });
    expect(await ask("state=restricted")).toMatchObject({ kind: "json", status: 403 });
    const normal = p06Fixture().impact;
    expect(impactView(waiting).state).toBe("loading");
    expect(impactView({ ...waiting, status: "error", fetchStatus: "idle", error: new TypeError("offline") }).state).toBe("offline");
    expect(impactView({ ...waiting, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
    expect(impactView({ ...waiting, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_FORBIDDEN") }).state).toBe(
      "restricted",
    );
    expect(impactView(done(normal)).state).toBe("normal");
    expect(impactView(done({ ...normal, events: [] })).state).toBe("empty");
    expect(impactView(done({ ...normal, analysis: p06Fixture().insufficient_analysis })).state).toBe("insufficient_data");
    expect(impactView({ ...done(normal), fetchStatus: "paused" })).toMatchObject({ state: "normal", stale: true });
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new TypeError("offline"))).toBe(true);
  });
});

describe("P06 挂在本页地址", () => {
  it("正常态：变更事件、待更新标注、AI 摘要标识与通知卡都在", async () => {
    const { host, unmount } = await mountAt("/impact");
    try {
      const first = p06Fixture().impact.events[0]?.title ?? "";
      await settle(() => host.textContent?.includes(first) === true);
      for (const text of [copy.events.title, copy.notices.title, copy.pending.marked, copy.pending.cleared, copy.notices.notifyLearners])
        expect(host.textContent).toContain(text);
      expect(host.querySelectorAll(".ui-ai").length).toBeGreaterThan(0);
      expect(host.querySelector(".ui-state--insufficient_data")).toBeNull();
    } finally {
      await unmount();
    }
  });

  it("按变更类型筛选；某类型没有事件时显示空态，清除筛选后恢复", async () => {
    const { host, unmount } = await mountAt("/impact");
    try {
      const events = p06Fixture().impact.events;
      const syllabus = events.find((event) => event.kind === "syllabus")?.title ?? "";
      const textbook = events.find((event) => event.kind === "textbook")?.title ?? "";
      await settle(() => host.textContent?.includes(syllabus) === true);
      await click(button(host, copy.kinds.textbook));
      await settle(() => host.textContent?.includes(textbook) === true && host.textContent?.includes(syllabus) === false);
      expect(host.textContent).toContain(textbook);
      expect(host.textContent).not.toContain(syllabus);
      await unmount();
      const custom = await mountAt("/impact?exam=ds");
      try {
        const only = p06Fixture("ds").impact.events[0]?.title ?? "";
        await settle(() => custom.host.textContent?.includes(only) === true);
        expect(custom.host.querySelector(".ui-state--insufficient_data")).not.toBeNull();
        await click(button(custom.host, copy.kinds.rule));
        await settle(() => custom.host.querySelector(".ui-state--empty") !== null);
        expect(custom.host.textContent).toContain(copy.state.empty.body);
        await click([...custom.host.querySelectorAll("button")].find((item) => item.textContent?.trim() === copy.state.empty.action));
        await settle(() => custom.host.textContent?.includes(only) === true);
        expect(custom.host.querySelector(".ui-state--empty")).toBeNull();
      } finally {
        await custom.unmount();
      }
    } catch (error) {
      await unmount().catch(() => undefined);
      throw error;
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
      const { host, unmount } = await mountAt(`/impact?state=${state}`);
      try {
        await settle(() => host.querySelector(`.ui-state--${state}`) !== null);
        expect(host.querySelector(`.ui-state--${state}`), host.textContent ?? "").not.toBeNull();
        if (text !== undefined) expect(host.textContent).toContain(text);
      } finally {
        await unmount();
      }
    });
  }

  it("关掉假数据层时走生成的请求函数：请求发到 /api/v1/admin/change-impact", async () => {
    vi.stubEnv("VITE_MOCKS", "off");
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      asked.push(url);
      const outcome = await handleP06({
        method: init?.method ?? "GET",
        url: new URL(url, window.location.origin).href,
        headers: new Headers(),
        body: undefined,
      });
      if (outcome.kind !== "json") throw new TypeError("mock network unavailable");
      return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
    });
    const { host, unmount } = await mountAt("/impact");
    try {
      const first = p06Fixture().impact.events[0]?.title ?? "";
      await settle(() => host.textContent?.includes(first) === true);
      expect(asked.some((url) => url.startsWith("/api/v1/admin/change-impact"))).toBe(true);
    } finally {
      await unmount();
    }
  });
});
