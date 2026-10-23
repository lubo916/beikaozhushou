// P08 题库审核与质量的示例接口（平台后台假数据层）：质检结论、证据上限、计数与时限判定取 fixture，页面只显示；真实权限待整合登记。
// 处理函数与 @exam-prep/contract/mock-browser 的 MockHandle 同签名：后台补齐假数据工作线程后可直接交给 startMockWorker。
import type { P08QuestionReview, P08ReviewOrigin } from "@exam-prep/contract";
import type { MockOutcome, MockRequest } from "@exam-prep/contract/mock-browser";

/** 每个演示考试一份：正常数据与“样本不足”数据（变式题作答样本不够：不带质量结论，只留原始计数）。 */
export interface P08Fixture {
  readonly normal: P08QuestionReview;
  readonly insufficient: P08QuestionReview;
}

const FILES = import.meta.glob<P08Fixture>("../../../../../fixtures/pages/P08/*.json", { eager: true, import: "default" });
const EXAMS: Readonly<Record<string, string>> = {
  kj: "junior-accounting",
  js: "teacher-qualification",
  en: "cet-6",
  ds: "ds-final-custom",
};
const ORIGINS: readonly P08ReviewOrigin[] = ["new", "modified"];
export const P08_PATH = "/api/v1/admin/question-review";

export function p08Fixture(exam = "kj"): P08Fixture {
  const id = EXAMS[exam] ?? exam;
  const data = Object.entries(FILES).find(([path]) => path.endsWith(`/${id}.json`))?.[1] ?? Object.values(FILES)[0];
  if (data === undefined) throw new Error("P08 fixture missing");
  return structuredClone(data);
}

function failure(status: number, code: string): MockOutcome {
  return { kind: "json", status, body: { code, message_key: `error.${code}`, details: {} }, headers: {} };
}

export async function handleP08(request: MockRequest): Promise<MockOutcome> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== P08_PATH) return { kind: "passthrough" };
  const query = url.searchParams;
  const state = query.get("state");
  // 加载、离线、出错、受限由假数据层统一制造（页面不为 ?state= 写分支）。
  if (state === "loading") return { kind: "hang" };
  if (state === "offline") return { kind: "network_error" };
  if (state === "error") return failure(500, "COMMON_INTERNAL");
  if (state === "restricted") return failure(403, "COMMON_FORBIDDEN");
  const fixture = p08Fixture(query.get("exam") ?? "kj");
  let review = state === "insufficient_data" ? fixture.insufficient : fixture.normal;
  const asked = query.get("origin");
  const origin = ORIGINS.find((key) => key === asked);
  if (origin !== undefined) review = { ...review, tasks: review.tasks.filter((task) => task.origin === origin) };
  if (state === "empty") {
    review = { ...review, origin_counts: { new: 0, modified: 0 }, tasks: [], checks: [], variant_pools: [], reports: [] };
  }
  return { kind: "json", status: 200, body: review, headers: { "x-data-source": "sample" } };
}
