# ADR-031 0.1b 工具链配套组件登记

## 背景

0.1b 计划 A1 要求为 ADR-025 已选工具的配套组件登记包名与理由。以下组件完成现有工具链接线，不增加产品功能或改变技术栈。

## 决定

允许以下直接依赖，版本保持精确锁定，并遵守 ADR-025 的发布观察期与升级纪律：

| 包名 | 版本线 | 理由 |
| --- | --- | --- |
| @prisma/adapter-pg | 7 | Prisma 7 连接 PostgreSQL 的驱动适配器 |
| @vitest/browser-playwright | 4 | Vitest 浏览器模式的 Playwright 提供者 |
| playwright | 1 | 提供浏览器驱动，与 @playwright/test 使用相同版本 |
| @vitejs/plugin-react | 5 | Vite 处理 React 组件 |
| @tailwindcss/vite | 4 | Tailwind 4 的 Vite 接入组件 |
| @eslint/js | 10 | ESLint 10 的基础推荐规则 |
| typescript-eslint | 8 | ESLint 解析与检查 TypeScript；所选精确版本的 peerDependencies 须同时接受 ESLint 10 与 TypeScript 6.0 |
| @faker-js/faker | 9 | Orval 生成的 MSW 模拟数据所需运行库 |
| @types/node | 24 | Node 24 类型声明 |
| @types/react | 19 | React 类型声明 |
| @types/react-dom | 19 | React DOM 类型声明 |

允许清单由 scripts/engineering/dependency-policy.json 执行；实际安装版本记录在各 package.json 与 pnpm-lock.yaml。Prisma 驱动内部使用的 pg 仅作为传递依赖，业务代码继续通过 packages/db 访问数据库。

## 后果

工具链可以执行类型检查、浏览器测试、数据库客户端生成和接口模拟。首次安装需核实这些组件的 peerDependencies 与生成输出；同版本线无法兼容时再按 ADR-025 处理。
