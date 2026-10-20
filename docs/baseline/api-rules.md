# 接口约定与页面拿数据

> 页面任务和后端任务必读。目标：前端先用假数据做完，后端接上时页面一行不改或只改很少。

## 1 接口风格

- 路径前缀 `/api/v1`，REST 风格，JSON。线上与本地都是同域（`/api/*` 转给 API 服务），不处理跨域。
- JSON 字段名用 snake_case（与 contracts/ 下已有的错误码、考试画像结构和演示数据一致）；生成的 TypeScript 类型照搬字段名。
- 每个接口有 operationId：camelCase 动宾结构、全局唯一（生成的钩子按它命名），并用 `x-owner` 写明所属领域。
- ID 一律是字符串（UUIDv7）。时间是 ISO 8601 的 UTC 字符串（带 Z）；“某一天”用 `YYYY-MM-DD`，按用户时区算。
- 金额以“分”为单位的整数。
- 列表用游标分页：请求带 `cursor`、`limit`（不超过参数 api.page.max_limit），响应为 `{ items: [...], next_cursor: string | null }`。
- 错误统一为 `{ code, message_key, details }`：`code` 是 contracts/errors.yaml 登记的稳定英文键（领域前缀＋含义，如 `COMMON_FORBIDDEN`、`PRAC_REVEAL_LOCKED`），HTTP 状态码随 code 一起登记；`message_key` 是文案键，前端据此显示中文；`details` 放结构化细节（如字段校验问题）。新错误先登记再用。
- 写操作带幂等键请求头 `Idempotency-Key`：同一个键的重复请求返回第一次的结果，不产生第二条记录（离线补交不重复）。
- 默认要求登录（游客也是一种会话）；公开接口在契约里显式标注。每个接口在 contracts/permissions.yaml 有对应动作，服务端按角色与数据范围校验，不靠界面隐藏；响应按字段白名单输出。
- 业务数字由后端算好返回，前端只显示。

## 2 契约文件怎么放（防并行冲突）

```text
contracts/openapi/
  _common.yaml          通用：错误、分页、ID、时间、枚举（地基任务维护）
  schemas/<对象>.yaml   核心数据形状：考试、知识点、题目、作答、证据、掌握档、卡片、错题、计划、任务、提议、笔记、资料、通知……（地基与整合任务维护）
  pages/<页ID>.yaml     某页需要的接口（页面任务各写各的）
```

- 合并脚本（tools/merge-openapi.mjs，F04 建）把所有文件合成一份再交给 Orval；路径或名字重复直接报错。
- 页面私有的数据形状用页 ID 作前缀命名（如 `S06TodayView`），公共形状引用 schemas/。需要新的公共形状，在交接单里提出。
- 生成物不进 git：`pnpm gen` 生成类型、Zod 校验、TanStack Query 钩子、MSW 处理器。
- 现状：仓库里还是 V3 的单文件 contracts/openapi.yaml（前缀 `/api`，没有 v1）和它的生成脚本 scripts/engineering/contract-gen.mjs，生成物 packages/contract/src/generated/ 也还在 git 里。F02 建立 `pnpm gen` 入口并接管契约生成、把契约生成物移出 git；F04 把它拆进上面的结构、改用 `/api/v1`、接通 Orval；拆完之前以单文件为准。

## 3 页面怎么拿数据

1. 在 `contracts/openapi/pages/<页ID>.yaml` 写本页要的接口（路径、参数、响应形状）。
2. `pnpm gen` 生成钩子；页面只用生成的钩子，不手写 fetch。
3. 在 `apps/<端>/src/mocks/pages/<页ID>.ts` 写假数据处理器：数据从 fixtures/exams/<考试 ID>/ 里取（四个演示考试，见 vocabulary.md 第 9 节），必须能通过生成的 Zod 校验。
4. 页面在 `data.ts` 里组合钩子；页面组件只管显示。

## 4 模拟层：真规则＋内存数据（不是死数据）

- 模拟层有一个内存仓库，启动时装入 fixtures 里的演示考试；写操作会真的改变内存数据（做完一题，错题本、今日、地图跟着变）。
- 规则一旦实现（B 任务第一步），就写成纯函数放在 `packages/domains/<领域>/core/`，模拟层直接调用同一份。所以页面开发时就能看到规则真的在起作用；接后端时规则不用重写，只是把存储从内存换成数据库。
- 规则还没实现的领域，模拟层先返回 fixtures 里的示例值，并在接口层标注“示例数据”。
- 依赖规则：页面组件不能引用 `packages/domains/*`；只有 `apps/*/src/mocks/**` 和服务端能引用 `packages/domains/*/core`。现有的 dependency-cruiser 规则（V3）不许界面引用任何领域包，F02 改成只放行这一条路。

## 5 假数据与真接口的切换

- 开发默认全部走假数据（MSW）。环境变量 `VITE_REAL=plan,practice` 让列出的领域走真接口，其余仍走假数据。
- 每接通一个领域，就把它加进 `dev:real` 脚本的默认列表；全部接通后，假数据只留给测试与离线演示。
- 演示考试切换（kj/js/en/ds）只在开发模式出现，由接口层统一处理。
- `?state=` 强制页面状态：由接口层统一拦截（返回空数据、错误、离线等），页面不需要为测试写特殊分支。取值见 vocabulary.md 第 7 节。

## 6 数据刷新约定

- 每个写操作在契约里注明“会影响哪些数据”；前端在写操作成功后让对应的查询失效（TanStack Query 的 invalidateQueries），由样板页给出写法。
- 常见的连锁：作答 → 错题、掌握档、今日清单、地图；完成任务 → 今日清单、三个数；确认提议 → 计划、今日清单。

## 7 后端写法要点

- 每个领域分两层：`core/`（纯函数规则，无输入输出，浏览器和服务器都能跑）和 `server/`（数据访问、路由、任务处理器）。apps/api 只负责装配。
- 请求和响应都用生成的 Zod 校验；接口测试用 Fastify inject，不起服务也能测。
- 领域之间只调用对方的公开入口，不直接读写对方的表；依赖方向登记在 docs/product/domain-map.yaml，由 dependency-cruiser 检查。只有 learner 领域能写证据与掌握档。
- 慢活（解析、导出、夜间顺延、提醒）进 BullMQ，由后台进程执行；一个事务能做完的就同步做。
- 涉及钱和额度只用数据库带条件的原子更新，不用 Redis 锁。
