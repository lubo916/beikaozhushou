import { describe, expect, it } from "vitest";
import { EnvError, assertRunnable, getEnv } from "./env.ts";

describe("运行环境名 EXAM_PREP_ENV", () => {
  it("未设置按 development", () => {
    expect(getEnv({})).toBe("development");
    expect(getEnv({ EXAM_PREP_ENV: "" })).toBe("development");
  });

  it("登记的环境名原样返回", () => {
    for (const name of ["development", "test", "staging", "production"] as const) {
      expect(getEnv({ EXAM_PREP_ENV: name })).toBe(name);
    }
  });

  it("其他值拒绝启动", () => {
    expect(() => getEnv({ EXAM_PREP_ENV: "prod" })).toThrow(EnvError);
  });

  it("正式登录接入前 production 拒绝启动", () => {
    expect(() => assertRunnable("production")).toThrow(EnvError);
    expect(() => assertRunnable("staging")).not.toThrow();
  });
});
