// S31 会员与权益：契约假数据与页面状态的浏览器单元测试。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import type { S31Membership } from "@exam-prep/contract";
import * as zodSchemas from "@exam-prep/contract/zod";
import { App } from "../../App.tsx";
import { heading, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S31.json";
import { membershipView, shouldRetry, type MembershipQuery } from "./data.ts";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";

type Json = Record<string, unknown>;
interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const pageFixtures = import.meta.glob<S31Membership>("../../../../../fixtures/pages/S31/*.json", { eager: true, import: "default" });
function fixtureFor(examId: string): S31Membership {
  const fixture = Object.entries(pageFixtures).find(([path]) => path.endsWith(`/${examId}.json`))?.[1];
  if (fixture === undefined) throw new Error(`S31 缺少演示考试数据：${examId}`);
  return fixture;
}
const parser = (zodSchemas as Record<string, unknown>)["getS31MembershipResponse"] as Parser | undefined;
const NOW = Date.parse("2026-10-22T10:00:00Z");
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const home = async (): Promise<Json> => {
    const outcome = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/billing/membership",
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") return {};
    expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
    const parsed = parser?.safeParse(outcome.body);
    expect(parsed?.success, String(parsed?.error)).toBe(true);
    return outcome.body as Json;
  };
  return { control, api, home };
}

/** 让生成的钩子直接接到假数据路由，不启动 Service Worker。 */
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

describe("S31 假数据契约", () => {
  it("生成了本页响应的 Zod 校验器", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试的正常、空、受限与数据不足数据全部通过生成的 Zod", async () => {
    for (const mode of MODES) {
      const { control, home } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await home();
        expect(data["data_source"]).toBe("sample");
        expect(data["view_state"]).toBe(mode === "" ? fixtureFor(exam.examId).view_state : mode);
        if (mode === "empty") expect(data["orders"]).toEqual([]);
      }
    }
  });
  it("自然无订单为空态，非自动续费没有扣款提醒，可申请但未提交的退款尚无完成进度", async () => {
    const { control, home } = setup();
    for (const exam of fixtures.exams) {
      control.setExam(exam.key);
      const data = (await home()) as unknown as S31Membership;
      if (data.orders.length === 0) expect(data.view_state).toBe("empty");
      if (!data.current.auto_renew) expect(data.reminders.some((item) => item.kind === "renewal")).toBe(false);
      if (data.refund.status === "available") {
        expect(data.refund.progress.length).toBeGreaterThan(0);
        expect(data.refund.progress.every((item) => !item.completed)).toBe(true);
      }
    }
  });
});

describe("S31 七态判断", () => {
  const waiting: MembershipQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): MembershipQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });

  it("请求中的页面显示加载；暂停请求或没有网络响应时显示离线", () => {
    expect(membershipView(waiting).state).toBe("loading");
    expect(membershipView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(membershipView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
  });

  it("403 显示受限；其他接口错误显示出错", () => {
    expect(membershipView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(membershipView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
    expect(membershipView(failed(new ApiError("COMMON_NOT_FOUND"))).state).toBe("error");
  });

  it("接口提供的四种视图直接展示；断网有缓存时保留权益", async () => {
    for (const mode of MODES) {
      const data = (await setup(mode).home()) as unknown as S31Membership;
      const query: MembershipQuery = { data, error: null, status: "success", fetchStatus: "idle" };
      const result = membershipView(query);
      expect(result.state).toBe(mode === "" ? "normal" : mode);
      expect(result.data).toBe(data);
      expect(result.stale).toBe(false);
      const stale = membershipView({ ...query, status: "error", error: new TypeError("Failed to fetch") });
      expect(stale.data).toBe(data);
      expect(stale.stale).toBe(true);
    }
  });

  it("网络与服务异常再试一次；4xx 不重复请求", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_NOT_FOUND"))).toBe(false);
  });
});

describe("S31 页面通过生成的接口钩子显示数据", () => {
  it("正常态有权益、额度、档位、购买、订单与兑换入口", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/membership", <App />);
    await settle(() => host.textContent?.includes(copy.current.title) === true);
    expect(heading(host)).toBe(copy.title);
    for (const title of [
      copy.current.title,
      copy.usage.title,
      copy.compare.title,
      copy.purchase.title,
      copy.orders.title,
      copy.redemption.title,
    ]) {
      expect(host.textContent).toContain(title);
    }
    expect(host.textContent).toContain(copy.sample);
    await unmount();
  });

  it("空订单保留页头并给出档位对比入口", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/membership", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    const state = host.querySelector(".ui-state--empty");
    expect(heading(host)).toBe(copy.title);
    expect(state?.textContent).toContain(copy.state.empty.title);
    expect(state?.textContent).toContain(copy.state.empty.body);
    expect(state?.textContent).toContain(copy.state.empty.action);
    await unmount();
  });

  it("接口异常显示本页中文说明与重试入口", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/membership", <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null, 250);
    const state = host.querySelector(".ui-state--error");
    expect(state?.textContent).toContain(copy.state.error.title);
    expect(state?.textContent).toContain(copy.state.error.body);
    expect(state?.querySelector("button")).not.toBeNull();
    await unmount();
  });

  for (const mode of ["restricted", "insufficient_data"] as const) {
    it(`${mode} 只提示对应能力，当前权益照常显示`, async () => {
      stubFetch(setup(mode).api);
      const { host, unmount } = await mountAt("/membership", <App />);
      await settle(() => host.querySelector(`.ui-state--${mode}`) !== null);
      expect(host.querySelector(`.ui-state--${mode}`)?.textContent).toContain(copy.state[mode].body);
      expect(host.textContent).toContain(copy.current.title);
      expect(heading(host)).toBe(copy.title);
      await unmount();
    });
  }
});

describe("S31 档位与订单复查回归", () => {
  for (const key of ["en", "ds"]) {
    it(`${key} 未开启自动续费时不显示“将自动续期”与关闭续费入口`, async () => {
      const { control, api } = setup();
      control.setExam(key);
      stubFetch(api);
      const { host, unmount } = await mountAt("/membership", <App />);
      await settle(() => host.textContent?.includes(copy.current.manual) === true);
      expect(host.textContent).toContain(copy.current.manual);
      expect(host.textContent).not.toContain(copy.current.renewing);
      const closeRenewal = [...host.querySelectorAll("button")].find((button) => button.textContent?.trim() === copy.current.close_renewal);
      expect(closeRenewal).toBeUndefined();
      expect(heading(host)).toBe(copy.title);
      await unmount();
    });
  }

  it("免费权益的两个到期栏显示长期有效，自然空订单保留权益与档位入口", async () => {
    const { control, api } = setup();
    control.setExam("ds");
    stubFetch(api);
    const { host, unmount } = await mountAt("/membership", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    const current = [...host.querySelectorAll<HTMLElement>(".ui-card")].find(
      (card) => card.querySelector("h2")?.textContent === copy.current.title,
    );
    expect(current).toBeDefined();
    for (const label of [copy.current.valid, copy.current.final]) {
      const row = [...(current?.querySelectorAll(".ui-kv__row") ?? [])].find((item) => item.querySelector("dt")?.textContent === label);
      expect(row?.querySelector("dd")?.textContent).toBe(copy.current.lifetime);
    }
    const state = host.querySelector(".ui-state--empty");
    expect(state?.textContent).toContain(copy.state.empty.title);
    expect(state?.textContent).toContain(copy.state.empty.body);
    expect(state?.textContent).toContain(copy.state.empty.action);
    expect(heading(host)).toBe(copy.title);
    await unmount();
  });
});
