import type { PrismaClient } from "./client.ts";
import { DEV_GUEST_ID, DEV_LEARNER_ID, PLATFORM_DEFAULT_TENANT_ID } from "./fixed-ids.ts";

/** 种子：平台默认租户与固定开发者账号（学员、游客各一）。已存在的记录不改，重复运行结果相同。 */
export async function seed(client: PrismaClient, now: Date = new Date()): Promise<void> {
  await client.tenant.upsert({
    where: { id: PLATFORM_DEFAULT_TENANT_ID },
    update: {},
    create: { id: PLATFORM_DEFAULT_TENANT_ID, kind: "platform_default", name: "平台默认租户", created_at: now },
  });
  const accounts = [
    { id: DEV_LEARNER_ID, kind: "registered" },
    { id: DEV_GUEST_ID, kind: "guest" },
  ] as const;
  for (const account of accounts) {
    await client.user.upsert({
      where: { id: account.id },
      update: {},
      create: {
        id: account.id,
        tenant_id: PLATFORM_DEFAULT_TENANT_ID,
        kind: account.kind,
        age_band: "adult",
        minor_mode: false,
        status: "active",
        created_at: now,
      },
    });
  }
}
