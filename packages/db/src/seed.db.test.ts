import { describe, expect, it } from "vitest";
import { DEV_GUEST_ID, DEV_LEARNER_ID, PLATFORM_DEFAULT_TENANT_ID } from "./fixed-ids.ts";
import { seed } from "./seed.ts";
import { useTestDatabase } from "./testing.ts";

describe("种子（pnpm db:seed）", () => {
  const db = useTestDatabase();

  it("写入平台默认租户与固定开发者账号（学员、游客各一），重复运行结果相同", async () => {
    await seed(db.client);
    await seed(db.client);
    const tenants = await db.client.tenant.findMany();
    expect(tenants.map((t) => [t.id, t.kind])).toEqual([[PLATFORM_DEFAULT_TENANT_ID, "platform_default"]]);
    const users = await db.client.user.findMany({ orderBy: { id: "asc" } });
    expect(users.map((u) => [u.id, u.kind, u.tenant_id])).toEqual([
      [DEV_LEARNER_ID, "registered", PLATFORM_DEFAULT_TENANT_ID],
      [DEV_GUEST_ID, "guest", PLATFORM_DEFAULT_TENANT_ID],
    ]);
  });
});
