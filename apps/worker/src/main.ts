// worker 进程入口：node apps/worker/src/main.ts（Node 24 直接运行 TS）。BullMQ 连接 Redis；健康检查 GET /healthz。
import { Redis } from "ioredis";
import { pino } from "pino";
import { assertRunnable, parseEnvName } from "@exam-prep/domain-platform";
import { createHealthServer } from "./health.ts";
import { PROCESSORS, startWorkers } from "./runtime.ts";

const DEFAULT_HEALTH_PORT = 3001;
const log = pino({ level: process.env["LOG_LEVEL"] || "info", base: { service: "worker" } });

try {
  const env = parseEnvName(process.env["EXAM_PREP_ENV"]);
  assertRunnable(env);
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) throw new Error("缺少 REDIS_URL（见 .env.example）");
  const port = Number(process.env["WORKER_HEALTH_PORT"] || DEFAULT_HEALTH_PORT);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`WORKER_HEALTH_PORT=${process.env["WORKER_HEALTH_PORT"]} 不是有效端口`);
  // BullMQ 要求 maxRetriesPerRequest 为 null
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  connection.on("error", (err: Error) => log.warn({ err }, "Redis 连接异常"));
  const runtime = startWorkers(connection, PROCESSORS);
  const health = createHealthServer({ ping: () => connection.ping() });
  health.listen(port, () => log.info({ env, port, queues: Object.keys(PROCESSORS) }, "worker 已启动"));
  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, "收到退出信号，关闭 worker");
    health.close();
    await runtime.close();
    await connection.quit();
    process.exit(0);
  };
  process.once("SIGTERM", (signal) => void shutdown(signal));
  process.once("SIGINT", (signal) => void shutdown(signal));
} catch (error) {
  log.fatal({ err: error }, "worker 拒绝启动");
  process.exit(1);
}
