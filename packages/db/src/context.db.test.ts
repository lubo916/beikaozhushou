import { describe, expect, it } from "vitest";
import { TenantScopeError, withContext, type RequestContext } from "./context.ts";
import { useTestDatabase } from "./testing.ts";

const T1 = "01920000-0000-7000-8000-0000000000a1";
const T2 = "01920000-0000-7000-8000-0000000000a2";
const U1 = "01920000-0000-7000-8000-0000000000b1";
const U2 = "01920000-0000-7000-8000-0000000000b2";
const U3 = "01920000-0000-7000-8000-0000000000b3";
const E1 = "01920000-0000-7000-8000-0000000000c1";

const ctx = (tenantId: string, learnerId: string): RequestContext => ({
  tenantId,
  learnerId,
  role: "learner",
  guest: false,
  timezone: "Asia/Shanghai",
});

const user = (id: string, tenant_id: string) => ({
  id,
  tenant_id,
  kind: "registered" as const,
  age_band: "adult" as const,
  minor_mode: false,
  status: "active" as const,
  created_at: new Date(),
});

describe("withContext 的租户隔离（越权测试，ADR-028 决定 1）", () => {
  const db = useTestDatabase();

  async function twoTenants(): Promise<void> {
    await db.truncate();
    const created_at = new Date();
    await db.client.tenant.createMany({
      data: [
        { id: T1, kind: "org", name: "机构甲", created_at },
        { id: T2, kind: "org", name: "机构乙", created_at },
      ],
    });
    await db.client.user.createMany({ data: [user(U1, T1), user(U2, T2)] });
  }

  it("列表只读到当前租户的记录", async () => {
    await twoTenants();
    const rows = await withContext(ctx(T1, U1), (s) => s.user.findMany({ select: { id: true } }), db.client);
    expect(rows).toEqual([{ id: U1 }]);
  });

  it("按 ID 读不到其他租户的记录", async () => {
    await twoTenants();
    const other = await withContext(ctx(T1, U1), (s) => s.user.findUnique({ where: { id: U2 } }), db.client);
    expect(other).toBeNull();
  });

  it("改不到其他租户的记录", async () => {
    await twoTenants();
    const result = await withContext(ctx(T1, U1), (s) => s.user.updateMany({ where: { id: U2 }, data: { minor_mode: true } }), db.client);
    expect(result.count).toBe(0);
    expect((await db.client.user.findUniqueOrThrow({ where: { id: U2 } })).minor_mode).toBe(false);
  });

  it("写入其他租户被拒绝", async () => {
    await twoTenants();
    await expect(withContext(ctx(T1, U1), (s) => s.user.create({ data: user(U3, T2) }), db.client)).rejects.toThrow(TenantScopeError);
    expect(await db.client.user.count({ where: { id: U3 } })).toBe(0);
  });

  it("原始 SQL 在 withContext 中被拒绝", async () => {
    await twoTenants();
    await expect(withContext(ctx(T1, U1), (s) => s.$queryRawUnsafe("SELECT 1"), db.client)).rejects.toThrow(TenantScopeError);
  });

  it("埋点事件表已迁移，可在当前租户内写入", async () => {
    await twoTenants();
    const now = new Date();
    const row = await withContext(
      ctx(T1, U1),
      (s) =>
        s.analyticsEvent.create({
          data: {
            id: E1,
            tenant_id: T1,
            learner_id: U1,
            guest: false,
            timezone: "Asia/Shanghai",
            name: "app_opened",
            version: 1,
            source: "client",
            properties: { entry: "test" },
            occurred_at: now,
            received_at: now,
          },
        }),
      db.client,
    );
    expect(row.tenant_id).toBe(T1);
  });
});
