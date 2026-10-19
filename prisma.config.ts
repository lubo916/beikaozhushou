// Prisma 7（ADR-026 决定 4）：多文件 schema 在 contracts/schema/，迁移在 packages/db/prisma/migrations/。
// 连接串读 DATABASE_URL：本地开发从仓库根的 .env 读取，CI 与预发用进程环境变量。
import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile(".env");
} catch {
  // 没有 .env 时用进程环境
}

export default defineConfig({
  schema: "contracts/schema",
  migrations: { path: "packages/db/prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] ?? "" },
});
