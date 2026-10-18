# METR-01 的 0 期模拟支持契约

本文随 METR-01 草稿复核，运行时代码尚未交付。仅规定开发适配层的接口、隔离存储、测试数据和输出格式；业务事件、指标名称/公式/参数以 contracts/、learner-model 和 planner 为唯一来源。真实接入先解决规格 OQ，再由 owner 登记规则，不把夹具结构升级为跨领域正式协议。

## 接口与校验次序

由 packages/domains/metrics/index.ts 导出下列类型、服务/仓储工厂及领域路由插件；EventPayload 从生成事件登记派生，仅表示校验后的类型，不另手写事件清单。Context、Identity 和 ContextProvider 从 @exam-prep/contract/runtime-context 取，统一 HTTP 映射取 foundation。返回 Promise，失败抛带登记码的 MetricsError，不携带原始提交值。

```ts
type Receipt = { status: 'inserted' | 'duplicate'; eventId: string };
type FieldIssue = { field: string; reason: string };
type MetricsCode = 'COMMON_VALIDATION' | 'COMMON_FORBIDDEN'
  | 'COMMON_CONFLICT' | 'COMMON_UNAVAILABLE';
type MetricsError = Error & { code: MetricsCode; details: FieldIssue[] };
type EventFilter = { from: string; to: string; event?: string };
type StoredPayload = {
  name: string; properties: Record<string, unknown>; occurred_at: string;
};
type MetricsDependencies = {
  repository: EventRepository;
  now: () => number; // epoch 毫秒，必须有限
  newId: () => string; // 可注入 UUIDv7 工厂
};
interface MetricsService {
  trackEvent(context: Context, event: unknown, key: unknown): Promise<Receipt>;
  recordEvent(context: Context, event: unknown, key: unknown): Promise<Receipt>;
  query(context: Context, filter: EventFilter): Promise<StoredEvent[]>;
}
declare function createMetricsService(deps: MetricsDependencies): MetricsService;
type GetContext = ContextProvider<FastifyRequest>;
declare function metricsRoutes(options: {
  service: MetricsService | undefined;
  getContext: GetContext;
}): FastifyPluginAsync;
```

METR 交付 metricsRoutes 与 createJsonlEventRepository；0.1b 只构造、注入和注册，不实现领域路由/仓储。Fastify 类型仅在服务器入口使用，共享 Context 模块无 Fastify 导入。getContext(request) 异步返回受信 Context；已知不可用 reject ContextUnavailableError，或 resolve 缺字段的上下文时映射 503，未知异常按 foundation 500。HTTP 适配器固定 client actor。service 未装配为 503；服务可用后再执行下列领域检查。

metricsRoutes 注册 POST /events，仅使用 Fastify 的 JSON 解析和传输限制，读取 request.body 与原始 request.headers['idempotency-key'] 后传给 trackEvent；缺失/多值头保留原值，服务判 422，不拼接、不 trim、不强转。不在路由 schema、OpenAPI/Zod middleware 或 preValidation 中预先验证 body/该头，不让结构错误抢先于角色/source 检查。生成类型供校验后消费，不能作为路由已验证的假设。HTTP inserted/duplicate 都为 202、无响应体，内部 Receipt 不外泄。

0.1b 注入服务实例，后续领域消费实例的受信方法；不建立隐式全局仓储或绕过注入的单例。recordEvent 只供进程内受信领域调用，浏览器不能构造 Context。platform/practice/plan 可依赖 metrics 的记录端口；metrics 不导入这些领域或 learner，未来 owner 的只读结果由装配层注入，本期只消费独立 fixture。

检查顺序固定，第一项失败即返回，不继续查幂等或写盘：

1. Context 受信适配器可用且身份/租户/时区可用，否则 COMMON_UNAVAILABLE。
2. trackEvent 要 client 且 role 是 metrics.event.track 登记允许值；recordEvent 要 domain、caller 属 metrics.event.record.callers，identity.role 为 guest/learner。空 roles 表示经受信 caller 授权，不是拒绝全部；guest 可由 practice 代表自己记作答。非法 actor/role/caller 为 COMMON_FORBIDDEN。
3. 能由字符串 name 查到的事件先验 source/owner：client 不能报 server，domain 不能报 client，domain caller 必须等于事件 owner；不符 COMMON_FORBIDDEN。未知 name 留下一步作输入错。
4. 完整顶层、active 状态、属性与时间、guest 与上下文一致性、幂等键格式，不符 COMMON_VALIDATION。额外 identity/tenant/caller/version 顶层字段属于结构错；公开事件没有目标身份参数。query 固定 Context 本人，不给可替换身份过滤器。
5. 有效输入后做幂等比较；冲突 COMMON_CONFLICT。
6. 仓储锁/读取/追加/fsync 失败 COMMON_UNAVAILABLE。

query 第一步检查 Context 可用性；第二步仅允许 client + guest/learner，或 domain + metrics.event.record.callers 登记的 platform/practice/plan + guest/learner。两类都只能查 Context 本人，其他 actor/role/caller 为 COMMON_FORBIDDEN。查询不按待查事件 owner 限制本人的历史记录；之后验发生窗/可选事件名，再读仓储。没有公开查询路由，不新增人类角色权限动作。name 过滤可指定已落盘旧事件名，不要求当前 active，以便跨哈希原样查询。

HTTP 非法 JSON、Content-Type、体积等传输失败先于领域流程，状态/登记码取 foundation，不一律当 422。领域映射：VALIDATION 422、FORBIDDEN 403、CONFLICT 409、UNAVAILABLE 503；意外异常由统一装配处理。MetricsError.details 的 FieldIssue[] 只用于内部错误，HTTP 统一包装为 {code,message_key,details:{issues:[...]}}，不直接把数组放到公共 details；无字段问题用 issues:[]。issues 只含字段路径/类别，不回显值。复合用例至少有“非法角色+缺键”“公开 server 事件+坏属性”“坏属性+占用键”。

Idempotency-Key/key 是原字符串，长度 1 至 128 个字符，仅 ASCII 0x21 至 0x7E；空白、Unicode、缺失、超长拒绝，不 trim 后接收。该技术格式与根 OpenAPI 同源，不是可调业务阈值。

occurred_at、recorded_at、fixture start/end/as_of 等时刻：RFC3339 扩展日期、字面大写 T、完整 HH:mm:ss，可选 1 至 3 位小数，后接大写 Z 或 ±HH:mm；须有效公历日期和时刻，不接收闰秒、基本格式、省秒、小写 t/z、无偏移或超过三位小数。拒绝表示未知偏移的 -00:00；+00:00 和 Z 均有效，其他偏移按 RFC3339 验证。规范化为 UTC YYYY-MM-DDTHH:mm:ss.SSSZ。高精度拒绝，不截断后幂等。0.1b 生成 Zod 校验须启用 offset 并叠加精度/历法约束。同一毫秒的不同有效表示规范化 payload 相同。

事件属性 uuid 接受 RFC9562 的带连字符 8-4-4-4-12 十六进制格式，判定正则为 `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`：版本位为 1–8，变体位为 8/9/a/b，接受大小写输入，拒绝 nil/max 和其他版本/变体。校验后转小写再计算 payload/hash/幂等，等价大小写不冲突；不把所有事件 UUID 都限为 v7。身份、生成事件 id 及本期夹具内部 ID 仍为 UUIDv7，持久记录用小写。int 仅接收 Number.isSafeInteger(value)，可正可负或零，不新增业务界限；非法/非有限/unsafe 值为 422。HTTP JSON.parse 后仍由服务执行此检查，不以 JSON 解析成功代替整数校验，不保留或按原始数字文本做幂等；超过安全整数的 JSON 大整数解析后也拒绝，避免精度丢失后接收合并。

## JSONL 仓储

EXAM_PREP_METRICS_STORE 可指定文件绝对路径，未设为 path.join(appStateDir, 'metrics/events.jsonl')；appStateDir 的 EXAM_PREP_STATE_DIR/默认值及 staging 持久卷归 foundation。development/test/staging 可用模拟适配器；本期 production API 拒绝启动。每例测试用临时目录，不默认读预发数据。

```ts
type StoredEvent = {
  id: string; tenant_id: string; identity_id: string;
  source: 'client' | 'server'; payload: StoredPayload;
  idempotency_key: string; payload_hash: string;
  recorded_at: string; schemaHash: string; simulated: true;
};
type OnceResult =
  | { status: 'inserted' | 'duplicate'; record: StoredEvent }
  | { status: 'conflict' };
interface EventRepository {
  appendOnce(record: StoredEvent): Promise<OnceResult>;
  query(filter: { tenant_id: string; identity_id: string } & EventFilter): Promise<StoredEvent[]>;
  close(): Promise<void>;
}
type JsonlIo = Pick<typeof import('node:fs/promises'),
  'mkdir' | 'open' | 'readFile' | 'unlink'>;
declare function createJsonlEventRepository(options: {
  storePath: string; // 绝对路径；环境解析/状态目录边界由 0.1b 检查
  now: () => number; // 锁诊断时钟，epoch 毫秒
  io?: JsonlIo; // 默认 node:fs/promises；可注入兼容 FileHandle 的文件/锁替身
}): Promise<EventRepository>;
```

id 经注入 UUIDv7 工厂；身份取 Context。payload_hash 是规范化 payload 的 UTF-8 JSON SHA-256，小写十六进制；schemaHash 是构建 events.yaml 原字节 SHA-256。规范化递归按对象键 Unicode 码元排序，数组保序，occurred_at 转固定毫秒 UTC。命名空间为 tenant_id/identity_id/source/payload.name/idempotency_key 元组，不用可能碰撞的裸字符串拼接。重复返回首次完整 record，不生成另一行。

工厂异步完成初始化并总以 EventRepository 表示已知存储状态：锁占用、创建/读盘失败或文件损坏不抛错阻止 API 启动，而返回不可用实例，其 appendOnce/query 均 reject COMMON_UNAVAILABLE（无敏感 details），API 因此可返回 503。非存储的未预期编程错误仍按 foundation 处理。不可用实例的 close 可重复调用，只清理自己成功取得的描述符/锁，不删除他人锁；已取得锁后扫描失败也保留自己的锁直到 close。测试以 io 替身注入半写/fsync/锁故障，不替换领域判断。

启动创建父目录，再以 Node fs.open(...,'wx') 获得 '<store>.lock'；锁文件含 PID/启动时刻仅供诊断。锁存在即不可用，不凭 PID 检测自动抢锁。每文件仅一个实例；同实例串行队列处理幂等/追加/query，防止并发写双行。正常 close 等待队列、关闭描述符再删除本实例锁；崩溃遗锁需开发者停止相关进程、核验原文件并备份后人工移除，不自动修复/清尾。

JSONL 是 UTF-8、逐条 JSON 对象、每条以 LF 结束。空文件合法；非 UTF-8、空白行、非法 JSON、缺必需字段/非法类型、重复 id、同幂等元组第二行、摘要不符、非法时间/hash/simulated 均损坏；中间行和未以 LF 完结的尾行同样处理。StoredPayload 是旧版可保留的存储基型，properties 是 JSON 对象、name 非空，身份/id 为 UUIDv7，时间为固定毫秒 UTC，两种 hash 为 64 位小写 hex；值必须可规范化为有限 JSON。旧 schemaHash 只验证这些结构/摘要，不以当前属性登记重解释旧 payload。启动全文件扫描失败保持不可用；运行时发现损坏也标记不可用，不跳过坏行/截断，不把前缀当完整结果。

追加写完整行后 FileHandle.sync（fsync）成功才更新内存索引并返回 inserted。写/同步失败使实例不可用，后续 query/append 均失败；须停进程检查恢复，不继续追加。失败不承诺磁盘没有字节：若实际已有完整提交行，核验恢复后的同键重试查回原 record；半行仍按损坏处理，不伪称接收。测试覆盖同步失败、半写、中间/尾部损坏、锁、并发与重启。

领域 query 强制 Context 的 tenant/identity；开发 CLI 用独立只读全身份适配器（先排他锁和全文件校验）遍历全部模拟身份，不向业务包导出绕过 self 的服务。--store 与环境路径择一，API 占锁时 CLI 明确失败，不偷偷并发读写。CLI 不创建事件、不调用 learner/plan。

## 独立夹具与语义校验

结构见 contracts/phase0-fixture.schema.json。0.1b 将此文件实际使用的 JSON Schema 子集编译为 packages/domains/metrics/generated/phase0-fixture.generated.ts（Zod 4 校验、派生类型、源文件 SHA-256），接入根 gen/漂移检查；未知关键字生成失败，不忽略，也不加 JSON Schema 运行时库。METR 消费生成校验，再执行下述跨引用/集合/状态语义，不手写第二份结构。

simulated=true、fixtureVersion='0.1'；exam_id 取本轮 profile.exam_id；learners 是显式 roster，ID 唯一，各自固定有效 IANA timezone。每天 date 唯一；不凭事件补 roster。--week 是有效当地周一日期，输出连续七个当地日期；不同学员分别归当地周，不转换成同一 UTC 窗。

处理范围固定：先对全文件做形状/历法校验并建立全局 ID 索引，再只对所选七天做学习/计划语义计算与未知传播。周外普通语义错误不影响周内结果；全文件形状错误仍使加载失败。片段、证据、快照 ID 各自在全 fixture 唯一；同类 ID 跨日/周重复时，不任取第一项，所有包含该 ID 的日期分别标记 duplicate_id（片段/证据影响学习，快照影响两完成率），只有涉及所选周的未知参与当次周聚合。计划项可跨快照/段复用 ID，唯一性只检查被选快照的各段，重复只影响该段。

learning.complete=true 声明当日输入完整；空 segments/evidence 才表示确认没有有效学习。缺日/缺 learning/complete=false 是 missing_input。evidence.segment_id 必须指向同学员同日片段。accepted 是 learner owner 已接收入账的模拟结果，不是 METR 自判；pending 必须 accepted=false，否则 inconsistent_evidence。已接受 negative 有效；revoked 影响贡献，不删原夹具。evidence.occurred_at/recorded_at 可在其他日，不据此搬动片段，也不重建真实补做判定算法。

片段 start 在 date，当地 end 同日或恰次日 00:00:00.000；UTC 时长为正且可整除一分钟，按 UTC [start,end) 不重叠（相接允许）。未知边界/时区历史不拆分/舍入。校验当日所有片段，包括无有效证据片段，不静默丢弃坏输入。

plan.selectedSnapshotId 命中当日 snapshots 中唯一 snapshot_id，不自动选最新/日终。缺 plan、null/悬空选择为 missing_snapshot；快照 ID 重复为 duplicate_id。as_of 是显式审计时点，不用查询/入库时间替换。

被选快照的 today/consolidate 各自拥有 items，ID 在该段唯一；跨段可同 ID，不要求 consolidate 是 today 子集。各段 eligible/completed 不可重复且必须引用本段 items；completed 是 eligible 子集，恰为 eligible 内 status=completed 的项；seen/unfinished/excluded 不进 completed。非 excluded 的 exclusion_reason 必须 null，excluded 可 null 或非空白字符串。today.eligible 恰为 items 去掉 status=excluded 且有非空白原因的项；没写原因的剔除项留分母。consolidate.eligible 由替身明确给定，不推定剔除规则，但仍验引用/状态一致性。任段冲突只影响该日该段指标；选择错误影响两率，不影响学习指标。未选快照仅参与全文件形状/快照 ID 索引，不按其历史状态或项集合重算当前选择。

JSON 语法/Schema 类型/额外字段错是加载失败，非零退出且无部分 CSV；可定位语义 missing/unsupported/引用/集合冲突转 not_ready，不伪造数值。形状验证只消费上述生成 Zod；Schema 的 format/pattern 与支持契约历法约束同时满足才合法，不能只靠正则放过不存在日期。

两考试用同一代码读 junior-accounting/cet-6 profile.exam_id。tests/fixtures/metrics/exam-event-map.json 是表项数组，每项字段均必填：{exam_id,sourceLearnerId,learnerId,questionId,knowledgePointId,sourceQuestionId,sourceKnowledgePointName}。(exam_id,sourceLearnerId) 唯一且每门覆盖完整模板 roster；learnerId/questionId/knowledgePointId 是固定且跨考试不同的合成 UUIDv7。sourceLearnerId 指模板学员，sourceQuestionId 命中对应原 questions[].id，sourceKnowledgePointName 同时属于该题 knowledge_points 和 knowledge-map 的 sample_points[].name。缺表、字段或源标签不匹配是测试失败；不从原题字符串强转 UUID，不作为 CONT/MAP 正式导入。

每门事件测试以映射 learnerId 构造 Context 身份，题/知识点属性取同项映射；执行同形写入、self 查询、去重与两学员隔离断言。fixture 查询把模板学员 ID 及其所有学员关联按 sourceLearnerId→learnerId 一对一替换，并令根 exam_id 匹配。题/知识点 ID 仅用于事件属性，未出现在该指标 fixture 时不捏造字段。复跑独立手算同一金标：按上述学员映射逆归一化后比较除根 exam_id/身份字段外的完整结果，逐行比较数值、reason、period、timezone、schemaHash、simulated/conclusion；身份列另断言为对应映射值。不把不同 learner_id 的整份 CSV 文本当相同，也不只删列后按行序比较错人。

## 输出全集、未知与零

每个 roster 学员输出七天×两种完成率，以及该周各一行 metrics.weekly_effective_days/learner.effective_minutes；另全 roster 一行 metrics.weekly_effective_learners。空 roster 合法，只输出聚合 0。不由仓储猜学员。名称取生成登记 ID。

|学习输入|该学员两项周指标|全体周有效人数|
|---|---|---|
|七天均完整合法，无有效片段|真 0|该学员贡献 0|
|七天均完整合法，有有效片段|有效日去重数与 UTC 分钟和|该学员贡献 1|
|任日缺失/不支持/引用错|两项均 not_ready|整行 not_ready，不填已知下界|

未知只向依赖传播：其他学员合法周值和日计划行保留；计划未知不影响学习，学习未知不影响合法完成率。任一 roster 学员周学习未知，聚合人数即未知。学员周行/聚合行依赖未知一律 dependent_not_ready；日根因在 stderr 仅列字段路径/类别，不另增未登记日学习指标。

## CLI 与 CSV

0.1b 配 NodeNext 的 tsconfig.cli.json/依赖 references，rootDir='.'、outDir='dist'，同时编译包根 index.ts、generated/** 与 src/dev/query.ts；dev:query 先 tsc -b tsconfig.cli.json，再 node dist/src/dev/query.js。服务器依赖包先按 references 构建，exports 指向编译 JS；相对导入写 .js 且遵循 NodeNext，不加 tsx 或假设原生类型剥离。

events 的 from/to 按时间格式且 from < to；event 若给是非空事件名，可查旧 hash 保存名称。按发生 UTC [from,to) 查，每个有记录的 tenant/identity/name/schemaHash 分组一行；不为不存在身份/旧 hash 捏造 0。fixture 用 --fixture JSON、--week YYYY-MM-DD，--store 不参与计算；--output 默认 stdout。先构造完整结果再输出；失败写 stderr，退出 2（参数/JSON/Schema）或 1（仓储/其他运行错），不含原始值；构建非零则不启动 CLI。

表头固定 kind,name,tenant_id,learner_id,period,timezone,value,reason,simulated,schemaHash,conclusion。UTF-8 无 BOM、CRLF 行尾（含末行），RFC4180 转义：含逗号/引号/CR/LF 则加双引号，内部引号翻倍；空值为空字段，不写 null 字面。simulated=true、conclusion 空。

|列|取值|
|---|---|
|kind|event_count、metric、not_ready；零分母仍 metric|
|name|事件取实际 name，指标/未知取生成指标 ID|
|tenant_id|事件取租户 UUID；fixture 无租户输入，留空|
|learner_id|事件取 identity_id（含 guest）；单学员取 roster.id，聚合留空|
|period|日 YYYY-MM-DD；周 week:YYYY-MM-DD（周一）；事件为规范 UTC from/to，以 / 隔开、[from,to)|
|timezone|单学员 IANA；聚合 per_learner，事件 UTC|
|value|计数/分钟十进制整数；比例整数长除法保留六位小数、half-up，零为 0.000000；未知/零分母空|
|reason|正常空；零分母 no_applicable_plan；未知用下表|
|schemaHash|event_count 取保存事件 hash；其余取构建指标 hash，SHA-256 小写 hex|

六位比例只固定 CSV 表示，不作为生产精度承诺；测试同时核对原始分子/分母。行序按 kind 的 event_count/metric/not_ready 顺序，再依 name、tenant_id、learner_id、period、schemaHash 的 Unicode 码元序。无 candidate 行/未登记指标名；新指标先登记。

以下是可定位语义原因的优先顺序，一行多原因取首个；传播统一 dependent_not_ready：

|reason|含义/直接影响|
|---|---|
|missing_input|日/learning 缺失或 complete=false；该日学习|
|invalid_timezone|非支持 IANA；该学员全部日学习/完成率|
|duplicate_id|重复片段/证据/快照/集合成员；可定位日/段|
|missing_reference|证据/集合引用缺失或跨学员/日对象；日/段|
|inconsistent_evidence|pending 与 accepted 冲突；日学习|
|invalid_interval|零/倒置时长；日学习|
|cross_local_day|超出同日边界；日学习|
|overlapping_segments|同学员片段交叠；涉及日学习|
|non_integral_minute|UTC 时长非完整分钟；日学习|
|missing_snapshot|plan/选择缺失或悬空；日两完成率|
|inconsistent_plan|段状态/集合/原因冲突；该段完成率|
|dependent_not_ready|周依赖未知日，聚合依赖未知学员；不填下界|

重复 roster ID/date 无法无歧义定位输出，作为加载失败；非法日历/时刻或 UUID 属 Schema/历法加载错误。reason 不是绕过 Schema。invalid_timezone 的该学员十四日完成率均 not_ready，两周学习行与聚合按依赖传播未知。
