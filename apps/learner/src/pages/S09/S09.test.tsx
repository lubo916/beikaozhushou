// S09 知识地图的测试（照 S10 样板页写，浏览器模式）。
// ① 假数据：四个演示考试，正常、空、受限、数据不足、锁定五种数据都通过生成的 Zod 校验；每章格子数等于章里的知识点数；
//    初级会计的数与原型一致；数据结构那场体检不通过、不给性价比阶梯。② 七态判断（data.ts）只看请求结果；重试策略；?view= 的键；
//    筛选只比对接口给的值。③ 整个学员端挂在 /map：方格、列表、空态、出错各走一遍。
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCount } from "@exam-prep/shared/format";
import type { S09MapOverview } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { App } from "../../App.tsx";
import { click, heading, linkByText, mountAt, settle } from "../../app/testing.tsx";
import common from "../../i18n/zh-CN/common.json";
import copy from "../../i18n/zh-CN/S09.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { MapGrid } from "./components/cells.tsx";
import { NO_FILTERS, mapView, matchesFilters, shouldRetry, viewFromSearch, type MapQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getKnowledgeMapOverviewResponse"] as Parser | undefined;
/** 北京时间 2026-10-21 10:00。 */
const NOW = Date.parse("2026-10-21T02:00:00Z");
const MODES = ["", "empty", "restricted", "insufficient_data", "locked"] as const;

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((e) => e.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const db = new MockDb(fixtures);
  const api = createMockApi({ db, control, routes });
  /** 取知识地图，并用生成的 Zod 结构校验。 */
  const overview = async (): Promise<S09MapOverview> => {
    const outcome = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/learner/map-overview",
      headers: new Headers(),
      body: undefined,
    });
    if (outcome.kind !== "json") throw new Error(`没有拿到 JSON：${outcome.kind}`);
    expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
    const result = parser?.safeParse(outcome.body);
    expect(result?.success, `?state=${state}：${String(result?.error)}`).toBe(true);
    return outcome.body as S09MapOverview;
  };
  return { control, api, overview };
}

const points = (body: S09MapOverview) => body.chapters.flatMap((chapter) => chapter.points);
const success = (data: S09MapOverview, error: unknown = null): MapQuery => ({
  data,
  error,
  status: error === null ? "success" : "error",
  fetchStatus: "idle",
});

describe("S09 假数据（mocks/pages/S09.ts）", () => {
  it("生成的 Zod 结构里有本页接口的响应", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试：五种数据都通过生成的 Zod 校验；每章格子数等于章里的知识点数；规则没实现，标示例数据", async () => {
    for (const mode of MODES) {
      const { control, overview } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const body = await overview();
        expect(body.data_source).toBe("sample");
        if (mode === "empty") continue;
        exam.map.chapters.forEach((chapter, index) => {
          expect(body.chapters[index]?.points.length, `${exam.key} ${chapter.name}`).toBe(chapter.knowledge_point_count);
        });
      }
    }
  });

  it("初级会计的数与原型一致：已学 131/212、已达标 96/197、各章达标数、需要注意 12/3/5、来源 198/9/5；默认选中今日推荐的第一个", async () => {
    const body = await setup().overview();
    expect(body.stats).toEqual({ learned: 131, reached: 96, in_scope: 197, total: 212 });
    expect(body.chapters.map((chapter) => chapter.reached)).toEqual([8, 20, 17, 11, 7, 16, 9, 8]);
    expect(body.attention).toEqual({ evidence_insufficient: 12, pending_verification: 3, no_material: 5 });
    expect(body.sources.map((row) => row.count)).toEqual([198, 9, undefined, 5]);
    expect(body.health.passed).toBe(true);
    const kj = fixtures.exams.find((exam) => exam.key === "kj");
    expect(body.focus_point_id).toBe(kj?.learner.today_tasks[0]?.knowledge_point_ids[0]);
    expect(body.relations.center_id).toBe(body.focus_point_id);
  });

  it("自建《数据结构》体检不通过：性价比阶梯锁定，一格都不给", async () => {
    const { control, overview } = setup();
    control.setExam("ds");
    const body = await overview();
    expect(body.health.passed).toBe(false);
    expect(points(body).every((point) => point.roi_tier === undefined)).toBe(true);
  });

  it("空、受限、数据不足、锁定各是该有的样子", async () => {
    expect((await setup("empty").overview()).chapters).toEqual([]);
    expect((await setup("restricted").overview()).access).toBe("extension_only");
    const thin = await setup("insufficient_data").overview();
    expect(thin.evidence_sufficient).toBe(false);
    expect(thin.attention.evidence_insufficient).toBeGreaterThan(12);
    const locked = await setup("locked").overview();
    expect(locked.health.passed).toBe(false);
    expect(points(locked).some((point) => point.roi_tier !== undefined)).toBe(false);
  });
});

describe("S09 七态判断、视图与筛选（data.ts）", () => {
  const waiting: MapQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): MapQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });

  it("还在取：加载；查询暂停或没拿到回应：离线；接口回 403：受限；其他错误：出错", () => {
    expect(mapView(waiting).state).toBe("loading");
    expect(mapView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(mapView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(mapView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(mapView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
    expect(mapView(failed(new ApiError("COMMON_NOT_FOUND"))).state).toBe("error");
  });

  it("有数据：一章都没有是空态；断网用旧数据、受限、数据不足各加一条提示；体检不通过是锁定", async () => {
    const normal = await setup().overview();
    expect(mapView(success(normal))).toMatchObject({ state: "normal", notices: [], locked: false });
    expect(mapView(success(normal, new TypeError("Failed to fetch"))).notices).toEqual(["offline"]);
    expect(mapView(success(await setup("empty").overview())).state).toBe("empty");
    expect(mapView(success(await setup("restricted").overview())).notices).toEqual(["restricted"]);
    expect(mapView(success(await setup("insufficient_data").overview())).notices).toEqual(["insufficient_data"]);
    expect(mapView(success(await setup("locked").overview())).locked).toBe(true);
  });

  it("网络与服务异常只再试一次；4xx 不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });

  it("?view= 认四个键；没写或写错时手机默认大纲树、其余默认方格", () => {
    expect(viewFromSearch("list", false)).toBe("list");
    expect(viewFromSearch("graph", true)).toBe("graph");
    expect(viewFromSearch(null, true)).toBe("tree");
    expect(viewFromSearch("nope", false)).toBe("grid");
  });

  it("筛选只比对接口给的值：未达标、有错题、重要度可以叠加；范围外单独筛", async () => {
    const all = points(await setup().overview());
    const unreached = all.filter((point) => matchesFilters(point, { ...NO_FILTERS, keys: ["unreached"] }));
    expect(unreached.length).toBe(197 - 96);
    const both = all.filter((point) => matchesFilters(point, { keys: ["unreached", "has_mistakes"], importance: [3, 4], levels: [] }));
    expect(both.every((point) => !point.reached && point.flags.includes("has_mistakes") && point.importance >= 3)).toBe(true);
    expect(all.filter((point) => matchesFilters(point, { ...NO_FILTERS, keys: ["out_of_scope"] })).length).toBe(212 - 197);
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

describe("S09 页面（整个学员端挂在 /map）", () => {
  it("方格：页名、四个视图标签、212 格、右边四张小卡", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/map?view=grid", <App />);
    await settle(() => host.querySelectorAll("button.s09-cell[data-point]").length > 0);
    expect(heading(host)).toBe(common.page.S09);
    expect(host.querySelectorAll("button.s09-cell[data-point]").length).toBe(212);
    const tabs = [...host.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
    for (const label of [copy.views.grid, copy.views.tree, copy.views.graph, copy.views.list]) expect(tabs).toContain(label);
    for (const title of [copy.stats.learned, copy.focus.title, copy.attention.title, copy.source.title])
      expect(host.textContent).toContain(title);
    await unmount();
  });

  it("?view=list：每个知识点一行，名字链到知识点主页", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/map?view=list", <App />);
    await settle(() => host.querySelector("tbody tr") !== null);
    const first = fixtures.exams.find((exam) => exam.key === "kj")?.map.chapters[0]?.sample_points[0];
    if (first === undefined) throw new Error("初级会计没有示例知识点");
    expect(host.querySelectorAll("tbody tr").length).toBe(212);
    expect(linkByText(host, first.name)?.getAttribute("href")).toBe(`/kp/${first.id}`);
    await unmount();
  });

  it("空态：页名还在，提示“由资料生成”并链到我的资料", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/map", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    const empty = host.querySelector(".ui-state--empty");
    expect(empty?.textContent).toContain(copy.state.empty.title);
    expect(linkByText(empty, copy.state.empty.action)?.getAttribute("href")).toBe("/materials");
    expect(heading(host)).toBe(common.page.S09);
    await unmount();
  });

  it("出错态：自动再试一次后显示“知识地图没能加载”和“重试”", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/map", <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null, 250);
    const error = host.querySelector(".ui-state--error");
    expect(error?.textContent).toContain("知识地图没能加载");
    expect([...(error?.querySelectorAll("button") ?? [])].map((button) => button.textContent)).toContain("重试");
    await unmount();
  });
});

describe("S09 方格键盘入口回归", () => {
  const cells = (host: HTMLElement) => [...host.querySelectorAll<HTMLButtonElement>("button.s09-cell[data-point]")];
  const entry = (host: HTMLElement) => cells(host).filter((cell) => cell.tabIndex === 0);

  it("折叠当前选中格所在章后，展开章仍可用 Tab 进入并继续方向键导航", async () => {
    const body = await setup().overview();
    const selectedId = body.chapters[0]?.points[0]?.id;
    const secondChapter = body.chapters[1];
    if (selectedId === undefined || secondChapter === undefined) throw new Error("缺少回归测试章节");
    const { host, unmount } = await mountAt(
      "/map",
      <MapGrid
        chapters={body.chapters}
        coloring="mastery"
        locked={false}
        matched={undefined}
        selectedId={selectedId}
        onSelect={() => undefined}
      />,
    );
    try {
      await click(cells(host)[0]);
      await click(host.querySelector("button.s09-row__name"));
      expect(entry(host).map((cell) => cell.dataset["point"])).toEqual([secondChapter.points[0]?.id]);
      const start = entry(host)[0];
      if (start === undefined) throw new Error("折叠后没有键盘入口");
      await act(async () => {
        start.focus();
        start.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      });
      expect(document.activeElement).toBe(cells(host)[1]);
      expect(entry(host)).toEqual([cells(host)[1]]);
      await click(host.querySelector("button.s09-row__name"));
      expect(entry(host)).toHaveLength(1);
    } finally {
      await unmount();
    }
  });

  it("切换考试后，旧焦点和选中点不在新数据里时仍保留一个可见的键盘入口", async () => {
    const body = await setup().overview();
    const first = body.chapters[0];
    const second = body.chapters[1];
    if (first === undefined || second === undefined) throw new Error("缺少回归测试章节");
    const onSelect = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <MapGrid
            chapters={[first]}
            coloring="mastery"
            locked={false}
            matched={undefined}
            selectedId={first.points[0]?.id}
            onSelect={onSelect}
          />,
        ),
      );
      await click(cells(host)[0]);
      // 保留旧 selectedId，覆盖考试切换后选中点请求尚未同步的一帧。
      await act(async () =>
        root.render(
          <MapGrid
            chapters={[second]}
            coloring="mastery"
            locked={false}
            matched={undefined}
            selectedId={first.points[0]?.id}
            onSelect={onSelect}
          />,
        ),
      );
      expect(entry(host).map((cell) => cell.dataset["point"])).toEqual([second.points[0]?.id]);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});

describe("S09 体检显示回归", () => {
  it("体检项保留格式化的数量与修复建议，不留下文案占位符", async () => {
    const { control, api, overview } = setup();
    control.setExam("ds");
    const body = await overview();
    stubFetch(api);
    const { host, unmount } = await mountAt("/map?view=grid", <App />);
    try {
      await settle(() => host.querySelector(".s09-health .s09-list") !== null);
      const text = host.querySelector(".s09-health .s09-list")?.textContent ?? "";
      for (const issue of body.health.issues) {
        expect(text).toContain(copy.source.issue[issue.kind]);
        expect(text).toContain(`${formatCount(issue.count)} 处`);
        expect(text).toContain(copy.source.fix[issue.kind]);
      }
      expect(text).not.toContain("{{");
    } finally {
      await unmount();
    }
  });
});
