// “今天”函数（data-model.md、开工决定第 6 条）：时间存 UTC；“今天”按用户时区与日界线算。
// 所有跨天逻辑（今日清单、夜间顺延、连续天数、到期）共用这一份：前端、后端与模拟层同一份代码。
// 纯函数：现在的时刻、时区与日界线都由调用方传入。

/** 学习日：YYYY-MM-DD（按用户时区与日界线算出的“哪一天”）。 */
export type LearningDay = string;

export interface DaySettings {
  /** IANA 时区名，如 Asia/Shanghai。 */
  readonly timeZone: string;
  /** 日界线：当地几点切到新的一天（0–23 的整点）。 */
  readonly dayStartHour: number;
}

/**
 * 默认值（开工决定第 6 条：凌晨 4 点切到新的一天，默认北京时间，用户可改）。F04 已登记为参数 account.day.time_zone 与
 * account.day.start_hour（学员可改 0–6 点，F04-Q2）：调用方从参数访问器取值，假数据层已改用参数。本常量只留给组件陈列页与现有测试，
 * 与参数一致由 apps/learner/src/mocks 的测试守着；整合任务改完陈列页后删除。
 */
export const DEFAULT_DAY_SETTINGS: DaySettings = { timeZone: "Asia/Shanghai", dayStartHour: 4 };

export interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  /** 0 = 周日 … 6 = 周六 */
  readonly weekday: number;
}

const MS_PER_DAY = 86_400_000;
const HOURS_PER_DAY = 24;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** 某个时刻在某时区的当地钟点。 */
export function zonedParts(instant: Date | number, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAY_NAMES.indexOf(get("weekday")),
  };
}

function checkSettings(settings: DaySettings): void {
  const hour = settings.dayStartHour;
  if (!Number.isInteger(hour) || hour < 0 || hour >= HOURS_PER_DAY) throw new RangeError(`日界线必须是 0–23 的整点：${hour}`);
}

/** 拆开学习日字符串；格式不对时报错。 */
export function parseDay(day: LearningDay): { readonly year: number; readonly month: number; readonly day: number } {
  const match = DAY_RE.exec(day);
  if (!match) throw new RangeError(`学习日要写成 YYYY-MM-DD：${day}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toDay(utcMs: number): LearningDay {
  return new Date(utcMs).toISOString().slice(0, "YYYY-MM-DD".length);
}

function dayToUtc(day: LearningDay): number {
  const p = parseDay(day);
  return Date.UTC(p.year, p.month - 1, p.day);
}

/** 加减天数：addDays("2026-10-31", 1) → "2026-11-01"。 */
export function addDays(day: LearningDay, days: number): LearningDay {
  return toDay(dayToUtc(day) + days * MS_PER_DAY);
}

/** 相差天数：从 from 到 to 过了几天（to 在前为负数）。 */
export function diffDays(from: LearningDay, to: LearningDay): number {
  return Math.round((dayToUtc(to) - dayToUtc(from)) / MS_PER_DAY);
}

/** 星期几：0 = 周日 … 6 = 周六。 */
export function weekdayOf(day: LearningDay): number {
  return new Date(dayToUtc(day)).getUTCDay();
}

/** 自然周的第一天（周一；metrics.md：周是周一至周日的自然周）。 */
export function weekStart(day: LearningDay): LearningDay {
  const weekday = weekdayOf(day);
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

/** “今天”：某个时刻按用户时区与日界线属于哪一个学习日。当地时间不到日界线时还算前一天。 */
export function today(now: Date | number, settings: DaySettings): LearningDay {
  checkSettings(settings);
  const p = zonedParts(now, settings.timeZone);
  const calendarDay = toDay(Date.UTC(p.year, p.month - 1, p.day));
  return p.hour < settings.dayStartHour ? addDays(calendarDay, -1) : calendarDay;
}

function offsetMs(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - (instant - (((instant % 1000) + 1000) % 1000));
}

/** 学习日从哪个时刻开始（UTC）：当地日期的日界线整点。夏令时切换当天也按当地钟点算。 */
export function dayStart(day: LearningDay, settings: DaySettings): Date {
  checkSettings(settings);
  const p = parseDay(day);
  const wall = Date.UTC(p.year, p.month - 1, p.day, settings.dayStartHour);
  const first = wall - offsetMs(wall, settings.timeZone);
  return new Date(wall - offsetMs(first, settings.timeZone));
}
