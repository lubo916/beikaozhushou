#!/usr/bin/env bash
# 一条命令回到上一版镜像（0.1b 计划 E2）：在 ECS 的部署目录运行 ./rollback.sh。耗时写入 state/history.tsv。
# 数据库迁移只前进不回退：上一版镜像须兼容当前表结构（迁移只做向后兼容的变更）；需要恢复数据时用 backups/ 中发布前的备份另行恢复。
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

STATE=state
previous=$(cat "$STATE/previous" 2>/dev/null || true)
current=$(cat "$STATE/current" 2>/dev/null || true)
if [ -z "$previous" ]; then
  echo "没有上一版的记录（$STATE/previous），无法回滚" >&2
  exit 1
fi
started=$(date +%s)
export RELEASE_TAG="$previous"
docker compose -f compose.staging.yaml up -d --remove-orphans --wait

printf '%s\n' "$previous" > "$STATE/current"
if [ -n "$current" ]; then
  printf '%s\n' "$current" > "$STATE/previous"
fi
elapsed=$(( $(date +%s) - started ))
printf '%s\trollback\t%s\t%ss\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$previous" "$elapsed" >> "$STATE/history.tsv"
echo "已回到 $previous（原版本 ${current:-未知}），耗时 ${elapsed} 秒（记入 $STATE/history.tsv）"
