// P01 运营驾驶舱（W01）：假数据过生成的 Zod、七态判断逐态喂结果、挂在本页地址走一遍正常与各状态、主要按钮。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { P01Cockpit } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { getP01CockpitResponse } from "@exam-prep/contract/zod";
import { click, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/P01.json";
import { handleP01, p01Fixture } from "../../mocks/pages/P01.ts";
import { cockpitView, shouldRetry } from "./view.ts";

const ask = (query: string) =>
  handleP01({ method: "GET", url: `http://localhost/api/v1/admin/cockpit?${query}`, headers: new Headers(), body: undefined });
const waiting = { data: undefined, error: null, status: "pending" as const, fetchStatus: "fetching" as const };
const done = (data: P01Cockpit) => ({ data, error: null, status: "success" as const, fetchStatus: "idle" as const });
const byText = (host: ParentNode, selector: string, text: string) =>
  [...host.querySelectorAll<HTMLElement>(selector)].find((element) => element.textContent?.trim() === text);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("P01 假数据与七态判断", () => {
  it("四个演示考试 × 正常、空、数据不足 × 三个分群维度都符合生成的契约", async () => {
    for (const exam of ["kj", "js", "en", "ds"])
      for (const state of ["normal", "empty", "insufficient_data"])
        for (const dimension of ["goal_type", "map_source", "channel"]) {
          const outcome = await ask(`exam=${exam}&state=${state}&dimension=${dimension}`);
          if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
          const parsed = getP01CockpitResponse.safeParse(outcome.body);
          expect(parsed.success, `${exam}/${state}/${dimension}：${String(parsed.error)}`).toBe(true);
          expect(outcome.body).toMatchObject({ retention: { dimension } });
        }
  });

  it("加载、离线、出错、受限由假数据层统一制造；别的地址放行", async () => {
    expect((await ask("state=loading")).kind).toBe("hang");
    expect((await ask("state=offline")).kind).toBe("network_error");
    expect(await ask("state=error")).toMatchObject({ kind: "json", status: 500, body: { code: "COMMON_INTERNAL" } });
    expect(await ask("state=restricted")).toMatchObject({ kind: "json", status: 403, body: { code: "COMMON_FORBIDDEN" } });
    const other = await handleP01({ method: "GET", url: "http://localhost/api/v1/other", headers: new Headers(), body: undefined });
    expect(other.kind).toBe("passthrough");
  });

  it("样本不足时不返回比例类结论，只留原始计数", async () => {
    const outcome = await ask("state=insufficient_data");
    if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
    const body = outcome.body as P01Cockpit;
    expect(body.sample_sufficient).toBe(false);
    expect(body.north_star.change_ratio).toBeUndefined();
    expect(body.first_week_rate.ratio).toBeUndefined();
    expect(body.funnel.every((step) => step.ratio === undefined)).toBe(true);
    expect(body.retention.groups.every((group) => group.ratio === undefined)).toBe(true);
  });

  it("请求结果逐态映射；权限拒绝优先于旧数据，断网时保留旧数据并提示", () => {
    const normal = p01Fixture().normal.cockpit;
    expect(cockpitView(waiting).state).toBe("loading");
    expect(cockpitView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(cockpitView({ ...waiting, status: "error", fetchStatus: "idle", error: new TypeError("offline") }).state).toBe("offline");
    expect(cockpitView({ ...waiting, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
    expect(cockpitView({ data: normal, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_FORBIDDEN") }).state).toBe(
      "restricted",
    );
    expect(cockpitView(done(normal)).state).toBe("normal");
    expect(cockpitView(done({ ...normal, funnel: [], alerts: [], retention: { ...normal.retention, groups: [] } })).state).toBe("empty");
    expect(cockpitView(done(p01Fixture().insufficient.cockpit)).state).toBe("insufficient_data");
    expect(cockpitView({ data: normal, status: "error", fetchStatus: "idle", error: new TypeError("offline") })).toMatchObject({
      state: "normal",
      stale: true,
    });
  });

  it("网络和服务异常重试一次，权限错误不重试", () => {
    expect(shouldRetry(0, new TypeError("offline"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(1, new ApiError("COMMON_INTERNAL"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});

describe("P01 挂在本页地址", () => {
  it("正常态：北极星、漏斗、留存、告警与 AI 标识；切分群维度；“处理”提示即将上线；口径链接到数据中台", async () => {
    const { host, unmount } = await mountAt("/cockpit");
    try {
      await settle(() => host.textContent?.includes("182,400") === true);
      expect(host.textContent).toContain("182,400");
      expect(host.textContent).toContain(copy.funnel.title);
      expect(host.textContent).toContain(copy.alerts.title);
      expect(host.textContent).toContain(copy.alertsBadge.replace("{{n}}", "3"));
      expect(host.querySelectorAll(".ui-ai").length).toBeGreaterThan(0);
      await click(byText(host, 'button, label, [role="radio"], [role="tab"]', copy.retention.dimensions.channel));
      await settle(() => host.textContent?.includes(copy.retention.groups.app_store) === true);
      expect(host.textContent).toContain(copy.retention.groups.app_store);
      await click(byText(host, "button", copy.alerts.handle));
      expect(host.querySelector('[role="status"]')?.textContent).toContain(copy.soon);
      const dictionary = [...host.querySelectorAll("a")].find((link) => link.getAttribute("href") === "/data-hub" && link.closest("main"));
      expect(dictionary?.textContent).toContain(copy.northStar.dictionary.replace("{{version}}", "v3"));
    } finally {
      await unmount();
    }
  });

  const STATES = [
    ["loading", undefined],
    ["empty", copy.state.empty.body],
    ["error", copy.state.error.body],
    ["offline", copy.state.offline.title],
    ["restricted", copy.state.restricted.body],
    ["insufficient_data", copy.state.insufficient_data.body],
  ] as const;
  for (const [state, text] of STATES) {
    it(`?state=${state} 显示对应的公共状态组件与文案`, async () => {
      const { host, unmount } = await mountAt(`/cockpit?state=${state}`);
      try {
        await settle(() => host.querySelector(`.ui-state--${state}`) !== null);
        expect(host.querySelector(`.ui-state--${state}`), host.textContent ?? "").not.toBeNull();
        if (text !== undefined) expect(host.textContent).toContain(text);
      } finally {
        await unmount();
      }
    });
  }

  it("关掉假数据层时走生成的请求函数：请求发到 /api/v1/admin/cockpit，结果照常显示", async () => {
    vi.stubEnv("VITE_MOCKS", "off");
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      asked.push(url);
      const outcome = await handleP01({
        method: init?.method ?? "GET",
        url: new URL(url, window.location.origin).href,
        headers: new Headers(),
        body: undefined,
      });
      if (outcome.kind !== "json") throw new TypeError("mock network unavailable");
      return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
    });
    const { host, unmount } = await mountAt("/cockpit");
    try {
      await settle(() => host.textContent?.includes("182,400") === true);
      expect(host.textContent).toContain("182,400");
      expect(asked.some((url) => url.startsWith("/api/v1/admin/cockpit"))).toBe(true);
    } finally {
      await unmount();
    }
  });
});
