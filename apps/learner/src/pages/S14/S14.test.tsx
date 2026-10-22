import { ApiError } from "@exam-prep/contract/errors";
import { notebookView, shouldRetry, type NotebookQuery } from "./data.ts";
// S14 本页契约冒烟：四个演示考试、状态和接口筛选均经真实生成的响应校验。
import { describe, expect, it } from "vitest";
import * as schemas from "@exam-prep/contract/zod";
import type { S14Notebook } from "@exam-prep/contract";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (schemas as Record<string, unknown>)["getS14NotebookResponse"] as Parser | undefined;
const NOW = Date.parse("2026-10-21T02:00:00Z");

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const notebook = async (query: Readonly<Record<string, string>> = {}): Promise<S14Notebook> => {
    const search = new URLSearchParams(query).toString();
    const outcome = await api.handle({
      method: "GET",
      url: `http://localhost/api/v1/learner/notebook?${search}`,
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("笔记本接口没有返回 JSON");
    expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
    const result = parser?.safeParse(outcome.body);
    expect(result?.success, String(result?.error)).toBe(true);
    return outcome.body as S14Notebook;
  };
  return { control, notebook };
}

describe("S14 假数据与生成契约", () => {
  it("生成的 Zod 中包含笔记本响应", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试的正常、空、受限和数据不足数据均符合契约", async () => {
    for (const state of ["", "empty", "restricted", "insufficient_data"]) {
      const { control, notebook } = setup(state);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await notebook();
        expect(data.data_source).toBe("sample");
        expect(data.exam_name).not.toBe("");
        expect(data.time_zone).not.toBe("");
        if (state === "") expect(data.notes.length).toBeGreaterThan(0);
        if (state === "empty") expect(data.notes).toEqual([]);
        if (state === "restricted") expect(data.ai_available).toBe(false);
        if (state === "insufficient_data") expect(data.paper_available).toBe(false);
        for (const row of data.notes) expect(row.note.exam_id).toBe(exam.examId);
      }
    }
  });

  it("全文搜索和类型、来源、科目筛选由接口完成；未知词给空列表", async () => {
    const { notebook } = setup();
    const data = await notebook();
    const first = data.notes[0];
    if (first === undefined) throw new Error("演示笔记为空");
    const byType = await notebook({ note_type: first.note.note_type });
    expect(byType.notes.length).toBeGreaterThan(0);
    expect(byType.notes.every((row) => row.note.note_type === first.note.note_type)).toBe(true);
    const bySource = await notebook({ source: first.source });
    expect(bySource.notes.length).toBeGreaterThan(0);
    expect(bySource.notes.every((row) => row.source === first.source)).toBe(true);
    const bySubject = await notebook({ subject: first.subject });
    expect(bySubject.notes.length).toBeGreaterThan(0);
    expect(bySubject.notes.every((row) => row.subject === first.subject)).toBe(true);
    const found = await notebook({ search: first.note.title });
    expect(found.notes.some((row) => row.note.id === first.note.id)).toBe(true);
    expect((await notebook({ search: "不存在的检索词S14" })).notes).toEqual([]);
  });
});
describe("S14 数据状态与重试", () => {
  const waiting: NotebookQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): NotebookQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });

  it("加载、查询暂停、网络错误与服务错误分别给出正确状态", () => {
    expect(notebookView(waiting).state).toBe("loading");
    expect(notebookView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(notebookView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(notebookView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(notebookView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });

  it("空列表与空收藏给空态；断网时保留已经取得的笔记并标出离线", async () => {
    const data = await setup().notebook();
    expect(notebookView({ ...waiting, data, status: "success", fetchStatus: "idle" }).state).toBe("normal");
    const stale = notebookView({ ...failed(new TypeError("Failed to fetch")), data });
    expect(stale.state).toBe("normal");
    expect(stale.stale).toBe(true);
    expect(stale.data?.notes).toEqual(data.notes);
    const empty = await setup("empty").notebook();
    expect(notebookView({ ...waiting, data: empty, status: "success" }).state).toBe("empty");
  });

  it("网络或服务异常只重试一次，4xx 不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});

describe("S14 时间筛选与游标分页", () => {
  it("起始日包括当天更新的笔记，未来日期无匹配仍保留收藏，不切成整页空态", async () => {
    const { notebook } = setup();
    const all = await notebook();
    const first = all.notes[0];
    if (first === undefined) throw new Error("演示笔记为空");
    const since = first.note.updated_at.slice(0, 10);
    const recent = await notebook({ period: since });
    expect(recent.notes.some((row) => row.note.id === first.note.id)).toBe(true);
    expect(recent.notes.every((row) => row.note.updated_at.slice(0, 10) >= since)).toBe(true);
    expect(recent.notes.length).toBeLessThan(all.notes.length);
    const filtered = await notebook({ period: "2099-01-01" });
    expect(filtered.notes).toEqual([]);
    expect(filtered.favorites.length).toBeGreaterThan(0);
    expect(notebookView({ data: filtered, error: null, status: "success", fetchStatus: "idle" }).state).toBe("normal");
  });

  it("按 next_cursor 翻页没有重复，上一页数据与下一页数据均符合生成契约", async () => {
    const { notebook } = setup();
    const first = await notebook({ limit: "2" });
    expect(first.notes).toHaveLength(2);
    expect(first.next_cursor).not.toBeNull();
    const second = await notebook({ limit: "2", cursor: first.next_cursor ?? "" });
    expect(second.notes).toHaveLength(2);
    const firstIds = first.notes.map((row) => row.note.id);
    expect(second.notes.every((row) => !firstIds.includes(row.note.id))).toBe(true);
    const all = await notebook();
    expect([...first.notes, ...second.notes].map((row) => row.note.id)).toEqual(all.notes.slice(0, 4).map((row) => row.note.id));
  });
});
