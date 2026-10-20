import { describe, expect, it } from "vitest";
import { DEFAULT_DAY_SETTINGS, addDays, dayStart, diffDays, today, weekStart, weekdayOf } from "./index.ts";

const BEIJING = { timeZone: "Asia/Shanghai", dayStartHour: 4 };
const NEW_YORK = { timeZone: "America/New_York", dayStartHour: 4 };

describe("“今天”函数（按用户时区与日界线）", () => {
  it("默认：北京时间凌晨 4 点切到新的一天（开工决定第 6 条）", () => {
    expect(DEFAULT_DAY_SETTINGS).toEqual(BEIJING);
  });

  it("边界：北京时间凌晨 3:59 还算前一天，4:00 起算新的一天", () => {
    expect(today(Date.parse("2026-10-20T19:59:00Z"), BEIJING)).toBe("2026-10-20"); // 当地 10月21日 03:59
    expect(today(Date.parse("2026-10-20T19:59:59.999Z"), BEIJING)).toBe("2026-10-20");
    expect(today(Date.parse("2026-10-20T20:00:00Z"), BEIJING)).toBe("2026-10-21"); // 当地 10月21日 04:00
    expect(today(new Date("2026-10-21T15:59:00Z"), BEIJING)).toBe("2026-10-21"); // 当地 23:59
  });

  it("跨月、跨年也按日界线切", () => {
    expect(today(Date.parse("2026-12-31T19:59:00Z"), BEIJING)).toBe("2026-12-31");
    expect(today(Date.parse("2026-12-31T20:00:00Z"), BEIJING)).toBe("2027-01-01");
    expect(today(Date.parse("2026-10-31T19:00:00Z"), BEIJING)).toBe("2026-10-31");
  });

  it("日界线可改：0 点即自然日", () => {
    const midnight = { timeZone: "Asia/Shanghai", dayStartHour: 0 };
    expect(today(Date.parse("2026-10-20T15:59:00Z"), midnight)).toBe("2026-10-20");
    expect(today(Date.parse("2026-10-20T16:00:00Z"), midnight)).toBe("2026-10-21");
  });

  it("夏令时时区也按当地钟点切日", () => {
    // 纽约 2026-03-08 凌晨 2 点进入夏令时（UTC-4）：当地 4:00 = 08:00Z；前一天是冬令时（UTC-5）
    expect(today(Date.parse("2026-03-08T07:59:00Z"), NEW_YORK)).toBe("2026-03-07");
    expect(today(Date.parse("2026-03-08T08:00:00Z"), NEW_YORK)).toBe("2026-03-08");
    expect(dayStart("2026-03-08", NEW_YORK).toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(dayStart("2026-03-07", NEW_YORK).toISOString()).toBe("2026-03-07T09:00:00.000Z");
  });

  it("学习日从当地日界线开始（换算成 UTC）", () => {
    expect(dayStart("2026-10-21", BEIJING).toISOString()).toBe("2026-10-20T20:00:00.000Z");
    expect(today(dayStart("2026-10-21", BEIJING), BEIJING)).toBe("2026-10-21");
  });

  it("日期运算：加减天数、相差天数、星期与自然周（周一开始）", () => {
    expect(addDays("2026-10-20", 12)).toBe("2026-11-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(diffDays("2026-10-20", "2026-12-31")).toBe(72);
    expect(diffDays("2026-10-20", "2026-10-18")).toBe(-2);
    expect(weekdayOf("2026-10-20")).toBe(2);
    expect(weekStart("2026-10-20")).toBe("2026-10-19");
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
  });

  it("输入不对时报错", () => {
    expect(() => addDays("2026/10/20", 1)).toThrow();
    expect(() => today(0, { timeZone: "Asia/Shanghai", dayStartHour: 24 })).toThrow();
  });
});
