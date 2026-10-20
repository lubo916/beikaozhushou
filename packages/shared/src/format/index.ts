// 显示格式（ui-rules.md 第 9 节）：时长、日期、时间、百分比、分数、区间、档位差、计数，一律用这里的函数显示，页面不自己拼；改格式只改这一处。
// 纯函数：时区由调用方传入；这里只管“怎么显示”，业务数字（掌握档、预测、完成度等）只来自接口，不在这里重算。
import { diffDays, parseDay, weekdayOf, zonedParts, type LearningDay } from "../today/index.ts";
import { AI_GENERATED } from "../vocab/supplement.ts";
import { formatNumber } from "./number.ts";

export { formatNumber } from "./number.ts";
export { findBareNumbers, interpolate, type InterpolationValues } from "./interpolate.ts";

/** 无法显示的取值（缺失、负的时长等）统一显示为破折号。 */
export const EMPTY_VALUE = "—";

const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const PERCENT = 100;
const WEEKDAY = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 时刻：Date、毫秒数或 ISO 字符串；“YYYY-MM-DD”是学习日，不做时区换算。 */
export type DateInput = Date | number | string;

export interface DateFormatOptions {
  /** 用户时区（IANA 名）；传入时刻时必填。 */
  readonly timeZone?: string | undefined;
  /** 带星期：“10月20日 周二”。 */
  readonly weekday?: boolean | undefined;
  /** 带年份：“2026年10月20日”。 */
  readonly year?: boolean | undefined;
}

function toInstant(input: DateInput): number {
  if (typeof input === "number") return input;
  return typeof input === "string" ? Date.parse(input) : input.getTime();
}

function calendarOf(input: DateInput, timeZone: string | undefined): { year: number; month: number; day: number; weekday: number } {
  if (typeof input === "string" && DAY_RE.test(input)) return { ...parseDay(input), weekday: weekdayOf(input) };
  if (timeZone === undefined) throw new Error("按时刻显示日期要传用户时区（timeZone）");
  return zonedParts(toInstant(input), timeZone);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 计数：formatCount(1234, "题") → “1,234 题”。 */
export function formatCount(value: number, unit = ""): string {
  if (!Number.isFinite(value)) return EMPTY_VALUE;
  const text = formatNumber(Math.round(value), 0);
  return unit ? `${text} ${unit}` : text;
}

/** 时长（分钟）：45 → “45 分钟”，90 → “1 小时 30 分钟”，120 → “2 小时”。 */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return EMPTY_VALUE;
  const total = Math.round(minutes);
  if (minutes > 0 && total === 0) return "不到 1 分钟";
  if (total < MINUTES_PER_HOUR) return `${total} 分钟`;
  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const rest = total % MINUTES_PER_HOUR;
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`;
}

/** 用时（秒）：38 → “38 秒”，65 → “1 分 5 秒”，120 → “2 分钟”。 */
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return EMPTY_VALUE;
  const total = Math.round(seconds);
  if (total < SECONDS_PER_MINUTE) return `${total} 秒`;
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  const rest = total % SECONDS_PER_MINUTE;
  return rest === 0 ? `${minutes} 分钟` : `${minutes} 分 ${rest} 秒`;
}

/** 日期：“10月20日”；可带星期、年份。时刻按用户时区换算，学习日（YYYY-MM-DD）原样显示。 */
export function formatDate(input: DateInput, options: DateFormatOptions = {}): string {
  const c = calendarOf(input, options.timeZone);
  const date = `${options.year ? `${c.year}年` : ""}${c.month}月${c.day}日`;
  return options.weekday ? `${date} ${WEEKDAY[c.weekday] ?? ""}` : date;
}

/** 时间：“14:05”（24 小时制，按用户时区）。 */
export function formatTime(input: Date | number | string, timeZone: string): string {
  const p = zonedParts(toInstant(input), timeZone);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** 日期加时间：“10月20日 14:05”。 */
export function formatDateTime(input: Date | number | string, timeZone: string, options: Omit<DateFormatOptions, "timeZone"> = {}): string {
  return `${formatDate(input, { ...options, timeZone })} ${formatTime(input, timeZone)}`;
}

/** 相对日期：今天、明天、昨天、3 天后、2 天前（today 由“今天”函数算出后传入）。 */
export function formatRelativeDay(day: LearningDay, today: LearningDay): string {
  const diff = diffDays(today, day);
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === -1) return "昨天";
  return diff > 0 ? `${diff} 天后` : `${-diff} 天前`;
}

/** 天数：“38 天”。 */
export function formatDays(days: number): string {
  return Number.isFinite(days) ? `${formatNumber(Math.round(days), 0)} 天` : EMPTY_VALUE;
}

/** 百分比：输入 0–1 的比例，0.625 → “63%”；digits 为最多几位小数。 */
export function formatPercent(ratio: number, digits = 0): string {
  return Number.isFinite(ratio) ? `${formatNumber(ratio * PERCENT, digits)}%` : EMPTY_VALUE;
}

export interface ScoreFormatOptions {
  /** 满分：给了就写成“61.5/100”。 */
  readonly total?: number | undefined;
  /** 单位，默认“分”。 */
  readonly unit?: string | undefined;
}

/** 分数：61.5 → “61.5 分”；带满分写成“61.5/100”。 */
export function formatScore(score: number, options: ScoreFormatOptions = {}): string {
  if (!Number.isFinite(score)) return EMPTY_VALUE;
  if (options.total !== undefined) return `${formatNumber(score)}/${formatNumber(options.total)}`;
  return `${formatNumber(score)} ${options.unit ?? "分"}`;
}

/** 区间：57–65（如预测分区间）；两端相同只写一个数；unit 跟在后面：“57–65 分”。 */
export function formatRange(low: number, high: number, unit = ""): string {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return EMPTY_VALUE;
  const [a, b] = low <= high ? [low, high] : [high, low];
  const text = a === b ? formatNumber(a) : `${formatNumber(a)}–${formatNumber(b)}`;
  return unit ? `${text} ${unit}` : text;
}

/** 档位差（vocabulary.md 第 1 节）：差值由接口给出；≤ 0 显示“已达标”，否则“还差 N 档”。 */
export function formatTierGap(gap: number): string {
  if (!Number.isFinite(gap)) return EMPTY_VALUE;
  return gap <= 0 ? "已达标" : `还差 ${Math.round(gap)} 档`;
}

/** AI 生成的内容在复制、下载、导出时带上标识（红线 4）：“【AI 生成】……”。 */
export function markAiGenerated(text: string, label: string = AI_GENERATED): string {
  return `【${label}】${text}`;
}
