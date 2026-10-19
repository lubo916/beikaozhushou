import type { Redis } from "ioredis";
import { describe, expect, it } from "vitest";
import { PROCESSORS, startWorkers } from "./runtime.ts";

describe("worker 运行时", () => {
  it("暂无任务：不启动任何队列，可正常关闭", async () => {
    expect(Object.keys(PROCESSORS)).toEqual([]);
    const runtime = startWorkers({} as Redis, PROCESSORS);
    expect(runtime.workers).toEqual([]);
    await expect(runtime.close()).resolves.toBeUndefined();
  });
});
