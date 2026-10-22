// S06 今日的测试（照 S10 样板页写，浏览器模式）。
// ① 假数据：四个演示考试 × 六个视图（再加不传视图）× 正常、空、受限、数据不足，都通过生成的 Zod 校验；各视图的数据是该有的样子。
// ② data.ts：七态判断只看请求结果；重试策略；?view= 只认页面登记的六个视图；一键开始的去向用路由表。
// ③ 整个学员端挂在 /today，假数据接口接到生成的钩子上：正常、?view= 切视图、空态、出错各走一遍。
// ④ 第 2 轮修的两处：生成的请求地址带上 view（?view= 才生效）；“待验证复核”按今天的作答算进度，做完英雄区接着指向下一项。
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGetTodayHomeUrl, type S06TodayHome } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { VOCAB } from "@exam-prep/shared/vocab";
import { App } from "../../App.tsx";
import { linkByText, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S06.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { PAGE_BY_ID } from "../../router/pages.ts";
import { TODAY_VIEWS, forcedView, goPath, isEmptyToday, nextTask, shouldRetry, todayView, type TodayQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getTodayHomeResponse"] as Parser | undefined;
const answerParser = (zodSchemas as Record<string, unknown>)["submitAnswerBody"] as Parser | undefined;
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
  /** 取今日页的数据（view 不传时由数据定），并用生成的 Zod 结构校验。 */
  const today = async (view = ""): Promise<S06TodayHome> => {
    const query = view === "" ? "" : `?view=${view}`;
    const outcome = await api.handle({ method: "GET", url: `http://localhost/api/v1/plan/today/home${query}`, headers: new Headers(), body: undefined });
    if (outcome.kind !== "json") throw new Error(`今日页的接口没有回 JSON：${outcome.kind}`);
    expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
    const result = parser?.safeParse(outcome.body);
    expect(result?.success, `view=${view}（?state=${state}）：${String(result?.error)}`).toBe(true);
    return outcome.body as S06TodayHome;
  };
  /** 在做题页作答：和做题页提交的是同一个接口（POST /practice/answers），作答记进内存仓库。 */
  const answer = async (questionId: string): Promise<void> => {
    const question = fixtures.exams.flatMap((exam) => exam.questions).find((item) => item.id === questionId);
    const body = {
      question_id: questionId,
      question_version: question?.version,
      response: { selected: [...(question?.answer ?? [])] },
      confidence: "sure",
      duration_ms: 0,
    };
    expect(answerParser?.safeParse(body).success, `作答的请求体不合契约：${questionId}`).toBe(true);
    const headers = new Headers({ "idempotency-key": `S06-${questionId}` });
    const outcome = await api.handle({ method: "POST", url: "http://localhost/api/v1/practice/answers", headers, body });
    expect(outcome.kind === "json" ? outcome.status : outcome.kind, `作答没有记上：${questionId}`).toBe(200);
  };
  return { control, api, today, answer };
}

const itemsOf = (data: S06TodayHome) => data.segments.flatMap((group) => group.items);
const segmentOf = (data: S06TodayHome, segment: string) => data.segments.find((group) => group.segment === segment)?.items ?? [];

describe("S06 假数据（mocks/pages/S06.ts）", () => {
  it("生成的 Zod 结构里有本页接口的响应", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试 × 六个视图（再加不传视图）× 正常、空、受限、数据不足，都通过生成的 Zod 校验", async () => {
    for (const mode of MODES) {
      const { control, today } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        for (const view of ["", ...TODAY_VIEWS]) await today(view);
      }
    }
  });

  it("不传视图时按数据定：今天还有没做完的，是正常视图；规则没实现，标示例数据", async () => {
    const data = await setup().today();
    expect([data.view, data.data_source, data.ai_paused]).toEqual(["normal", "sample", "none"]);
  });

  it("正常视图：先做推迟有损失的；下一项是进行中的那项；件数与清单对得上；有换档与润色过的理由", async () => {
    const data = await setup().today("normal");
    expect(data.segments.map((group) => group.segment)).toEqual(["consolidate", "advance", "closing"]);
    const next = nextTask(data);
    expect([next?.task.status, next?.task.segment]).toEqual(["in_progress", "consolidate"]);
    const items = itemsOf(data);
    expect(data.summary.task_count).toBe(items.length);
    expect(data.summary.done_count).toBe(items.filter((item) => item.task.status === "done" || item.task.status === "seen").length);
    expect(data.tiers?.options.map((option) => option.tier)).toEqual(["full", "lite", "minimal"]);
    expect(items.some((item) => item.polished !== undefined)).toBe(true);
  });

  it("首次进入：第 1 天、不给轮次、都还没做；全部完成：都已完成、没有下一项与换档，给明天第一件事", async () => {
    const { today } = setup();
    const first = await today("first");
    expect([first.day_no, first.round]).toEqual([1, undefined]);
    expect(itemsOf(first).every((item) => item.task.status === "todo")).toBe(true);
    const done = await today("done");
    expect(itemsOf(done).every((item) => item.task.status === "done")).toBe(true);
    expect([done.next_task_id, done.tiers]).toEqual([undefined, undefined]);
    expect(done.tomorrow_first).toBeDefined();
  });

  it("不可学日与中断回归：只有巩固段有任务、不给换档；中断回归给中断天数；导师不可用：理由不带润色句", async () => {
    const { today } = setup();
    for (const view of ["off", "back"] as const) {
      const data = await today(view);
      expect([segmentOf(data, "advance"), segmentOf(data, "closing"), data.tiers]).toEqual([[], [], undefined]);
      expect(segmentOf(data, "consolidate").length).toBeGreaterThan(0);
    }
    expect((await today("back")).away_days).toBeGreaterThan(0);
    const noai = await today("noai");
    expect(noai.ai_paused).toBe("unavailable");
    expect(itemsOf(noai).every((item) => item.polished === undefined)).toBe(true);
  });

  it("空：三段都没有任务；受限：只暂停高成本 AI，清单照常；数据不足：按典型节奏排", async () => {
    expect(isEmptyToday(await setup("empty").today())).toBe(true);
    const restricted = await setup("restricted").today();
    expect([restricted.ai_paused, isEmptyToday(restricted)]).toEqual(["quota", false]);
    expect(itemsOf(restricted).every((item) => item.polished === undefined)).toBe(true);
    expect((await setup("insufficient_data").today()).pace).toBe("typical");
  });

  it("待验证复核：进度按内存仓库里今天的作答算，做完记为已完成，下一项接着往下走（feat:S06-06、S06-07）", async () => {
    const { today, answer } = setup();
    const before = await today();
    const verify = itemsOf(before).find((item) => item.task.source === "verify_recheck");
    const ids = verify?.task.question_ids ?? [];
    expect(ids.length, "待验证复核要有题，作答才有地方记").toBeGreaterThan(0);
    // 还没作答：显示演示用的“进行中”，英雄区的“继续”指向它
    expect([verify?.task.status, before.next_task_id]).toEqual(["in_progress", verify?.task.id]);
    for (const id of ids) await answer(id);
    const after = await today();
    const done = itemsOf(after).find((item) => item.task.id === verify?.task.id);
    expect([done?.task.status, done?.task.answered_count]).toEqual(["done", ids.length]);
    expect(after.summary.done_count).toBe(before.summary.done_count + 1);
    const open = itemsOf(after).filter((item) => item.task.status !== "done" && item.task.status !== "seen");
    expect(after.next_task_id, "下一项是清单里还没做的第一项").toBe(open[0]?.task.id);
    expect(after.next_task_id).not.toBe(verify?.task.id);
  });
});

describe("S06 数据判断（data.ts）", () => {
  const waiting: TodayQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): TodayQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });

  it("还在取：加载；查询被暂停（浏览器离线）：离线", () => {
    expect(todayView(waiting).state).toBe("loading");
    expect(todayView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
  });

  it("请求没拿到回应：离线；接口回 403：受限；其他错误：出错", () => {
    expect(todayView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(todayView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(todayView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });

  it("网络与服务异常只再试一次；4xx 不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });

  it("?view= 只认页面登记的六个视图", () => {
    expect(PAGE_BY_ID.S06.views.map((view) => view.key)).toEqual([...TODAY_VIEWS]);
    expect([forcedView("done"), forcedView("whatever"), forcedView(null)]).toEqual(["done", undefined, undefined]);
  });

  it("一键开始的去向用路由表：带参数的页面填接口给的参数，没给就用 demo", () => {
    expect(goPath({ page: "S15" })).toBe("/review");
    expect(goPath({ page: "S18" })).toBe("/quiz/demo");
    expect(goPath({ page: "S12", param: "doc-1" })).toBe("/reader/doc-1");
  });
});

describe("S06 接口地址（生成的请求函数）", () => {
  it("?view= 作为查询参数 view 发给接口：契约里写明 view 不展开，生成的地址不会丢掉它", () => {
    expect(getGetTodayHomeUrl({ view: "first" })).toBe("/plan/today/home?view=first");
    expect(getGetTodayHomeUrl({})).toBe("/plan/today/home");
  });
});

/** 让生成的钩子发出的请求直接交给假数据接口（不经 Service Worker）；requested 记下每次请求的完整地址。 */
function stubFetch(api: MockApi, requested: string[] = []): void {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const href = new URL(url, "http://localhost").href;
    requested.push(href);
    const outcome = await api.handle({
      method: init?.method ?? "GET",
      url: href,
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

describe("S06 页面（整个学员端挂在 /today）", () => {
  it("正常态：三段都在，英雄区的“继续”直达下一项的具体位置，底部有完成口径", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/today", <App />);
    await settle(() => host.textContent?.includes(copy.list.title) === true);
    const text = host.textContent ?? "";
    for (const segment of Object.values(VOCAB.today_segment)) expect(text).toContain(segment);
    const label = copy.hero.continue.replace("{{source}}", VOCAB.task_source.verify_recheck);
    expect(linkByText(host, label)?.getAttribute("href")).toBe("/quiz/demo");
    expect(text).toContain(copy.list.evidence);
    await unmount();
  });

  it("?view=off：今天不可学，只留到期复习的最小版，提示去学习计划", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/today?view=off", <App />);
    await settle(() => host.textContent?.includes(copy.list.off_meta) === true);
    expect(linkByText(host, copy.list.off_plan)?.getAttribute("href")).toBe("/plan");
    await unmount();
  });

  it("?view=first：今日页的请求带上 view=first，页面显示首次进入那一版（第 1 天，清单已按摸底结果排好）", async () => {
    const requested: string[] = [];
    stubFetch(setup().api, requested);
    const { host, unmount } = await mountAt("/today?view=first", <App />);
    const lead = copy.hero.line.first.split("{{")[0] ?? "";
    await settle(() => host.textContent?.includes(lead) === true);
    const views = requested.filter((url) => url.includes("/plan/today/home")).map((url) => new URL(url).searchParams.get("view"));
    expect(views, "今日页的请求要带上地址里的 ?view=").toContain("first");
    expect(host.textContent).toContain(lead);
    expect(host.textContent).toContain(copy.hero.day_no.replace("{{n}}", "1"));
    await unmount();
  });

  it("做完“待验证复核”回到今日：英雄区接着指向下一项，不再停在它上面（feat:S06-06）", async () => {
    const { api, today, answer } = setup();
    stubFetch(api);
    const verify = itemsOf(await today()).find((item) => item.task.source === "verify_recheck");
    const resume = copy.hero.continue.replace("{{source}}", VOCAB.task_source.verify_recheck);
    const before = await mountAt("/today", <App />);
    await settle(() => linkByText(before.host, resume) !== undefined);
    expect(linkByText(before.host, resume)).toBeDefined();
    await before.unmount();
    // 在做题页把这一项的题做完（这里直接交给假数据接口），再回到今日
    for (const id of verify?.task.question_ids ?? []) await answer(id);
    const next = nextTask(await today());
    const source = next === undefined ? "" : VOCAB.task_source[next.task.source];
    const label = (next?.task.status === "in_progress" ? copy.hero.continue : copy.hero.start).replace("{{source}}", source);
    const after = await mountAt("/today", <App />);
    await settle(() => linkByText(after.host, label) !== undefined);
    expect(next?.task.id).not.toBe(verify?.task.id);
    expect(linkByText(after.host, label)?.getAttribute("href")).toBe(next === undefined ? undefined : goPath(next.go));
    expect(linkByText(after.host, resume)).toBeUndefined();
    await after.unmount();
  });

  it("空态：英雄区还在，提示“生成计划”并链到起点报告与方案", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/today", <App />);
    await settle(() => host.textContent?.includes(copy.state.empty.title) === true);
    expect(host.querySelector("section[aria-label]")).not.toBeNull();
    expect(linkByText(host, copy.state.empty.action)?.getAttribute("href")).toBe("/start-report");
    await unmount();
  });

  it("出错态：显示公共的出错状态", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/today", <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null);
    expect(host.querySelector(".ui-state--error")).not.toBeNull();
    await unmount();
  });
});
