import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "./client.ts";
import { scopedClient, TenantScopeError, type RequestContext } from "./context.ts";

const A = "01920000-0000-7000-8000-0000000000aa";
const B = "01920000-0000-7000-8000-0000000000bb";
const U = "01920000-0000-7000-8000-000000000001";
const ctx: RequestContext = { tenantId: A, learnerId: U, role: "learner", guest: false, timezone: "Asia/Shanghai" };

// 使用真实 Prisma 扩展链；最后一个扩展只记录参数并返回，不执行 SQL，也不连接数据库。
const client = createPrismaClient("postgresql://unused:unused@127.0.0.1:1/unused");
const received: { model: string; operation: string; args: unknown }[] = [];
const db = scopedClient(client, ctx).$extends({
  query: {
    $allModels: {
      $allOperations({ model, operation, args }) {
        received.push({ model, operation, args });
        return Promise.resolve([]);
      },
    },
  },
});

beforeEach(() => {
  received.length = 0;
});
afterAll(() => client.$disconnect());

describe("租户防线在 Prisma 扩展链中执行（不连接数据库）", () => {
  it("正常标量查询在进入执行层前补齐租户，Tenant 按自身 id 限定", async () => {
    await db.user.findMany({ select: { id: true }, where: { status: "active" } });
    await db.tenant.findMany({ select: { id: true, name: true } });
    expect(received).toEqual([
      { model: "User", operation: "findMany", args: { select: { id: true }, where: { status: "active", tenant_id: A } } },
      { model: "Tenant", operation: "findMany", args: { select: { id: true, name: true }, where: { id: A } } },
    ]);
  });

  it("Tenant/关联表入口与已有关系上的读写越权在执行层之前被拒绝", async () => {
    await expect(db.tenant.findMany({ include: { users: true } })).rejects.toThrow(TenantScopeError);
    await expect(db.questionKnowledgePoint.findMany({ include: { question: true } })).rejects.toThrow(TenantScopeError);
    await expect(db.user.findMany({ select: { merged_into_user: { select: { phone: true } } } })).rejects.toThrow(TenantScopeError);
    await expect(
      db.user.update({
        where: { id: U },
        data: { users_via_merged_into: { update: { where: { id: B }, data: { tenant_id: B } } } },
      }),
    ).rejects.toThrow(TenantScopeError);
    expect(received).toEqual([]);
  });

  it("JSON 嵌套键不会被当作关系操作拒绝", async () => {
    const properties = { tenant: { connect: { id: B } } };
    await db.analyticsEvent.updateMany({ where: { id: U }, data: { properties } });
    expect(received).toEqual([
      { model: "AnalyticsEvent", operation: "updateMany", args: { where: { id: U, tenant_id: A }, data: { properties } } },
    ]);
  });

  it("标量创建、复合主键查询与计数仍可正常使用", async () => {
    await db.user.create({
      data: { id: U, tenant_id: A, kind: "registered", age_band: "adult", minor_mode: false, status: "active", created_at: new Date(0) },
    });
    await db.masteryLevel.findUnique({ where: { learner_id_knowledge_point_id: { learner_id: U, knowledge_point_id: B } } });
    await db.user.count({ select: { _all: true, id: true } });
    expect(received.map(({ args }) => args)).toEqual([
      {
        data: { id: U, tenant_id: A, kind: "registered", age_band: "adult", minor_mode: false, status: "active", created_at: new Date(0) },
      },
      { where: { learner_id_knowledge_point_id: { learner_id: U, knowledge_point_id: B }, tenant_id: A } },
      { select: { _all: true, id: true }, where: { tenant_id: A } },
    ]);
  });

  it("原始 SQL 仍被拒绝", async () => {
    await expect(db.$queryRawUnsafe("SELECT 1")).rejects.toThrow(TenantScopeError);
    await expect(db.$executeRawUnsafe("DELETE FROM users")).rejects.toThrow(TenantScopeError);
  });
});
