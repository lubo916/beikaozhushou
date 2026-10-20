import { randomUUID } from "node:crypto";
import { fastify, type FastifyBaseLogger, type FastifyInstance, type FastifyServerOptions } from "fastify";
import type {} from "@exam-prep/db/fastify";
import { getPrisma, type PrismaClient } from "@exam-prep/db/client";
import { metricsRoutes } from "@exam-prep/domain-metrics/server";
import { platformRoutes } from "@exam-prep/domain-platform/server";
import { setParamSource, type ParamSource } from "@exam-prep/params";
import { fixedIdentityFromEnv, registerContext, type IdentitySource } from "./context.ts";
import { assertRunnable, getEnv, type EnvName } from "./env.ts";
import { registerErrorHandling } from "./errors.ts";
import { API_PREFIX, registerRoleCheck } from "./roles.ts";

export interface BuildAppOptions {
  /** 运行环境名；默认读 EXAM_PREP_ENV。production 拒绝启动。 */
  readonly env?: EnvName;
  /** 请求身份来源；默认为固定开发者身份（EXAM_PREP_DEV_*）。测试据此构造 learner、guest 以外的角色。 */
  readonly identity?: IdentitySource;
  /** 参数覆盖来源（PLAT-02 接入运行时覆盖）。 */
  readonly paramSource?: ParamSource;
  /** 日志：pino 选项或开关；loggerInstance 传入现成的日志对象，优先于 logger。 */
  readonly logger?: Exclude<FastifyServerOptions["logger"], undefined>;
  readonly loggerInstance?: FastifyBaseLogger;
  /** 数据库客户端；默认在首次使用时按 DATABASE_URL 构造（packages/db）。 */
  readonly db?: PrismaClient;
  /** 请求体上限（字节）；默认用 Fastify 的默认值。 */
  readonly bodyLimit?: number;
}

function defaultLogger(): Exclude<FastifyServerOptions["logger"], undefined> {
  return { level: process.env["LOG_LEVEL"] || "info", redact: ["req.headers.authorization", "req.headers.cookie"] };
}

/** 应用构建：注册身份、角色校验、统一错误体与健康检查，并在 /api 下注册各领域的路由插件。测试用 inject，不起服务。 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? getEnv();
  assertRunnable(env);
  const identity = options.identity ?? fixedIdentityFromEnv();
  if (options.paramSource) setParamSource(options.paramSource);
  const serverOptions: FastifyServerOptions = {
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    ...(options.loggerInstance ? { loggerInstance: options.loggerInstance } : { logger: options.logger ?? defaultLogger() }),
    ...(options.bodyLimit === undefined ? {} : { bodyLimit: options.bodyLimit }),
  };
  const app: FastifyInstance = fastify(serverOptions);
  const injectedDb = options.db;
  app.decorate("db", { getter: () => injectedDb ?? getPrisma() });
  registerContext(app, identity);
  registerRoleCheck(app);
  registerErrorHandling(app);
  // 健康检查：/health 给本地预览与部署探活；/healthz 是旧地址，compose.staging.yaml 与 Playwright 仍在用
  app.get("/health", { config: { infra: true } }, async () => ({ status: "ok", env }));
  app.get("/healthz", { config: { infra: true } }, async () => ({ status: "ok", env }));
  await app.register(platformRoutes, { prefix: API_PREFIX });
  await app.register(metricsRoutes, { prefix: API_PREFIX });
  return app;
}
