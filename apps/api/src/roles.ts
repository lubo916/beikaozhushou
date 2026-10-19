import type { FastifyContextConfig, FastifyInstance } from "fastify";
import type {} from "@exam-prep/db/fastify";
import { ApiError } from "@exam-prep/contract/errors";
import { isActionId, roleAllowed } from "@exam-prep/contract/permissions";

/** 各领域的路由插件都注册在 /api 下（ADR-026 决定 6）。 */
export const API_PREFIX = "/api";

function isApiPath(url: string): boolean {
  return url === API_PREFIX || url.startsWith(`${API_PREFIX}/`);
}

/**
 * 角色校验（docs/conventions/security.md 规则 1）：
 * 登记路由时，/api 下的路由必须用 config.action 声明 contracts/permissions.yaml 中的动作；/api 以外只允许 config.infra 的基础设施路由。
 * 收到请求时，统一钩子比对 request.ctx.role 与动作允许的角色，不允许返回 COMMON_FORBIDDEN。
 * openapi 中标 x-public 的接口不要求登录；0 期每个请求都带固定身份，这一标注在接入登录后生效。
 */
export function registerRoleCheck(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    const config: FastifyContextConfig = route.config ?? {};
    const where = `${String(route.method)} ${route.url}`;
    if (config.infra === true) {
      if (isApiPath(route.url)) throw new Error(`路由 ${where} 在 ${API_PREFIX} 下，不能标 config.infra`);
      return;
    }
    if (!isApiPath(route.url)) throw new Error(`路由 ${where} 不在 ${API_PREFIX} 下，也没有标 config.infra`);
    if (config.action === undefined) throw new Error(`路由 ${where} 没有声明 config.action（contracts/permissions.yaml 的动作）`);
    if (!isActionId(config.action)) throw new Error(`路由 ${where} 的动作 ${String(config.action)} 未在 contracts/permissions.yaml 登记`);
  });
  app.addHook("onRequest", async (request) => {
    const { action, infra } = request.routeOptions.config;
    if (infra === true || action === undefined) return;
    if (!roleAllowed(action, request.ctx.role)) throw new ApiError("COMMON_FORBIDDEN", { action });
  });
}
