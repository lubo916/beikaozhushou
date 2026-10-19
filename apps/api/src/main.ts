// API 进程入口：node apps/api/src/main.ts（Node 24 直接运行 TS）。
import { buildApp } from "./app.ts";
import { getEnv } from "./env.ts";

const DEFAULT_PORT = 3000;
const port = Number(process.env["API_PORT"] || DEFAULT_PORT);
const host = process.env["API_HOST"] || "0.0.0.0";

try {
  if (!Number.isInteger(port) || port <= 0) throw new Error(`API_PORT=${process.env["API_PORT"]} 不是有效端口`);
  const app = await buildApp({ env: getEnv() });
  const close = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "收到退出信号，关闭 API");
    await app.close();
    process.exit(0);
  };
  process.once("SIGTERM", (signal) => void close(signal));
  process.once("SIGINT", (signal) => void close(signal));
  await app.listen({ port, host });
} catch (error) {
  process.stderr.write(`API 拒绝启动：${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
