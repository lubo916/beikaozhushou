import { describe, expect, it } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import fixture from "../../../../../fixtures/pages/O01/junior-accounting.json";
import type { O01Workbench } from "@exam-prep/contract";
import { workbenchView as view } from "./view.ts";
const data = fixture as O01Workbench;
const success = { data, error: null, status: "success" as const, fetchStatus: "idle" as const };
describe("O01 缓存与权限回归", () => {
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
    const limited = { ...data, access: "restricted" as const, classes: [], todos: [] };
    expect(view({ ...success, data: limited }).state).not.toBe("empty");
    const insufficient = { ...data, sample_sufficient: false, classes: [], todos: [] };
    expect(view({ ...success, data: insufficient }).state).not.toBe("empty");
  });
});
