import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as contract from "@exam-prep/contract";
import type { MockOutcome } from "@exam-prep/contract/mock-browser";
import { OPERATIONS } from "@exam-prep/contract/operations";
import * as zodSchemas from "@exam-prep/contract/zod";
import { param } from "@exam-prep/params";
import { DEFAULT_DAY_SETTINGS, addDays, dayStart } from "@exam-prep/shared/today";
import { invalidateAfter, matchesOperation } from "../api/refresh.ts";
import { createMockApi } from "./api.ts";
import { DevControl } from "./control.ts";
import { MockDb } from "./db.ts";
import { loadDemoFixtures } from "./fixtures.ts";
import { collectRoutes, loadRouteModules } from "./registry.ts";
import { defineRoute } from "./route.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
/** 北京时间 2026-10-21 10:00。 */
const NOW = Date.parse("2026-10-21T02:00:00Z");
const SCHEMAS: Record<string, unknown> = { ...zodSchemas };
const KJ = fixtures.exams[0]?.examId ?? "";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
type Json = Record<string, unknown>;
interface Task {
  id: string;
  source: string;
  status: string;
  question_ids: string[];
  answered_count: number;
}

function setup(real: string[] = []) {
  let search = "";
  const control = new DevControl({
    examKeys: fixtures.exams.map((e) => e.key),
    defaultExamKey: fixtures.defaultKey,
    realDomains: real,
    search: () => search,
    clock: () => NOW,
  });
  const db = new MockDb(fixtures);
  const api = createMockApi({ db, control, routes });
  const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    api.handle({ method, url: `http://localhost/api/v1${path}`, headers: new Headers(headers), body });
  const setState = (state: string) => (search = state ? `?state=${state}` : "");
  return { control, db, api, call, setState };
}

function ok(outcome: MockOutcome, schema?: string): Json {
  expect(outcome.kind).toBe("json");
  if (outcome.kind !== "json") return {};
  expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
  if (schema !== undefined) {
    const parser = SCHEMAS[schema] as Partial<Parser> | undefined;
    expect(typeof parser?.safeParse, `生成的 Zod 结构里没有 ${schema}`).toBe("function");
    const result = (parser as Parser).safeParse(outcome.body);
    expect(result.success, `${schema}：${String(result.error)}`).toBe(true);
  }
  return outcome.body as Json;
}

/** 选择题作答的请求体。 */
function choice(questionId: string, selected: number[], confidence = "sure"): Json {
  return { question_id: questionId, question_version: 1, response: { selected }, confidence, duration_ms: 9000 };
}

function tasksOf(list: Json): Task[] {
  return (list["segments"] as { tasks: Task[] }[]).flatMap((s) => s.tasks);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("假数据层：自动注册与四个演示考试", () => {
  it("domains/ 与 pages/ 下导出的路由都收上来；重复写或写了契约里没有的接口直接报错", () => {
    const ids = routes.map((r) => r.operationId);
    for (const id of ["getMeContext", "getTodayList", "listMistakes", "submitAnswer", "getCurrentPlan"]) expect(ids).toContain(id);
    const route = defineRoute("getMeContext", () => ({}));
    expect(() => collectRoutes({ "a.ts": { routes: [route] }, "b.ts": { routes: [route] } })).toThrow(/写了两次/);
    expect(() => collectRoutes({ "c.ts": {} })).toThrow(/routes/);
  });

  it("四个演示考试切过去，各接口的假数据都通过生成的 Zod 校验", async () => {
    for (const exam of fixtures.exams) {
      const { control, call } = setup();
      control.setExam(exam.key);
      const context = ok(await call("GET", "/me/context"), "getMeContextResponse");
      expect((context["goal"] as Json)["exam_id"]).toBe(exam.examId);
      ok(await call("GET", "/plan/today"), "getTodayListResponse");
      ok(await call("GET", "/plan/current"), "getCurrentPlanResponse");
      ok(await call("GET", "/plan/proposals"), "listProposalsResponse");
      ok(await call("GET", "/notes"), "listNotesResponse");
      ok(await call("GET", "/materials"), "listMaterialsResponse");
      ok(await call("GET", "/notifications"), "listNotificationsResponse");
      ok(await call("GET", `/exams/${exam.examId}`), "getExamProfileResponse");
      ok(await call("GET", `/exams/${exam.examId}/map`), "getKnowledgeMapResponse");
      ok(await call("GET", `/learner/mastery-grid?mapId=${exam.map.map_id}`), "getMasteryGridResponse");
      ok(await call("GET", "/params"), "getParamsResponse");
      for (const card of exam.cards) ok(await call("GET", `/cards/${card.id}`), "getCardResponse");
      for (const question of exam.questions) {
        const pointId = question.knowledge_point_ids[0] ?? "";
        ok(await call("GET", `/maps/points/${pointId}`), "getKnowledgePointResponse");
        ok(await call("GET", `/practice/next?pointId=${pointId}`), "nextQuestionResponse");
        const view = ok(await call("GET", `/questions/${question.id}`), "getQuestionResponse");
        expect(view["answer"]).toBeUndefined();
        const locked = await call("GET", `/questions/${question.id}/solution`);
        expect(locked.kind === "json" && locked.status).toBe(409);
        const answer = { question_id: question.id, question_version: question.version, confidence: "sure", duration_ms: 30000 };
        const response = question.response_form === "choice" ? { selected: [1] } : { text: "演示作答" };
        ok(await call("POST", "/practice/answers", { ...answer, response }, { "Idempotency-Key": question.id }), "submitAnswerResponse");
        ok(await call("GET", `/questions/${question.id}/solution`), "getQuestionSolutionResponse");
      }
      ok(await call("GET", "/practice/mistakes"), "listMistakesResponse");
    }
  });
});

describe("假数据层：写操作、幂等、时间旅行与强制状态", () => {
  it("做完一题，错题本与今日清单跟着变；同一个幂等键串行重试只算一次", async () => {
    const { db, call } = setup();
    const practice = tasksOf(ok(await call("GET", "/plan/today"))).find((t) => t.source === "practice");
    const questionId = practice?.question_ids[0] ?? "";
    expect(practice?.status).toBe("todo");
    const submit = () => call("POST", "/practice/answers", choice(questionId, [1]), { "Idempotency-Key": "k-1" });
    const first = ok(await submit());
    expect(first["correct"]).toBe(false);
    expect(first["mistake_id"]).toEqual(expect.any(String));
    expect(ok(await submit())["attempt_id"]).toBe(first["attempt_id"]);
    expect(db.attempts(KJ)).toHaveLength(1);
    const mistakes = ok(await call("GET", "/practice/mistakes"));
    const rows = (mistakes["items"] as Json[]).map((m) => [m["question_id"], m["status"], m["wrong_count"]]);
    expect(rows).toEqual([[questionId, "new", 1]]);
    const after = tasksOf(ok(await call("GET", "/plan/today"))).find((t) => t.id === practice?.id);
    expect(after).toMatchObject({ status: "done", answered_count: 1 });
  });

  it("同一个幂等键并发提交两次只执行一次：作答编号相同、只有一条作答、错题只记一次", async () => {
    const { db, call } = setup();
    const question = fixtures.exams[0]?.questions.find((q) => q.response_form === "choice");
    const submit = () => call("POST", "/practice/answers", choice(question?.id ?? "", [1]), { "Idempotency-Key": "k-2" });
    const [a, b] = await Promise.all([submit(), submit()]);
    expect(ok(a)["attempt_id"]).toBe(ok(b)["attempt_id"]);
    expect(db.attempts(KJ)).toHaveLength(1);
    const mistakes = ok(await call("GET", "/practice/mistakes"));
    expect((mistakes["items"] as Json[]).map((m) => m["wrong_count"])).toEqual([1]);
  });

  it("重置演示数据会清掉幂等记录：同一个键重新写入真的再写一次，错题本与今日清单都查得到", async () => {
    const { db, call } = setup();
    const practice = tasksOf(ok(await call("GET", "/plan/today"))).find((t) => t.source === "practice");
    const questionId = practice?.question_ids[0] ?? "";
    const submit = () => call("POST", "/practice/answers", choice(questionId, [1]), { "Idempotency-Key": "k-3" });
    const before = ok(await submit());
    db.reset();
    expect(db.attempts(KJ)).toHaveLength(0);
    const again = ok(await submit());
    expect(again["attempt_id"]).not.toBe(before["attempt_id"]);
    expect(db.attempts(KJ)).toHaveLength(1);
    const mistakes = ok(await call("GET", "/practice/mistakes"));
    expect((mistakes["items"] as Json[]).map((m) => m["id"])).toEqual([again["mistake_id"]]);
    const after = tasksOf(ok(await call("GET", "/plan/today"))).find((t) => t.id === practice?.id);
    expect(after).toMatchObject({ status: "done", answered_count: 1 });
  });

  it("时间旅行：过了日界线才算新的一天；错题按回炉间隔回到今日清单", async () => {
    const { control, db, call } = setup();
    const settings = db.daySettings();
    control.travelTo(dayStart("2026-10-21", settings).getTime() - 1);
    expect(ok(await call("GET", "/me/context"))["today"]).toBe("2026-10-20");
    control.travelTo(dayStart("2026-10-21", settings).getTime());
    expect(ok(await call("GET", "/me/context"))["today"]).toBe("2026-10-21");
    const question = fixtures.exams[0]?.questions.find((q) => q.response_form === "choice");
    await call("POST", "/practice/answers", choice(question?.id ?? "", [3], "vague"));
    const gap = param("practice.mistake.review_intervals")[0] ?? 1;
    const retryOn = (list: Json) => tasksOf(list).find((t) => t.source === "mistake_retry");
    control.travelTo(dayStart(addDays("2026-10-21", gap - 1), settings).getTime());
    expect(retryOn(ok(await call("GET", "/plan/today")))).toBeUndefined();
    control.travelTo(dayStart(addDays("2026-10-21", gap), settings).getTime());
    const list = ok(await call("GET", "/plan/today"), "getTodayListResponse");
    expect(retryOn(list)?.question_ids).toEqual([question?.id]);
    expect(tasksOf(list).find((t) => t.source === "practice")?.status).toBe("todo");
  });

  it("?state= 由接口层统一处理：加载、出错、离线、空、受限", async () => {
    const { call, setState } = setup();
    setState("error");
    const error = await call("GET", "/plan/today");
    expect(error.kind === "json" && [error.status, (error.body as Json)["code"]]).toEqual([500, "COMMON_INTERNAL"]);
    setState("offline");
    expect((await call("GET", "/plan/today")).kind).toBe("network_error");
    setState("loading");
    expect((await call("GET", "/plan/today")).kind).toBe("hang");
    setState("empty");
    expect(ok(await call("GET", "/practice/mistakes"))["items"]).toEqual([]);
    expect(ok(await call("GET", "/notifications"), "listNotificationsResponse")["items"]).toEqual([]);
    expect(ok(await call("GET", "/me/context"))["goal"]).toBeUndefined();
    setState("restricted");
    const restricted = await call("GET", "/plan/today");
    expect(restricted.kind === "json" && restricted.status).toBe(403);
    setState("");
    ok(await call("GET", "/plan/today"));
  });

  it("VITE_REAL 列出的领域走真接口，其余仍走假数据；契约外的地址放行", async () => {
    const { call } = setup(["plan"]);
    expect((await call("GET", "/plan/today")).kind).toBe("passthrough");
    ok(await call("GET", "/me/context"));
    expect((await call("GET", "/not-in-contract")).kind).toBe("passthrough");
  });
});

describe("示范接口与数据刷新", () => {
  it("GET /api/v1/me/context 从生成的钩子一路走到界面", async () => {
    const { api } = setup();
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const outcome = await api.handle({
        method: init?.method ?? "GET",
        url: new URL(url, "http://localhost").href,
        headers: new Headers(init?.headers),
        body: undefined,
      });
      if (outcome.kind !== "json") throw new TypeError("network");
      const headers = { "content-type": "application/json" };
      return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers });
    });
    function Probe() {
      const query = contract.useGetMeContext();
      const text = query.data === undefined ? "…" : `${query.data.today} ${query.data.goal?.exam_name ?? ""}`;
      return <p>{text}</p>;
    }
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    await vi.waitFor(() => expect(host.textContent).toBe("2026-10-21 初级会计职称"));
    await act(async () => root.unmount());
    host.remove();
  });

  it("作答之后按契约 x-invalidates 让错题本与今日清单的查询失效（api-rules 第 6 节）", async () => {
    expect(OPERATIONS.submitAnswer.invalidates).toContain("listMistakes");
    expect(matchesOperation("getKnowledgeMap", "/exams/cet-6/map")).toBe(true);
    expect(matchesOperation("getExamProfile", "/exams/cet-6/map")).toBe(false);
    const keyOf = (contract as Record<string, unknown>)["getListMistakesQueryKey"];
    expect(typeof keyOf).toBe("function");
    if (typeof keyOf === "function") expect(matchesOperation("listMistakes", (keyOf as () => unknown[])()[0])).toBe(true);
    const client = new QueryClient();
    client.setQueryData(["/practice/mistakes"], {});
    client.setQueryData(["/plan/today"], {});
    client.setQueryData(["/exams/cet-6"], {});
    await invalidateAfter(client, "submitAnswer");
    expect(client.getQueryState(["/practice/mistakes"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["/plan/today"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["/exams/cet-6"])?.isInvalidated).toBe(false);
  });

  it("用户时区与日界线已登记为参数，和“今天”函数的临时常量一致（F03 交给 F04 的登记）", () => {
    expect(param("account.day.time_zone")).toBe(DEFAULT_DAY_SETTINGS.timeZone);
    expect(param("account.day.start_hour")).toBe(DEFAULT_DAY_SETTINGS.dayStartHour);
  });
});
