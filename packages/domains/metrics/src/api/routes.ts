import type { FastifyPluginAsync } from "fastify";

/** metrics 领域的接口，由 apps/api 在 /api 下注册；埋点上报接口由 METR-01 加入。 */
export const metricsRoutes: FastifyPluginAsync = async () => {};
