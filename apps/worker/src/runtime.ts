import { Worker, type Processor } from "bullmq";
import type { Redis } from "ioredis";

/** 队列名 → 任务处理器。各领域的任务处理器随功能加入（ADR-026 决定 1）；当前没有任务。 */
export type Processors = Readonly<Record<string, Processor>>;

export const PROCESSORS: Processors = {};

export interface WorkerRuntime {
  readonly workers: readonly Worker[];
  close(): Promise<void>;
}

/** 为每个登记的队列启动一个 BullMQ Worker，共用同一个 Redis 连接。 */
export function startWorkers(connection: Redis, processors: Processors): WorkerRuntime {
  const workers = Object.entries(processors).map(([queue, processor]) => new Worker(queue, processor, { connection }));
  return {
    workers,
    close: async () => {
      await Promise.all(workers.map((w) => w.close()));
    },
  };
}
