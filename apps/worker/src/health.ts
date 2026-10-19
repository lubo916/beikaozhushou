import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export interface HealthServerOptions {
  /** 检查依赖（Redis）是否可用；在 timeoutMs 内完成即为健康。 */
  readonly ping: () => Promise<unknown>;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2000;

function send(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("health check timeout")), ms);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** worker 的健康检查：GET /healthz，Redis 可用返回 200，否则 503。 */
export function createHealthServer(options: HealthServerOptions): Server {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "GET" || req.url !== "/healthz") {
      send(res, 404, { status: "not_found" });
      return;
    }
    withTimeout(options.ping(), timeoutMs).then(
      () => send(res, 200, { status: "ok" }),
      () => send(res, 503, { status: "unavailable" }),
    );
  });
}
