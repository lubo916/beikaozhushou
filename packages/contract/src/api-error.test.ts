import { describe, expect, it } from "vitest";
import { ApiError, isApiError } from "./api-error.ts";
import { ERROR_CODES } from "./generated/error-codes.ts";

describe("ApiError", () => {
  it("按登记的错误码取 HTTP 状态与文案键，输出统一错误体", () => {
    const e = new ApiError("PRAC_REVEAL_LOCKED", { question_id: "q1" });
    expect(e.status).toBe(ERROR_CODES.PRAC_REVEAL_LOCKED.httpStatus);
    expect(e.toBody()).toEqual({ code: "PRAC_REVEAL_LOCKED", message_key: "error.practice.reveal_locked", details: { question_id: "q1" } });
  });

  it("模块重复加载时按名称与登记的 code 识别", () => {
    const foreign = Object.assign(new Error("COMMON_FORBIDDEN"), { name: "ApiError", code: "COMMON_FORBIDDEN" });
    expect(isApiError(foreign)).toBe(true);
    expect(isApiError(Object.assign(new Error("x"), { name: "ApiError", code: "NOT_REGISTERED" }))).toBe(false);
  });
});
