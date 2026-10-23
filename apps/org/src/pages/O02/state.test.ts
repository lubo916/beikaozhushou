import { describe, expect, it } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import fixture from "../../../../../fixtures/pages/O02/junior-accounting.json";
import type { O02Leads } from "@exam-prep/contract";
import { leadsView as view, visibleLead } from "./view.ts";
const data = fixture as O02Leads;
const success = { data, error: null, status: "success" as const, fetchStatus: "idle" as const };
describe("O02 缓存与权限回归", () => {
  it("权限被收回时隐藏已缓存的数据，403 优先于旧成功响应", () => {
    expect(view({ ...success, status: "error", error: new ApiError("COMMON_FORBIDDEN") })).toEqual({
      state: "restricted",
      data: undefined,
      stale: false,
    });
  });
  it("离线继续显示已授权缓存并给离线标记", () => {
    expect(view({ ...success, status: "error", error: new TypeError("offline") })).toMatchObject({ state: "normal", data, stale: true });
  });
  it("受限或样本不足的响应不因列表为空而误判空态", () => {
    const limited = { ...data, access: "restricted" as const, leads: [] };
    expect(view({ ...success, data: limited }).state).toBe("restricted");
    const insufficient = { ...data, sample_sufficient: false, leads: [] };
    expect(view({ ...success, data: insufficient }).state).not.toBe("empty");
  });
});

describe("O02 沟通弹窗权限回归", () => {
  it("受限和空响应立即移除已打开线索的内容", () => {
    const selected = data.leads[0];
    expect(visibleLead(selected, { state: "restricted", data: undefined })).toBeUndefined();
    expect(visibleLead(selected, { state: "empty", data: { ...data, leads: [] } })).toBeUndefined();
  });
  it("刷新后只显示当前响应中仍可见的线索内容", () => {
    const selected = data.leads[0];
    if (selected === undefined) throw new Error("缺少线索fixture");
    const current = { ...selected, communication: "当前授权响应中的沟通要点" };
    expect(visibleLead(selected, { state: "normal", data: { ...data, leads: [current] } })).toEqual(current);
    expect(visibleLead(selected, { state: "normal", data: { ...data, leads: [] } })).toBeUndefined();
  });
});
