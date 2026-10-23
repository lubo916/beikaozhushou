// P02 数据中台·指标字典的示例接口（平台后台假数据层）：口径与版本取 fixture，筛选在这里完成，页面只显示。
// 处理函数与 @exam-prep/contract/mock-browser 的 MockHandle 同签名：后台补齐假数据工作线程后可直接交给 startMockWorker。
import type { P02MetricCategory, P02MetricDictionary, P02QualityCheck } from "@exam-prep/contract";
import type { MockOutcome, MockRequest } from "@exam-prep/contract/mock-browser";

/** 每个演示考试一份：完整字典，以及“样本不足”时的数据质量检查（只有原始计数）。 */
export interface P02Fixture {
  readonly dictionary: P02MetricDictionary;
  readonly insufficient_quality: P02QualityCheck;
}

const FILES = import.meta.glob<P02Fixture>("../../../../../fixtures/pages/P02/*.json", { eager: true, import: "default" });
const EXAMS: Readonly<Record<string, string>> = {
  kj: "junior-accounting",
  js: "teacher-qualification",
  en: "cet-6",
  ds: "ds-final-custom",
};
const CATEGORIES: readonly P02MetricCategory[] = ["learning", "conversion", "retention", "quality", "cost"];
export const P02_PATH = "/api/v1/admin/metric-dictionary";

export function p02Fixture(exam = "kj"): P02Fixture {
  const id = EXAMS[exam] ?? exam;
  const data = Object.entries(FILES).find(([path]) => path.endsWith(`/${id}.json`))?.[1] ?? Object.values(FILES)[0];
  if (data === undefined) throw new Error("P02 fixture missing");
  return structuredClone(data);
}

function failure(status: number, code: string): MockOutcome {
  return { kind: "json", status, body: { code, message_key: `error.${code}`, details: {} }, headers: {} };
}

export async function handleP02(request: MockRequest): Promise<MockOutcome> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== P02_PATH) return { kind: "passthrough" };
  const query = url.searchParams;
  const state = query.get("state");
  if (state === "loading") return { kind: "hang" };
  if (state === "offline") return { kind: "network_error" };
  if (state === "error") return failure(500, "COMMON_INTERNAL");
  if (state === "restricted") return failure(403, "COMMON_FORBIDDEN");
  const fixture = p02Fixture(query.get("exam") ?? "kj");
  const dictionary = fixture.dictionary;
  const category = CATEGORIES.find((key) => key === query.get("category"));
  const keyword = (query.get("q") ?? "").trim().toLowerCase();
  let items = dictionary.items.filter(
    (item) =>
      (category === undefined || item.category === category) &&
      (keyword === "" || item.name.toLowerCase().includes(keyword) || item.metric_id.toLowerCase().includes(keyword)),
  );
  let body: P02MetricDictionary = { ...dictionary, items };
  if (state === "empty") {
    items = [];
    body = { ...dictionary, total_count: 0, items, categories: dictionary.categories.map((entry) => ({ ...entry, count: 0 })) };
  }
  if (state === "insufficient_data") body = { ...body, quality: fixture.insufficient_quality };
  return { kind: "json", status: 200, body, headers: { "x-data-source": "sample" } };
}
