// metrics 领域（指标）的包入口：本领域的路由插件与事件、指标登记（生成物，来源 contracts/events.yaml、contracts/metrics.yaml）。
export { metricsRoutes } from "./api/routes.ts";
export { EVENTS, type EventEntry, type EventName, type EventPropertyType } from "./generated/events.ts";
export { METRICS, type MetricId } from "./generated/metrics.ts";
