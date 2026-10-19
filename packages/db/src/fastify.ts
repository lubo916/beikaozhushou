// Fastify 的类型扩展：apps/api 与各领域的路由插件共用（类型导入即可生效：import type {} from "@exam-prep/db/fastify"）。
import type {} from "fastify";
import type { ActionId } from "@exam-prep/contract/permissions";
import type { PrismaClient } from "./client.ts";
import type { RequestContext } from "./context.ts";

declare module "fastify" {
  interface FastifyRequest {
    /** 当前请求的身份（apps/api/src/context.ts 挂上）。 */
    ctx: RequestContext;
  }
  interface FastifyInstance {
    /** 数据库客户端；业务读写经 withContext(request.ctx, fn, app.db)。 */
    db: PrismaClient;
  }
  interface FastifyContextConfig {
    /** 路由所用动作（contracts/permissions.yaml 的 id）；统一钩子按它校验角色。 */
    action?: ActionId;
    /** 基础设施路由（健康检查）：不在 /api 下，不校验角色。 */
    infra?: boolean;
  }
}

export {};
