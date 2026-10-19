# 本地开发用 PostgreSQL 17（ADR-025 决定 3）：带 zhparser（中文分词，依赖 SCWS）、pg_bigm（二元组索引）与 pgvector（向量）。
# 版本固定在 ARG，升级时改这里并重新构建。预发与生产用阿里云 RDS PostgreSQL 17，扩展在 RDS 控制台开启。
# 扩展由迁移按需创建；首次初始化时 initdb/ 的脚本建测试库并确认三个扩展都能加载。
FROM postgres:17-bookworm

RUN set -eu; \
    apt-get -o Acquire::Retries=5 update; \
    for attempt in 1 2 3; do \
        apt-get -o Acquire::Retries=5 install -y --no-install-recommends ca-certificates curl bzip2 build-essential postgresql-server-dev-17 postgresql-17-pgvector && break; \
        test "$attempt" -lt 3 || exit 1; \
        sleep 2; \
    done

ARG SCWS_VERSION=1.2.3
ARG ZHPARSER_REF=V2.2
ARG PG_BIGM_REF=v1.2-20240606

RUN set -eux; \
    mkdir -p /tmp/build; \
    cd /tmp/build; \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 300 "https://www.xunsearch.com/scws/down/scws-${SCWS_VERSION}.tar.bz2" -o scws.tar.bz2; \
    tar xjf scws.tar.bz2; \
    (cd "scws-${SCWS_VERSION}" && ./configure --prefix=/usr/local && make -j"$(nproc)" && make install); \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 300 "https://github.com/amutu/zhparser/archive/refs/tags/${ZHPARSER_REF}.tar.gz" -o zhparser.tar.gz; \
    tar xzf zhparser.tar.gz; \
    (cd zhparser-* && SCWS_HOME=/usr/local make && SCWS_HOME=/usr/local make install); \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 300 "https://github.com/pgbigm/pg_bigm/archive/refs/tags/${PG_BIGM_REF}.tar.gz" -o pg_bigm.tar.gz; \
    tar xzf pg_bigm.tar.gz; \
    (cd pg_bigm-* && make USE_PGXS=1 && make USE_PGXS=1 install); \
    ldconfig; \
    apt-get purge -y --auto-remove curl bzip2 build-essential postgresql-server-dev-17; \
    rm -rf /tmp/build /var/lib/apt/lists/*

COPY initdb/ /docker-entrypoint-initdb.d/
