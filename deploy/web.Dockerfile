# 预发的入口镜像（0.1b 计划 E2）：Caddy 托管学员端静态文件，/api 转给 api（deploy/Caddyfile）。构建模式即环境名。
# 生成物不进 git（F02）：装完依赖后先生成界面要用的部分（参数、错误码、权限、页面清单、接口钩子），再构建。
# 构建：docker build -f deploy/web.Dockerfile --build-arg EXAM_PREP_ENV=staging -t <镜像仓库>/<命名空间>/exam-prep-web:<标签> .
FROM node:24-bookworm-slim AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --offline --ignore-scripts \
  && node packages/codegen/src/main.ts --only=params,errors,permissions,metrics,pages,orval
ARG EXAM_PREP_ENV=staging
RUN pnpm --filter @exam-prep/learner exec vite build --mode "${EXAM_PREP_ENV}"

FROM caddy:2.10-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/learner/dist /srv/learner
