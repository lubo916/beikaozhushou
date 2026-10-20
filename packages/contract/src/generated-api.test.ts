import { faker } from "@faker-js/faker";
import { QueryClient } from "@tanstack/react-query";
import { setupServer } from "msw/node";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGetParamsQueryOptions } from "./generated/api/endpoints.ts";
import { getGetParamsMockHandler, getGetQuestionResponseMock, getTrackEventMockHandler } from "./generated/api/endpoints.msw.ts";
import { getParamsResponse, getQuestionResponse, trackEventBody } from "./generated/api/endpoints.zod.ts";

describe("Orval 生成物与 Zod 4、MSW 的接线", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Zod 保留参数与事件属性中的自由字段，并拒绝缺少必填字段", () => {
    const values = { "planner.daily_goal": 12, enabled: true };
    expect(getParamsResponse.parse(values)).toEqual(values);
    const event = { name: "page.view", properties: { page_id: "S01", duration: 2 }, occurred_at: "2026-01-01T00:00:00Z" };
    expect(trackEventBody.parse(event)).toEqual(event);
    expect(trackEventBody.safeParse({ properties: {}, occurred_at: event.occurred_at }).success).toBe(false);
  });

  it("参数取值里的自由数组原样通过，生成的 MSW 题目也通过 Zod", () => {
    const values = { "plan.disconnect.tiers_days": [3, 14], mixed: [{ label: "A" }, "B", 1, null] };
    expect(getParamsResponse.parse(values)).toEqual(values);
    faker.seed(1);
    expect(getQuestionResponse.safeParse(getGetQuestionResponseMock()).success).toBe(true);
  });

  it("生成的 queryFn 将取消信号经请求配置传给 fetch", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const options = getGetParamsQueryOptions();
    const queryFn = options.queryFn;
    if (typeof queryFn !== "function") throw new Error("没有生成 queryFn");
    const signal = new AbortController().signal;
    await queryFn({ client: new QueryClient(), queryKey: options.queryKey, signal, meta: undefined });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/params", expect.objectContaining({ method: "GET", signal }));
  });

  it("生成的 MSW handler 能响应 /api/v1/params 与无响应体的 /api/v1/events", async () => {
    const values = { "planner.daily_goal": 12 };
    const server = setupServer(getGetParamsMockHandler(values), getTrackEventMockHandler());
    server.listen({ onUnhandledRequest: "error" });
    try {
      const params = await fetch("http://localhost/api/v1/params");
      expect(params.status).toBe(200);
      expect(getParamsResponse.parse(await params.json())).toEqual(values);
      const event = await fetch("http://localhost/api/v1/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "page.view", properties: {}, occurred_at: "2026-01-01T00:00:00Z" }),
      });
      expect(event.status).toBe(202);
      expect(await event.text()).toBe("");
    } finally {
      server.close();
    }
  });
});
