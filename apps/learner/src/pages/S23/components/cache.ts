/** 演示考试初始化时会把地址选择同步到会话，之后工具条只改会话。 */
export function activeExamKey(search: string, saved: string | null): string {
  return saved ?? new URLSearchParams(search).get("exam") ?? "kj";
}
