// S04 摸底诊断的测试（照 S10 样板写，浏览器模式）。
// ① 假数据：四个演示考试，正常、空、受限、数据不足四种数据与 ?view=test 的演示会话都通过生成的 Zod 校验；开始、交一题（选“不会”可以不作答）、
//    暂停与接着做、改用快速定位、按章自评、交卷后把诊断错题加入错题本，都会真的改变内存里的会话；不合规的提交回 4xx。
// ② 七态判断与提交条件（data.ts）只看请求结果与作答；重试策略；地址里的 ?view=。③ 整个学员端挂在 /diagnosis：正常、空态、出错各走一遍。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { S04Diagnosis } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { App } from "../../App.tsx";
import { heading, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S04.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { diagnosisBlocker, diagnosisView, forcedView, shouldRetry, type DiagnosisQuery } from "./data.ts";

type Json = Record<string, unknown>;

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getDiagnosisResponse"] as Parser | undefined;
/** 北京时间 2026-10-23 10:00。 */
const NOW = Date.parse("2026-10-23T02:00:00Z");
const VARIANTS = ["", "empty", "restricted", "insufficient_data"] as const;
const BASE = "/practice/diagnosis";

function setup(state = "", exam?: string) {
  const control = new DevControl({
    examKeys: fixtures.exams.map((e) => e.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  if (exam !== undefined) control.setExam(exam);
  const db = new MockDb(fixtures);
  const api = createMockApi({ db, control, routes });
  let key = 0;
  const call = (method: string, path: string, body?: unknown) => {
    key += 1;
    const headers = new Headers(method === "GET" ? {} : { "idempotency-key": `k${key}` });
    return api.handle({ method, url: `http://localhost/api/v1${path}`, headers, body });
  };
  /** 发请求，要求回 200，并用生成的 Zod 结构校验（读与写都回整页数据 S04Diagnosis）。 */
  const json = async (method: string, path: string, body?: unknown): Promise<Json> => {
    const outcome = await call(method, path, body);
    expect(outcome.kind, `${method} ${path}`).toBe("json");
    if (outcome.kind !== "json") return {};
    expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
    const result = parser?.safeParse(outcome.body);
    expect(result?.success, `${method} ${path}（?state=${state}）：${String(result?.error)}`).toBe(true);
    return outcome.body as Json;
  };
  return { api, call, json };
}

const sessionOf = (body: Json): Json => body["session"] as Json;

/** 交当前这一题：选“不会”，不作答。 */
function unknownAnswer(session: Json): Json {
  const current = session["current"] as Json;
  const question = current["question"] as Json;
  return {
    item_id: current["id"],
    question_id: question["id"],
    question_version: question["version"],
    response: {},
    confidence: "unknown",
    duration_ms: 1500,
  };
}

describe("S04 假数据（mocks/pages/S04.ts）", () => {
  it("生成的 Zod 结构里有本页接口的响应", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试：正常、空、受限、数据不足四种数据与 ?view=test 的演示会话都通过生成的 Zod 校验", async () => {
    for (const exam of fixtures.exams) {
      for (const state of VARIANTS) {
        const { json } = setup(state, exam.key);
        expect((await json("GET", BASE))["view"], `${exam.key} ${state}`).toBe("start");
        const demo = await json("GET", `${BASE}?view=test`);
        expect(demo["view"]).toBe("test");
        expect(sessionOf(demo)["stage"]).toBe("questions");
        expect(demo["data_source"], "规则没实现，标示例数据").toBe("sample");
      }
    }
  });

  it("空：题源不足只能快速定位；受限：测评限制提示；数据不足：有模块要用同类数据代替或无依据", async () => {
    const empty = await setup("empty").json("GET", BASE);
    expect(empty["pool_sufficient"]).toBe(false);
    expect((empty["modes"] as Json[]).filter((mode) => mode["available"] === true).map((mode) => mode["mode"])).toEqual(["quick"]);
    expect((await setup("restricted").json("GET", BASE))["assessment_restricted"]).toBe(true);
    const normal = await setup().json("GET", BASE);
    expect(normal["assessment_restricted"]).toBe(false);
    expect(normal["prior_modules"]).toBe(0);
    for (const exam of fixtures.exams) {
      const thin = await setup("insufficient_data", exam.key).json("GET", BASE);
      expect(Number(thin["prior_modules"]) + Number(thin["no_basis_modules"]), exam.key).toBeGreaterThan(0);
    }
  });

  it("自建考试（ds）：自适应诊断不可用，默认选中章节抽测并标推荐（规则卡 R3）", async () => {
    const modes = (await setup("", "ds").json("GET", BASE))["modes"] as Json[];
    const adaptive = modes.find((mode) => mode["mode"] === "adaptive");
    const chapter = modes.find((mode) => mode["mode"] === "chapter");
    expect(adaptive?.["available"]).toBe(false);
    expect(adaptive?.["unavailable_reason"]).toBe("custom_map");
    expect(chapter?.["recommended"]).toBe(true);
    expect(chapter?.["selected"]).toBe(true);
  });

  it("开始后进测评中；题目不带答案与提示；选“不会”可以不作答；暂停后已答的题保留，接着做回到测评中", async () => {
    const { json } = setup();
    const started = await json("POST", `${BASE}/sessions`, { mode: "adaptive" });
    expect(started["view"]).toBe("test");
    const session = sessionOf(started);
    expect(session["answered"]).toBe(0);
    const question = (session["current"] as Json)["question"] as Json;
    expect(question["answer"], "测评中不给答案").toBeUndefined();
    expect(question["hints"], "测评中不给提示").toBeUndefined();
    const id = String(session["id"]);
    const next = await json("POST", `${BASE}/sessions/${id}/answers`, unknownAnswer(session));
    expect(sessionOf(next)["answered"]).toBe(1);
    const paused = await json("POST", `${BASE}/sessions/${id}/pause`);
    expect(paused["view"]).toBe("start");
    expect(sessionOf(paused)["paused"]).toBe(true);
    expect(sessionOf(paused)["answered"], "暂停不丢已答的题").toBe(1);
    expect((await json("POST", `${BASE}/sessions/${id}/resume`))["view"]).toBe("test");
  });

  it("不合规的提交回 4xx：没选把握度、不是当前这题、没作答又没选“不会”", async () => {
    const { json, call } = setup();
    const session = sessionOf(await json("POST", `${BASE}/sessions`, { mode: "adaptive" }));
    const good = unknownAnswer(session);
    const path = `${BASE}/sessions/${String(session["id"])}/answers`;
    const { confidence: _dropped, ...noConfidence } = good;
    for (const body of [noConfidence, { ...good, item_id: "not-this-one" }, { ...good, confidence: "sure" }]) {
      const outcome = await call("POST", path, body);
      expect(outcome.kind).toBe("json");
      if (outcome.kind === "json") expect(outcome.status, JSON.stringify(body)).toBeGreaterThanOrEqual(400);
    }
  });

  it("快速定位：按章自评后出核对题，做完交卷；诊断错题不自动进错题本，勾选后才加入", async () => {
    const { json } = setup();
    let session = sessionOf(await json("POST", `${BASE}/sessions`, { mode: "quick" }));
    expect(session["stage"]).toBe("rating");
    const id = String(session["id"]);
    const ratings = ((session["rating"] as Json)["modules"] as Json[]).map((row) => ({ module_id: row["module_id"], rating: "basic" }));
    session = sessionOf(await json("POST", `${BASE}/sessions/${id}/ratings`, { ratings }));
    for (let guard = 0; session["stage"] === "questions" && guard < 20; guard += 1) {
      session = sessionOf(await json("POST", `${BASE}/sessions/${id}/answers`, unknownAnswer(session)));
    }
    expect(session["stage"]).toBe("finished");
    expect(session["finish_reason"]).toBe("quick_finished");
    const mistakes = session["mistakes"] as Json[];
    expect(mistakes.length).toBeGreaterThan(0);
    expect(mistakes.every((row) => row["added"] === false), "不自动进错题本").toBe(true);
    const first = String(mistakes[0]?.["item_id"]);
    const after = sessionOf(await json("POST", `${BASE}/sessions/${id}/mistakes`, { item_ids: [first] }));
    expect((after["mistakes"] as Json[]).find((row) => row["item_id"] === first)?.["added"]).toBe(true);
    expect((after["modules"] as Json[]).some((row) => row["status"] === "in_progress"), "交卷后没有进行中的模块").toBe(false);
  });

  it("中途改用快速定位：已答的题保留，没答过题的章改成按章自评", async () => {
    const { json } = setup();
    const demo = sessionOf(await json("GET", `${BASE}?view=test`));
    const switched = sessionOf(await json("POST", `${BASE}/sessions/${String(demo["id"])}/switch-quick`));
    expect(switched["stage"]).toBe("rating");
    expect(switched["answered"]).toBe(demo["answered"]);
    const toRate = ((switched["rating"] as Json)["modules"] as Json[]).map((row) => row["module_id"]);
    const measured = (switched["modules"] as Json[]).filter((row) => row["status"] === "estimated").map((row) => row["module_id"]);
    expect(measured.length).toBeGreaterThan(0);
    expect(toRate.some((moduleId) => measured.includes(moduleId))).toBe(false);
  });
});

describe("S04 七态判断与提交条件（data.ts）", () => {
  const waiting: DiagnosisQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): DiagnosisQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });
  const loaded = (data: Json): DiagnosisQuery => ({ data: data as unknown as S04Diagnosis, error: null, status: "success", fetchStatus: "idle" });

  it("还在取：加载；查询被暂停或请求没拿到回应：离线；接口回 403：受限；其他错误：出错", () => {
    expect(diagnosisView(waiting).state).toBe("loading");
    expect(diagnosisView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(diagnosisView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(diagnosisView(failed(new ApiError("COMMON_FORBIDDEN", {}))).state).toBe("restricted");
    expect(diagnosisView(failed(new ApiError("COMMON_INTERNAL", {}))).state).toBe("error");
  });

  it("题源不足且还没有会话：空态；有数据但没联网：照常显示并加离线提示", async () => {
    expect(diagnosisView(loaded(await setup("empty").json("GET", BASE))).state).toBe("empty");
    const normal = loaded(await setup().json("GET", BASE));
    expect(diagnosisView(normal).state).toBe("normal");
    expect(diagnosisView({ ...normal, fetchStatus: "paused" }).stale).toBe(true);
  });

  it("网络与服务异常只再试一次；4xx 不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN", {}))).toBe(false);
  });

  it("地址里的 ?view= 只认开始页与测评中", () => {
    expect(forcedView("start")).toBe("start");
    expect(forcedView("test")).toBe("test");
    expect(forcedView("other")).toBeUndefined();
    expect(forcedView(null)).toBeUndefined();
  });

  it("提交条件（规则卡 R6）：选“不会”可以不作答；其他把握度要先作答；不选把握度不能交", () => {
    const shape = { form: "choice", options: ["甲", "乙"] } as const;
    const none = { selected: [], texts: [] };
    const picked = { selected: [1], texts: [] };
    expect(diagnosisBlocker(shape, none, "unknown")).toBeNull();
    expect(diagnosisBlocker(shape, none, "sure")).toBe("answer");
    expect(diagnosisBlocker(shape, picked, null)).toBe("confidence");
    expect(diagnosisBlocker(shape, picked, "guess")).toBeNull();
  });
});

/** 把生成的钩子发出的请求接到假数据接口上（不起 Service Worker）。 */
function stubFetch(api: MockApi): void {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(request?.url ?? String(input), "http://localhost").toString();
    const method = init?.method ?? request?.method ?? "GET";
    const headers = new Headers(init?.headers ?? request?.headers);
    const raw = typeof init?.body === "string" ? init.body : undefined;
    const outcome = await api.handle({ method, url, headers, body: raw === undefined ? undefined : (JSON.parse(raw) as unknown) });
    if (outcome.kind === "hang") return new Promise<Response>(() => undefined);
    if (outcome.kind === "empty") return new Response(null, { status: outcome.status });
    if (outcome.kind !== "json") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("S04 页面（整个学员端挂在 /diagnosis）", () => {
  it("正常态：开始页标题“先摸个底”，三种方式、题从哪来、规则都在", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/diagnosis", <App />);
    await settle(() => heading(host) === copy.header.title);
    expect(heading(host)).toBe(copy.header.title);
    for (const text of [copy.mode.adaptive.title, copy.mode.quick.title, copy.mode.chapter.title, copy.source.title, copy.rules.title]) {
      expect(host.textContent).toContain(text);
    }
    await unmount();
  });

  it("空态：页头还在，说明题源不足，按钮“改用快速定位”", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/diagnosis", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    const empty = host.querySelector(".ui-state--empty");
    expect(empty?.textContent).toContain(copy.state.empty.title);
    expect([...(empty?.querySelectorAll("button") ?? [])].map((button) => button.textContent)).toContain(copy.state.empty.action);
    expect(heading(host)).toBe(copy.header.title);
    await unmount();
  });

  it("出错态：自动再试一次后显示“摸底诊断没能加载”和“重试”", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/diagnosis", <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null, 250);
    const error = host.querySelector(".ui-state--error");
    expect(error?.textContent).toContain("摸底诊断没能加载");
    expect([...(error?.querySelectorAll("button") ?? [])].map((button) => button.textContent)).toContain("重试");
    await unmount();
  });
});
