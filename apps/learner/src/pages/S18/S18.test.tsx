// S18 做题与解析的测试（U18a，照 S10 样板写，浏览器模式）。
// ① 假数据：四个演示考试、两个示范题组，正常、空、受限、数据不足四种数据都通过生成的 Zod 校验；提交揭晓、再交回 409、生成题核对、测评态交卷各走一遍。
// ② 七态判断（data.ts）只看请求结果；重试策略；demo 在 gen 视图换成导师出题的示范题组。③ 整个学员端挂在 /quiz/demo：正常、空态、出错各走一遍。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import kj from "../../../../../fixtures/pages/S18/junior-accounting.json";
import { App } from "../../App.tsx";
import { heading, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S18.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { DEMO_GENERATED, sessionIdFor, sessionView, shouldRetry, type SessionQuery } from "./data.ts";

type Json = Record<string, unknown>;

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (name: string): Parser | undefined => (zodSchemas as Record<string, unknown>)[name] as Parser | undefined;
/** 北京时间 2026-10-21 10:00。 */
const NOW = Date.parse("2026-10-21T02:00:00Z");
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((e) => e.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const db = new MockDb(fixtures);
  const api = createMockApi({ db, control, routes });
  const call = (method: string, path: string, body?: unknown) =>
    api.handle({ method, url: `http://localhost/api/v1${path}`, headers: new Headers(), body });
  /** 调接口；成功的响应用生成的 Zod 结构校验。 */
  const json = async (method: string, path: string, body: unknown, schema: string, status = 200): Promise<Json> => {
    const outcome = await call(method, path, body);
    expect(outcome.kind, path).toBe("json");
    if (outcome.kind !== "json") return {};
    expect(outcome.status, JSON.stringify(outcome.body)).toBe(status);
    if (status === 200) {
      const result = parser(schema)?.safeParse(outcome.body);
      expect(result?.success, `${method} ${path}（?state=${state}）：${String(result?.error)}`).toBe(true);
    }
    return outcome.body as Json;
  };
  const session = (id: string) => json("GET", `/practice/sessions/${id}`, undefined, "getQuizSessionResponse");
  const answer = (id: string, item: Json, selected: number[], status = 200) =>
    json(
      "POST",
      `/practice/sessions/${id}/answers`,
      {
        item_id: item["id"],
        question_id: (item["question"] as Json)["id"],
        question_version: (item["question"] as Json)["version"],
        response: { selected },
        confidence: "sure",
        duration_ms: 30000,
        hint_level: 0,
      },
      "submitQuizAnswerResponse",
      status,
    );
  return { control, call, json, session, answer };
}

const itemsOf = (body: Json): Json[] => body["items"] as Json[];

describe("S18 假数据（mocks/pages/S18.ts）", () => {
  it("生成的 Zod 结构里有本页四个接口", () => {
    for (const name of ["getQuizSessionResponse", "submitQuizAnswerResponse", "checkGeneratedQuestionResponse", "finishQuizSessionResponse"]) {
      expect(typeof parser(name)?.safeParse, name).toBe("function");
    }
  });

  it("四个演示考试、两个示范题组：正常、空、受限、数据不足四种数据都通过生成的 Zod 校验", async () => {
    for (const mode of MODES) {
      const { control, session } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        for (const id of ["demo", DEMO_GENERATED]) await session(id);
      }
    }
  });

  it("demo 是题库的示范题组、demo-gen 是导师出题；断点续做停在第一道没做的题；规则没实现，标示例数据", async () => {
    const { session, call } = setup();
    const objective = await session("demo");
    expect(objective["title"]).toBe(kj.sessions.objective.title);
    expect([objective["kind"], objective["mode"], objective["resume_index"], objective["data_source"]]).toEqual(["objective", "in_class", 3, "sample"]);
    const generated = await session(DEMO_GENERATED);
    expect([generated["kind"], generated["mode"]]).toEqual(["generated", "in_class"]);
    expect(itemsOf(generated).every((item) => item["check"] !== "not_needed")).toBe(true);
    const missing = await call("GET", "/practice/sessions/not-a-session");
    expect(missing.kind === "json" && missing.status).toBe(404);
  });

  it("空态做完了有小结；受限是测评态（不能切换模式、不能看提示）；数据不足停在没有群体数据的已揭晓选择题", async () => {
    const empty = await setup("empty").session("demo");
    expect(empty["finished"]).toBe(true);
    expect(empty["summary"]).toBeDefined();
    const restricted = await setup("restricted").session("demo");
    expect(restricted["mode"]).toBe("assessment");
    expect(restricted["restrictions"]).toEqual({ mode_locked: true, hints_locked: true });
    expect(itemsOf(restricted).some((item) => item["status"] === "revealed")).toBe(false);
    const insufficient = await setup("insufficient_data").session("demo");
    const resumed = itemsOf(insufficient)[insufficient["resume_index"] as number] ?? {};
    expect(resumed["status"]).toBe("revealed");
    expect(((resumed["result"] as Json)["solution"] as Json)["group_miss_rate"]).toBeNull();
  });

  it("提交一题当场揭晓（随堂）；揭晓后再交回 409；不选把握度回 422", async () => {
    const { session, answer, json } = setup();
    const current = itemsOf(await session("demo"))[3] ?? {};
    const revealed = await answer("demo", current, [0]);
    expect(revealed["status"]).toBe("revealed");
    expect((revealed["result"] as Json)["correct"]).toBe(true);
    await answer("demo", current, [1], 409);
    const next = itemsOf(await session("demo"))[4] ?? {};
    await json(
      "POST",
      "/practice/sessions/demo/answers",
      { item_id: next["id"], question_id: (next["question"] as Json)["id"], question_version: 1, response: { selected: [0] }, duration_ms: 1, hint_level: 0 },
      "",
      422,
    );
  });

  it("生成题先做后核：揭晓后待确认、不计证据；确认没问题后计证据并升为三级；只能确认一次", async () => {
    const { session, answer, json } = setup();
    const item = itemsOf(await session(DEMO_GENERATED))[2] ?? {};
    const revealed = await answer(DEMO_GENERATED, item, [0]);
    expect(revealed["check"]).toBe("pending");
    expect((revealed["result"] as Json)["evidence_counted"]).toBe(false);
    const path = `/practice/sessions/${DEMO_GENERATED}/checks`;
    const checked = await json("POST", path, { item_id: item["id"], verdict: "ok" }, "checkGeneratedQuestionResponse");
    expect(checked["check"]).toBe("ok");
    expect((checked["result"] as Json)["evidence_counted"]).toBe(true);
    expect((checked["question"] as Json)["credibility"]).toBe("generated_confirmed");
    await json("POST", path, { item_id: item["id"], verdict: "problem" }, "", 409);
  });

  it("测评态（?state=restricted）：交的题先不揭晓，交卷后一起揭晓", async () => {
    const { session, answer, json } = setup("restricted");
    const item = itemsOf(await session("demo"))[3] ?? {};
    const waiting = await answer("demo", item, [0]);
    expect(waiting["status"]).toBe("answered");
    expect(waiting["result"]).toBeUndefined();
    const done = await json("POST", "/practice/sessions/demo/finish", undefined, "finishQuizSessionResponse");
    expect(done["finished"]).toBe(true);
    expect(itemsOf(done)[3]?.["status"]).toBe("revealed");
  });
});

describe("S18 七态判断与取数（data.ts）", () => {
  const waiting: SessionQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): SessionQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });

  it("还在取：加载；查询被暂停或请求没拿到回应：离线；403：受限；其他错误：出错", () => {
    expect(sessionView(waiting).state).toBe("loading");
    expect(sessionView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(sessionView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(sessionView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(sessionView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });

  it("网络与服务异常只再试一次；4xx 不重试；demo 在 gen 视图换成导师出题的示范题组", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(sessionIdFor("demo", "gen")).toBe(DEMO_GENERATED);
    expect(sessionIdFor("demo", "obj")).toBe("demo");
    expect(sessionIdFor("s-1", "gen")).toBe("s-1");
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
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
    });
    if (outcome.kind === "hang") return new Promise<Response>(() => undefined);
    if (outcome.kind !== "json") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
  });
}

function apiFor(state = ""): MockApi {
  const control = new DevControl({
    examKeys: fixtures.exams.map((e) => e.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  return createMockApi({ db: new MockDb(fixtures), control, routes });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("S18 页面（整个学员端挂在 /quiz/demo）", () => {
  it("正常态：页头是题组名，题目卡有把握度三档，右栏有本组进度与练习小结", async () => {
    stubFetch(apiFor());
    const { host, unmount } = await mountAt("/quiz/demo", <App />);
    await settle(() => heading(host) === kj.sessions.objective.title);
    expect(heading(host)).toBe(kj.sessions.objective.title);
    expect(host.querySelectorAll("main fieldset input[type=radio]").length).toBeGreaterThanOrEqual(3);
    expect(host.textContent).toContain(copy.side.progress);
    expect(host.textContent).toContain(copy.summary.title);
    await unmount();
  });

  it("空态：页头还在，提示“这一组题做完了”和“看小结”", async () => {
    stubFetch(apiFor("empty"));
    const { host, unmount } = await mountAt("/quiz/demo", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    expect(host.querySelector(".ui-state--empty")?.textContent).toContain(copy.state.empty.title);
    expect(heading(host)).toBe(kj.sessions.objective.title);
    await unmount();
  });

  it("出错态：自动再试一次后显示“做题与解析没能加载”和“重试”", async () => {
    stubFetch(apiFor("error"));
    const { host, unmount } = await mountAt("/quiz/demo", <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null, 250);
    const error = host.querySelector(".ui-state--error");
    expect(error?.textContent).toContain("做题与解析没能加载");
    expect([...(error?.querySelectorAll("button") ?? [])].map((button) => button.textContent)).toContain("重试");
    await unmount();
  });
});
