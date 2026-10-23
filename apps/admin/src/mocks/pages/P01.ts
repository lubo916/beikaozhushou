// P01 运营驾驶舱的示例接口（平台后台假数据层）：业务数字取 fixture，页面只显示；真实权限待整合登记。
// 处理函数与 @exam-prep/contract/mock-browser 的 MockHandle 同签名：后台补齐假数据工作线程后可直接交给 startMockWorker。
import type { P01Cockpit, P01CohortDimension, P01RetentionGroup } from "@exam-prep/contract";
import type { MockOutcome, MockRequest } from "@exam-prep/contract/mock-browser";

interface P01Variant {
  readonly cockpit: P01Cockpit;
  readonly retention_by_dimension: Readonly<Record<P01CohortDimension, readonly P01RetentionGroup[]>>;
}
/** 每个演示考试一份：正常数据与“样本不足”数据（只有原始计数，不带比例类结论）。 */
export interface P01Fixture {
  readonly normal: P01Variant;
  readonly insufficient: P01Variant;
}

const FILES = import.meta.glob<P01Fixture>("../../../../../fixtures/pages/P01/*.json", { eager: true, import: "default" });
const EXAMS: Readonly<Record<string, string>> = {
  kj: "junior-accounting",
  js: "teacher-qualification",
  en: "cet-6",
  ds: "ds-final-custom",
};
const DIMENSIONS: readonly P01CohortDimension[] = ["goal_type", "map_source", "channel"];
export const P01_PATH = "/api/v1/admin/cockpit";

export function p01Fixture(exam = "kj"): P01Fixture {
  const id = EXAMS[exam] ?? exam;
  const data = Object.entries(FILES).find(([path]) => path.endsWith(`/${id}.json`))?.[1] ?? Object.values(FILES)[0];
  if (data === undefined) throw new Error("P01 fixture missing");
  return structuredClone(data);
}

function failure(status: number, code: string): MockOutcome {
  return { kind: "json", status, body: { code, message_key: `error.${code}`, details: {} }, headers: {} };
}

export async function handleP01(request: MockRequest): Promise<MockOutcome> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== P01_PATH) return { kind: "passthrough" };
  const query = url.searchParams;
  const state = query.get("state");
  // 加载、离线、出错、受限由假数据层统一制造（页面不为 ?state= 写分支）。
  if (state === "loading") return { kind: "hang" };
  if (state === "offline") return { kind: "network_error" };
  if (state === "error") return failure(500, "COMMON_INTERNAL");
  if (state === "restricted") return failure(403, "COMMON_FORBIDDEN");
  const fixture = p01Fixture(query.get("exam") ?? "kj");
  const variant = state === "insufficient_data" ? fixture.insufficient : fixture.normal;
  const asked = query.get("dimension");
  const dimension = DIMENSIONS.find((key) => key === asked) ?? variant.cockpit.retention.dimension;
  let cockpit: P01Cockpit = {
    ...variant.cockpit,
    retention: { ...variant.cockpit.retention, dimension, groups: [...variant.retention_by_dimension[dimension]] },
  };
  if (state === "empty") {
    cockpit = {
      ...cockpit,
      open_alert_count: 0,
      north_star: { ...cockpit.north_star, value: 0, previous_value: 0 },
      first_week_rate: { metric_id: cockpit.first_week_rate.metric_id, numerator: 0, denominator: 0 },
      funnel: [],
      retention: { ...cockpit.retention, groups: [] },
      alerts: [],
    };
  }
  return { kind: "json", status: 200, body: cockpit, headers: { "x-data-source": "sample" } };
}
