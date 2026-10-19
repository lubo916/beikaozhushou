import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ApiError } from "@exam-prep/contract/errors";
import type { PrismaClient, RequestContext } from "@exam-prep/db";
import { PARAMS, param, setParamSource } from "@exam-prep/params";
import { buildApp, type BuildAppOptions } from "./app.ts";

const learner: RequestContext = {
  learnerId: "01920000-0000-7000-8000-000000000002",
  tenantId: "01920000-0000-7000-8000-000000000001",
  role: "learner",
  guest: false,
  timezone: "Asia/Shanghai",
};

const apps: FastifyInstance[] = [];
async function make(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = await buildApp({ env: "test", logger: false, identity: () => learner, ...options });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  setParamSource(() => undefined);
});

describe("统一错误体 {code, message_key, details}", () => {
  it("未知路由返回 COMMON_NOT_FOUND", async () => {
    const app = await make();
    const res = await app.inject({ method: "GET", url: "/api/does-not-exist" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: "COMMON_NOT_FOUND", message_key: "error.common.not_found", details: {} });
  });

  it("请求体不是合法 JSON 返回 COMMON_BAD_REQUEST", async () => {
    const app = await make();
    app.post("/api/echo", { config: { action: "metrics.event.track" } }, async (request) => request.body);
    const res = await app.inject({ method: "POST", url: "/api/echo", headers: { "content-type": "application/json" }, payload: "{bad" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: "COMMON_BAD_REQUEST", message_key: "error.common.bad_request" });
  });

  it("请求体过大返回 COMMON_PAYLOAD_TOO_LARGE", async () => {
    const app = await make({ bodyLimit: 16 });
    app.post("/api/echo", { config: { action: "metrics.event.track" } }, async (request) => request.body);
    const res = await app.inject({ method: "POST", url: "/api/echo", payload: { text: "x".repeat(64) } });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toMatchObject({ code: "COMMON_PAYLOAD_TOO_LARGE" });
  });

  it("媒体类型不支持返回 COMMON_UNSUPPORTED_MEDIA_TYPE", async () => {
    const app = await make();
    app.post("/api/echo", { config: { action: "metrics.event.track" } }, async (request) => request.body);
    const res = await app.inject({ method: "POST", url: "/api/echo", headers: { "content-type": "application/xml" }, payload: "<a/>" });
    expect(res.statusCode).toBe(415);
    expect(res.json()).toMatchObject({ code: "COMMON_UNSUPPORTED_MEDIA_TYPE" });
  });

  it("未预期异常返回 COMMON_INTERNAL，不回显细节，日志带请求 ID", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const app = await make({ logger: { level: "error", stream } });
    app.get("/api/boom", { config: { action: "exam.profile.read" } }, async () => {
      throw new Error("secret detail");
    });
    const res = await app.inject({ method: "GET", url: "/api/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: "COMMON_INTERNAL", message_key: "error.common.internal", details: {} });
    expect(res.body).not.toContain("secret detail");
    const record = lines.map((l) => JSON.parse(l) as Record<string, unknown>).find((r) => r["err"]);
    expect(record?.["reqId"]).toEqual(expect.any(String));
    expect(record?.["err"]).toMatchObject({ message: "secret detail" });
  });

  it("领域代码抛出 ApiError 时按其 code 输出", async () => {
    const app = await make();
    app.post("/api/answers", { config: { action: "practice.answer.submit" } }, async () => {
      throw new ApiError("PRAC_REVEAL_LOCKED", { question_id: "q1" });
    });
    const res = await app.inject({ method: "POST", url: "/api/answers", payload: {} });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: "PRAC_REVEAL_LOCKED", message_key: "error.practice.reveal_locked", details: { question_id: "q1" } });
  });
});

describe("角色校验", () => {
  it("角色不在动作允许的角色中返回 COMMON_FORBIDDEN", async () => {
    const app = await make({ identity: () => ({ ...learner, role: "support_agent" }) });
    app.get("/api/profile", { config: { action: "exam.profile.read" } }, async () => ({ ok: true }));
    const res = await app.inject({ method: "GET", url: "/api/profile" });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      code: "COMMON_FORBIDDEN",
      message_key: "error.common.forbidden",
      details: { action: "exam.profile.read" },
    });
  });

  it("允许的角色通过；不对端开放的动作对学员一律拒绝", async () => {
    const app = await make();
    app.get("/api/profile", { config: { action: "exam.profile.read" } }, async () => ({ ok: true }));
    app.post("/api/evidence", { config: { action: "learner.evidence.record" } }, async () => ({ ok: true }));
    expect((await app.inject({ method: "GET", url: "/api/profile" })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/evidence", payload: {} })).json()).toMatchObject({ code: "COMMON_FORBIDDEN" });
  });

  it("/api 下的路由必须声明已登记的动作", async () => {
    const missing = await make();
    await expect(async () => {
      missing.get("/api/no-action", async () => ({}));
      await missing.ready();
    }).rejects.toThrow(/config\.action/);
    const unknown = await make();
    await expect(async () => {
      unknown.get("/api/bad-action", { config: { action: "nope.read" as never } }, async () => ({}));
      await unknown.ready();
    }).rejects.toThrow(/未在 contracts\/permissions\.yaml 登记/);
  });

  it("健康检查是基础设施路由，不经角色校验", async () => {
    const app = await make({ identity: () => ({ ...learner, role: "support_agent" }) });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", env: "test" });
  });
});

describe("应用构建 buildApp(options)", () => {
  it("production 拒绝启动", async () => {
    await expect(buildApp({ env: "production", logger: false, identity: () => learner })).rejects.toThrow(/生产环境/);
  });

  it("可注入参数覆盖来源", async () => {
    await make({ paramSource: () => Number.MAX_SAFE_INTEGER });
    expect(param("api.page.max_limit")).toBe(PARAMS["api.page.max_limit"].range[1]);
  });

  it("可注入数据库客户端", async () => {
    const fake = {} as PrismaClient;
    const app = await make({ db: fake });
    expect(app.db).toBe(fake);
  });
});
