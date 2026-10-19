#!/usr/bin/env bash
# 在固定版本的 Playwright Linux 镜像（装中文字体，见 tests/e2e/Dockerfile）中运行端到端测试；截图基线只在这里生成与比对。
# 在 Linux 或 WSL2 上运行（容器与宿主共用 node_modules）。用法：scripts/engineering/e2e-in-image.sh [playwright 参数…]
# 例：scripts/engineering/e2e-in-image.sh --update-snapshots
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE="exam-prep-e2e:playwright-1.56.0"
docker build -t "$IMAGE" "$ROOT/tests/e2e"
docker run --rm --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI=1 \
  -v "$ROOT":/work -w /work "$IMAGE" \
  sh -c 'mkdir -p /tmp/bin && /opt/node24/bin/node /opt/node24/lib/node_modules/corepack/dist/corepack.js enable --install-directory /tmp/bin && PATH=/tmp/bin:$PATH pnpm exec playwright test "$@"' sh "$@"
