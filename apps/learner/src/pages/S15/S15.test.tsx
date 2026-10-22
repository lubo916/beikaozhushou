// S15：四考试假数据过生成契约、七态与重试；评级只演示，不伪造复习记录。
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { S15ReviewHome } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { COPY as UI_COPY } from "@exam-prep/ui";
import { App } from "../../App.tsx";
import { click, heading, linkByText, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S15.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { homeView, shouldRetry, type HomeQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getReviewHomeResponse"] as Parser | undefined;
const NOW = Date.parse("2026-10-22T02:00:00Z");
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const home = async (): Promise<S15ReviewHome> => {
    const outcome = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/review/home",
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("复习接口没有返回数据");
    expect(outcome.status).toBe(200);
    const result = parser?.safeParse(outcome.body);
    expect(result?.success, String(result?.error)).toBe(true);
    return outcome.body as S15ReviewHome;
  };
  return { control, api, home };
}

describe("S15 复习接口假数据", () => {
  it("四个演示考试的正常、空、受限和数据不足数据都通过生成的 Zod", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const mode of MODES) {
      const { control, home } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await home();
        expect(data.data_source).toBe("sample");
        expect(data.state).toBe(mode === "" ? "normal" : mode);
        expect(data.exam_name).not.toBe("");
        expect(data.session.card.front).not.toBe("");
        expect(
          exam.map.chapters.flatMap((chapter) => chapter.sample_points).some((point) => point.id === data.session.card.knowledge_point_id),
        ).toBe(true);
        expect(data.session.ratings.map((rating) => rating.id)).toEqual(["again", "hard", "good", "easy"]);
      }
    }
  });

  it("空态清空今日队列；额度受限仍保留到期复习", async () => {
    const empty = await setup("empty").home();
    expect(empty.queue.due).toBe(0);
    expect(empty.queue.new_cards).toBe(0);
    expect(empty.queue.tomorrow).toBeGreaterThan(0);
    const restricted = await setup("restricted").home();
    expect(restricted.queue.due).toBeGreaterThan(0);
    expect(restricted.session.card.front).not.toBe("");
  });
});

describe("S15 七态判断与重试", () => {
  const waiting: HomeQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): HomeQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });

  it("加载、离线、403 受限和服务出错区分显示", () => {
    expect(homeView(waiting).state).toBe("loading");
    expect(homeView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(homeView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(homeView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(homeView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });

  it("接口给出空、受限和数据不足；已有数据离线时保留内容", async () => {
    for (const mode of MODES) {
      const data = await setup(mode).home();
      const query: HomeQuery = { data, error: null, status: "success", fetchStatus: "idle" };
      expect(homeView(query).state).toBe(mode === "" ? "normal" : mode);
      const stale = homeView({ ...query, fetchStatus: "paused" });
      expect(stale.data).toBe(data);
      expect(stale.stale).toBe(true);
    }
  });

  it("网络和服务异常只重试一次，4xx 不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});

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

afterEach(() => vi.unstubAllGlobals());

describe("S15 页面挂载", () => {
  it("正常态显示页头、今日队列和记忆概况", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/review", <App />);
    await settle(() => host.textContent?.includes(copy.queue.title) === true);
    expect(heading(host)).toBe(copy.title);
    expect(host.textContent).toContain(copy.memory.title);
    await unmount();
  });

  it("空态保留页头，并给去今日的入口", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/review", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    const state = host.querySelector(".ui-state--empty");
    expect(heading(host)).toBe(copy.title);
    expect(state?.textContent).toContain(copy.state.empty.title);
    expect(linkByText(state, copy.state.empty.action)?.getAttribute("href")).toBe("/today");
    await unmount();
  });

  it("错误态显示公共重试与本页错误提示", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/review", <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null, 250);
    const state = host.querySelector(".ui-state--error");
    expect(state?.textContent).toContain(`${copy.title}没能加载`);
    expect(state?.querySelectorAll("button").length).toBe(2);
    await unmount();
  });
});

describe("S15 先回忆再翻面", () => {
  it("答案和评级在翻面前隐藏；翻面后短暂禁用且四档无默认，演示评级不伪造保存", async () => {
    const { api, home } = setup();
    const data = await home();
    stubFetch(api);
    const { host, unmount } = await mountAt("/review?view=session", <App />);
    const button = (name: string): HTMLButtonElement | undefined =>
      [...host.querySelectorAll<HTMLButtonElement>("main button")].find(
        (element) => element.getAttribute("aria-label") === name || element.textContent?.trim() === name,
      );
    await settle(() => button(copy.session.flip) !== undefined);
    expect(host.textContent).not.toContain(data.session.card.back);
    expect(button(copy.session.again)).toBeUndefined();
    await click(button(copy.session.flip));
    expect(host.textContent).toContain(data.session.card.back);
    const labels = [copy.session.again, copy.session.hard, copy.session.good, copy.session.easy];
    for (const label of labels) {
      expect(button(label)?.disabled).toBe(true);
      expect(button(label)?.getAttribute("aria-pressed")).not.toBe("true");
    }
    await settle(() => labels.every((label) => button(label)?.disabled === false), 250);
    for (const label of labels) expect(button(label)?.disabled).toBe(false);
    await click(button(copy.session.again));
    expect(host.textContent).toContain(copy.session.demo);
    expect(host.textContent).toContain(copy.soon);
    await unmount();
  });
});

async function openPendingEditor() {
  stubFetch(setup().api);
  const mounted = await mountAt("/review", <App />);
  const { host } = mounted;
  await settle(() => host.textContent?.includes(copy.queue.title) === true);
  await click(
    [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((button) => button.textContent?.trim() === copy.tabs.pending),
  );
  await click(
    [...host.querySelectorAll<HTMLButtonElement>("main button")].find((button) => button.textContent?.trim() === copy.pending.edit),
  );
  const dialog = host.querySelector<HTMLDialogElement>("dialog[open]");
  if (dialog === null) throw new Error("待确认卡片的编辑弹窗没有打开");
  return { ...mounted, dialog };
}

describe("S15 AI 卡片编辑与复制", () => {
  it("待确认卡片进入编辑弹窗后，正反面仍保留显式 AI 生成标识", async () => {
    const { dialog, unmount } = await openPendingEditor();
    expect(dialog.querySelector("h2")?.textContent).toBe(copy.pending.edit_title);
    const content = dialog.querySelector(".ui-ai");
    expect(content?.querySelector(".ui-ai-badge")?.textContent).toContain(UI_COPY.ai.label);
    expect(content?.textContent).toContain(copy.pending.hint);
    const inputs = content?.querySelectorAll<HTMLTextAreaElement>("textarea");
    expect(inputs?.length).toBe(2);
    for (const input of inputs ?? []) expect(input.value).not.toBe("");
    await unmount();
  });

  it("编辑正反面时复制部分文本，剪贴板只包含所选文本并带一次 AI 标记；空选择不拦截", async () => {
    const { dialog, unmount } = await openPendingEditor();
    const inputs = dialog.querySelectorAll<HTMLTextAreaElement>("textarea");
    expect(inputs.length).toBe(2);
    document.getSelection()?.removeAllRanges();
    for (const input of inputs) {
      expect(input.value.length).toBeGreaterThan(2);
      input.focus();
      input.setSelectionRange(1, input.value.length - 1);
      const selected = input.value.slice(input.selectionStart, input.selectionEnd);
      const clipboard = new DataTransfer();
      const event = new ClipboardEvent("copy", { clipboardData: clipboard, bubbles: true, cancelable: true });
      await act(async () => {
        input.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
      expect(clipboard.getData("text/plain")).toBe(`【${UI_COPY.ai.label}】${selected}`);

      input.setSelectionRange(0, 0);
      document.getSelection()?.removeAllRanges();
      const emptyClipboard = new DataTransfer();
      const emptyEvent = new ClipboardEvent("copy", { clipboardData: emptyClipboard, bubbles: true, cancelable: true });
      await act(async () => {
        input.dispatchEvent(emptyEvent);
      });
      expect(emptyEvent.defaultPrevented).toBe(false);
      expect(emptyClipboard.getData("text/plain")).toBe("");
    }
    await unmount();
  });
});
