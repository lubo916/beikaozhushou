import "./state.test.ts";
import { describe, expect, it } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { handleO02, o02Fixture } from "../../mocks/pages/O02.ts";
import { leadsView, shouldRetry, type O02Query } from "./view.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const parser = (zodSchemas as Record<string, unknown>)["getO02LeadsResponse"] as Parser | undefined;
const waiting: O02Query = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
const failed = (error: unknown): O02Query => ({ ...waiting, error, status: "error", fetchStatus: "idle" });

describe("O02 假数据与生成契约", () => {
  it("四个演示考试在正常、空、受限与数据不足时都通过生成 Zod", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const exam of ["kj", "js", "en", "ds"]) {
      for (const state of ["normal", "empty", "restricted", "insufficient_data"]) {
        const result = await handleO02({
          method: "GET",
          url: `http://localhost/api/v1/org/leads/overview?exam=${exam}&state=${state}`,
          headers: new Headers(),
          body: undefined,
        });
        expect(result.kind).toBe("json");
        if (result.kind !== "json") throw new Error("O02 应返回 JSON");
        expect(result.status).toBe(200);
        const parsed = parser?.safeParse(result.body);
        expect(parsed?.success, String(parsed?.error)).toBe(true);
      }
    }
  });
  it("受限响应不泄露线索与联系数据；空响应清空列表；变体不污染原始示例", async () => {
    const normal = o02Fixture();
    for (const state of ["restricted", "empty"]) {
      const result = await handleO02({
        method: "GET",
        url: `http://localhost/api/v1/org/leads/overview?state=${state}`,
        headers: new Headers(),
        body: undefined,
      });
      if (result.kind !== "json") throw new Error("O02 应返回 JSON");
      expect((result.body as { leads: unknown[] }).leads).toEqual([]);
    }
    expect(o02Fixture()).toEqual(normal);
    expect(normal.leads.length).toBeGreaterThan(0);
    expect(normal.leads.every((lead) => lead.phone_masked.includes("*"))).toBe(true);
  });
  it("加载、出错、离线由模拟层返回，未匹配的请求放行", async () => {
    const request = { method: "GET", url: "http://localhost/api/v1/org/leads/overview", headers: new Headers(), body: undefined };
    expect((await handleO02({ ...request, url: request.url + "?state=loading" })).kind).toBe("hang");
    expect((await handleO02({ ...request, url: request.url + "?state=offline" })).kind).toBe("network_error");
    const error = await handleO02({ ...request, url: request.url + "?state=error" });
    expect(error.kind === "json" && error.status).toBe(500);
    expect((await handleO02({ ...request, url: "http://localhost/api/v1/other" })).kind).toBe("passthrough");
  });
});
describe("O02 七态与重试", () => {
  it("加载、出错、离线、受限分别按请求结果判断", () => {
    expect(leadsView(waiting).state).toBe("loading");
    expect(leadsView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(leadsView(failed(new TypeError("network"))).state).toBe("offline");
    expect(leadsView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
    expect(leadsView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
  });
  it("有缓存时离线仍保留联系清单，空与受限由响应字段判断", () => {
    const data = o02Fixture();
    const normal: O02Query = { data, error: null, status: "success", fetchStatus: "idle" };
    expect(leadsView(normal).state).toBe("normal");
    const stale = leadsView({ ...normal, fetchStatus: "paused" });
    expect(stale.state).toBe("normal");
    expect(stale.stale).toBe(true);
    expect(stale.data?.leads).toEqual(data.leads);
    expect(leadsView({ ...normal, data: { ...data, leads: [] } }).state).toBe("empty");
    expect(leadsView({ ...normal, data: { ...data, access: "restricted" } }).state).toBe("restricted");
  });
  it("网络与服务异常最多重试一次，客户端错误不重试", () => {
    expect(shouldRetry(0, new TypeError("network"))).toBe(true);
    expect(shouldRetry(1, new TypeError("network"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});
