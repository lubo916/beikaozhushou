# ADR-021 技术栈与工程基线

- 状态：已采纳

## 背景

技术栈改起来约等于重写，必须在行走骨架之前定下（实施步骤表“准备 6”）。AI 工具的训练语料新旧混杂，需要明确版本与写法；部署目标是国内云，要一并考虑地域与备案。

## 决定

1. 运行时与工程：Node.js 24 LTS、pnpm 11 workspace、TypeScript 6（strict）。大版本锁定，核心框架只吃补丁版本，可复现性靠锁文件；新发布的依赖观察 7 天再安装。
2. 应用与界面：Next.js 16 App Router、React 19.2、Tailwind CSS 4（主题由 design/tokens.json 生成）、shadcn/ui、TanStack Query 5、Zustand 5、React Hook Form 7 与 Zod 4。富文本 TipTap 3，公式 KaTeX；离线与安装用 Serwist；界面文案用文案键管理。
3. 数据：PostgreSQL 16 与 Prisma 7；Prisma schema 由 contracts/schema/*.yaml 生成（ADR-003），按学员与租户隔离的表启用行级安全（ADR-011）。Redis 7 只做缓存、计数、临时令牌与锁，不存权威数据；涉及金额与额度的扣减在数据库中原子完成。金额以“分”为整数存储。
4. 外部能力：大模型经兼容端点调用，唯一出口是 packages/ai（ADR-015）；对象存储、短信、内容安全、文字识别、推送统一封装后调用；支付先接一种渠道（4.3）。
5. 质量：Vitest 4、Playwright、ESLint 10、Prettier 3、依赖方向检查；错误监控与结构化日志（敏感字段脱敏）。
6. 部署：容器镜像部署在国内云，数据库用同地域托管 PostgreSQL 16；健康检查拆为 live、ready、db、redis 四个端点。

## 后果

- 行走骨架可以直接开工，AI 工具按明确版本写码。
- 版本较新，部分库的生态要在 0.1b 验证。
- 何时重新考虑：某个核心框架停止安全支持，或骨架验证发现阻断问题时，写新 ADR 升级。
