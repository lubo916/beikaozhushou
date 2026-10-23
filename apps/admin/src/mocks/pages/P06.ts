// P06 变更影响分析的示例接口（平台后台假数据层）：变更事件与影响范围取 fixture，按变更类型筛选在这里完成，页面只显示。
// 处理函数与 @exam-prep/contract/mock-browser 的 MockHandle 同签名：后台补齐假数据工作线程后可直接交给 startMockWorker。
import type { P06AnalysisSample, P06ChangeEvent, P06ChangeImpact, P06ChangeKind, P06ImpactScope } from "@exam-prep/contract";
import type { MockOutcome, MockRequest } from "@exam-prep/contract/mock-browser";

/** 每个演示考试一份：完整的变更影响，以及“样本不足”时的学习记录计数（只有原始计数，不估算受影响学员）。 */
export interface P06Fixture {
  readonly impact: P06ChangeImpact;
  readonly insufficient_analysis: P06AnalysisSample;
}

const FILES = import.meta.glob<P06Fixture>("../../../../../fixtures/pages/P06/*.json", { eager: true, import: "default" });
const EXAMS: Readonly<Record<string, string>> = {
  kj: "junior-accounting",
  js: "teacher-qualification",
  en: "cet-6",
  ds: "ds-final-custom",
};
const KINDS: readonly P06ChangeKind[] = ["syllabus", "textbook", "rule"];
export const P06_PATH = "/api/v1/admin/change-impact";

export function p06Fixture(exam = "kj"): P06Fixture {
  const id = EXAMS[exam] ?? exam;
  const data = Object.entries(FILES).find(([path]) => path.endsWith(`/${id}.json`))?.[1] ?? Object.values(FILES)[0];
  if (data === undefined) throw new Error("P06 fixture missing");
  return structuredClone(data);
}

function failure(status: number, code: string): MockOutcome {
  return { kind: "json", status, body: { code, message_key: `error.${code}`, details: {} }, headers: {} };
}

/** 样本不足时不出结论：去掉受影响学员的估算和 AI 摘要，只留内容层面的原始计数。 */
function withoutEstimates(event: P06ChangeEvent): P06ChangeEvent {
  const impact: P06ImpactScope = {
    knowledge_point_count: event.impact.knowledge_point_count,
    question_count: event.impact.question_count,
    card_count: event.impact.card_count,
    template_count: event.impact.template_count,
    ...(event.impact.mapped_page_count === undefined ? {} : { mapped_page_count: event.impact.mapped_page_count }),
  };
  const base: P06ChangeEvent = {
    event_id: event.event_id,
    title: event.title,
    kind: event.kind,
    official_document: event.official_document,
    effective_on: event.effective_on,
    stage: event.stage,
    impact,
    pending_update: event.pending_update,
  };
  return event.progress === undefined ? base : { ...base, progress: event.progress };
}

export async function handleP06(request: MockRequest): Promise<MockOutcome> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== P06_PATH) return { kind: "passthrough" };
  const query = url.searchParams;
  const state = query.get("state");
  if (state === "loading") return { kind: "hang" };
  if (state === "offline") return { kind: "network_error" };
  if (state === "error") return failure(500, "COMMON_INTERNAL");
  if (state === "restricted") return failure(403, "COMMON_FORBIDDEN");
  const fixture = p06Fixture(query.get("exam") ?? "kj");
  const impact = fixture.impact;
  const kind = KINDS.find((key) => key === query.get("kind"));
  let body: P06ChangeImpact = { ...impact, events: impact.events.filter((event) => kind === undefined || event.kind === kind) };
  if (state === "empty") {
    body = { ...impact, total_count: 0, events: [], kind_counts: impact.kind_counts.map((entry) => ({ ...entry, count: 0 })) };
  }
  if (state === "insufficient_data") body = { ...body, analysis: fixture.insufficient_analysis, events: body.events.map(withoutEstimates) };
  return { kind: "json", status: 200, body, headers: { "x-data-source": "sample" } };
}
