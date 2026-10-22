export interface PlaywrightShard {
  readonly current: number;
  readonly total: number;
}

const SHARD_ERROR = "E2E_SHARD 必须为有效分片（例如 1/2），且序号不能超过总片数";

/** 空值表示完整运行；显式分片必须是安全的正整数，避免错误参数漏掉测试。 */
export function readPlaywrightShard(value: string | undefined): PlaywrightShard | undefined {
  if (value === undefined || value === "") return undefined;
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(value);
  if (!match) throw new Error(SHARD_ERROR);
  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(total) || current > total) {
    throw new Error(SHARD_ERROR);
  }
  return { current, total };
}
