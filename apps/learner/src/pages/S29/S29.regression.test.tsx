// S29 回归测试（U29 续写）：每一条都先在修复前跑过并确认失败，修好后通过，永久保留（AGENTS.md「测试与修 bug」）。
// 覆盖：示例引用与考试地图一致、按考试分开缓存、接口拒绝优先于旧缓存、离线只留能离线用的内容、AI 内容复制带标识、拍照先选用途。
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGetMeContextQueryKey, type MeContext, type S29SearchPage } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { App } from "../../App.tsx";
import { DEMO_CONTEXT, click, mount, settle, testClient } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S29.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { pathTo } from "../../routes.ts";
import { searchView } from "./data.ts";

interface QuickRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly point_id: string;
}
interface QuickTable {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly ai_generated: boolean;
  readonly rows: readonly QuickRow[];
}
interface PageFixture {
  readonly sample_query: string;
  readonly aliases: readonly string[];
  readonly point_id: string;
  readonly excerpt: string;
  readonly material_id: string;
  readonly question_id: string;
  readonly quick_tables: readonly QuickTable[];
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const pages = import.meta.glob<PageFixture>("../../../../../fixtures/pages/S29/*.json", { eager: true, import: "default" });
const NOW = Date.parse("2026-10-22T02:00:00Z");
const SEARCH_PATH = "/learner/search";
/** 速查表由对应类型的知识点汇成（bk spec S29-04）：数值与时限←事实数据型，公式与步骤←方法程序型，条文←条文原文型，
 *  术语←概念原理型或事实数据型；易混对照按易混关系汇集，不限类型（null）。 */
const CATEGORY_TYPES: Readonly<Record<string, readonly string[] | null>> = {
  values: ["fact"],
  formulas: ["procedure"],
  clauses: ["statute"],
  terms: ["concept", "fact"],
  compare: null,
};

function fixtureOf(examId: string): PageFixture {
  const fixture = Object.entries(pages).find(([path]) => path.endsWith(`/${examId}.json`))?.[1];
  if (fixture === undefined) throw new Error(`S29 缺少演示考试 ${examId} 的页面数据`);
  return fixture;
}
function examOf(key: string) {
  const exam = fixtures.exams.find((item) => item.key === key);
  if (exam === undefined) throw new Error(`没有演示考试 ${key}`);
  return exam;
}
function pointName(examId: string): string {
  const exam = fixtures.exams.find((item) => item.examId === examId);
  const fixture = fixtureOf(examId);
  const point = exam?.map.chapters.flatMap((chapter) => chapter.sample_points).find((item) => item.id === fixture.point_id);
  if (point === undefined) throw new Error(`S29 示例知识点不在 ${examId} 的地图里`);
  return point.name;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** state：用 ?state= 强制的页面状态（受限、空等由本页假数据的变体给出）。 */
function setupApi(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  async function search(params: Record<string, string> = {}): Promise<S29SearchPage> {
    const outcome = await api.handle({
      method: "GET",
      url: `http://localhost/api/v1${SEARCH_PATH}?${new URLSearchParams(params)}`,
      headers: new Headers(),
      body: undefined,
    });
    if (outcome.kind !== "json" || outcome.status !== 200) throw new Error(`S29 搜索没有正常返回：${JSON.stringify(outcome)}`);
    return outcome.body as S29SearchPage;
  }
  return { api, control, search };
}

/** 页面级测试的环境：真实假数据层＋可控的本页接口（迟迟不回、拒绝访问、断网），保留查询客户端以便触发重新获取。 */
interface Harness {
  readonly client: QueryClient;
  readonly control: DevControl;
  readonly mode: { hold: boolean; deny: boolean; offline: boolean };
}
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function harness(state = "", context: MeContext = DEMO_CONTEXT): Harness {
  const { api, control } = setupApi(state);
  const mode = { hold: false, deny: false, offline: false };
  stubFetch(api, mode);
  return { client: testClient(context), control, mode };
}
function stubFetch(api: MockApi, mode: Harness["mode"]): void {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://localhost");
    if (url.pathname.endsWith(SEARCH_PATH)) {
      if (mode.offline) throw new TypeError("network");
      if (mode.deny) return json(403, new ApiError("COMMON_FORBIDDEN").toBody());
      if (mode.hold) return new Promise<Response>(() => undefined);
    }
    const outcome = await api.handle({
      method: init?.method ?? "GET",
      url: url.href,
      headers: new Headers(init?.headers),
      body: undefined,
    });
    if (outcome.kind === "hang") return new Promise<Response>(() => undefined);
    if (outcome.kind !== "json") throw new TypeError("network");
    return json(outcome.status, outcome.body);
  });
}
function open(h: Harness, path: string) {
  return mount(
    <QueryClientProvider client={h.client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const resultTitles = (host: ParentNode): string[] =>
  [...host.querySelectorAll(".s29-result-title")].map((link) => link.textContent?.trim() ?? "");
const buttonByText = (root: ParentNode, text: string): HTMLButtonElement | undefined =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === text);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("S29 示例引用与考试地图一致（回归：示例查询曾指向别的知识点、资料和题目）", () => {
  for (const exam of fixtures.exams) {
    it(`${exam.examId}：查询、别名、资料、题目和速查表行都对应地图里真实存在且内容相符的知识点`, async () => {
      const fixture = fixtureOf(exam.examId);
      const points = new Map(exam.map.chapters.flatMap((chapter) => chapter.sample_points).map((point) => [point.id, point]));
      const point = points.get(fixture.point_id);
      expect(point, "示例知识点必须在考试地图里").toBeDefined();
      expect(point?.name, "示例查询要能对上知识点名称").toContain(fixture.sample_query);
      expect(fixture.aliases).toContain(fixture.sample_query);
      expect(new Set(fixture.aliases).size, "别名不重复").toBe(fixture.aliases.length);
      const material = exam.learner.materials.find((item) => isRecord(item) && item["id"] === fixture.material_id);
      expect(isRecord(material) ? material["knowledge_point_ids"] : undefined, "资料要覆盖这个知识点").toContain(fixture.point_id);
      expect(isRecord(material) ? material["access"] : undefined, "结果跳阅读器，资料要能全文阅读").toBe("parsable");
      const question = exam.questions.find((item) => item.id === fixture.question_id);
      expect(question?.knowledge_point_ids, "题目要考这个知识点").toContain(fixture.point_id);
      expect(fixture.quick_tables[0]?.rows[0]?.point_id, "默认显示的速查表就是和关键词相关的那张").toBe(fixture.point_id);
      for (const table of fixture.quick_tables) {
        const allowed = CATEGORY_TYPES[table.category];
        expect(allowed, `不认识的速查表类别 ${table.category}`).not.toBeUndefined();
        for (const row of table.rows) {
          const target = points.get(row.point_id);
          expect(target, `${table.id}/${row.id} 指向的知识点不在地图里`).toBeDefined();
          expect(row.label, `${table.id}/${row.id} 的名称要与知识点一致`).toBe(target?.name);
          if (allowed !== null && allowed !== undefined) {
            expect(
              target?.knowledge_types.some((type) => allowed.includes(type)),
              `${table.id}/${row.id}：「${target?.name ?? ""}」的知识类型不属于这类速查表`,
            ).toBe(true);
          }
        }
      }
      const { control, search } = setupApi();
      control.setExam(exam.key);
      for (const alias of fixture.aliases) {
        const data = await search({ q: alias });
        const items = data.groups.flatMap((group) => group.items);
        expect(items.find((item) => item.kind === "point")?.target_id, `别名「${alias}」`).toBe(fixture.point_id);
        expect(items.find((item) => item.kind === "material")?.target_id, `别名「${alias}」`).toBe(fixture.material_id);
        const shown = data.quick_tables.find((table) => table.id === data.selected_table);
        expect(
          shown?.rows.some((row) => row.point_id === fixture.point_id),
          `别名「${alias}」右栏速查表`,
        ).toBe(true);
      }
    });
  }
});

describe("S29 搜索词、类型和速查表真的随请求发出（回归：生成的请求地址丢掉了普通查询参数，搜什么都回示例结果）", () => {
  it("地址带关键词、类型和速查表时，接口只回该类型的结果并选中那张表", async () => {
    const h = harness();
    const fixture = fixtureOf("junior-accounting");
    const alias = fixture.aliases[1] ?? "";
    const { host, unmount } = await open(h, `${pathTo("S29")}?q=${encodeURIComponent(alias)}&kind=material&table=terms`);
    try {
      await settle(() => host.querySelectorAll(".s29-results > section").length === 1);
      const sections = [...host.querySelectorAll(".s29-results > section")].map((section) => section.getAttribute("aria-label"));
      expect(sections, "只剩“我的资料原文”一类").toEqual([copy.kind.material]);
      expect(host.querySelector(".s29-results a")?.getAttribute("href")).toBe(pathTo("S12", { docId: fixture.material_id }));
      expect(host.querySelector<HTMLSelectElement>(".ui-cols__aside select")?.value).toBe("terms");
    } finally {
      await unmount();
    }
  });

  it("搜不到的关键词进入“没找到”；最近访问视图不带关键词，进入空态", async () => {
    for (const [query, state] of [
      ["?q=__no_s29_matching_content__", "insufficient_data"],
      ["?view=recent", "empty"],
    ] as const) {
      const h = harness();
      const { host, unmount } = await open(h, `${pathTo("S29")}${query}`);
      try {
        await settle(() => host.querySelector(`.ui-state--${state}`) !== null);
        expect(host.querySelector(`.ui-state--${state}`), query).not.toBeNull();
        expect(resultTitles(host), query).toEqual([]);
      } finally {
        await unmount();
        vi.unstubAllGlobals();
      }
    }
  });
});

describe("S29 接口拒绝与出错优先于旧缓存（回归：有旧缓存时 403 仍显示旧的个人内容）", () => {
  it("判断函数：有缓存时被拒绝显示受限、服务出错显示出错，都不再带旧数据；断网仍保留缓存并标明离线", async () => {
    const data = await setupApi().search();
    expect(searchView({ data, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_FORBIDDEN") })).toEqual({
      state: "restricted",
      data: undefined,
      stale: false,
    });
    expect(searchView({ data, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") })).toEqual({
      state: "error",
      data: undefined,
      stale: false,
    });
    expect(searchView({ data, status: "error", fetchStatus: "idle", error: new TypeError("network") })).toEqual({
      state: data.state_hint,
      data,
      stale: true,
    });
  });

  it("页面：已显示结果后接口拒绝访问，个人结果全部收起，显示账号受限的说明与出路（不是拍照额度）", async () => {
    const h = harness();
    const { host, unmount } = await open(h, pathTo("S29"));
    try {
      await settle(() => resultTitles(host).length > 0);
      expect(resultTitles(host)).toContain(pointName("junior-accounting"));
      h.mode.deny = true;
      await act(async () => {
        await h.client.refetchQueries({ type: "active" });
      });
      await settle(() => host.querySelector(".s29-results") === null);
      expect(host.querySelector(".s29-results"), "被拒绝后不能继续显示旧结果").toBeNull();
      expect(host.querySelector(".s29-recent"), "最近访问也是个人内容，一并收起").toBeNull();
      const state = host.querySelector(".ui-state--restricted");
      expect(state?.textContent).toContain(copy.state.forbidden.title);
      expect(state?.textContent).not.toContain(copy.state.restricted.title);
      expect(state?.querySelector("a")?.getAttribute("href")).toBe(pathTo("S33"));
    } finally {
      await unmount();
    }
  });

  it("页面：拍照额度受限（本页假数据的受限示例，不是接口拒绝）只停拍照，文本搜索和结果照常可用", async () => {
    const h = harness("restricted");
    const { host, unmount } = await open(h, pathTo("S29"));
    try {
      await settle(() => resultTitles(host).length > 0);
      expect(resultTitles(host)).toContain(pointName("junior-accounting"));
      expect(host.querySelector(".ui-state--restricted")?.textContent).toContain(copy.state.restricted.title);
      const input = host.querySelector<HTMLInputElement>('input[type="search"]');
      expect(input, "受限时搜索框照常可用").not.toBeNull();
      const alias = fixtureOf("junior-accounting").aliases[2] ?? "";
      await act(async () => {
        if (input === null) return;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, alias);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await click(buttonByText(host, copy.search.submit));
      await settle(() => input?.value === alias && resultTitles(host).length > 0);
      expect(resultTitles(host), "受限时文本搜索仍出结果").toContain(pointName("junior-accounting"));
      await click(buttonByText(host, copy.search.photo));
      const dialog = () => document.querySelector<HTMLDialogElement>("dialog[open]");
      await settle(() => dialog() !== null);
      await click(dialog()?.querySelector<HTMLInputElement>('input[value="practice"]'));
      expect(buttonByText(dialog() ?? document, copy.photo.continue)?.disabled, "额度受限时不能继续拍照").toBe(true);
    } finally {
      await unmount();
    }
  });
});

describe("S29 离线只保留能离线用的内容（回归：断网后拍照入口仍可点）", () => {
  it("断网时保留已缓存的结果并标明离线；拍照搜题要联网，按钮不可用", async () => {
    const h = harness();
    const { host, unmount } = await open(h, pathTo("S29"));
    try {
      await settle(() => resultTitles(host).length > 0);
      h.mode.offline = true;
      await act(async () => {
        await h.client.refetchQueries({ type: "active" });
      });
      await settle(() => host.querySelector(".ui-banner") !== null, 250);
      expect(resultTitles(host)).toContain(pointName("junior-accounting"));
      expect(host.querySelector(".ui-banner")?.textContent).toContain(copy.state.offline.body);
      expect(buttonByText(host, copy.search.photo)?.disabled, "断网时拍照搜题不可用").toBe(true);
    } finally {
      await unmount();
    }
  });
});

describe("S29 同页切换考试不串数据（回归：查询键不含考试，切换后仍显示上一考试的结果）", () => {
  it("接口按请求里的考试返回；不认识的考试回 404", async () => {
    const { api, control } = setupApi();
    control.setExam("kj");
    const outcome = await api.handle({
      method: "GET",
      url: `http://localhost/api/v1${SEARCH_PATH}?exam_id=cet-6`,
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind === "json" ? outcome.status : outcome.kind).toBe(200);
    const body = outcome.kind === "json" ? (outcome.body as S29SearchPage) : undefined;
    expect(body?.groups[0]?.items[0]?.target_id).toBe(fixtureOf("cet-6").point_id);
    const missing = await api.handle({
      method: "GET",
      url: `http://localhost/api/v1${SEARCH_PATH}?exam_id=no-such-exam`,
      headers: new Headers(),
      body: undefined,
    });
    expect(missing.kind === "json" ? missing.status : missing.kind).toBe(404);
  });

  it("切到六级后，新结果还没回来时不显示初级会计的结果；回来后显示六级自己的结果", async () => {
    const h = harness();
    const { host, unmount } = await open(h, pathTo("S29"));
    try {
      const before = pointName("junior-accounting");
      await settle(() => resultTitles(host).includes(before));
      expect(resultTitles(host)).toContain(before);
      h.mode.hold = true;
      h.control.setExam("en");
      act(() => {
        void h.client.invalidateQueries();
      });
      await settle(() => h.client.getQueryData<MeContext>(getGetMeContextQueryKey())?.goal?.exam_id === examOf("en").examId);
      await settle(() => !resultTitles(host).includes(before));
      expect(resultTitles(host), "目标已换成六级，不能再显示初级会计的结果").not.toContain(before);
      h.mode.hold = false;
      await act(async () => {
        await h.client.refetchQueries({ type: "active" });
      });
      const after = pointName("cet-6");
      await settle(() => resultTitles(host).includes(after));
      expect(resultTitles(host)).toContain(after);
      expect(resultTitles(host)).not.toContain(before);
    } finally {
      await unmount();
    }
  });
});

describe("S29 AI 内容与拍照流程", () => {
  function copyFrom(element: Element): string {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const clipboard = new DataTransfer();
    element.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: clipboard }));
    selection?.removeAllRanges();
    return clipboard.getData("text/plain");
  }

  it("导师答过的结果与 AI 速查表用公共 AI 内容组件包起来，复制出去的文字开头带“【AI 生成】”（回归：只有标签、复制不带标识）", async () => {
    const h = harness();
    const { host, unmount } = await open(h, `${pathTo("S29")}?table=compare`);
    try {
      await settle(() => resultTitles(host).length > 0);
      const tutor = host.querySelector(`section[aria-label="${copy.kind.tutor}"]`);
      const tutorAi = tutor?.querySelector(".ui-ai .ui-ai__body");
      expect(tutorAi, "导师答过的内容要用 AiContent 包起来").not.toBeNull();
      if (tutorAi) expect(copyFrom(tutorAi)).toMatch(/^【AI 生成】/);
      const quick = host.querySelector(".ui-cols__aside .ui-ai .ui-ai__body");
      expect(quick?.querySelector("table"), "AI 汇成的速查表要用 AiContent 包起来").not.toBeNull();
      if (quick) expect(copyFrom(quick)).toMatch(/^【AI 生成】/);
      const point = host.querySelector(`section[aria-label="${copy.kind.point}"]`);
      expect(point?.querySelector(".ui-ai"), "不是 AI 生成的结果不加标识").toBeNull();
    } finally {
      await unmount();
    }
  });

  it("拍照搜题先选用途才能继续；取消后重新打开要重新选；继续只提示即将上线，不假装上传", async () => {
    const h = harness();
    const { host, unmount } = await open(h, pathTo("S29"));
    try {
      await settle(() => resultTitles(host).length > 0);
      await click(buttonByText(host, copy.search.photo));
      const dialog = () => document.querySelector<HTMLDialogElement>("dialog[open]");
      await settle(() => dialog() !== null);
      const proceed = () => buttonByText(dialog() ?? document, copy.photo.continue);
      expect(proceed()?.disabled).toBe(true);
      await click(dialog()?.querySelector<HTMLInputElement>('input[value="explain"]'));
      expect(proceed()?.disabled).toBe(false);
      await click(buttonByText(dialog() ?? document, copy.photo.cancel));
      await settle(() => dialog() === null);
      await click(buttonByText(host, copy.search.photo));
      await settle(() => dialog() !== null);
      expect([...(dialog()?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [])].some((radio) => radio.checked)).toBe(false);
      expect(proceed()?.disabled).toBe(true);
      await click(dialog()?.querySelector<HTMLInputElement>('input[value="practice"]'));
      await click(proceed());
      await settle(() => dialog() === null);
      await settle(() => document.body.textContent?.includes(copy.soon.photo) === true);
      expect(document.body.textContent).toContain(copy.soon.photo);
    } finally {
      await unmount();
    }
  });
});
