#!/usr/bin/env bash
# 在 claude.ai 网页沙箱里装起 PostgreSQL 与 Redis，给需要数据库的测试用（bk start <任务> --with-db 会调用）。
# 沙箱打开网络访问后才能连 Ubuntu 软件源（网络开关在新对话里才生效）；装上的是 Ubuntu 自带的 PostgreSQL 16（线上是 17，差异很小；
# zhparser、pg_bigm 装不上，相关测试以本地与 CI 为准）。连接串写进 .env.local（不提交）：DATABASE_URL 用开发库，TEST_DATABASE_URL 用测试库。
# 任何一步失败都友好退出（返回 0），bk 会记下“数据库不可用”，数据库测试改到本地跑。
set -u
say(){ echo "· $*"; }
warn(){ echo "⚠ $*"; }
LOG=/tmp/bk-sandbox-db.log
command -v apt-get >/dev/null || { warn "没有 apt-get，跳过数据库"; exit 0; }
[ "$(id -u)" = 0 ] || { warn "需要 root 才能安装（网页沙箱默认是 root），跳过数据库"; exit 0; }
export DEBIAN_FRONTEND=noninteractive
say "安装 PostgreSQL 与 Redis（约 15–60 秒）"
timeout 120 apt-get update -qq >"$LOG" 2>&1 || { warn "软件源连不上（多半是没开网络访问），跳过数据库；日志 $LOG"; exit 0; }
timeout 300 apt-get install -y -qq postgresql redis-server >>"$LOG" 2>&1 || { warn "安装失败，跳过数据库；日志 $LOG"; exit 0; }
PG_MAJOR=$(ls /usr/lib/postgresql 2>/dev/null | sort -n | tail -1)
[ -n "$PG_MAJOR" ] || { warn "没找到 PostgreSQL 的安装目录，跳过数据库；日志 $LOG"; exit 0; }
timeout 120 apt-get install -y -qq "postgresql-$PG_MAJOR-pgvector" >>"$LOG" 2>&1 || warn "pgvector 没装上，向量相关测试以本地为准"
service postgresql start >>"$LOG" 2>&1 || pg_ctlcluster "$PG_MAJOR" main start >>"$LOG" 2>&1 || true
redis-server --daemonize yes >>"$LOG" 2>&1 || true
for _ in $(seq 1 20); do su postgres -c "pg_isready -q" 2>/dev/null && break; sleep 1; done
su postgres -c "pg_isready -q" 2>/dev/null || { warn "PostgreSQL 没有启动起来，跳过数据库；日志 $LOG"; exit 0; }
DB_USER=bk; DB_PASS=bk
psql_q(){ su postgres -c "psql -qtAc \"$1\""; }
[ "$(psql_q "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")" = 1 ] \
  || psql_q "CREATE ROLE $DB_USER LOGIN SUPERUSER PASSWORD '$DB_PASS'" >>"$LOG" 2>&1
for db in bk_dev bk_test; do
  [ "$(psql_q "SELECT 1 FROM pg_database WHERE datname='$db'")" = 1 ] || su postgres -c "createdb -O $DB_USER $db" >>"$LOG" 2>&1
  su postgres -c "psql -q -d $db -c 'CREATE EXTENSION IF NOT EXISTS vector'" >>"$LOG" 2>&1 || true
done
set_env(){ # 写入或替换 .env.local 里的一行
  touch .env.local
  if grep -q "^$1=" .env.local; then sed -i "s#^$1=.*#$1=$2#" .env.local; else echo "$1=$2" >> .env.local; fi
}
URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432"
set_env DATABASE_URL "$URL/bk_dev"
set_env TEST_DATABASE_URL "$URL/bk_test"
set_env REDIS_URL "redis://127.0.0.1:6379"
say "数据库已就绪：开发库 $URL/bk_dev、测试库 $URL/bk_test、Redis 127.0.0.1:6379（写在 .env.local，不会提交）"
