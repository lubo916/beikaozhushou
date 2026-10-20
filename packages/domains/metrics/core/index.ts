// metrics 领域（指标）的 core 层：事件与指标登记（pnpm gen 生成，来源 contracts/events.yaml、contracts/metrics.yaml）。
export { EVENTS, type EventEntry, type EventName, type EventPropertyType } from "./generated/events.ts";
export { METRICS, type MetricId } from "./generated/metrics.ts";
