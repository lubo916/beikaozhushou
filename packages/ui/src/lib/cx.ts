/** 拼接类名：忽略 false、null、undefined 与空串。 */
export function cx(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
