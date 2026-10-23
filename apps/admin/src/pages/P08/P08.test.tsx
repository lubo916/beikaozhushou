// P08 题库审核与质量（W04）：假数据过生成的 Zod、七态判断逐态喂结果、挂在本页地址走一遍正常与各状态、主要按钮。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { P08QuestionReview } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { getP08QuestionReviewResponse } from "@exam-prep/contract/zod";
import { credibilityLabel, formatCount, vocabLabel } from "@exam-prep/shared";
import { click, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/P08.json";
import { handleP08, p08Fixture } from "../../mocks/pages/P08.ts";
import { questionReviewView, shouldRetry } from "./view.ts";

const ask = (query: string) =>
  handleP08({ method: "GET", url: `http://localhost/api/v1/admin/question-review?${query}`, headers: new Headers(), body: undefined });
const json = async (query: string): Promise<P08QuestionReview> => {
  const outcome = await ask(query);
  if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
  return outcome.body as P08QuestionReview;
};
const waiting = { data: undefined, error: null, status: "pending" as const, fetchStatus: "fetching" as const };
const done = (data: P08QuestionReview) => ({ data, error: null, status: "success" as const, fetchStatus: "idle" as const });
const byText = (host: ParentNode, selector: string, text: string) =>
  [...host.querySelectorAll<HTMLElement>(selector)].find((element) => element.textContent?.trim() === text);
/** 筛选片的按钮里还带接口给的条数，按开头的名称找。 */
const chip = (host: ParentNode, label: string) =>
  [...host.querySelectorAll<HTMLElement>(".ui-chip")].find((element) => element.textContent?.trim().startsWith(label) === true);
const CHECKS = Object.keys(copy.checks.names);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("P08 假数据与七态判断", () => {
  it("四个演示考试 × 正常、空、数据不足 × 来源筛选都符合生成的契约", async () => {
    for (const exam of ["kj", "js", "en", "ds"])
      for (const state of ["normal", "empty", "insufficient_data"])
        for (const origin of ["", "new", "modified"]) {
          const outcome = await ask(`exam=${exam}&state=${state}${origin === "" ? "" : `&origin=${origin}`}`);
          if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
          const parsed = getP08QuestionReviewResponse.safeParse(outcome.body);
          expect(parsed.success, `${exam}/${state}/${origin}：${String(parsed.error)}`).toBe(true);
          const body = outcome.body as P08QuestionReview;
          if (origin !== "") expect(body.tasks.every((task) => task.origin === origin)).toBe(true);
        }
  });

  it("每道生成题都过完七道质检（各一次），证据上限由接口给", async () => {
    for (const exam of ["kj", "js", "en", "ds"]) {
      const body = await json(`exam=${exam}`);
      expect(body.checks.length).toBeGreaterThan(0);
      for (const check of body.checks) expect(check.results.map((result) => result.check).sort()).toEqual([...CHECKS].sort());
    }
  });

  it("报错闭环：已处理的带结论与重新计分人数，待处理的不带", async () => {
    for (const exam of ["kj", "js", "en", "ds"]) {
      const body = await json(`exam=${exam}`);
      expect(body.reports.some((report) => report.status === "resolved")).toBe(true);
      for (const report of body.reports) expect(report.resolution !== undefined).toBe(report.status === "resolved");
    }
  });

  it("加载、离线、出错、受限由假数据层统一制造；别的地址放行", async () => {
    expect((await ask("state=loading")).kind).toBe("hang");
    expect((await ask("state=offline")).kind).toBe("network_error");
    expect(await ask("state=error")).toMatchObject({ kind: "json", status: 500, body: { code: "COMMON_INTERNAL" } });
    expect(await ask("state=restricted")).toMatchObject({ kind: "json", status: 403, body: { code: "COMMON_FORBIDDEN" } });
    const other = await handleP08({ method: "GET", url: "http://localhost/api/v1/other", headers: new Headers(), body: undefined });
    expect(other.kind).toBe("passthrough");
  });

  it("作答样本不足时不返回变式题质量结论，只留原始计数", async () => {
    const body = await json("state=insufficient_data");
    expect(body.sample_sufficient).toBe(false);
    expect(body.sample_count).toBeLessThan(body.minimum_sample_size);
    expect(body.variant_pools.every((pool) => pool.quality === undefined && pool.exposure_level === undefined)).toBe(true);
  });

  it("请求结果逐态映射；权限拒绝优先于旧数据，断网时保留旧数据并提示", () => {
    const normal = p08Fixture().normal;
    expect(questionReviewView(waiting).state).toBe("loading");
    expect(questionReviewView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(questionReviewView({ ...waiting, status: "error", fetchStatus: "idle", error: new TypeError("offline") }).state).toBe("offline");
    expect(questionReviewView({ ...waiting, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") }).state).toBe(
      "error",
    );
    expect(
      questionReviewView({ data: normal, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_FORBIDDEN") }).state,
    ).toBe("restricted");
    expect(questionReviewView(done(normal)).state).toBe("normal");
    expect(questionReviewView(done({ ...normal, tasks: [], checks: [], variant_pools: [], reports: [] })).state).toBe("empty");
    expect(questionReviewView(done({ ...normal, tasks: [] })).state).toBe("normal");
    expect(questionReviewView(done(p08Fixture().insufficient)).state).toBe("insufficient_data");
    expect(questionReviewView({ data: normal, status: "error", fetchStatus: "idle", error: new TypeError("offline") })).toMatchObject({
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

describe("P08 挂在本页地址", () => {
  it("正常态：双人审核队列、七道质检与证据上限、变式题池、报错闭环；切来源；写操作提示即将上线", async () => {
    const fixture = p08Fixture().normal;
    const fresh = fixture.tasks.find((task) => task.origin === "new");
    const changed = fixture.tasks.find((task) => task.origin === "modified");
    const check = fixture.checks[0];
    const resolved = fixture.reports.find((report) => report.resolution !== undefined)?.resolution;
    if (fresh === undefined || changed === undefined || check === undefined || resolved === undefined) throw new Error("fixture 不完整");
    const { host, unmount } = await mountAt("/question-review");
    try {
      await settle(() => host.textContent?.includes(fresh.question_ref) === true);
      expect(host.textContent).toContain(copy.queue.title);
      expect(host.textContent).toContain(credibilityLabel(fresh.credibility));
      expect(host.textContent).toContain(copy.checks.names.distractors_reasonable);
      expect(host.textContent).toContain(copy.checks.cap.replace("{{level}}", vocabLabel("evidence_strength", check.evidence_cap)));
      expect(host.textContent).toContain(copy.variants.title);
      expect(host.textContent).toContain(copy.reports.rescored.replace("{{n}}", formatCount(resolved.rescored_users)));
      expect(host.querySelectorAll("main .ui-ai").length).toBeGreaterThan(0);
      await click(byText(host, "button", copy.queue.check));
      expect(host.querySelector('[role="status"]')?.textContent).toContain(copy.soon);
      await click(chip(host, copy.queue.origins.modified));
      await settle(() => host.textContent?.includes(fresh.question_ref) !== true);
      expect(host.textContent).toContain(changed.question_ref);
      expect(host.textContent).not.toContain(fresh.question_ref);
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
      const { host, unmount } = await mountAt(`/question-review?state=${state}`);
      try {
        await settle(() => host.querySelector(`.ui-state--${state}`) !== null);
        expect(host.querySelector(`.ui-state--${state}`), host.textContent ?? "").not.toBeNull();
        if (text !== undefined) expect(host.textContent).toContain(text);
      } finally {
        await unmount();
      }
    });
  }

  it("关掉假数据层时走生成的请求函数：请求发到 /api/v1/admin/question-review，结果照常显示", async () => {
    vi.stubEnv("VITE_MOCKS", "off");
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      asked.push(url);
      const outcome = await handleP08({
        method: init?.method ?? "GET",
        url: new URL(url, window.location.origin).href,
        headers: new Headers(),
        body: undefined,
      });
      if (outcome.kind !== "json") throw new TypeError("mock network unavailable");
      return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
    });
    const first = p08Fixture().normal.tasks[0]?.question_ref ?? "";
    const { host, unmount } = await mountAt("/question-review");
    try {
      await settle(() => host.textContent?.includes(first) === true);
      expect(host.textContent).toContain(first);
      expect(asked.some((url) => url.startsWith("/api/v1/admin/question-review"))).toBe(true);
    } finally {
      await unmount();
    }
  });
});
