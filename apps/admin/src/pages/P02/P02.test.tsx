// P02 数据中台·指标字典（W01）：假数据过生成的 Zod、筛选在接口层完成、七态判断、挂在本页地址走一遍正常与各状态、主要按钮。
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { P02MetricDictionary } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { getP02MetricDictionaryResponse } from "@exam-prep/contract/zod";
import { click, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/P02.json";
import { handleP02, p02Fixture } from "../../mocks/pages/P02.ts";
import { dictionaryView, shouldRetry } from "./view.ts";

const ask = (query: string) =>
  handleP02({ method: "GET", url: `http://localhost/api/v1/admin/metric-dictionary?${query}`, headers: new Headers(), body: undefined });
const body = async (query: string): Promise<P02MetricDictionary> => {
  const outcome = await ask(query);
  if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
  return outcome.body as P02MetricDictionary;
};
const waiting = { data: undefined, error: null, status: "pending" as const, fetchStatus: "fetching" as const };
const done = (data: P02MetricDictionary) => ({ data, error: null, status: "success" as const, fetchStatus: "idle" as const });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function type(input: HTMLInputElement | null, value: string): Promise<void> {
  if (input === null) throw new Error("找不到搜索框");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("P02 假数据与七态判断", () => {
  it("四个演示考试 × 正常、空、数据不足 × 各分类都符合生成的契约", async () => {
    for (const exam of ["kj", "js", "en", "ds"])
      for (const state of ["normal", "empty", "insufficient_data"])
        for (const category of ["", "learning", "conversion", "retention", "quality", "cost"]) {
          const outcome = await ask(`exam=${exam}&state=${state}${category === "" ? "" : `&category=${category}`}`);
          if (outcome.kind !== "json") throw new Error("应返回示例 JSON");
          const parsed = getP02MetricDictionaryResponse.safeParse(outcome.body);
          expect(parsed.success, `${exam}/${state}/${category}：${String(parsed.error)}`).toBe(true);
        }
  });

  // R01 R19/E26、R06 R9/R24 与已拍板 R06-Q4/Q7：字典不能另造一套统计口径。
  for (const exam of ["kj", "js", "en", "ds"]) {
    const definition = async (metric: string) => {
      const item = (await body(`exam=${exam}`)).items.find((entry) => entry.metric_id === metric);
      expect(item, `${exam} 缺少指标 ${metric}`).toBeDefined();
      return item?.definition ?? "";
    };

    it(`${exam} 已学口径包含只有待验证证据的零档知识点`, async () => {
      const learned = await definition("learned_points");
      expect(learned).toContain("未撤回证据");
      expect(learned).toContain("待验证");
      expect(learned).toContain("负");
      expect(learned).toContain("地图知识点总数");
      expect(learned).not.toContain("达到“已了解”");
    });

    it(`${exam} 已达标口径同时要求范围内、证据充分和达到目标档`, async () => {
      const reached = await definition("target_reached");
      expect(reached).toContain("学习范围内");
      expect(reached).toContain("证据充分");
      expect(reached).toContain("系统判定档不低于目标档");
    });

    it(`${exam} 有效学习按未撤回证据判定，检测通过只决定该节完成`, async () => {
      const effective = await definition("effective_learning");
      expect(effective).toContain("未撤回证据");
      expect(effective).toContain("负证据");
      expect(effective).toContain("待验证");
      expect(effective).toContain("通过检测才算该节完成");
      expect(effective).not.toContain("阅读通过读后即测");
    });

    it(`${exam} 预测达线比较学员目标分，地图体检失败时锁定`, async () => {
      const passed = await definition("passed_line");
      expect(passed).toContain("目标分");
      expect(passed).toContain("已过目标线");
      expect(passed).toContain("地图体检不通过");
      expect(passed).not.toMatch(/不低于(?:各科)?合格线/);
    });
  }

  it("分类与搜索由接口筛选；分类数是字典总数，不随筛选变", async () => {
    const cost = await body("category=cost");
    expect(cost.items.map((item) => item.metric_id)).toEqual(["tutor_cost_per_active"]);
    expect(cost.total_count).toBe(p02Fixture().dictionary.items.length);
    expect((await body("q=留存")).items.map((item) => item.metric_id)).toEqual(["retention_day_n"]);
    expect((await body("q=PAID_conversion")).items.map((item) => item.metric_id)).toEqual(["paid_conversion"]);
    expect((await body("q=没有这个指标")).items).toEqual([]);
  });

  it("口径随考试的评价规则不同；样本不足时数据质量只给原始计数", async () => {
    const passed = async (exam: string) => (await body(`exam=${exam}`)).items.find((item) => item.metric_id === "passed_line")?.definition;
    expect(await passed("kj")).not.toBe(await passed("en"));
    const thin = await body("state=insufficient_data");
    expect(thin.quality).toMatchObject({ sample_sufficient: false });
    expect(thin.quality.summary).toBeUndefined();
    expect(thin.quality.conflict_count).toBeUndefined();
    expect(thin.items.length).toBeGreaterThan(0);
  });

  it("加载、离线、出错、受限由假数据层统一制造；请求结果逐态映射", async () => {
    expect((await ask("state=loading")).kind).toBe("hang");
    expect((await ask("state=offline")).kind).toBe("network_error");
    expect(await ask("state=error")).toMatchObject({ kind: "json", status: 500 });
    expect(await ask("state=restricted")).toMatchObject({ kind: "json", status: 403 });
    const normal = p02Fixture().dictionary;
    expect(dictionaryView(waiting).state).toBe("loading");
    expect(dictionaryView({ ...waiting, status: "error", fetchStatus: "idle", error: new TypeError("offline") }).state).toBe("offline");
    expect(dictionaryView({ ...waiting, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") }).state).toBe(
      "error",
    );
    expect(dictionaryView({ ...waiting, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_FORBIDDEN") }).state).toBe(
      "restricted",
    );
    expect(dictionaryView(done(normal)).state).toBe("normal");
    expect(dictionaryView(done({ ...normal, items: [] })).state).toBe("empty");
    expect(dictionaryView(done({ ...normal, quality: p02Fixture().insufficient_quality })).state).toBe("insufficient_data");
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new TypeError("offline"))).toBe(true);
  });
});

describe("P02 挂在本页地址", () => {
  it("正常态：字典、版本记录、AI 标识；按分类筛选；搜不到时显示空态，清除筛选后恢复", async () => {
    const { host, unmount } = await mountAt("/data-hub");
    try {
      await settle(() => host.textContent?.includes("周有效学习用户") === true);
      expect(host.textContent).toContain(copy.dictionary.title);
      expect(host.textContent).toContain(copy.quality.title);
      expect(host.querySelectorAll(".ui-ai").length).toBeGreaterThan(0);
      expect(host.querySelectorAll("details").length).toBe(p02Fixture().dictionary.items.length);
      const chip = [...host.querySelectorAll("button")].find((button) => button.textContent?.trim().startsWith(copy.categories.cost));
      await click(chip);
      await settle(() => host.textContent?.includes("单活跃用户导师成本") === true);
      expect(host.textContent).toContain("单活跃用户导师成本");
      expect(host.textContent).not.toContain("周有效学习用户");
      await type(host.querySelector<HTMLInputElement>('input[type="search"]'), "没有这个指标");
      await settle(() => host.querySelector(".ui-state--empty") !== null);
      expect(host.textContent).toContain(copy.state.empty.body);
      await click([...host.querySelectorAll("button")].find((button) => button.textContent?.trim() === copy.state.empty.action));
      await settle(() => host.textContent?.includes("周有效学习用户") === true);
      expect(host.querySelector(".ui-state--empty")).toBeNull();
    } finally {
      await unmount();
    }
  });

  it("连续输入搜索时控件保持挂载和焦点，加载期间不显示旧分类结果", async () => {
    const { host, unmount } = await mountAt("/data-hub");
    try {
      await settle(() => host.textContent?.includes("周有效学习用户") === true);
      const input = host.querySelector<HTMLInputElement>('input[type="search"]');
      if (input === null) throw new Error("找不到搜索框");
      input.focus();
      await type(input, "留");
      await settle(() => host.textContent?.includes("第 N 日留存") === true);
      expect(host.querySelector('input[type="search"]')).toBe(input);
      expect(document.activeElement).toBe(input);
      await type(input, "留存");
      await settle(() => host.textContent?.includes("第 N 日留存") === true);
      expect(input.value).toBe("留存");
      expect(document.activeElement).toBe(input);
      expect(host.textContent).not.toContain("周有效学习用户");
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
      const { host, unmount } = await mountAt(`/data-hub?state=${state}`);
      try {
        await settle(() => host.querySelector(`.ui-state--${state}`) !== null);
        expect(host.querySelector(`.ui-state--${state}`), host.textContent ?? "").not.toBeNull();
        if (text !== undefined) expect(host.textContent).toContain(text);
      } finally {
        await unmount();
      }
    });
  }

  it("关掉假数据层时走生成的请求函数：请求发到 /api/v1/admin/metric-dictionary", async () => {
    vi.stubEnv("VITE_MOCKS", "off");
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      asked.push(url);
      const outcome = await handleP02({
        method: init?.method ?? "GET",
        url: new URL(url, window.location.origin).href,
        headers: new Headers(),
        body: undefined,
      });
      if (outcome.kind !== "json") throw new TypeError("mock network unavailable");
      return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
    });
    const { host, unmount } = await mountAt("/data-hub");
    try {
      await settle(() => host.textContent?.includes("周有效学习用户") === true);
      expect(host.textContent).toContain("周有效学习用户");
      expect(asked.some((url) => url.startsWith("/api/v1/admin/metric-dictionary"))).toBe(true);
    } finally {
      await unmount();
    }
  });
});
