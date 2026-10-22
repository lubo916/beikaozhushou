// U21 简版：四考试数据契约、七态映射、真实页面链路及本次录音同意。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import type { S21OralTrainingHome } from "@exam-prep/contract";
import * as zodSchemas from "@exam-prep/contract/zod";
import { App } from "../../App.tsx";
import { click, heading, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S21.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { oralView, shouldRetry, type OralQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getOralTrainingHomeResponse"] as Parser | undefined;
const NOW = Date.parse("2026-10-22T10:00:00Z");
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;

function setup(state = "", examKey = "kj") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  control.setExam(examKey);
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const home = async (): Promise<S21OralTrainingHome> => {
    const outcome = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/practice/oral/home",
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("口头训练未返回 JSON");
    expect(outcome.status).toBe(200);
    const parsed = parser?.safeParse(outcome.body);
    expect(parsed?.success, String(parsed?.error)).toBe(true);
    return outcome.body as S21OralTrainingHome;
  };
  return { control, api, home };
}

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

describe("S21 假数据与生成契约", () => {
  it("四个演示考试的正常、空、受限和样本不足数据均通过生成的 Zod", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const mode of MODES) {
      const { control, home } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await home();
        expect(data.exam_id).toBe(exam.examId);
        expect(data.data_source).toBe("sample");
      }
    }
  });

  it("画像挂载结论来自接口，空记录、视频受限、样本不足各只改变相应数据", async () => {
    expect((await setup("", "kj").home()).activation).toBe("manual");
    expect((await setup("", "en").home()).activation).toBe("automatic");
    expect((await setup("", "ds").home()).activation).toBe("disabled");
    const empty = await setup("empty").home();
    expect(empty.assessment.available).toBe(false);
    expect(empty.radar.sufficient).toBe(false);
    const restricted = await setup("restricted").home();
    expect(restricted.video_analysis_allowed).toBe(false);
    expect(restricted.assessment.available).toBe(true);
    const insufficient = await setup("insufficient_data").home();
    expect(insufficient.radar.sufficient).toBe(false);
    expect(insufficient.radar.dimensions).toEqual([]);
    expect(insufficient.assessment.available).toBe(true);
  });
});

describe("S21 请求状态判断", () => {
  const waiting: OralQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): OralQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });

  it("无数据时区分加载、离线、权限受限和服务异常", () => {
    expect(oralView(waiting).state).toBe("loading");
    expect(oralView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(oralView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(oralView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(oralView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });

  it("已有记录照常可读，断网只加旧数据提示；空记录由接口 available 决定", async () => {
    const data = await setup().home();
    expect(oralView({ ...failed(new TypeError("Failed to fetch")), data })).toEqual({ state: "normal", data, stale: true });
    const empty = await setup("empty").home();
    expect(oralView({ ...waiting, data: empty }).state).toBe("empty");
    for (const mode of ["restricted", "insufficient_data"]) {
      const partial = await setup(mode).home();
      expect(oralView({ ...waiting, data: partial }).state).toBe("normal");
    }
  });

  it("网络与服务异常只自动重试一次，客户端错误不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_NOT_FOUND"))).toBe(false);
  });
});

const button = (root: ParentNode, text: string): HTMLButtonElement | undefined =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text);
const checkbox = (root: ParentNode, text: string): HTMLInputElement | undefined =>
  [...root.querySelectorAll<HTMLLabelElement>("label")]
    .find((label) => label.textContent?.includes(text))
    ?.querySelector<HTMLInputElement>("input[type=checkbox]") ?? undefined;

describe("S21 真实页面链路", () => {
  it("正常页显示评估、批注、重构和隐私，流程的留存同意每次默认清空", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/oral", <App />);
    try {
      await settle(() => host.querySelector('[data-testid="s21-home"]') !== null);
      expect(heading(host)).toBe(copy.title);
      for (const title of [copy.assessment.title, copy.transcript.title, copy.reconstruction.title, copy.privacy.title])
        expect(host.textContent).toContain(title);
      await click(button(host, copy.header.start));
      const dialog = host.querySelector("dialog[open]");
      expect(dialog).not.toBeNull();
      expect(checkbox(dialog as Element, copy.flow.save)?.checked).toBe(false);
      expect(checkbox(dialog as Element, copy.flow.video)?.checked).toBe(false);
      await click(checkbox(dialog as Element, copy.flow.save));
      expect(checkbox(dialog as Element, copy.flow.save)?.checked).toBe(true);
      await click(button(dialog as Element, copy.flow.cancel));
      await click(button(host, copy.header.start));
      const reopened = host.querySelector("dialog[open]");
      expect(checkbox(reopened as Element, copy.flow.save)?.checked).toBe(false);
      expect(checkbox(reopened as Element, copy.flow.video)?.checked).toBe(false);
    } finally {
      await unmount();
    }
  });

  it("空记录保留页头并可打开开始流程；出错有重试提示", async () => {
    for (const mode of ["empty", "error"]) {
      stubFetch(setup(mode).api);
      const { host, unmount } = await mountAt("/oral", <App />);
      try {
        await settle(() => host.querySelector(`.ui-state--${mode}`) !== null, 250);
        const shown = host.querySelector(`.ui-state--${mode}`);
        expect(shown).not.toBeNull();
        if (mode === "empty") {
          expect(heading(host)).toBe(copy.title);
          expect(shown?.textContent).toContain(copy.state.empty.body);
          await click(button(shown as Element, copy.state.empty.action));
          expect(host.querySelector("dialog[open]")).not.toBeNull();
        } else {
          expect(shown?.getAttribute("role")).toBe("alert");
          expect(shown?.textContent).toContain(`${copy.title}没能加载`);
        }
      } finally {
        await unmount();
      }
    }
  });
});
