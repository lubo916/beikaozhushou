import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { DEV_GUEST_ID, DEV_LEARNER_ID, PLATFORM_DEFAULT_TENANT_ID } from "@exam-prep/db";
import { buildApp } from "./app.ts";
import { fixedIdentityFromEnv } from "./context.ts";

const OTHER = "01920000-0000-7000-8000-0000000000ff";
const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("固定开发者身份（0 期不做正式登录）", () => {
  it("未设置时取种子的平台默认租户与开发者学员，时区默认 Asia/Shanghai", () => {
    const ctx = fixedIdentityFromEnv({})({} as never);
    expect(ctx).toEqual({
      tenantId: PLATFORM_DEFAULT_TENANT_ID,
      learnerId: DEV_LEARNER_ID,
      role: "learner",
      guest: false,
      timezone: "Asia/Shanghai",
    });
  });

  it("guest 由 role 推出，未指定学员 ID 时取种子的游客账号", () => {
    const ctx = fixedIdentityFromEnv({ EXAM_PREP_DEV_ROLE: "guest" })({} as never);
    expect(ctx).toMatchObject({ role: "guest", guest: true, learnerId: DEV_GUEST_ID });
  });

  it("环境变量指定的 ID 与时区生效", () => {
    const ctx = fixedIdentityFromEnv({
      EXAM_PREP_DEV_LEARNER_ID: OTHER,
      EXAM_PREP_DEV_TENANT_ID: OTHER,
      EXAM_PREP_DEV_TIMEZONE: "Asia/Tokyo",
    })({} as never);
    expect(ctx).toMatchObject({ learnerId: OTHER, tenantId: OTHER, timezone: "Asia/Tokyo" });
  });

  it("其他角色、无效 ID 与无效时区拒绝启动", () => {
    expect(() => fixedIdentityFromEnv({ EXAM_PREP_DEV_ROLE: "support_agent" })).toThrow(/learner 或 guest/);
    expect(() => fixedIdentityFromEnv({ EXAM_PREP_DEV_LEARNER_ID: "abc" })).toThrow();
    expect(() => fixedIdentityFromEnv({ EXAM_PREP_DEV_TIMEZONE: "Mars/Base" })).toThrow(/时区/);
  });

  it("浏览器不能通过任何请求字段切换身份", async () => {
    const app = await buildApp({ env: "test", logger: false, identity: fixedIdentityFromEnv({}) });
    apps.push(app);
    app.post("/api/whoami", { config: { action: "metrics.event.track" } }, async (request) => request.ctx);
    const res = await app.inject({
      method: "POST",
      url: `/api/whoami?learnerId=${OTHER}&role=guest`,
      headers: { "x-learner-id": OTHER, "x-tenant-id": OTHER, "x-role": "guest", cookie: `learner_id=${OTHER}` },
      payload: { learnerId: OTHER, tenantId: OTHER, role: "guest", guest: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      tenantId: PLATFORM_DEFAULT_TENANT_ID,
      learnerId: DEV_LEARNER_ID,
      role: "learner",
      guest: false,
      timezone: "Asia/Shanghai",
    });
  });
});
