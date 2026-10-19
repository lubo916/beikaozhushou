import { ENV_NAMES, EnvError, assertRunnable, parseEnvName, type EnvName } from "@exam-prep/domain-platform";

export { ENV_NAMES, EnvError, assertRunnable, parseEnvName, type EnvName };

/** 当前运行环境名（读 EXAM_PREP_ENV）：development、test、staging、production；未设置按 development，其他值拒绝启动。 */
export function getEnv(source: NodeJS.ProcessEnv = process.env): EnvName {
  return parseEnvName(source["EXAM_PREP_ENV"]);
}
