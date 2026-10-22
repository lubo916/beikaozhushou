// U11：生成契约校验四考试的真实 mock 响应，并验证七态与缓存断网行为。
import { describe, expect, it } from "vitest";
import type { S11Workspace } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { shouldRetry, workspaceView, type WorkspaceQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getS11MaterialsWorkspaceResponse"] as Parser | undefined;
const MODES = ["normal", "empty", "restricted", "insufficient_data"] as const;
type Mode = (typeof MODES)[number];

async function response(examKey: string, mode: Mode = "normal"): Promise<S11Workspace> {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => `?exam=${examKey}&state=${mode}`,
    clock: () => Date.parse("2026-10-22T10:00:00Z"),
  });
  control.setExam(examKey);
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const outcome = await api.handle({
    method: "GET",
    url: "http://localhost/api/v1/content/materials/workspace",
    headers: new Headers(),
    body: undefined,
  });
  expect(outcome.kind).toBe("json");
  if (outcome.kind !== "json") throw new Error("资料页 mock 应返回 JSON");
  expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
  const parsed = parser?.safeParse(outcome.body);
  expect(parsed?.success, `${examKey}/${mode}: ${String(parsed?.error)}`).toBe(true);
  return outcome.body as S11Workspace;
}

const success = (data: S11Workspace): WorkspaceQuery => ({
  data,
  error: null,
  status: "success",
  fetchStatus: "idle",
});
const failed = (error: unknown): WorkspaceQuery => ({
  data: undefined,
  error,
  status: "error",
  fetchStatus: "idle",
});

describe("S11 契约与四考试假数据", () => {
  it("提供本页生成的 Zod 响应校验器", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四考试的正常、空、受限、数据不足响应全部通过生成契约", async () => {
    for (const exam of fixtures.exams) {
      for (const mode of MODES) {
        const data = await response(exam.key, mode);
        expect(data.exam_id).toBe(exam.examId);
        expect(data.availability).toBe(mode);
        expect(data.data_source).toBe("sample");
        expect(workspaceView(success(data)).state).toBe(mode);
      }
    }
  });

  it("正常资料保留三种接入方式，并把已读与已达标分别提供", async () => {
    for (const exam of fixtures.exams) {
      const data = await response(exam.key);
      const access = new Set(data.materials.map((row) => row.material.access));
      expect(access).toEqual(new Set(["parsable", "mapped_only", "link_only"]));
      expect(data.materials.every((row) => row.material.exam_id === exam.examId)).toBe(true);
      expect(data.materials.some((row) => row.read_ratio !== row.attained_ratio)).toBe(true);
      expect(data.materials.some((row) => row.status === "failed" && Boolean(row.failure_reason))).toBe(true);
      expect(data.alignments.some((row) => row.disposition === "pending")).toBe(true);
      expect(data.alignments.some((row) => row.disposition === "excluded")).toBe(true);
    }
  });

  it("空态给可导入的工作区；额度耗尽与覆盖不足仍保留已解析资料", async () => {
    const normal = await response(fixtures.defaultKey);
    const empty = await response(fixtures.defaultKey, "empty");
    expect(empty.materials).toEqual([]);
    expect(empty.summary.pending).toBe(0);
    expect(empty.import_preview.filename).not.toBe("");

    const restricted = await response(fixtures.defaultKey, "restricted");
    expect(restricted.summary.parse_remaining).toBe(0);
    expect(restricted.materials).toEqual(normal.materials);
    const insufficient = await response(fixtures.defaultKey, "insufficient_data");
    expect(insufficient.materials).toEqual(normal.materials);
    expect(insufficient.health.some((item) => item.kind === "gap" && item.count > 0)).toBe(true);

    const unchanged = await response(fixtures.defaultKey);
    expect(unchanged.summary.parse_remaining).toBeGreaterThan(0);
  });
});

describe("S11 七态、缓存与请求重试", () => {
  const waiting: WorkspaceQuery = {
    data: undefined,
    error: null,
    status: "pending",
    fetchStatus: "fetching",
  };

  it("首次加载显示骨架；浏览器暂停请求或网络断连显示离线", () => {
    expect(workspaceView(waiting).state).toBe("loading");
    expect(workspaceView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(workspaceView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
  });

  it("服务错误显示出错，权限拒绝显示受限，未找到也不误判离线", () => {
    expect(workspaceView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
    expect(workspaceView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(workspaceView(failed(new ApiError("COMMON_NOT_FOUND"))).state).toBe("error");
  });

  it("缓存资料在断网和查询暂停后保留，并提供离线提醒标记", async () => {
    const data = await response(fixtures.defaultKey);
    const disconnected = workspaceView({
      ...success(data),
      status: "error",
      error: new TypeError("Failed to fetch"),
    });
    expect(disconnected.state).toBe("normal");
    expect(disconnected.data).toBe(data);
    expect(disconnected.stale).toBe(true);
    const paused = workspaceView({ ...success(data), fetchStatus: "paused" });
    expect(paused.data).toBe(data);
    expect(paused.stale).toBe(true);
    expect(workspaceView(success(data)).stale).toBe(false);
  });

  it("网络与服务异常最多重试一次；权限与未找到错误不重试", () => {
    for (const error of [new TypeError("Failed to fetch"), new ApiError("COMMON_INTERNAL")]) {
      expect(shouldRetry(0, error)).toBe(true);
      expect(shouldRetry(1, error)).toBe(false);
    }
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_NOT_FOUND"))).toBe(false);
  });
});
