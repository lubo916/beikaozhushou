// S18 做题与解析的测试（U18a，照 S10 样板写，浏览器模式）。
// ① 假数据：四个演示考试、两个示范题组，正常、空、受限、数据不足四种数据都通过生成的 Zod 校验；提交揭晓、再交回 409、生成题核对、测评态交卷各走一遍。
// ② 七态判断（data.ts）只看请求结果；重试策略；demo 在 gen 视图换成导师出题的示范题组。③ 整个学员端挂在 /quiz/demo：正常、空态、出错各走一遍。
// ④ U18b 下半：提示阶梯（服务端记用量、用过提示最高记弱证据、测评态 403）、分层解析、错因确认（可改选、进小结）、讲解与追问与引导我想、导师不可用。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { S18QuizSession } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import kj from "../../../../../fixtures/pages/S18/junior-accounting.json";
import { App } from "../../App.tsx";
import { click, heading, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S18.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { emptyResponse } from "../../../../../packages/ui/src/quiz/index.ts";
import quizCopy from "../../../../../packages/ui/src/quiz/copy.zh-CN.json";
import { QuestionCard } from "./components/QuestionCard.tsx";
import {
  DEMO_GENERATED,
  ERROR_CAUSES,
  hintLadder,
  nextOpenIndex,
  revealTone,
  sessionIdFor,
  sessionView,
  shapeOf,
  shouldRetry,
  sourceOf,
  wrongPicks,
  type SessionQuery,
} from "./data.ts";

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
  return { api, control, call, json, session, answer };
}

const itemsOf = (body: Json): Json[] => body["items"] as Json[];

describe("S18 假数据（mocks/pages/S18.ts）", () => {
  it("生成的 Zod 结构里有本页四个接口", () => {
    for (const name of [
      "getQuizSessionResponse",
      "submitQuizAnswerResponse",
      "checkGeneratedQuestionResponse",
      "finishQuizSessionResponse",
    ]) {
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
    expect([objective["kind"], objective["mode"], objective["resume_index"], objective["data_source"]]).toEqual([
      "objective",
      "in_class",
      3,
      "sample",
    ]);
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
      {
        item_id: next["id"],
        question_id: (next["question"] as Json)["id"],
        question_version: 1,
        response: { selected: [0] },
        duration_ms: 1,
        hint_level: 0,
      },
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

  it("提前交卷后：已答题和未答题都不能再提交，小结保持不变", async () => {
    const { session, answer, json } = setup("restricted");
    const before = itemsOf(await session("demo"));
    const answered = before[3] ?? {};
    const unanswered = before[4] ?? {};
    await answer("demo", answered, [0]);
    const finished = await json("POST", "/practice/sessions/demo/finish", undefined, "finishQuizSessionResponse");
    await answer("demo", answered, [1], 409);
    await answer("demo", unanswered, [0], 409);
    const after = await session("demo");
    expect(after["progress"]).toEqual(finished["progress"]);
    expect(after["summary"]).toEqual(finished["summary"]);
    expect(itemsOf(after)[4]?.["answer"]).toBeUndefined();
  });

  it.each(["ok", "problem"] as const)("生成题答完但未核对时仍能续做；最后一题核对后才完成（%s）", async (verdict) => {
    const { session, answer, json } = setup();
    const initial = await session(DEMO_GENERATED);
    for (const item of itemsOf(initial)) {
      if (item["status"] === "unanswered") await answer(DEMO_GENERATED, item, [0]);
    }
    const pending = await session(DEMO_GENERATED);
    const waiting = itemsOf(pending).filter((item) => item["check"] === "pending");
    expect(waiting.length).toBeGreaterThan(0);
    expect(pending["finished"]).toBe(false);
    expect(pending["resume_index"]).toBe(itemsOf(pending).findIndex((item) => item["check"] === "pending"));
    for (const item of waiting) {
      await json("POST", `/practice/sessions/${DEMO_GENERATED}/checks`, { item_id: item["id"], verdict }, "checkGeneratedQuestionResponse");
    }
    expect((await session(DEMO_GENERATED))["finished"]).toBe(true);
  });

  it("生成题测评交卷后仍可从待核对题继续，作答则保持结束", async () => {
    const { session, answer, json } = setup("restricted");
    const item = itemsOf(await session(DEMO_GENERATED))[2] ?? {};
    await answer(DEMO_GENERATED, item, [0]);
    const done = (await json(
      "POST",
      `/practice/sessions/${DEMO_GENERATED}/finish`,
      undefined,
      "finishQuizSessionResponse",
    )) as unknown as S18QuizSession;
    const pendingIndex = done.items.findIndex((entry) => entry.status === "revealed" && entry.check === "pending");
    expect(pendingIndex).toBeGreaterThanOrEqual(0);
    expect(done.finished).toBe(true);
    expect(done.resume_index).toBe(pendingIndex);
    expect(sessionView({ data: done, error: null, status: "success", fetchStatus: "idle" }).state).toBe("normal");
    await answer(DEMO_GENERATED, itemsOf(done as unknown as Json)[3] ?? {}, [0], 409);
  });

  it("生成题全答完：下一题按钮仍能回到先前跳过的待核对题", async () => {
    const { session, answer } = setup();
    for (const item of itemsOf(await session(DEMO_GENERATED))) {
      if (item["status"] === "unanswered") await answer(DEMO_GENERATED, item, [0]);
    }
    const data = (await session(DEMO_GENERATED)) as unknown as S18QuizSession;
    const current = data.items.length - 1;
    expect(nextOpenIndex(data.items, current)).toBe(
      data.items.findIndex((entry, index) => index !== current && entry.status === "revealed" && entry.check === "pending"),
    );
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
  it("交卷后的未答题仍展示原题，但作答、把握度和提交都锁定", async () => {
    const { json } = setup("restricted");
    const done = (await json(
      "POST",
      "/practice/sessions/demo/finish",
      undefined,
      "finishQuizSessionResponse",
    )) as unknown as S18QuizSession;
    const item = done.items[3];
    if (item === undefined) throw new Error("缺少未作答示范题");
    expect(item.status).toBe("unanswered");
    const onResponse = vi.fn();
    const onConfidence = vi.fn();
    const { host, unmount } = await mountAt(
      "/quiz/demo",
      <QuestionCard
        session={done}
        item={item}
        response={emptyResponse(shapeOf(item))}
        onResponse={onResponse}
        confidence={null}
        onConfidence={onConfidence}
        scratch=""
        onScratch={() => undefined}
        struck={[]}
        onStrike={() => undefined}
        strikeMode={false}
        onStrikeMode={() => undefined}
        flagged={false}
        onFlag={() => undefined}
        seconds={0}
        busy={false}
        onSubmit={() => undefined}
        after={null}
      />,
    );
    try {
      const inputs = [...host.querySelectorAll<HTMLInputElement>("input[type=radio]")];
      expect(inputs.length).toBeGreaterThan(0);
      expect(inputs.every((input) => input.disabled)).toBe(true);
      await click(inputs[0]);
      expect(onResponse).not.toHaveBeenCalled();
      expect(onConfidence).not.toHaveBeenCalled();
      expect([...host.querySelectorAll("button")].some((button) => button.textContent?.trim() === quizCopy.submit.action)).toBe(false);
    } finally {
      await unmount();
    }
  });

  it.each(["", "restricted"])("生成题答完后重新进入：仍停在未核对题并显示确认入口（%s）", async (state) => {
    const { api, session, answer, json } = setup(state);
    for (const item of itemsOf(await session(DEMO_GENERATED))) {
      if (item["status"] === "unanswered") await answer(DEMO_GENERATED, item, [0]);
    }
    if (state === "restricted") await json("POST", `/practice/sessions/${DEMO_GENERATED}/finish`, undefined, "finishQuizSessionResponse");
    stubFetch(api);
    const { host, unmount } = await mountAt("/quiz/demo?view=gen", <App />);
    try {
      await settle(() => host.textContent?.includes(copy.reveal.check_title) === true);
      expect(host.querySelector(".ui-state--empty")).toBeNull();
      const confirm = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === copy.reveal.check_ok,
      );
      expect(confirm).toBeDefined();
      await click(confirm);
      await settle(() => host.textContent?.includes(copy.reveal.check_done_ok) === true);
      expect(host.textContent).toContain(copy.reveal.check_done_ok);
    } finally {
      await unmount();
    }
  });

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

interface LayerJson {
  readonly steps: readonly string[];
  readonly suggested_cause?: string;
  readonly wrong_step?: number;
}
const LAYERS = kj.solution_layers as Readonly<Record<string, LayerJson>>;
const fillCopy = (text: string, values: Readonly<Record<string, string | number>>): string =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole: string, name: string) => (values[name] === undefined ? whole : String(values[name])));

describe("S18 下半（U18b）：提示阶梯、分层解析、错因确认、讲解与追问", () => {
  const hintsPath = "/practice/sessions/demo/hints";
  const causesPath = "/practice/sessions/demo/causes";
  const explainPath = "/practice/sessions/demo/explanations";

  it("生成的 Zod 结构里有下半的三个接口", () => {
    for (const name of ["takeQuizHintResponse", "saveQuizErrorCauseResponse", "askQuizTutorResponse"]) {
      expect(typeof parser(name)?.safeParse, name).toBe("function");
    }
  });

  it("提示阶梯：题目不预先带提示原文，一级一级给，用完再要回 422；交的时候说没用过也按记录算，做对最高记弱证据；揭晓后不再给", async () => {
    const { session, answer, json } = setup();
    const item = itemsOf(await session("demo"))[3] ?? {};
    expect((item["question"] as Json)["hints"]).toBeUndefined();
    const total = (item["hints"] as Json)["total"] as number;
    expect(total).toBeGreaterThan(1);
    expect((item["hints"] as Json)["shown"]).toEqual([]);
    for (let n = 1; n <= total; n += 1) {
      const next = await json("POST", hintsPath, { item_id: item["id"] }, "takeQuizHintResponse");
      expect(((next["hints"] as Json)["shown"] as string[]).length).toBe(n);
    }
    await json("POST", hintsPath, { item_id: item["id"] }, "", 422);
    const revealed = await answer("demo", item, [0]);
    const result = revealed["result"] as Json;
    expect([result["correct"], result["evidence_strength"], result["evidence_reason"]]).toEqual([true, "weak", "hint_used"]);
    expect((revealed["answer"] as Json)["hint_level"]).toBe(total);
    await json("POST", hintsPath, { item_id: item["id"] }, "", 409);
  });

  it("测评态（?state=restricted）不能看提示：回 403", async () => {
    const { session, json } = setup("restricted");
    const item = itemsOf(await session("demo"))[3] ?? {};
    await json("POST", hintsPath, { item_id: item["id"] }, "", 403);
  });

  it("答错揭晓带分层解析（分步、资料与视频位置）和导师建议错因；错因无默认，可以选、可以改选；做对的、没揭晓的不收错因", async () => {
    const { session, answer, json } = setup();
    const item = itemsOf(await session("demo"))[3] ?? {};
    const layer = LAYERS[(item["question"] as Json)["id"] as string];
    const wrong = await answer("demo", item, [1]);
    const result = wrong["result"] as Json;
    const layers = result["layers"] as Json;
    expect(layers["steps"]).toEqual(layer?.steps);
    expect((layers["sources"] as Json[]).map((source) => source["kind"])).toEqual(["material", "video"]);
    expect(layers["suggested_cause"]).toBe(layer?.suggested_cause);
    expect(result["error_cause"]).toBeUndefined();
    const saved = await json("POST", causesPath, { item_id: item["id"], cause: "method_unknown" }, "saveQuizErrorCauseResponse");
    expect((saved["result"] as Json)["error_cause"]).toBe("method_unknown");
    const changed = await json("POST", causesPath, { item_id: item["id"], cause: "concept_unclear" }, "saveQuizErrorCauseResponse");
    expect((changed["result"] as Json)["error_cause"]).toBe("concept_unclear");
    await json("POST", causesPath, { item_id: item["id"], cause: "not_a_cause" }, "", 422);
    const items = itemsOf(await session("demo"));
    await json("POST", causesPath, { item_id: items[0]?.["id"], cause: "slip" }, "", 422);
    await json("POST", causesPath, { item_id: items[4]?.["id"], cause: "slip" }, "", 422);
    const right = items[0]?.["result"] as Json;
    expect((right["layers"] as Json)["suggested_cause"]).toBeUndefined();
  });

  it("测评态交卷后选的错因进练习小结的错因分布", async () => {
    const { session, answer, json } = setup("restricted");
    const item = itemsOf(await session("demo"))[3] ?? {};
    await answer("demo", item, [1]);
    await json("POST", "/practice/sessions/demo/finish", undefined, "finishQuizSessionResponse");
    await json("POST", causesPath, { item_id: item["id"], cause: "misread" }, "saveQuizErrorCauseResponse");
    const summary = (await session("demo"))["summary"] as Json;
    expect(summary["error_causes"]).toContainEqual({ cause: "misread", count: 1 });
  });

  it("讲解与追问：揭晓前不讲（409）；揭晓后带上作答与草稿来讲，可以接着追问；引导我想先问再指出第几步；回复标示例数据", async () => {
    const { session, answer, json } = setup();
    const item = itemsOf(await session("demo"))[3] ?? {};
    const question = item["question"] as Json;
    const picked = ((question["options"] as string[]) ?? [])[1] ?? "";
    await json("POST", explainPath, { item_id: item["id"], mode: "explain", scratch: "" }, "", 409);
    await answer("demo", item, [1]);
    const first = await json("POST", explainPath, { item_id: item["id"], mode: "explain", scratch: "206 - 6" }, "askQuizTutorResponse");
    expect([first["tutor_available"], first["data_source"]]).toEqual([true, "sample"]);
    expect(first["reply"]).toContain(picked);
    expect(first["reply"]).toContain("206 - 6");
    expect((first["follow_ups"] as string[]).length).toBeGreaterThan(0);
    const asked = "why";
    const more = await json(
      "POST",
      explainPath,
      { item_id: item["id"], mode: "explain", scratch: "", follow_up: asked, thread_id: first["thread_id"] },
      "askQuizTutorResponse",
    );
    expect(more["thread_id"]).toBe(first["thread_id"]);
    expect(more["reply"]).toContain(asked);
    const opening = await json("POST", explainPath, { item_id: item["id"], mode: "guided", scratch: "" }, "askQuizTutorResponse");
    expect([opening["reply"], opening["wrong_step"]]).toEqual([kj.tutor.guided_open, undefined]);
    const pointed = await json(
      "POST",
      explainPath,
      { item_id: item["id"], mode: "guided", scratch: "", follow_up: asked, thread_id: opening["thread_id"] },
      "askQuizTutorResponse",
    );
    expect(pointed["wrong_step"]).toBe(LAYERS[question["id"] as string]?.wrong_step);
    await json("POST", explainPath, { item_id: item["id"], mode: "talk", scratch: "" }, "", 422);
  });

  it("导师不可用（演示考试 ds）：照常回 200，tutor_available 为 false、回复为空", async () => {
    const { control, session, answer, json } = setup();
    control.setExam("ds");
    const items = itemsOf(await session("demo"));
    const index = items.findIndex((entry) => entry["status"] === "unanswered" && Array.isArray((entry["question"] as Json)["options"]));
    const item = items[index] ?? {};
    await answer("demo", item, [0]);
    const reply = await json("POST", explainPath, { item_id: item["id"], mode: "explain", scratch: "" }, "askQuizTutorResponse");
    expect([reply["tutor_available"], reply["reply"]]).toEqual([false, ""]);
  });

  it("页面的显示判断只看接口给的值：提示按钮、我选错的项、揭晓色调、资料定位、错因七类", async () => {
    const { session, answer } = setup();
    const raw = itemsOf(await session("demo"));
    const data = (await session("demo")) as unknown as S18QuizSession;
    const open = data.items[3];
    if (open === undefined) throw new Error("缺少示范题");
    expect(hintLadder(open)).toEqual({ next: 1, total: open.hints.total, done: false });
    const wrong = (await answer("demo", raw[3] ?? {}, [1])) as unknown as S18QuizSession["items"][number];
    expect(wrongPicks(wrong)).toEqual([1]);
    const result = wrong.result;
    if (result === undefined) throw new Error("没有揭晓结果");
    expect(revealTone(result)).toBe("wrong");
    expect(revealTone({ ...result, correct: true, evidence_strength: "pending" })).toBe("pending");
    expect(revealTone({ ...result, correct: true, evidence_strength: "strong" })).toBe("correct");
    expect(revealTone({ ...result, correct: null, evidence_counted: false })).toBe("neutral");
    expect(sourceOf(result.layers, "material")?.kind).toBe("material");
    expect(sourceOf({ steps: [], sources: [] }, "video")).toBeUndefined();
    expect(ERROR_CAUSES).toHaveLength(new Set(ERROR_CAUSES).size);
  });

  it("页面：点“提示”一级一级给提示，并说明用过提示最高记弱证据", async () => {
    stubFetch(apiFor());
    const { host, unmount } = await mountAt("/quiz/demo", <App />);
    try {
      await settle(() => heading(host) === kj.sessions.objective.title);
      const label = fillCopy(copy.question.hint, { n: 1, total: 2 });
      await settle(() => [...host.querySelectorAll("button")].some((button) => button.textContent?.trim() === label));
      const hint = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === label);
      await click(hint);
      await settle(() => host.textContent?.includes(copy.question.hint_note) === true);
      expect(host.textContent).toContain(copy.question.hint_note);
      expect(
        [...host.querySelectorAll("button")].some(
          (button) => button.textContent?.trim() === fillCopy(copy.question.hint, { n: 2, total: 2 }),
        ),
      ).toBe(true);
    } finally {
      await unmount();
    }
  });
});
