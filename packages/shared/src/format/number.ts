const formatters = new Map<number, Intl.NumberFormat>();

/** 数字：千位分隔、最多 digits 位小数（默认 1 位）：1234.56 → “1,234.6”；不显示“-0”。 */
export function formatNumber(value: number, digits = 1): string {
  let formatter = formatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits, signDisplay: "negative" });
    formatters.set(digits, formatter);
  }
  return formatter.format(value);
}
