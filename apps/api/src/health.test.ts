import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.ts";

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function make(): Promise<FastifyInstance> {
  const app = await buildApp({ env: "test", logger: false });
  apps.push(app);
  return app;
}

describe("健康检查（Fastify inject，不起服务、不连数据库）", () => {
  it("GET /health 返回 200 与运行环境名", async () => {
    const app = await make();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", env: "test" });
  });

  it("旧地址 /healthz 与 /health 返回相同内容", async () => {
    const app = await make();
    const [health, healthz] = await Promise.all([app.inject({ url: "/health" }), app.inject({ url: "/healthz" })]);
    expect(healthz.statusCode).toBe(200);
    expect(healthz.json()).toEqual(health.json());
  });

  it("/health 只接受 GET（以及 Fastify 自动配的 HEAD）", async () => {
    const app = await make();
    const res = await app.inject({ method: "POST", url: "/health" });
    expect(res.statusCode).toBe(404);
  });
});
