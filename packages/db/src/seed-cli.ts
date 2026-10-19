// pnpm db:seed：向 DATABASE_URL 指向的库写入种子（预发由 deploy/release.sh 在迁移后运行）。
import { createPrismaClient } from "./client.ts";
import { seed } from "./seed.ts";

const client = createPrismaClient(process.env["DATABASE_URL"] ?? "");
try {
  await seed(client);
  process.stdout.write("种子写入完成：平台默认租户与固定开发者账号（学员、游客各一）。\n");
} finally {
  await client.$disconnect();
}
