// P05 考情分析工作台的示例接口（平台后台假数据层）：真题拆解、考点档案与成熟度取 fixture，按来源筛选在这里完成，页面只显示。
// 处理函数与 @exam-prep/contract/mock-browser 的 MockHandle 同签名：后台补齐假数据工作线程后可直接交给 startMockWorker。
import type { P05ExamAnalysis, P05SourceLevel } from "@exam-prep/contract";
import type { MockOutcome, MockRequest } from "@exam-prep/contract/mock-browser";

/** 每个演示考试一份：完整的考情分析，以及“样本不足”时的成熟度与考点档案（只有原始计数）。 */
export interface P05Fixture {
  readonly analysis: P05ExamAnalysis;
  readonly insufficient: Pick<P05ExamAnalysis, "total_count" | "source_counts" | "maturity" | "profile">;
}

const FILES = import.meta.glob<P05Fixture>("../../../../../fixtures/pages/P05/*.json", { eager: true, import: "default" });
const EXAMS: Readonly<Record<string, string>> = {
  kj: "junior-accounting",
  js: "teacher-qualification",
  en: "cet-6",
  ds: "ds-final-custom",
};
const SOURCES: readonly P05SourceLevel[] = ["official_public", "licensed", "recalled"];
export const P05_PATH = "/api/v1/admin/exam-analysis";

export function p05Fixture(exam = "kj"): P05Fixture {
  const id = EXAMS[exam] ?? exam;
  const data = Object.entries(FILES).find(([path]) => path.endsWith(`/${id}.json`))?.[1] ?? Object.values(FILES)[0];
  if (data === undefined) throw new Error("P05 fixture missing");
  return structuredClone(data);
}

function failure(status: number, code: string): MockOutcome {
  return { kind: "json", status, body: { code, message_key: `error.${code}`, details: {} }, headers: {} };
}

export async function handleP05(request: MockRequest): Promise<MockOutcome> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== P05_PATH) return { kind: "passthrough" };
  const query = url.searchParams;
  const state = query.get("state");
  if (state === "loading") return { kind: "hang" };
  if (state === "offline") return { kind: "network_error" };
  if (state === "error") return failure(500, "COMMON_INTERNAL");
  if (state === "restricted") return failure(403, "COMMON_FORBIDDEN");
  const fixture = p05Fixture(query.get("exam") ?? "kj");
  const analysis = fixture.analysis;
  const source = SOURCES.find((key) => key === query.get("source"));
  let body: P05ExamAnalysis = {
    ...analysis,
    questions: analysis.questions.filter((item) => source === undefined || item.source === source),
  };
  if (state === "empty") {
    body = {
      ...analysis,
      total_count: 0,
      questions: [],
      source_counts: analysis.source_counts.map((entry) => ({ ...entry, count: 0 })),
      maturity: { ...fixture.insufficient.maturity, question_count: 0, year_count: 0 },
      profile: { ...fixture.insufficient.profile, question_count: 0 },
    };
  }
  if (state === "insufficient_data") body = { ...body, ...fixture.insufficient };
  return { kind: "json", status: 200, body, headers: { "x-data-source": "sample" } };
}
