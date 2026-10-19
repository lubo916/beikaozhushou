import type { FastifyInstance, FastifyRequest } from "fastify";
import type {} from "@exam-prep/db/fastify";
import { DEV_GUEST_ID, DEV_LEARNER_ID, PLATFORM_DEFAULT_TENANT_ID, assertContext, type RequestContext } from "@exam-prep/db";

/** 请求身份来源：buildApp 可注入（测试据此构造其他角色）；默认为固定开发者身份。 */
export type IdentitySource = (request: FastifyRequest) => RequestContext;

const DEV_ROLES = ["learner", "guest"] as const;
type DevRole = (typeof DEV_ROLES)[number];
const DEFAULT_TIMEZONE = "Asia/Shanghai";

function assertTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error(`EXAM_PREP_DEV_TIMEZONE=${timezone} 不是有效的 IANA 时区`);
  }
}

/**
 * 固定开发者身份（0 期不做正式登录）：只取环境变量 EXAM_PREP_DEV_*，启动时校验一次；
 * 请求的任何字段（请求头、查询参数、请求体、Cookie）都不能切换身份。
 */
export function fixedIdentityFromEnv(env: NodeJS.ProcessEnv = process.env): IdentitySource {
  const rawRole = env["EXAM_PREP_DEV_ROLE"] || "learner";
  const role = DEV_ROLES.find((r): r is DevRole => r === rawRole);
  if (!role) throw new Error(`EXAM_PREP_DEV_ROLE=${rawRole} 不受支持：0 期只有 learner 或 guest`);
  const guest = role === "guest";
  const ctx: RequestContext = Object.freeze({
    tenantId: env["EXAM_PREP_DEV_TENANT_ID"] || PLATFORM_DEFAULT_TENANT_ID,
    learnerId: env["EXAM_PREP_DEV_LEARNER_ID"] || (guest ? DEV_GUEST_ID : DEV_LEARNER_ID),
    role,
    guest,
    timezone: env["EXAM_PREP_DEV_TIMEZONE"] || DEFAULT_TIMEZONE,
  });
  assertTimezone(ctx.timezone);
  assertContext(ctx);
  return () => ctx;
}

/** 把请求身份挂到每个请求（request.ctx）。 */
export function registerContext(app: FastifyInstance, identity: IdentitySource): void {
  app.decorateRequest("ctx", null as unknown as RequestContext);
  app.addHook("onRequest", async (request) => {
    request.ctx = identity(request);
  });
}
