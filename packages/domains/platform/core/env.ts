// 运行环境名（EXAM_PREP_ENV）：纯函数，api 与 worker 启动时用来拒绝未登记的环境。
/** 运行环境名（EXAM_PREP_ENV）的全部取值。 */
export const ENV_NAMES = ["development", "test", "staging", "production"] as const;
export type EnvName = (typeof ENV_NAMES)[number];

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

/** 解析 EXAM_PREP_ENV：未设置按 development，其他值拒绝启动。 */
export function parseEnvName(raw: string | undefined): EnvName {
  if (raw === undefined || raw === "") return "development";
  const name = ENV_NAMES.find((n) => n === raw);
  if (!name) throw new EnvError(`EXAM_PREP_ENV=${raw} 不是登记的环境名（${ENV_NAMES.join("、")}），拒绝启动`);
  return name;
}

/** 正式登录接入前生产环境不可用：0 期用固定开发者身份，production 拒绝启动。 */
export function assertRunnable(env: EnvName): void {
  if (env === "production") throw new EnvError("正式登录接入前生产环境不可用：EXAM_PREP_ENV=production 拒绝启动");
}
