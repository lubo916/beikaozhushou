import { describe, expect, it } from "vitest";
import { readPlaywrightShard } from "../support/playwright-env.ts";

describe("Playwright 分片环境参数", () => {
  it.each([undefined, ""])("未设置分片时保留本地完整运行：%s", (value) => {
    expect(readPlaywrightShard(value)).toBeUndefined();
  });

  it.each([
    ["1/1", { current: 1, total: 1 }],
    ["1/2", { current: 1, total: 2 }],
    ["2/2", { current: 2, total: 2 }],
    ["3/7", { current: 3, total: 7 }],
  ])("接受有效分片 %s", (value, expected) => {
    expect(readPlaywrightShard(value)).toEqual(expected);
  });

  it.each([
    "0/2",
    "1/0",
    "3/2",
    "1",
    "1/2/3",
    "1.5/2",
    "1/2.5",
    "-1/2",
    "1/-2",
    " 1/2",
    "1/2 ",
    "1 / 2",
    "1e0/2",
    "Infinity/2",
    "NaN/2",
    "01/02",
    "0x1/2",
    "1/9007199254740992",
    "9007199254740992/9007199254740992",
  ])("拒绝无效分片 %s，避免执行不完整的清单", (value) => {
    expect(() => readPlaywrightShard(value)).toThrow(/E2E_SHARD/);
  });
});
