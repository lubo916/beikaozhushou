// 数据库测试辅助：每个测试文件一个独立连接，文件开始前与结束后各清表一次。
// 数据库测试文件命名为 *.db.test.ts，由 vitest 的 db 项目串行运行（vitest.config.ts）。
import { afterAll, beforeAll } from "vitest";
import { createPrismaClient, type PrismaClient } from "./client.ts";
import { MODELS } from "./generated/models.ts";

/** 测试库连接串：只用 TEST_DATABASE_URL，清表不会碰到开发库。 */
export function testDatabaseUrl(): string {
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) {
    throw new Error("数据库测试需要 TEST_DATABASE_URL（见 .env.example；本地先运行 docker compose -f deploy/compose.yaml up -d）");
  }
  return url;
}

/** 清空全部业务表（表名取自 generated/models.ts，不含迁移记录表）。 */
export async function truncateAll(client: PrismaClient): Promise<void> {
  const tables = [...new Set(Object.values(MODELS).map((m) => m.table))];
  if (tables.length === 0) return;
  await client.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export interface TestDatabase {
  /** 本测试文件独占的客户端（beforeAll 之后可用）。 */
  readonly client: PrismaClient;
  /** 在用例之间需要干净的表时调用。 */
  truncate(): Promise<void>;
}

export function useTestDatabase(): TestDatabase {
  let client: PrismaClient | undefined;
  const handle: TestDatabase = {
    get client(): PrismaClient {
      if (!client) throw new Error("测试数据库尚未连接：在 beforeAll 之后使用");
      return client;
    },
    truncate: () => truncateAll(handle.client),
  };
  beforeAll(async () => {
    client = createPrismaClient(testDatabaseUrl());
    await truncateAll(client);
  });
  afterAll(async () => {
    if (!client) return;
    await truncateAll(client);
    await client.$disconnect();
    client = undefined;
  });
  return handle;
}
