---
id: PLAT-02
status: ready
refs:
  api: [getParams]
  permissions: [platform.params.read]
  errors: [COMMON_VALIDATION]
  params: [ui.loading.slow_hint_seconds, learner.evidence.fast_answer_ratio]
  adr: [ADR-014]
open_questions:
  - id: OQ-PLAT-02-1
    q: 参数中心（PLAT-04）上线前，生效值从哪里覆盖登记默认值？
    default: 仓库内按环境的覆盖文件 deploy/params/<环境>.json，只覆盖 rollout 不为 gray_required 的参数（R3），经代码评审合入、随发布生效，发布记录即变更记录；参数中心上线后由它提供取值
  - id: OQ-PLAT-02-2
    q: getParams 是否向客户端返回全部登记参数？
    default: 返回全部（登记中没有不宜公开的参数）；将来出现这类参数时，先在登记中增加可见性字段（重型通道）
---
# PLAT-02 参数注册与运行时访问器

## 1 目标与边界
contracts/params.yaml 登记的每个参数，在服务端和学员端都经同一个类型化访问器读取：有覆盖取覆盖值，没有就取登记默认值，数值夹在登记区间内（ADR-014）。rollout 为 gray_required 的参数只经灰度调整（ADR-014 决定 3），本功能不提供灰度，这类参数不接受覆盖，生效值就是登记默认值。学员端经 getParams 拿到与服务端相同的生效值。检查 E-PARAM-03 覆盖全部手写的应用与包代码，代码里找不到写死的阈值；每个参数都能在登记中查到默认值、区间与出处。

不做：后台参数中心、灰度与参数变更记录（PLAT-04）；学员个人取值的保存入口与设置界面（由用到该参数的功能接入）；参数默认值的定稿（OQ-001）。

## 2 业务规则
- R1 访问器只接受登记过的参数名。未登记的名称在类型检查时报错；绕过类型传入时抛出含该名称的错误，不返回任何兜底数值。
- R2 生效值：覆盖文件里有该参数时取覆盖值，否则取登记默认值；rollout 为 gray_required 的参数不能出现在覆盖文件里（R3），生效值即登记默认值。API 与 worker 进程启动时各读取一次本环境的覆盖文件（第 4 节），文件不存在时按空对象处理并写一条提示日志；文件内容的变动在下次启动后生效。
- R3 启动校验。覆盖文件有下列任一问题时，进程拒绝启动并一次列出全部问题：不是 JSON 对象；键不是登记的参数名；键是 rollout 为 gray_required 的参数（问题说明写明须经灰度调整）；取值类型与登记默认值不同（数值、字符串、布尔各自对应，数组逐个元素对应，对象的键集合相同且各值对应）；登记默认值是整数而取值不是整数。
- R4 区间：标量数值参数的取值越出登记区间时不拒绝启动，取最近的区间端点，并为每个越界项写一条告警日志，含参数名、原值与生效值。区间为空的参数不夹取。
- R5 getParams 返回全部登记参数的生效值（参数名到取值的对象），每一项都与同一进程中服务端访问器读到的值相同。
- R6 学员端启动时先按登记默认值运行，同时请求一次 getParams：成功后访问器改用返回值，返回中未登记的名称或类型不符的项忽略、该项保留默认值；快照只影响此后的读取，已在进行中的计时不重算。请求失败时继续使用默认值，不提示错误，本次运行期间不再请求。
- R7 学员取值校验：访问器提供校验函数。参数没有学员可调区间（learner_range），或取值落在该区间之外（端点算在区间内）时，判为不通过并给出允许区间；接口层以 COMMON_VALIDATION 返回，details 含参数名与允许区间。
- R8 E-PARAM-03 检查 apps/ 与 packages/ 下手写的 .ts、.tsx 文件，排除带 GENERATED 标记的文件、测试文件、*.config.ts 与 *.fixture.ts；数值字面量只允许 0、1、-1。单位换算、协议常量等不是阈值的数字，在同一行写 param-exempt 与理由。
- R9 每个登记参数都有说明、默认值、单位与出处，标量数值参数还有区间。出处写在 source_items（原型条目）；没有原型条目的参数，在说明末尾注明依据（功能 ID、ADR 编号或约定文件）。check 对缺项报 E-SCHEMA-01。

## 3 界面
无界面。学员端的取值方式见 R6。

## 4 数据
- 不新增表。新增四个覆盖文件 deploy/params/development.json、test.json、staging.json、production.json，初始均为空对象 {}；本环境取运行环境名 EXAM_PREP_ENV（0.1b 提供：development、test、staging、production，未设置按 development，其他值拒绝启动）。
- getParams 无需登录即可调用（x-public），动作 platform.params.read。

## 5 AI 行为
无。

## 6 验收
PLAT-02-AC1（R1）
Given 一个登记过的参数名和一个未登记的名称
When 分别调用访问器
Then 前者通过类型检查并返回登记默认值；后者类型检查报错，强制绕过类型调用时抛出含该名称的错误

PLAT-02-AC2（R2、R5）
Given 覆盖文件把 ui.loading.slow_hint_seconds 设为区间内另一个值，其余参数没有覆盖
When 服务启动后调用 getParams
Then 该参数返回覆盖值，其余返回登记默认值，每一项都与服务端访问器读到的值相同

PLAT-02-AC3（R3）
Given 覆盖文件同时含未登记的键、类型不符的取值、整数参数的小数取值
When 启动服务进程
Then 进程以非零状态退出，错误信息列出这三处问题

PLAT-02-AC4（R4）
Given 覆盖文件把 ui.loading.slow_hint_seconds 设为区间之外的整数
When 服务启动后读取该参数
Then 读到最近的区间端点，日志中有一条含参数名、原值与生效值的告警

PLAT-02-AC5（R6）
Given 学员端以登记默认值启动
When getParams 返回一个覆盖值和一个未登记的名称；另一次 getParams 请求失败
Then 前一种情况访问器返回覆盖值并忽略未登记的名称；后一种情况返回登记默认值，不抛错，也不再次请求

PLAT-02-AC6（R7）
Given 一个有学员可调区间的参数和一个没有的参数
When 分别校验区间内、端点与区间外的取值
Then 区间内与端点通过；区间外以及没有学员可调区间的参数不通过，结果带允许区间

PLAT-02-AC7（R8）
Given apps/learner 与 packages/ui 下各有一个写了阈值字面量的手写文件，另有使用 0、1、-1 的行、带 param-exempt 的行，以及生成文件、测试文件、配置文件与夹具文件中的数字
When 运行 check
Then 只对那两个阈值字面量报 E-PARAM-03

PLAT-02-AC8（R9）
Given 一个缺区间的标量数值参数，和一个 source_items 为空、说明中没有注明依据的参数
When 运行 check
Then 两者各报一条 E-SCHEMA-01

PLAT-02-AC9（R3）
Given 覆盖文件只有一项：learner.evidence.fast_answer_ratio（rollout 为 gray_required）取区间内、与登记默认值不同的值
When 启动服务进程
Then 进程以非零状态退出，错误信息指出该参数须经灰度调整、不接受覆盖

## 7 不变量与合规
无。
