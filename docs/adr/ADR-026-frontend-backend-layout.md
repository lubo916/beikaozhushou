# ADR-026 前后端分离的仓库结构

- 状态：已采纳

## 背景

ADR-003 让三端各自持有页面、路由与鉴权，界面应用直接依赖领域包。ADR-025 改为前后端分离：界面是纯前端，业务规则只在服务端执行，服务器代码与浏览器代码物理隔开。

## 决定

1. 一个 pnpm 工作区、五个应用：apps/learner、apps/org、apps/admin 是 React 与 Vite 的纯前端，只经 API 读写数据；apps/api（Fastify）是唯一后端，只装配各领域的路由；apps/worker（BullMQ）执行解析、夜间顺延、提醒与导出。
2. 共享包：packages/domains/<领域> 放业务规则、数据访问、本领域的路由与任务处理器；packages/contract 的线上传输契约由 contracts/openapi.yaml 生成，也容纳无业务逻辑的手写中立端口。0.1b 手写 src/runtime-context.ts 导出 Context/ContextProvider/ContextUnavailableError，服务器经 @exam-prep/contract/runtime-context 编译子路径导入，不加载 React Query；该模块不依赖 Fastify/React。packages/db 是数据库客户端的唯一构造处；packages/ai 的 core 是 AI 网关，<场景>/ 放提示词与输出结构；packages/params 的 registry.generated.ts 由参数登记生成，runtime.ts/index.ts 为消费登记的手写访问器，拆分在 0.1b 完成；packages/ui 放组件、七种页面状态组件与令牌产物；deploy/ 放 Dockerfile、compose 文件与发布回滚脚本。
3. 依赖方向：界面应用只依赖 packages/ui、packages/contract、packages/params，不引用 domains、db、ai；packages/ui 不导入 params，参数值由界面应用读取后注入；apps/api 与 apps/worker 装配 packages/domains；领域之间只经对方包入口，直接调用/导入/订阅遵守 domain-map.yaml。platform、practice、plan 调用 metrics 记录入口，metrics 不反向依赖这些领域或 learner；指标所需 owner 只读结果由应用经中立 contract 端口注入，不导入或复制其生产算法。只有 learner 写证据与掌握档（E-OWN-02）。允许边与无环由 dependency-cruiser 守护。
4. 表结构的唯一来源是 Prisma 多文件 schema：contracts/schema/<领域>.prisma，一个领域一个文件，归属与字段的数据类别写在三斜线注释里，spec_tool 解析它做 E-OWN-01、E-DC-01。转换在 0.1b 完成，与 docs/conventions/data.md 规则 1、2 和 spec_tool 的解析在同一次提交里修改；转换完成前，contracts/schema/*.yaml 仍是表结构来源。
5. 一个功能的改动路径：contracts/openapi.yaml → gen → 领域包（规则、数据、路由）→ 界面页面 → 测试。界面只显示接口返回的业务数字，不在界面重算。
6. 线上前后端同域，/api/* 转给 API 服务；学员与员工用两套会话；后台用单独域名。
7. 本 ADR 取代 ADR-003；决定 4 在转换完成后同时取代 ADR-006 决定 4 中 x-data-class 的标注写法。

## 后果

- 任务包推导“涉及路径”的规则（领域包加端目录）不变；apps/api 与 apps/worker 中只有装配代码。
- 接口测试用 Fastify 的 inject，不起服务也能测。
- 何时重新考虑：需要原生端或小程序时，在 apps/ 下增加端（ADR-029），不改领域包。
