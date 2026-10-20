import { describe, expect, it } from "vitest";
import {
  EMPTY_VALUE,
  findBareNumbers,
  formatCount,
  formatDate,
  formatDateTime,
  formatDays,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRange,
  formatRelativeDay,
  formatScore,
  formatSeconds,
  formatTierGap,
  formatTime,
  interpolate,
  markAiGenerated,
} from "./index.ts";

const TZ = "Asia/Shanghai";
const AFTERNOON = Date.UTC(2026, 9, 20, 6, 5); // 北京时间 2026-10-20 14:05

describe("显示格式（ui-rules 第 9 节）", () => {
  it("时长：分钟与小时", () => {
    expect(formatDuration(45)).toBe("45 分钟");
    expect(formatDuration(90)).toBe("1 小时 30 分钟");
    expect(formatDuration(120)).toBe("2 小时");
    expect(formatDuration(0)).toBe("0 分钟");
    expect(formatDuration(0.4)).toBe("不到 1 分钟");
    expect(formatDuration(-5)).toBe(EMPTY_VALUE);
  });

  it("用时：秒与分", () => {
    expect(formatSeconds(38)).toBe("38 秒");
    expect(formatSeconds(65)).toBe("1 分 5 秒");
    expect(formatSeconds(120)).toBe("2 分钟");
    expect(formatSeconds(Number.NaN)).toBe(EMPTY_VALUE);
  });

  it("日期与时间按用户时区显示，学习日原样显示", () => {
    expect(formatDate(AFTERNOON, { timeZone: TZ })).toBe("10月20日");
    expect(formatDate(AFTERNOON, { timeZone: TZ, weekday: true })).toBe("10月20日 周二");
    expect(formatDate("2026-10-20", { year: true })).toBe("2026年10月20日");
    expect(formatDate("2026-10-25", { weekday: true })).toBe("10月25日 周日");
    expect(formatTime(AFTERNOON, TZ)).toBe("14:05");
    expect(formatTime("2026-10-20T06:05:00Z", "UTC")).toBe("06:05");
    expect(formatDateTime(AFTERNOON, TZ)).toBe("10月20日 14:05");
    expect(() => formatDate(AFTERNOON)).toThrow();
  });

  it("相对日期与天数", () => {
    expect(formatRelativeDay("2026-10-20", "2026-10-20")).toBe("今天");
    expect(formatRelativeDay("2026-10-21", "2026-10-20")).toBe("明天");
    expect(formatRelativeDay("2026-10-19", "2026-10-20")).toBe("昨天");
    expect(formatRelativeDay("2026-10-23", "2026-10-20")).toBe("3 天后");
    expect(formatRelativeDay("2026-10-18", "2026-10-20")).toBe("2 天前");
    expect(formatDays(38)).toBe("38 天");
  });

  it("数字、计数、百分比、分数、区间与档位差", () => {
    expect(formatNumber(1234.56)).toBe("1,234.6");
    expect(formatNumber(-0.01)).toBe("0");
    expect(formatCount(1234, "题")).toBe("1,234 题");
    expect(formatPercent(0.625)).toBe("63%");
    expect(formatPercent(0.625, 1)).toBe("62.5%");
    expect(formatScore(61.5)).toBe("61.5 分");
    expect(formatScore(60, { total: 100 })).toBe("60/100");
    expect(formatRange(57, 65)).toBe("57–65");
    expect(formatRange(65, 57, "分")).toBe("57–65 分");
    expect(formatRange(60, 60)).toBe("60");
    expect(formatTierGap(2)).toBe("还差 2 档");
    expect(formatTierGap(0)).toBe("已达标");
    expect(formatTierGap(-1)).toBe("已达标");
  });

  it("文案插值：规则数字经占位符传入", () => {
    expect(interpolate("间隔 {{days}} 天做对 {{times}} 次", { days: 3, times: 2 })).toBe("间隔 3 天做对 2 次");
    expect(interpolate("{{ days }} 天内可撤销", { days: 7 })).toBe("7 天内可撤销");
    expect(interpolate("缺 {{x}}", {})).toBe("缺 {{x}}");
  });

  it("裸数字检查：占位符以外的数字（含全角）都算", () => {
    expect(findBareNumbers("间隔 {{days}} 天做对 {{times}} 次")).toEqual([]);
    expect(findBareNumbers("保底 30%，7 天内可撤销")).toEqual(["30", "7"]);
    expect(findBareNumbers("我只有１５分钟")).toEqual(["１５"]);
  });

  it("AI 生成的内容复制导出时带标识", () => {
    expect(markAiGenerated("先复习这一节")).toBe("【AI 生成】先复习这一节");
  });
});
