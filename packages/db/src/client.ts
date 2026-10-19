import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

export { PrismaClient };

/** Prisma 客户端的唯一构造处（ADR-026 决定 2）。业务读写经 withContext（ADR-028 决定 1）。 */
export function createPrismaClient(connectionString: string): PrismaClient {
  if (!connectionString) throw new Error("缺少数据库连接串：设置 DATABASE_URL（数据库测试用 TEST_DATABASE_URL），见 .env.example");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

let shared: PrismaClient | undefined;

/** 进程内共享的客户端：首次使用时按 DATABASE_URL 构造，构造时不连接数据库。 */
export function getPrisma(): PrismaClient {
  shared ??= createPrismaClient(process.env["DATABASE_URL"] ?? "");
  return shared;
}

export async function disconnectPrisma(): Promise<void> {
  const client = shared;
  shared = undefined;
  await client?.$disconnect();
}
