// O02 简版：只读示例由 fixtures 提供；所有业务数字来自接口，不在页面重算。
import type { O02Leads } from "@exam-prep/contract";
import type { MockRequest, MockOutcome } from "@exam-prep/contract/mock-browser";

const FILES = import.meta.glob<O02Leads>("../../../../../fixtures/pages/O02/*.json", { eager: true, import: "default" });
const EXAMS: Readonly<Record<string, string>> = {
  kj: "junior-accounting",
  js: "teacher-qualification",
  en: "cet-6",
  ds: "ds-final-custom",
};

export function o02Fixture(exam = "kj"): O02Leads {
  const id = EXAMS[exam] ?? exam;
  const hit = Object.entries(FILES).find(([path]) => path.endsWith(`/${id}.json`));
  const fallback = Object.entries(FILES).find(([path]) => path.endsWith("/junior-accounting.json"));
  const value = hit?.[1] ?? fallback?.[1];
  if (value === undefined) throw new Error("O02 缺少演示数据");
  return structuredClone(value);
}

export async function handleO02(request: MockRequest): Promise<MockOutcome> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== "/api/v1/org/leads/overview") return { kind: "passthrough" };
  const state = url.searchParams.get("state");
  if (state === "loading") return { kind: "hang" };
  if (state === "offline") return { kind: "network_error" };
  if (state === "error")
    return { kind: "json", status: 500, headers: {}, body: { code: "COMMON_INTERNAL", message_key: "error.COMMON_INTERNAL", details: {} } };
  const data = o02Fixture(url.searchParams.get("exam") ?? "kj");
  if (state === "empty") {
    data.leads = [];
    data.channels = [];
    data.summary = { new_leads: 0, followup_due: 0, trial_booked: 0, enrolled: 0, conversion_ratio: 0 };
    data.sample_count = 0;
  }
  if (state === "restricted") {
    data.access = "restricted";
    data.leads = [];
    data.channels = [];
    data.summary = { new_leads: 0, followup_due: 0, trial_booked: 0, enrolled: 0, conversion_ratio: 0 };
    data.sample_count = 0;
  }
  if (state === "insufficient_data") {
    data.sample_sufficient = false;
    data.sample_count = 5;
    data.channels = [{ id: "diagnosis", name: data.channels[0]?.name ?? "", leads: 5, trial: 2, enrolled: 1 }];
  }
  return { kind: "json", status: 200, headers: {}, body: data };
}
