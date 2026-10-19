# 截图基线只在这个固定版本的 Playwright Linux 镜像中生成与比对（0.1b 计划 A6、风险 4）：版本与 @playwright/test 一致，装中文字体。
# 使用：scripts/engineering/e2e-in-image.sh [playwright 参数…]
FROM node:24-bookworm-slim AS node-runtime

FROM mcr.microsoft.com/playwright:v1.56.0-noble
COPY --from=node-runtime /usr/local/bin/node /opt/node24/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules/corepack /opt/node24/lib/node_modules/corepack
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-noto-cjk fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*
ENV PATH=/opt/node24/bin:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    EXAM_PREP_SCREENSHOT_IMAGE=1
