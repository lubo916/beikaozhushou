import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-error.ts";
import { customFetch, resolveUrl, toApiError } from "./fetcher.ts";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("fetcher（生成钩子的请求函数）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("2xx 返回解析后的响应体，路径加 /api/v1 前缀", async () => {
    const fetchMock = vi.fn(async () => json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(customFetch<{ ok: boolean }>("/params", { method: "GET" })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/params", { method: "GET" });
    expect(resolveUrl("/api/v1/events")).toBe("/api/v1/events");
  });

  it("没有响应体的 2xx 返回 undefined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 202 })),
    );
    await expect(customFetch("/events", { method: "POST" })).resolves.toBeUndefined();
  });

  it("非 2xx 的统一错误体解析为 ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(403, { code: "COMMON_FORBIDDEN", message_key: "error.common.forbidden", details: { action: "x" } })),
    );
    const error = await customFetch("/events", { method: "POST" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "COMMON_FORBIDDEN", status: 403, details: { action: "x" } });
  });

  it("响应体不是统一错误体时按 HTTP 状态取通用错误码", () => {
    expect(toApiError(404, "<html>")).toMatchObject({ code: "COMMON_NOT_FOUND" });
    expect(toApiError(422, { code: "UNKNOWN" })).toMatchObject({ code: "COMMON_VALIDATION" });
    expect(toApiError(502, undefined)).toMatchObject({ code: "COMMON_INTERNAL", details: { status: 502 } });
  });
});
