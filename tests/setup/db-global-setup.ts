// vitest 的 db 项目：运行前把 TEST_DATABASE_URL 指向的库迁移到最新（prisma migrate deploy）。
import { execFileSync } from "node:child_process";

export default function setup(): void {
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) {
    throw new Error("数据库测试需要 TEST_DATABASE_URL（见 .env.example；本地先运行 docker compose -f deploy/compose.yaml up -d）");
  }
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
    shell: process.platform === "win32",
  });
}
