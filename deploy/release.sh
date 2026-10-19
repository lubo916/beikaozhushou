#!/usr/bin/env bash
# 预发发布（0.1b 计划 E2）：备份 → 迁移 → 替换容器 → 记录版本。在 ECS 的部署目录运行：./release.sh <镜像标签>
# 前提：同目录有 compose.staging.yaml 与 .env（变量名与说明见仓库根 .env.example），已登录镜像仓库。
# 每次发布的耗时写入 state/history.tsv。
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

TAG="${1:?用法：./release.sh <镜像标签>}"
COMPOSE=(docker compose -f compose.staging.yaml)
STATE=state
mkdir -p "$STATE" backups
started=$(date +%s)
log() { printf '[release %s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

set -a
# shellcheck disable=SC1091
. ./.env
set +a
: "${DATABASE_URL:?.env 缺少 DATABASE_URL}"
current=$(cat "$STATE/current" 2>/dev/null || true)
export RELEASE_TAG="$TAG"

log "1/4 拉取镜像 $TAG"
"${COMPOSE[@]}" pull web api worker

log "2/4 备份数据库"
backup="backups/$(date -u +%Y%m%dT%H%M%SZ)-${TAG}.dump"
docker run --rm --network host -e PGURL="${DATABASE_URL%%\?*}" postgres:17-bookworm \
  sh -c 'pg_dump --format=custom --no-owner "$PGURL"' > "$backup"
ls -1t backups/*.dump | tail -n +"$(( ${BACKUP_KEEP:-10} + 1 ))" | xargs -r rm --
log "  备份写入 $backup"

log "3/4 迁移数据库并写入种子"
"${COMPOSE[@]}" run --rm --no-deps api node_modules/.bin/prisma migrate deploy
"${COMPOSE[@]}" run --rm --no-deps api node --disable-warning=ExperimentalWarning packages/db/src/seed-cli.ts

log "4/4 替换容器"
"${COMPOSE[@]}" up -d --remove-orphans --wait

if [ -n "$current" ] && [ "$current" != "$TAG" ]; then
  printf '%s\n' "$current" > "$STATE/previous"
fi
printf '%s\n' "$TAG" > "$STATE/current"
elapsed=$(( $(date +%s) - started ))
printf '%s\trelease\t%s\t%ss\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TAG" "$elapsed" >> "$STATE/history.tsv"
log "完成：当前版本 $TAG，耗时 ${elapsed} 秒（记入 $STATE/history.tsv）"
