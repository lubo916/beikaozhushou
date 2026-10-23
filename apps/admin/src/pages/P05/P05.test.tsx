// P05 考情分析工作台（W03）：假数据过生成的 Zod、按来源筛选在接口层完成、成熟度门控、七态判断、挂在本页地址走一遍正常与各状态、主要按钮。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { P05ExamAnalysis } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { getP05ExamAnalysisResponse } from "@exam-prep/contract/zod";
import { findForbiddenWords } from "@exam-prep/shared/vocab";
import { click, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/P05.json";
import { handleP05, p05Fixture } from "../../mocks/pages/P05.ts";
import { analysisView, shouldRetry } from "./view.ts";

const EXAMS = ["kj", "js", "en", "ds"] as const;
const ask = (query: string) =>
  handleP05({ method: "GET", url: `http://localhost/api/v1/admin/exam-analysis?${query}`, headers: new Headers(), body: undefined });
const body = async (query: string): Promise<P05ExamAnalysis> => {
  const outcome = await ask(query);
  if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
  return outcome.body as P05ExamAnalysis;
};
const waiting = { data: undefined, error: null, status: "pending" as const, fetchStatus: "fetching" as const };
const done = (data: P05ExamAnalysis) => ({ data, error: null, status: "success" as const, fetchStatus: "idle" as const });
const chip = (host: HTMLElement, label: string) =>
  [...host.querySelectorAll("button")].find((button) => button.textContent?.trim().startsWith(label));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("P05 假数据与七态判断", () => {
  it("四个演示考试 × 正常、空、数据不足 × 各来源都符合生成的契约", async () => {
    for (const exam of EXAMS)
      for (const state of ["normal", "empty", "insufficient_data"])
        for (const source of ["", "official_public", "licensed", "recalled"]) {
          const outcome = await ask(`exam=${exam}&state=${state}${source === "" ? "" : `&source=${source}`}`);
          if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
          const parsed = getP05ExamAnalysisResponse.safeParse(outcome.body);
          expect(parsed.success, `${exam}/${state}/${source}：${String(parsed.error)}`).toBe(true);
        }
  });

  it("按来源筛选由接口完成；总数与各来源条数不随筛选变", async () => {
    const all = await body("exam=kj");
    const recalled = await body("exam=kj&source=recalled");
    expect(recalled.questions.length).toBeGreaterThan(0);
    expect(recalled.questions.every((item) => item.source === "recalled")).toBe(true);
    expect(recalled.questions.length).toBeLessThan(all.questions.length);
    expect(recalled.total_count).toBe(all.total_count);
    expect(recalled.source_counts).toEqual(all.source_counts);
    expect((await body("exam=ds&source=official_public")).questions).toEqual([]);
  });

  it("四档成熟度各有一个演示考试；成熟中只给原始次数，冷启动不给考点档案", async () => {
    const levels = await Promise.all(EXAMS.map(async (exam) => (await body(`exam=${exam}`)).maturity.level));
    expect(levels).toEqual(["mature", "usable", "maturing", "cold"]);
    const maturing = await body("exam=en");
    expect(maturing.profile.entries.length).toBeGreaterThan(0);
    for (const entry of maturing.profile.entries) {
      expect(entry.appearance_count).toBeGreaterThan(0);
      expect(entry.total_score ?? entry.trend ?? entry.traps ?? entry.angles ?? entry.question_types).toBeUndefined();
    }
    const cold = await body("exam=ds");
    expect(cold.profile).toMatchObject({ sample_sufficient: false, entries: [] });
    expect(cold.profile.recomputed_at).toBeUndefined();
    const forced = await body("exam=kj&state=insufficient_data");
    expect(forced.profile).toMatchObject({ sample_sufficient: false, entries: [] });
    expect(forced.maturity.level).toBe("cold");
    expect(forced.total_count).toBe(forced.questions.length);
  });

  it("AI 初稿都标了 ai_draft；四档在学员端的显示由接口给", async () => {
    for (const exam of EXAMS) {
      const data = await body(`exam=${exam}`);
      for (const item of data.questions) expect(item.ai_draft, item.question_id).toBe(item.review_status === "pending");
      for (const entry of data.profile.entries) expect(entry.ai_draft, entry.name).toBe(entry.status === "draft");
      expect(data.maturity_tiers.map((tier) => tier.level)).toEqual(["cold", "maturing", "usable", "mature"]);
    }
  });

  it("示例数据与文案里没有宣传禁用语（命题趋势只描述考频与变化）", async () => {
    for (const exam of EXAMS) expect(findForbiddenWords(JSON.stringify(p05Fixture(exam)))).toEqual([]);
    expect(findForbiddenWords(JSON.stringify(copy))).toEqual([]);
  });

  it("加载、离线、出错、受限由假数据层统一制造；请求结果逐态映射", async () => {
    expect((await ask("state=loading")).kind).toBe("hang");
    expect((await ask("state=offline")).kind).toBe("network_error");
    expect(await ask("state=error")).toMatchObject({ kind: "json", status: 500 });
    expect(await ask("state=restricted")).toMatchObject({ kind: "json", status: 403 });
    const normal = p05Fixture().analysis;
    expect(analysisView(waiting).state).toBe("loading");
    expect(analysisView({ ...waiting, status: "error", fetchStatus: "idle", error: new TypeError("offline") }).state).toBe("offline");
    expect(analysisView({ ...waiting, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
    expect(analysisView({ ...waiting, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_FORBIDDEN") }).state).toBe(
      "restricted",
    );
    expect(analysisView(done(normal)).state).toBe("normal");
    expect(analysisView(done({ ...normal, questions: [] })).state).toBe("empty");
    expect(analysisView(done({ ...normal, profile: p05Fixture().insufficient.profile })).state).toBe("insufficient_data");
    expect(analysisView({ ...done(normal), fetchStatus: "paused" })).toMatchObject({ state: "normal", stale: true });
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new TypeError("offline"))).toBe(true);
    expect(shouldRetry(1, new TypeError("offline"))).toBe(false);
  });
});

describe("P05 挂在本页地址", () => {
  it("正常态：真题拆解、考点档案、数据成熟度、禁用表述与 AI 标识都在；当前档有标记", async () => {
    const { host, unmount } = await mountAt("/exam-analysis");
    try {
      const first = p05Fixture().analysis.questions[0]?.knowledge_point.name ?? "";
      await settle(() => host.textContent?.includes(first) === true);
      for (const title of [copy.questions.title, copy.profile.title, copy.maturity.title, copy.wording.title])
        expect(host.textContent).toContain(title);
      expect(host.querySelectorAll(".ui-ai").length).toBeGreaterThan(0);
      expect(host.textContent).toContain(copy.maturity.current);
      expect(host.textContent).toContain(copy.profile.level.mature);
    } finally {
      await unmount();
    }
  });

  it("按来源筛选；某来源没有题时显示空态，清除筛选后恢复", async () => {
    const { host, unmount } = await mountAt("/exam-analysis?exam=ds");
    try {
      const rows = p05Fixture("ds").analysis.questions;
      const recalled = rows.find((item) => item.source === "recalled")?.knowledge_point.name ?? "";
      const licensed = rows.find((item) => item.source === "licensed")?.knowledge_point.name ?? "";
      await settle(() => host.textContent?.includes(licensed) === true);
      expect(host.querySelector(".ui-state--insufficient_data")).not.toBeNull();
      await click(chip(host, copy.sources.recalled));
      await settle(() => host.textContent?.includes(recalled) === true && host.textContent?.includes(licensed) === false);
      expect(host.textContent).toContain(recalled);
      expect(host.textContent).not.toContain(licensed);
      await click(chip(host, copy.sources.official_public));
      await settle(() => host.querySelector(".ui-state--empty") !== null);
      expect(host.textContent).toContain(copy.state.empty.body);
      await click([...host.querySelectorAll("button")].find((button) => button.textContent?.trim() === copy.state.empty.action));
      await settle(() => host.textContent?.includes(licensed) === true);
      expect(host.querySelector(".ui-state--empty")).toBeNull();
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
      const { host, unmount } = await mountAt(`/exam-analysis?state=${state}`);
      try {
        await settle(() => host.querySelector(`.ui-state--${state}`) !== null);
        expect(host.querySelector(`.ui-state--${state}`), host.textContent ?? "").not.toBeNull();
        if (text !== undefined) expect(host.textContent).toContain(text);
      } finally {
        await unmount();
      }
    });
  }

  it("关掉假数据层时走生成的请求函数：请求发到 /api/v1/admin/exam-analysis", async () => {
    vi.stubEnv("VITE_MOCKS", "off");
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      asked.push(url);
      const outcome = await handleP05({
        method: init?.method ?? "GET",
        url: new URL(url, window.location.origin).href,
        headers: new Headers(),
        body: undefined,
      });
      if (outcome.kind !== "json") throw new TypeError("mock network unavailable");
      return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
    });
    const { host, unmount } = await mountAt("/exam-analysis");
    try {
      const first = p05Fixture().analysis.questions[0]?.knowledge_point.name ?? "";
      await settle(() => host.textContent?.includes(first) === true);
      expect(host.textContent).toContain(first);
      expect(asked.some((url) => url.startsWith("/api/v1/admin/exam-analysis"))).toBe(true);
    } finally {
      await unmount();
    }
  });
});
