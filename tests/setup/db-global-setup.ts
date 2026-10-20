// vitest 的 db 项目：运行前把 TEST_DATABASE_URL 指向的库迁移到最新（prisma migrate deploy）。
import { execFileSync } from "node:child_process";

export default function setup(): void {
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) {
    throw new Error("数据库测试需要 TEST_DATABASE_URL（见 .env.example；本地起 deploy/compose.dev.yml，网页沙箱用 bk start --with-db）");
  }
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
    shell: process.platform === "win32",
  });
}
