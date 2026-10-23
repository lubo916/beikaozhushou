// P07 内容生产流水线的示例接口（平台后台假数据层）：待办数、排序与差异分段取 fixture，页面只显示；真实权限待整合登记。
// 处理函数与 @exam-prep/contract/mock-browser 的 MockHandle 同签名：后台补齐假数据工作线程后可直接交给 startMockWorker。
import type { P07Pipeline, P07ReviewKind } from "@exam-prep/contract";
import type { MockOutcome, MockRequest } from "@exam-prep/contract/mock-browser";

/** 每个演示考试一份：正常数据与“样本不足”数据（置信度校准样本不够：不带置信度，按入队时间排）。 */
export interface P07Fixture {
  readonly normal: P07Pipeline;
  readonly insufficient: P07Pipeline;
}

const FILES = import.meta.glob<P07Fixture>("../../../../../fixtures/pages/P07/*.json", { eager: true, import: "default" });
const EXAMS: Readonly<Record<string, string>> = {
  kj: "junior-accounting",
  js: "teacher-qualification",
  en: "cet-6",
  ds: "ds-final-custom",
};
const KINDS: readonly P07ReviewKind[] = ["solution", "card", "slice_mount"];
export const P07_PATH = "/api/v1/admin/pipeline";

export function p07Fixture(exam = "kj"): P07Fixture {
  const id = EXAMS[exam] ?? exam;
  const data = Object.entries(FILES).find(([path]) => path.endsWith(`/${id}.json`))?.[1] ?? Object.values(FILES)[0];
  if (data === undefined) throw new Error("P07 fixture missing");
  return structuredClone(data);
}

function failure(status: number, code: string): MockOutcome {
  return { kind: "json", status, body: { code, message_key: `error.${code}`, details: {} }, headers: {} };
}

/** 按条目类型筛审核台：条目与当前筛选下的待审数都换成该类型的（计数取 fixture，页面不算）。 */
function filterKind(pipeline: P07Pipeline, kind: P07ReviewKind): P07Pipeline {
  const review = pipeline.review;
  return {
    ...pipeline,
    review: { ...review, total_count: review.kind_counts[kind], items: review.items.filter((item) => item.kind === kind) },
  };
}

export async function handleP07(request: MockRequest): Promise<MockOutcome> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== P07_PATH) return { kind: "passthrough" };
  const query = url.searchParams;
  const state = query.get("state");
  // 加载、离线、出错、受限由假数据层统一制造（页面不为 ?state= 写分支）。
  if (state === "loading") return { kind: "hang" };
  if (state === "offline") return { kind: "network_error" };
  if (state === "error") return failure(500, "COMMON_INTERNAL");
  if (state === "restricted") return failure(403, "COMMON_FORBIDDEN");
  const fixture = p07Fixture(query.get("exam") ?? "kj");
  let pipeline = state === "insufficient_data" ? fixture.insufficient : fixture.normal;
  const asked = query.get("kind");
  const kind = KINDS.find((key) => key === asked);
  if (kind !== undefined) pipeline = filterKind(pipeline, kind);
  if (state === "empty") {
    pipeline = {
      ...pipeline,
      queue: { parse_pending: 0, review_pending: 0 },
      materials: [],
      productions: [],
      review: { ...pipeline.review, total_count: 0, kind_counts: { solution: 0, card: 0, slice_mount: 0 }, items: [] },
    };
  }
  return { kind: "json", status: 200, body: pipeline, headers: { "x-data-source": "sample" } };
}
