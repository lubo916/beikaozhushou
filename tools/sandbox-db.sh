#!/usr/bin/env bash
# 在 claude.ai 网页沙箱里装起 PostgreSQL 与 Redis，给需要数据库的测试用（bk start <任务> --with-db 会调用）。
# 沙箱允许访问 Ubuntu 软件源；装上的是 PostgreSQL 16（线上是 17，差异很小；最终以本地与 CI 为准）。
# 任何一步失败都友好退出（返回 0），bk 会记下“数据库不可用”，数据库测试改到本地跑。
set -u
say(){ echo "· $*"; }
warn(){ echo "⚠ $*"; }
command -v apt-get >/dev/null || { warn "没有 apt-get，跳过数据库"; exit 0; }
export DEBIAN_FRONTEND=noninteractive
say "安装 PostgreSQL 与 Redis（约 15–60 秒）"
apt-get update -qq >/tmp/bk-apt.log 2>&1 || { warn "软件源连不上，跳过数据库（日志 /tmp/bk-apt.log）"; exit 0; }
apt-get install -y -qq postgresql redis-server >>/tmp/bk-apt.log 2>&1 || { warn "安装失败，跳过数据库（日志 /tmp/bk-apt.log）"; exit 0; }
apt-get install -y -qq postgresql-16-pgvector >>/tmp/bk-apt.log 2>&1 || warn "pgvector 没装上，向量相关测试以本地为准"
service postgresql start >/dev/null 2>&1 || pg_ctlcluster 16 main start >/dev/null 2>&1 || true
redis-server --daemonize yes >/dev/null 2>&1 || true
DB_USER=bk; DB_PASS=bk; DB_NAME=bk_dev
su postgres -c "psql -qtAc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\"" | grep -q 1 \
  || su postgres -c "psql -qc \"CREATE ROLE $DB_USER LOGIN SUPERUSER PASSWORD '$DB_PASS'\"" >/dev/null
su postgres -c "psql -qtAc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\"" | grep -q 1 \
  || su postgres -c "createdb -O $DB_USER $DB_NAME"
su postgres -c "psql -q -d $DB_NAME -c 'CREATE EXTENSION IF NOT EXISTS vector'" >/dev/null 2>&1 || true
URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"
touch .env.local
if grep -q '^DATABASE_URL=' .env.local; then sed -i "s#^DATABASE_URL=.*#DATABASE_URL=$URL#" .env.local; else echo "DATABASE_URL=$URL" >> .env.local; fi
grep -q '^REDIS_URL=' .env.local || echo "REDIS_URL=redis://127.0.0.1:6379" >> .env.local
say "数据库已就绪：$URL（写在 .env.local，不会提交）"
