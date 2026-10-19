import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createHealthServer, type HealthServerOptions } from "./health.ts";

const servers: Server[] = [];

async function start(options: HealthServerOptions): Promise<string> {
  const server = createHealthServer(options);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});

describe("worker 健康检查", () => {
  it("Redis 可用时 /healthz 返回 200", async () => {
    const base = await start({ ping: async () => "PONG" });
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("Redis 不可用或超时返回 503", async () => {
    const down = await start({ ping: async () => Promise.reject(new Error("ECONNREFUSED")) });
    expect((await fetch(`${down}/healthz`)).status).toBe(503);
    const slow = await start({ ping: () => new Promise(() => undefined), timeoutMs: 20 });
    expect((await fetch(`${slow}/healthz`)).status).toBe(503);
  });

  it("其他路径返回 404", async () => {
    const base = await start({ ping: async () => "PONG" });
    expect((await fetch(`${base}/metrics`)).status).toBe(404);
  });
});
