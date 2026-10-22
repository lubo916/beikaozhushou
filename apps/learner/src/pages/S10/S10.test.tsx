// S10 知识点主页的测试（F08 样板页：页面的单元测试照这里写，浏览器模式）。
// ① 假数据：四个演示考试、demo 与每个示例知识点，正常与空、受限、数据不足四种数据都通过生成的 Zod 校验；做错一题，关联题目跟着变。
// ② 七态判断（data.ts）只看请求结果；重试策略。③ 整个学员端挂在 /kp/demo，假数据接口接到生成的钩子上：正常、空态、出错各走一遍。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { App } from "../../App.tsx";
import { heading, linkByText, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S10.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { homeView, shouldRetry, type HomeQuery } from "./data.ts";

type Json = Record<string, unknown>;

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getKnowledgePointHomeResponse"] as Parser | undefined;
/** 北京时间 2026-10-21 10:00。 */
const NOW = Date.parse("2026-10-21T02:00:00Z");
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;

/** 演示考试的示范知识点（demo）：有题目的那个。 */
function demoPoint(key: string): { readonly id: string; readonly name: string } {
  const exam = fixtures.exams.find((e) => e.key === key);
  const point = exam?.map.chapters
    .flatMap((chapter) => chapter.sample_points)
    .find((p) => exam.questions.some((q) => q.knowledge_point_ids.includes(p.id)));
  if (point === undefined) throw new Error(`演示考试 ${key} 没有带题目的知识点`);
  return point;
}

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((e) => e.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const db = new MockDb(fixtures);
  const api = createMockApi({ db, control, routes });
  const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    api.handle({ method, url: `http://localhost/api/v1${path}`, headers: new Headers(headers), body });
  /** 取知识点主页，并用生成的 Zod 结构校验。 */
  const home = async (pointId: string): Promise<Json> => {
    const outcome = await call("GET", `/learner/points/${pointId}/home`);
    expect(outcome.kind, pointId).toBe("json");
    if (outcome.kind !== "json") return {};
    expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
    const result = parser?.safeParse(outcome.body);
    expect(result?.success, `${pointId}（?state=${state}）：${String(result?.error)}`).toBe(true);
    return outcome.body as Json;
  };
  return { control, api, call, home };
}

function rowOf(body: Json, questionId: string): Json {
  const row = (body["questions"] as Json[]).find((item) => item["id"] === questionId);
  if (row === undefined) throw new Error(`关联题目里没有 ${questionId}`);
  return row;
}

describe("S10 假数据（mocks/pages/S10.ts）", () => {
  it("生成的 Zod 结构里有本页接口的响应", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试：demo 与每个示例知识点，正常、空、受限、数据不足四种数据都通过生成的 Zod 校验", async () => {
    for (const mode of MODES) {
      const { control, home } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const ids = ["demo", ...exam.map.chapters.flatMap((chapter) => chapter.sample_points.map((point) => point.id))];
        for (const id of ids) await home(id);
      }
    }
  });

  it("demo 换成当前演示考试的示范知识点；四种数据各是该有的样子；规则没实现，标示例数据", async () => {
    const normal = await setup().home("demo");
    expect((normal["point"] as Json)["name"]).toBe(demoPoint("kj").name);
    expect((normal["materials"] as unknown[]).length).toBeGreaterThan(0);
    expect(normal["data_source"]).toBe("sample");
    const empty = await setup("empty").home("demo");
    expect([empty["materials"], empty["questions"]]).toEqual([[], []]);
    const restricted = await setup("restricted").home("demo");
    expect((restricted["exam_profile"] as Json)["maturity"]).toBe("cold");
    const insufficient = await setup("insufficient_data").home("demo");
    expect((insufficient["exam_profile"] as Json)["maturity"]).toBe("maturing");
    expect(((insufficient["point"] as Json)["exam_level"] as Json)["estimated"]).toBe(true);
  });

  it("没有这个知识点回 404", async () => {
    const outcome = await setup().call("GET", "/learner/points/not-a-point/home");
    expect(outcome.kind === "json" && outcome.status).toBe(404);
  });

  it("做错一题，关联题目里这道题的“做错几次”跟着加一（内存仓库里的作答）", async () => {
    const { call, home } = setup();
    const kj = fixtures.exams.find((e) => e.key === "kj");
    const question = kj?.questions.find((q) => q.response_form === "choice" && q.knowledge_point_ids.includes(demoPoint("kj").id));
    if (question === undefined) throw new Error("示范知识点没有选择题");
    const before = rowOf(await home("demo"), question.id);
    const wrongOption = question.answer?.includes(1) === true ? 0 : 1;
    const answer = { question_id: question.id, question_version: question.version, response: { selected: [wrongOption] }, confidence: "sure", duration_ms: 9000 };
    const submitted = await call("POST", "/practice/answers", answer, { "Idempotency-Key": "s10-wrong-once" });
    expect(submitted.kind === "json" && submitted.status).toBe(200);
    const after = rowOf(await home("demo"), question.id);
    expect(after["status"]).toBe("wrong");
    expect(after["times"]).toBe(Number(before["status"] === "wrong" ? before["times"] : 0) + 1);
  });
});

describe("S10 七态判断（data.ts）", () => {
  const waiting: HomeQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): HomeQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });

  it("还在取：加载；查询被暂停（浏览器离线）：离线", () => {
    expect(homeView(waiting).state).toBe("loading");
    expect(homeView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
  });

  it("请求没拿到回应：离线；接口回 403：受限；其他错误：出错", () => {
    expect(homeView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(homeView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(homeView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
    expect(homeView(failed(new ApiError("COMMON_NOT_FOUND"))).state).toBe("error");
  });

  it("网络与服务异常只再试一次；4xx 不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});

/** 让生成的钩子发出的请求直接交给假数据接口（不经 Service Worker）。 */
function stubFetch(api: MockApi): void {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const outcome = await api.handle({
      method: init?.method ?? "GET",
      url: new URL(url, "http://localhost").href,
      headers: new Headers(init?.headers),
      body: undefined,
    });
    if (outcome.kind === "hang") return new Promise<Response>(() => undefined);
    if (outcome.kind !== "json") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("S10 页面（整个学员端挂在 /kp/demo）", () => {
  it("正常态：标题是示范知识点的名字，九张卡片都在", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/kp/demo", <App />);
    const name = demoPoint("kj").name;
    await settle(() => heading(host) === name);
    expect(heading(host)).toBe(name);
    const titles = [
      copy.ladder.title,
      copy.methods.title,
      copy.mistakes.title,
      copy.questions.title,
      copy.evidence.title,
      copy.materials.title,
      copy.profile.title,
      copy.relations.title,
      copy.cards.title,
    ];
    for (const title of titles) expect(host.textContent).toContain(title);
    await unmount();
  });

  it("空态：页头还在，提示“去挂资料”并链到我的资料", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/kp/demo", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    const empty = host.querySelector(".ui-state--empty");
    expect(empty?.textContent).toContain(copy.state.empty.title);
    expect(linkByText(empty, copy.state.empty.action)?.getAttribute("href")).toBe("/materials");
    expect(heading(host)).toBe(demoPoint("kj").name);
    await unmount();
  });

  it("出错态：自动再试一次后显示“知识点主页没能加载”和“重试”", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/kp/demo", <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null, 250);
    const error = host.querySelector(".ui-state--error");
    expect(error?.textContent).toContain("知识点主页没能加载");
    expect([...(error?.querySelectorAll("button") ?? [])].map((button) => button.textContent)).toContain("重试");
    await unmount();
  });
});
