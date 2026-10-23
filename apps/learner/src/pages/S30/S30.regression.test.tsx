// S30 回归测试（U29 续写）：每一条都先在修复前跑过并确认失败，修好后通过，永久保留（AGENTS.md「测试与修 bug」）。
// 覆盖：番茄钟绑定今日清单里真实的任务、按考试分开缓存、接口拒绝优先于旧缓存、离线只留番茄钟、举报须明确选原因。
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGetMeContextQueryKey, type MeContext, type S30StudyRoom } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { App } from "../../App.tsx";
import { DEMO_CONTEXT, click, mount, settle, testClient } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S30.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { pathTo } from "../../routes.ts";
import { roomView, useStudyRoom } from "./data.ts";

interface PageFixture {
  readonly group_size: number;
  readonly rooms: readonly { readonly id: string; readonly name: string }[];
  readonly focus: { readonly minutes: number; readonly today_minutes: number; readonly task_id?: string };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const pages = import.meta.glob<PageFixture>("../../../../../fixtures/pages/S30/*.json", { eager: true, import: "default" });
const NOW = Date.parse("2026-10-22T02:00:00Z");
const ROOM_PATH = "/engagement/study-room";

function fixtureOf(examId: string): PageFixture {
  const fixture = Object.entries(pages).find(([path]) => path.endsWith(`/${examId}.json`))?.[1];
  if (fixture === undefined) throw new Error(`S30 缺少演示考试 ${examId} 的页面数据`);
  return fixture;
}
function examOf(key: string) {
  const exam = fixtures.exams.find((item) => item.key === key);
  if (exam === undefined) throw new Error(`没有演示考试 ${key}`);
  return exam;
}
function firstRoom(examId: string): string {
  const name = fixtureOf(examId).rooms[0]?.name;
  if (name === undefined) throw new Error(`S30 演示考试 ${examId} 没有自习室`);
  return name;
}
function setupApi() {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  return { api, control };
}
async function fetchRoom(api: MockApi, query = ""): Promise<{ status: number; body: unknown }> {
  const outcome = await api.handle({
    method: "GET",
    url: `http://localhost/api/v1${ROOM_PATH}${query}`,
    headers: new Headers(),
    body: undefined,
  });
  if (outcome.kind !== "json") throw new Error(`S30 没有返回 JSON：${outcome.kind}`);
  return { status: outcome.status, body: outcome.body };
}

interface Harness {
  readonly client: QueryClient;
  readonly control: DevControl;
  readonly mode: { hold: boolean; deny: boolean; offline: boolean };
}
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
/** 本页接口的“迟迟不回”：hold 改回 false 时放行，挂着的请求照常交给假数据层返回（像慢网络终于回来）。
 *  原先挂着的请求永远不回，而 TanStack Query 对“还没有数据、正在请求”的查询再 refetch 只会等原来那次请求，
 *  测试会在“回来后”这一步自己卡死（30 秒超时）；这里只改测试替身，断言不变。 */
function createMode(): { readonly mode: Harness["mode"]; readonly whenReleased: () => Promise<void> } {
  const waiting: (() => void)[] = [];
  let hold = false;
  const mode = {
    deny: false,
    offline: false,
    get hold(): boolean {
      return hold;
    },
    set hold(value: boolean) {
      hold = value;
      if (!value) for (const release of waiting.splice(0)) release();
    },
  };
  return { mode, whenReleased: () => new Promise<void>((resolve) => waiting.push(resolve)) };
}
function harness(context: MeContext = DEMO_CONTEXT): Harness {
  const { api, control } = setupApi();
  const { mode, whenReleased } = createMode();
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://localhost");
    if (url.pathname.endsWith(ROOM_PATH)) {
      if (mode.offline) throw new TypeError("network");
      if (mode.deny) return json(403, new ApiError("COMMON_FORBIDDEN").toBody());
      if (mode.hold) await whenReleased();
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
  return { client: testClient(context), control, mode };
}
function open(h: Harness) {
  return mount(
    <QueryClientProvider client={h.client}>
      <MemoryRouter initialEntries={[pathTo("S30")]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const text = (host: ParentNode): string => host.textContent ?? "";
const buttonByText = (root: ParentNode, label: string): HTMLButtonElement | undefined =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === label);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("S30 番茄钟绑定今日清单里真实的任务（回归：示例任务是编的，不在该考试的今日清单里）", () => {
  for (const exam of fixtures.exams) {
    it(`${exam.examId}：绑定的任务在今日清单里，接口给出的任务名与清单一致`, async () => {
      const fixture = fixtureOf(exam.examId);
      const task = exam.learner.today_tasks.find((item) => item.id === fixture.focus.task_id);
      expect(task, "番茄钟绑定的任务必须来自该考试的今日清单").toBeDefined();
      const { api, control } = setupApi();
      control.setExam(exam.key);
      const { status, body } = await fetchRoom(api);
      expect(status).toBe(200);
      expect((body as S30StudyRoom).focus.task).toBe(task?.title);
    });
  }
});

describe("S30 接口拒绝与出错优先于旧缓存（回归：有旧缓存时 403 仍显示旧的房间与专注记录）", () => {
  it("判断函数：有缓存时被拒绝显示受限、服务出错显示出错，都不再带旧数据；断网仍保留缓存并标明离线", async () => {
    const { api } = setupApi();
    const data = (await fetchRoom(api)).body as S30StudyRoom;
    expect(roomView({ data, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_FORBIDDEN") })).toEqual({
      state: "restricted",
      data: undefined,
      stale: false,
    });
    expect(roomView({ data, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") })).toEqual({
      state: "error",
      data: undefined,
      stale: false,
    });
    expect(roomView({ data, status: "error", fetchStatus: "idle", error: new TypeError("network") })).toEqual({
      state: data.page_state,
      data,
      stale: true,
    });
  });

  it("页面：已显示房间后接口拒绝访问，房间与专注记录全部收起，显示账号受限的说明与出路（不是未成年人模式）", async () => {
    const h = harness();
    const { host, unmount } = await open(h);
    try {
      const room = firstRoom("junior-accounting");
      await settle(() => text(host).includes(room));
      h.mode.deny = true;
      await act(async () => {
        await h.client.refetchQueries({ type: "active" });
      });
      await settle(() => !text(host).includes(room));
      expect(text(host), "被拒绝后不能继续显示旧房间").not.toContain(room);
      expect(text(host)).not.toContain(copy.focus.title);
      const state = host.querySelector(".ui-state--restricted");
      expect(state?.textContent).toContain(copy.state.forbidden.title);
      expect(state?.textContent).not.toContain(copy.state.restricted.title);
      expect(state?.querySelector("a")?.getAttribute("href")).toBe(pathTo("S33"));
    } finally {
      await unmount();
    }
  });
});

describe("S30 离线只保留番茄钟（回归：断网后仍显示上次的在线人数和房间入口）", () => {
  it("断网时标明离线：自习室需要联网所以收起房间，番茄钟保留，小组收起", async () => {
    const h = harness();
    const { host, unmount } = await open(h);
    try {
      const room = firstRoom("junior-accounting");
      await settle(() => text(host).includes(room));
      h.mode.offline = true;
      await act(async () => {
        await h.client.refetchQueries({ type: "active" });
      });
      await settle(() => host.querySelector(".ui-banner") !== null, 250);
      expect(host.querySelector(".ui-banner")?.textContent).toContain(copy.state.offline.body);
      expect(text(host), "离线时不显示上次的房间和在线人数").not.toContain(room);
      expect(text(host)).toContain(copy.focus.title);
      expect(text(host)).not.toContain(copy.group.title);
    } finally {
      await unmount();
    }
  });
});

describe("S30 同页切换考试不串数据（回归：查询键不含考试，切换后仍显示上一考试的自习室）", () => {
  it("接口按请求里的考试返回；不认识的考试回 404", async () => {
    const { api, control } = setupApi();
    control.setExam("kj");
    const other = await fetchRoom(api, "?exam_id=cet-6");
    expect(other.status).toBe(200);
    expect((other.body as S30StudyRoom).rooms[0]?.name).toBe(firstRoom("cet-6"));
    expect((await fetchRoom(api, "?exam_id=no-such-exam")).status).toBe(404);
  });

  it("切到六级后，新数据还没回来时不显示初级会计的自习室；回来后显示六级自己的", async () => {
    const h = harness();
    const { host, unmount } = await open(h);
    try {
      const before = firstRoom("junior-accounting");
      await settle(() => text(host).includes(before));
      h.mode.hold = true;
      h.control.setExam("en");
      act(() => {
        void h.client.invalidateQueries();
      });
      await settle(() => h.client.getQueryData<MeContext>(getGetMeContextQueryKey())?.goal?.exam_id === examOf("en").examId);
      await settle(() => !text(host).includes(before));
      expect(text(host), "目标已换成六级，不能再显示初级会计的自习室").not.toContain(before);
      h.mode.hold = false;
      await act(async () => {
        await h.client.refetchQueries({ type: "active" });
      });
      const after = firstRoom("cet-6");
      await settle(() => text(host).includes(after));
      expect(text(host)).toContain(after);
    } finally {
      await unmount();
    }
  });
});

describe("S30 内容治理须明确操作（回归：举报原因默认已选，点一下就能提交）", () => {
  it("举报要先选原因才能提交；重新打开要重新选；提交和屏蔽都只提示即将上线，不假装已处理", async () => {
    const h = harness();
    const { host, unmount } = await open(h);
    try {
      await settle(() => text(host).includes(firstRoom("junior-accounting")));
      const dialog = () => document.querySelector<HTMLDialogElement>("dialog[open]");
      await click(buttonByText(host, copy.governance.report));
      await settle(() => dialog() !== null);
      const submit = () => buttonByText(dialog() ?? document, copy.report.submit);
      expect([...(dialog()?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [])].some((radio) => radio.checked)).toBe(false);
      expect(submit()?.disabled, "没选原因不能提交").toBe(true);
      await click(dialog()?.querySelector<HTMLInputElement>('input[value="anxiety"]'));
      expect(submit()?.disabled).toBe(false);
      await click(buttonByText(dialog() ?? document, copy.report.cancel));
      await settle(() => dialog() === null);
      await click(buttonByText(host, copy.governance.report));
      await settle(() => dialog() !== null);
      expect(submit()?.disabled, "重新打开要重新选原因").toBe(true);
      await click(dialog()?.querySelector<HTMLInputElement>('input[value="spam"]'));
      await click(submit());
      await settle(() => dialog() === null && text(document.body).includes(copy.soon.report));
      expect(text(document.body)).toContain(copy.soon.report);
      const room = firstRoom("junior-accounting");
      const block = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.getAttribute("aria-label") === copy.room.block_room.replace("{{name}}", room),
      );
      await click(block);
      await settle(() => dialog() !== null);
      await click(buttonByText(dialog() ?? document, copy.block.submit));
      await settle(() => text(document.body).includes(copy.soon.block));
      expect(text(document.body)).toContain(copy.soon.block);
      expect(text(host), "屏蔽未接后端，房间仍照常显示，不假装已屏蔽").toContain(room);
    } finally {
      await unmount();
    }
  });
});

describe("S30 只跟随外壳已取到的当前目标，不另发请求（回归：页面挂载时自己再取一次当前目标，受限态多出 403 与重试）", () => {
  it("页面挂载不请求 /me/context；外壳的当前目标一变，本页请求随之带上新的考试", async () => {
    const { api } = setupApi();
    const requests: URL[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://localhost");
      requests.push(url);
      const outcome = await api.handle({
        method: init?.method ?? "GET",
        url: url.href,
        headers: new Headers(init?.headers),
        body: undefined,
      });
      if (outcome.kind !== "json") throw new TypeError("network");
      return json(outcome.status, outcome.body);
    });
    // 和学员端一样用默认设置（数据立即过期、挂载即重取），只关掉重试；当前目标是外壳已取到放进缓存的那份。
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(getGetMeContextQueryKey(), DEMO_CONTEXT);
    let seen: { readonly data: unknown } | undefined;
    function Probe() {
      seen = useStudyRoom();
      return null;
    }
    const { unmount } = await mount(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    try {
      const own = () => requests.filter((url) => url.pathname.endsWith(ROOM_PATH));
      const contexts = () => requests.filter((url) => url.pathname.endsWith("/me/context"));
      await settle(() => seen?.data !== undefined);
      expect(own()[0]?.searchParams.get("exam_id")).toBe(DEMO_CONTEXT.goal?.exam_id);
      expect(contexts(), "页面不另发当前目标请求").toEqual([]);
      const goal = DEMO_CONTEXT.goal;
      if (goal === undefined || goal === null) throw new Error("演示上下文缺当前目标");
      const next = examOf("en").examId;
      act(() => {
        client.setQueryData<MeContext>(getGetMeContextQueryKey(), { ...DEMO_CONTEXT, goal: { ...goal, exam_id: next } });
      });
      await settle(() => own().some((url) => url.searchParams.get("exam_id") === next));
      expect(
        own().some((url) => url.searchParams.get("exam_id") === next),
        "外壳换了目标，本页跟着换",
      ).toBe(true);
      expect(contexts(), "跟随时也不另发当前目标请求").toEqual([]);
    } finally {
      await unmount();
    }
  });
});
