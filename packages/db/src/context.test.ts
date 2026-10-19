import { describe, expect, it } from "vitest";
import { TenantScopeError, applyTenantScope, assertContext, type RequestContext } from "./context.ts";
import { MODELS } from "./generated/models.ts";

const A = "01920000-0000-7000-8000-0000000000aa";
const B = "01920000-0000-7000-8000-0000000000bb";

describe("租户第一道防线：applyTenantScope", () => {
  it("读、改、删的条件补上当前租户", () => {
    expect(applyTenantScope("User", "findMany", { where: { status: "active" } }, A)).toEqual({ where: { status: "active", tenant_id: A } });
    expect(applyTenantScope("User", "count", undefined, A)).toEqual({ where: { tenant_id: A } });
    expect(applyTenantScope("User", "deleteMany", { where: { id: "1" } }, A)).toEqual({ where: { id: "1", tenant_id: A } });
  });

  it("条件指定其他租户即拒绝", () => {
    expect(() => applyTenantScope("User", "findFirst", { where: { tenant_id: B } }, A)).toThrow(TenantScopeError);
  });

  it("写入补上当前租户，指定或关联其他租户即拒绝", () => {
    expect(applyTenantScope("User", "create", { data: { id: "1" } }, A)).toEqual({ data: { id: "1", tenant_id: A } });
    expect(applyTenantScope("User", "createMany", { data: [{ id: "1" }, { id: "2", tenant_id: A }] }, A)).toEqual({
      data: [
        { id: "1", tenant_id: A },
        { id: "2", tenant_id: A },
      ],
    });
    expect(() => applyTenantScope("User", "create", { data: { tenant_id: B } }, A)).toThrow(TenantScopeError);
    expect(() => applyTenantScope("User", "create", { data: { tenant: { connect: { id: B } } } }, A)).toThrow(TenantScopeError);
  });

  it("修改不能把记录移到其他租户", () => {
    expect(() => applyTenantScope("User", "update", { where: { id: "1" }, data: { tenant_id: B } }, A)).toThrow(TenantScopeError);
    expect(() => applyTenantScope("User", "update", { where: { id: "1" }, data: { tenant_id: { set: B } } }, A)).toThrow(TenantScopeError);
    expect(applyTenantScope("User", "update", { where: { id: "1" }, data: { tenant_id: { set: A } } }, A)).toMatchObject({
      data: { tenant_id: { set: A } },
    });
    expect(applyTenantScope("User", "upsert", { where: { id: "1" }, create: { id: "1" }, update: {} }, A)).toEqual({
      where: { id: "1", tenant_id: A },
      create: { id: "1", tenant_id: A },
      update: {},
    });
  });

  it("租户表按自身 id 隔离，不能从租户关系入口读取全部学员", () => {
    expect(applyTenantScope("Tenant", "findMany", { select: { id: true, name: true } }, A)).toEqual({
      select: { id: true, name: true },
      where: { id: A },
    });
    expect(() => applyTenantScope("Tenant", "findUnique", { where: { id: B } }, A)).toThrow(TenantScopeError);
    expect(() => applyTenantScope("Tenant", "update", { where: { id: A }, data: { id: B } }, A)).toThrow(TenantScopeError);
    expect(() => applyTenantScope("Tenant", "findMany", { include: { users: true } }, A)).toThrow(TenantScopeError);
    expect(() => applyTenantScope("Tenant", "findMany", { select: { users: true } }, A)).toThrow(TenantScopeError);
    expect(() => applyTenantScope("QuestionKnowledgePoint", "findMany", { include: { question: true } }, A)).toThrow(TenantScopeError);
  });

  it("关系展开、关系计数、关系排序与逻辑条件中的关系筛选在查询前被拒绝", () => {
    for (const args of [
      { include: { merged_into_user: true } },
      { select: { merged_into_user: { select: { phone: true } } } },
      { select: { _count: { select: { questions: true } } } },
      { where: { OR: [{ tenant: { is: { id: B } } }] } },
      { orderBy: { merged_into_user: { phone: "asc" } } },
    ]) {
      expect(() => applyTenantScope("User", "findMany", args, A)).toThrow(TenantScopeError);
    }
  });

  it("嵌套 create、update、connect、delete 与 upsert 均不能绕过当前租户", () => {
    for (const relation of [
      { create: { id: "child", tenant_id: B } },
      { update: { where: { id: "child" }, data: { tenant_id: B } } },
      { connect: { id: "other-tenant-user" } },
      { deleteMany: {} },
      { upsert: { where: { id: "child" }, create: { tenant_id: B }, update: { tenant_id: B } } },
    ]) {
      const data = { users_via_merged_into: relation };
      expect(() => applyTenantScope("User", "create", { data }, A)).toThrow(TenantScopeError);
      expect(() => applyTenantScope("User", "update", { where: { id: "parent" }, data }, A)).toThrow(TenantScopeError);
      expect(() => applyTenantScope("User", "upsert", { where: { id: "parent" }, create: { id: "parent" }, update: data }, A)).toThrow(
        TenantScopeError,
      );
    }
  });

  it("JSON 内容与路径筛选保留原样，标量选择、排序及分页仍受当前租户约束", () => {
    const properties = { tenant: { connect: { id: B } }, update: { include: { users: true } } };
    expect(applyTenantScope("AnalyticsEvent", "create", { data: { id: "event", properties } }, A)).toEqual({
      data: { id: "event", properties, tenant_id: A },
    });
    const args = {
      where: { AND: [{ properties: { path: ["tenant", "connect"], equals: { id: B } } }] },
      select: { id: true, properties: true },
      orderBy: [{ received_at: "desc" }],
      cursor: { id: "event" },
      take: 10,
    };
    expect(applyTenantScope("AnalyticsEvent", "findMany", args, A)).toEqual({
      ...args,
      where: { ...args.where, tenant_id: A },
      cursor: { id: "event", tenant_id: A },
    });
  });

  it("复合主键仍可正常查询，生成的标量元数据覆盖所有模型", () => {
    const where = { learner_id_knowledge_point_id: { learner_id: "learner", knowledge_point_id: "point" } };
    expect(applyTenantScope("MasteryLevel", "findUnique", { where }, A)).toEqual({ where: { ...where, tenant_id: A } });
    for (const meta of Object.values(MODELS)) expect(meta.scalarFields.length).toBeGreaterThan(0);
  });

  it("身份校验：ID 为 UUID，guest 由 role 推出", () => {
    const ok: RequestContext = { learnerId: A, tenantId: B, role: "learner", guest: false, timezone: "Asia/Shanghai" };
    expect(() => assertContext(ok)).not.toThrow();
    expect(() => assertContext({ ...ok, guest: true })).toThrow(TenantScopeError);
    expect(() => assertContext({ ...ok, tenantId: "not-a-uuid" })).toThrow(TenantScopeError);
  });
});
