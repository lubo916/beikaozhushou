// O01 的机构端示例接口。业务数字取 fixture，页面只显示；真实权限等待整合登记。
import type { O01Workbench } from "@exam-prep/contract";
import type { MockRequest, MockOutcome } from "@exam-prep/contract/mock-browser";
const FILES = import.meta.glob<O01Workbench>("../../../../../fixtures/pages/O01/*.json", { eager: true, import: "default" });
const EXAMS: Readonly<Record<string, string>> = {
  kj: "junior-accounting",
  js: "teacher-qualification",
  en: "cet-6",
  ds: "ds-final-custom",
};
const ROLE_TODOS: Readonly<Record<string, readonly string[]>> = {
  academic_admin: ["schedule", "review"],
  head_teacher: ["contact"],
  lecturer: ["grading", "qa"],
  researcher: ["review"],
  advisor: ["contact"],
};
export function o01Fixture(exam = "kj"): O01Workbench {
  const id = EXAMS[exam] ?? exam;
  const data = Object.entries(FILES).find(([path]) => path.endsWith(`/${id}.json`))?.[1] ?? Object.values(FILES)[0];
  if (data === undefined) throw new Error("O01 fixture missing");
  return structuredClone(data);
}
export async function handleO01(request: MockRequest): Promise<MockOutcome> {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== "/api/v1/org/workbench") return { kind: "passthrough" };
  const state = url.searchParams.get("state");
  if (state === "loading") return { kind: "hang" };
  if (state === "offline") return { kind: "network_error" };
  if (state === "error")
    return { kind: "json", status: 500, body: { code: "COMMON_INTERNAL", message_key: "error.COMMON_INTERNAL", details: {} }, headers: {} };
  const data = o01Fixture(url.searchParams.get("exam") ?? "kj");
  const role = url.searchParams.get("role") ?? "org_owner";
  const scope = role === "org_owner" ? (url.searchParams.get("scope") ?? "all") : "east";
  const type = url.searchParams.get("organization_type");
  if (type === "school")
    data.metrics = [
      { id: "students", value: 420, format: "count" },
      { id: "courses", value: 18, format: "count" },
      { id: "completion", value: 0.81, format: "percent" },
      { id: "ai_minutes", value: 1680, format: "minutes" },
    ];
  if (type === "enterprise")
    data.metrics = [
      { id: "students", value: 168, format: "count" },
      { id: "required", value: 0.83, format: "percent" },
      { id: "certifications", value: 12, format: "count" },
      { id: "ai_minutes", value: 960, format: "minutes" },
    ];
  if (scope !== "all") {
    data.organization_name = scope === "east" ? "启明学习中心 · 东城校区" : "启明学习中心 · 教学部门";
    data.metrics = data.metrics.map((m) => (m.id === "students" ? { ...m, value: 64 } : m));
  }
  if (role !== "org_owner" && role !== "campus_manager")
    data.todos = data.todos.filter((todo) => (ROLE_TODOS[role] ?? ["contact"]).includes(todo.id));
  if (state === "empty") {
    data.classes = [];
    data.todos = [];
    data.notices = [];
    data.metrics = [];
  }
  if (state === "restricted") {
    data.access = "restricted";
    data.classes = [];
    data.metrics = [];
  }
  if (state === "insufficient_data") {
    data.sample_sufficient = false;
    data.sample_count = 6;
    data.classes = [];
    data.metrics = [];
  }
  return { kind: "json", status: 200, body: data, headers: { "x-data-source": "sample" } };
}
