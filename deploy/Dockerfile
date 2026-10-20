# api 与 worker 共用的镜像（0.1b 计划 E2）：同一镜像、不同入口（compose 的 command）。Node 24 直接运行 TS（类型擦除），不另行编译。
# 镜像带上 deploy/params/（PLAT-02 的参数覆盖文件在运行时从这里读取）与迁移文件（release.sh 用本镜像执行 prisma migrate deploy）。
# 生成物不进 git（F02）：装完依赖后只生成服务端要用的部分（参数、错误码、权限、事件指标、表元数据、Prisma 客户端）。
# 构建：docker build -f deploy/Dockerfile -t <镜像仓库>/<命名空间>/exam-prep-server:<标签> .
FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --prod

COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --prod --offline \
  && node packages/codegen/src/main.ts --only=params,errors,permissions,metrics,models,prisma

USER node
EXPOSE 3000 3001
CMD ["node", "--disable-warning=ExperimentalWarning", "apps/api/src/main.ts"]
