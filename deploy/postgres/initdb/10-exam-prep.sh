#!/bin/sh
# 首次初始化（数据目录为空时）：建测试库 exam_prep_test（数据库测试与清表只用它），
# 并确认 zhparser、pg_bigm、vector 三个扩展都能加载（加载后删除；扩展由迁移按需创建）。
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE exam_prep_test;"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname exam_prep_test <<'SQL'
CREATE EXTENSION zhparser;
DROP EXTENSION zhparser;
CREATE EXTENSION pg_bigm;
DROP EXTENSION pg_bigm;
CREATE EXTENSION vector;
DROP EXTENSION vector;
SQL
