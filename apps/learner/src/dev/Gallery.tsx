// 组件陈列页 /dev/ui（F03）：每个公共组件的各种状态都在这里看得到；只在开发与测试时挂上（routes.tsx）。
// 用“预览宽度”看手机 375、平板 834、桌面 1280 三档（组件按容器宽度切换，不看屏幕宽度）；演示里的业务数字是示例，真实页面只显示接口返回的值。
import { useEffect, useState, type ReactNode } from "react";
import { param } from "@exam-prep/params";
import {
  formatCount,
  formatDate,
  formatDuration,
  formatPercent,
  formatRange,
  formatRelativeDay,
  formatScore,
  formatSeconds,
  formatTierGap,
  formatTime,
  interpolate,
} from "@exam-prep/shared/format";
import { DEFAULT_DAY_SETTINGS, addDays, dayStart, today } from "@exam-prep/shared/today";
import {
  DEGRADE_TIER,
  MASTERY_RANKS,
  PAGE_STATE_CODES,
  THREE_NUMBER_QUESTION,
  VOCAB,
  masteryLabel,
  type DegradeTierCode,
  type MasteryRank,
  type PageStateCode,
  type ProposalStatusCode,
} from "@exam-prep/shared/vocab";
import {
  AiBadge,
  AiContent,
  Banner,
  COPY,
  BarList,
  BottomSheet,
  Button,
  Card,
  Columns,
  DataTable,
  Dialog,
  Drawer,
  EvidenceRow,
  FilterChips,
  IconButton,
  Importance,
  KeyValueList,
  KpCard,
  List,
  ListRow,
  MasteryGrid,
  MasteryLadder,
  PageHeader,
  PageState,
  PageStates,
  ProgressBar,
  ProposalCard,
  ReasonTags,
  Segmented,
  Skeleton,
  Stat,
  StatGroup,
  Tabs,
  Tag,
  TaskGroup,
  TaskStrip,
  UndoBar,
  cx,
  pageStateFromSearch,
  type AbnormalState,
  type MasteryCell,
} from "@exam-prep/ui";
import copy from "./states.zh-CN.json";
import "./gallery.css";

const SECTIONS = [
  ["tokens", "设计令牌"],
  ["format", "显示格式与“今天”"],
  ["card", "面板"],
  ["button", "按钮"],
  ["tag", "标签"],
  ["list", "行列表"],
  ["header", "页头"],
  ["table", "表格"],
  ["stat", "统计卡（三个数）"],
  ["chips", "筛选片"],
  ["bars", "横条图"],
  ["tabs", "分段选择与标签页"],
  ["ai", "AI 标识与理由标签"],
  ["proposal", "提议卡"],
  ["states", `页面状态（七态加${VOCAB.page_state.locked}）`],
  ["ladder", "掌握阶梯"],
  ["grid", "掌握方格"],
  ["kp", "知识点小卡与证据行"],
  ["task", "今日任务条"],
  ["notice", "撤销条与提示条"],
  ["progress", "进度条、键值行与占位骨架"],
  ["overlay", "对话框、抽屉与底部面板"],
  ["layout", "页面双栏（容器查询）"],
] as const;

type Width = "auto" | "mobile" | "tablet" | "desktop";
type Overlay = "dialog" | "alert" | "left" | "right" | "sheet" | null;

const WIDTHS: { value: Width; label: string }[] = [
  { value: "auto", label: "跟随窗口" },
  { value: "mobile", label: "手机 375" },
  { value: "tablet", label: "平板 834" },
  { value: "desktop", label: "桌面 1280" },
];
const COLORS = ["bg-canvas", "bg-surface", "bg-sunk", "ink-primary", "ink-secondary", "ink-tertiary", "line-strong", "line-soft"];
const BRAND_COLORS = ["brand-primary", "brand-primary-ink", "brand-primary-soft", "status-warning", "status-warning-soft", "status-warning-line"];
const STATUS_COLORS = ["status-danger", "status-danger-soft", "status-success", "status-success-soft", "status-ai", "status-ai-soft"];
const SPACES = ["1", "2", "3", "4", "5", "6", "8", "10", "12"];
const ABNORMAL = PAGE_STATE_CODES.filter((code): code is AbnormalState => code !== "normal");
const BOUNDARY_DAY = "2026-10-21";

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="dev-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="dev-section__title">
        {title}
      </h2>
      {note !== undefined && <p className="dev-section__note">{note}</p>}
      {children}
    </section>
  );
}

function Swatch({ token, label }: { token: string; label?: string }) {
  return (
    <li className="dev-swatch">
      <span className="dev-swatch__chip" style={{ background: `var(--color-${token})` }} />
      <code>{label ?? `color.${token.replace("-", ".")}`}</code>
    </li>
  );
}

function stateProps(page: "S06" | "S10", state: AbnormalState, retry: () => void) {
  const c = copy[page];
  switch (state) {
    case "empty":
      return { title: c.empty.title, body: c.empty.body, action: <Button variant="primary">{c.empty.action}</Button> };
    case "offline":
      return { body: c.offline };
    case "restricted":
      return { body: c.restricted };
    case "insufficient_data":
      return {
        body: c.insufficient_data,
        counts: [
          { key: "answers", label: "已作答", value: formatCount(6, "题") },
          { key: "days", label: "已学天数", value: formatCount(5, "天") },
        ],
      };
    case "locked":
      return { body: copy.locked.body, action: <Button variant="primary">{copy.locked.action}</Button> };
    case "error":
      return { onRetry: retry, onReport: retry };
    case "loading":
      return { slowHintAfterSeconds: param("ui.loading.slow_hint_seconds") };
  }
}

function demoCells(): MasteryCell[] {
  const names = ["会计等式", "资产", "负债", "所有者权益", "收入", "费用", "利润", "借贷记账法", "会计科目", "账户结构", "试算平衡", "原始凭证"];
  return Array.from({ length: 36 }, (_, index) => ({
    id: `kp-${index}`,
    name: `${names[index % names.length] ?? ""}${index >= names.length ? `（${Math.floor(index / names.length) + 1}）` : ""}`,
    level: ((index * 7 + Math.floor(index / 5)) % MASTERY_RANKS.length) as MasteryRank,
    evidenceSufficient: index % 9 !== 4,
    inScope: index % 13 !== 11,
  }));
}

/** 组件陈列页。 */
export function Gallery() {
  const [width, setWidth] = useState<Width>("auto");
  const [display, setDisplay] = useState<string[]>([]);
  const [statePage, setStatePage] = useState<"S06" | "S10">("S06");
  const [pageState, setPageState] = useState<PageStateCode>(() => pageStateFromSearch(window.location.search, { enabled: import.meta.env.DEV }));
  const [proposal, setProposal] = useState<ProposalStatusCode>("pending");
  const [target, setTarget] = useState<MasteryRank>(3);
  const [tier, setTier] = useState<DegradeTierCode>("full");
  const [tab, setTab] = useState("questions");
  const [chips, setChips] = useState<string[]>(["wrong"]);
  const [picked, setPicked] = useState("");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [notices, setNotices] = useState<string[]>(["info", "success", "warning", "danger", "ai"]);
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    if (display.includes("large")) root.setAttribute("data-text", "large");
    else root.removeAttribute("data-text");
    if (display.includes("cvd")) root.setAttribute("data-vision", "cvd");
    else root.removeAttribute("data-vision");
    return () => {
      root.removeAttribute("data-text");
      root.removeAttribute("data-vision");
    };
  }, [display]);

  const bump = () => setClicks((n) => n + 1);
  const undoHint = interpolate(copy.demo.undo_hint, { days: param("plan.proposal.undo_days") });
  const now = Date.now();
  const learningDay = today(now, DEFAULT_DAY_SETTINGS);
  const tz = DEFAULT_DAY_SETTINGS.timeZone;
  const boundary = dayStart(BOUNDARY_DAY, DEFAULT_DAY_SETTINGS).getTime();
  const minute = 60_000;
  const proposalRows = { what: "把周六的新学挪到周日上午", why: "周六的时间格只剩 20 分钟，排不下 45 分钟的新学", cost: "周日多学 25 分钟", ifNot: "周六的任务做不完，会挤到下周" };

  return (
    <div className="dev-gallery ui-root">
      <header className="dev-gallery__bar">
        <strong className="dev-gallery__brand">组件陈列页</strong>
        <Segmented label="预览宽度" size="sm" options={WIDTHS} value={width} onChange={setWidth} />
        <FilterChips
          label="显示设置"
          options={[
            { value: "large", label: "大字号" },
            { value: "cvd", label: "色觉友好配色" },
          ]}
          selected={display}
          onChange={setDisplay}
        />
      </header>
      <div className={cx("dev-gallery__frame ui-cq", width !== "auto" && `dev-gallery__frame--${width}`)}>
        <main className="dev-gallery__main">
          <PageHeader
            eyebrow="开发与测试用 · 正式版本里没有这一页"
            title="公共组件陈列"
            description="按原型里的使用次数排序；页面只拼装这些组件，不各写一套。点目录跳到对应一节。"
          />
          <nav aria-label="目录" className="dev-toc">
            {SECTIONS.map(([id, title]) => (
              <a key={id} href={`#${id}`} className="dev-toc__link">
                {title}
              </a>
            ))}
          </nav>

          <Section id="tokens" title="设计令牌" note="唯一来源 design/tokens.json；改令牌后运行 node packages/ui/scripts/gen-tokens.ts。页面里不写颜色值与像素。">
            <div className="dev-grid">
              <Card title="底色、文字与分隔线" headingLevel={3}>
                <ul className="dev-swatches">
                  {COLORS.map((token) => (
                    <Swatch key={token} token={token} />
                  ))}
                </ul>
              </Card>
              <Card title="主色与提醒" headingLevel={3}>
                <ul className="dev-swatches">
                  {BRAND_COLORS.map((token) => (
                    <Swatch key={token} token={token} />
                  ))}
                </ul>
              </Card>
              <Card title="错误、完成与 AI" headingLevel={3}>
                <ul className="dev-swatches">
                  {STATUS_COLORS.map((token) => (
                    <Swatch key={token} token={token} />
                  ))}
                </ul>
              </Card>
              <Card title="掌握六档" headingLevel={3}>
                <ul className="dev-swatches">
                  {MASTERY_RANKS.map((rank) => (
                    <Swatch key={rank} token={`mastery-${rank}`} label={`${rank} ${masteryLabel(rank)}`} />
                  ))}
                </ul>
              </Card>
              <Card title="字号、字重与圆角" headingLevel={3}>
                <p className="dev-type dev-type--title">页标题 22 · 宋体</p>
                <p className="dev-type">正文 14：今天先复习到期的卡片，再做新学。</p>
                <p className="dev-type dev-type--small">小字 12.5：考频 4 级 · 历年 2–4 分</p>
                <div className="dev-row">
                  <span className="dev-radius dev-radius--md">大圆角</span>
                  <span className="dev-radius dev-radius--sm">小圆角</span>
                </div>
              </Card>
              <Card title="间距阶梯（4 的倍数）" headingLevel={3}>
                <ul className="dev-spaces">
                  {SPACES.map((step) => (
                    <li key={step} className="dev-space">
                      <code>space.{step}</code>
                      <span className="dev-space__bar" style={{ inlineSize: `var(--size-space-${step})` }} />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </Section>

          <Section id="format" title="显示格式与“今天”" note="所有页面用同一组格式函数（packages/shared/src/format）；“今天”按用户时区与凌晨 4 点日界线算。">
            <Card headingLevel={3} title="同一个数，各页显示一样">
              <KeyValueList
                items={[
                  { key: "duration", label: "时长", value: `${formatDuration(45)} · ${formatDuration(90)} · ${formatDuration(120)}` },
                  { key: "seconds", label: "用时", value: `${formatSeconds(38)} · ${formatSeconds(65)}` },
                  { key: "date", label: "日期与时间", value: `${formatDate(now, { timeZone: tz, weekday: true })} ${formatTime(now, tz)}` },
                  { key: "relative", label: "相对日期", value: `${formatRelativeDay(addDays(learningDay, 1), learningDay)} · ${formatRelativeDay(addDays(learningDay, 3), learningDay)}` },
                  { key: "percent", label: "百分比", value: formatPercent(0.625) },
                  { key: "score", label: "分数", value: `${formatScore(61.5)} · ${formatScore(60, { total: 100 })}` },
                  { key: "range", label: "区间", value: formatRange(57, 65, "分") },
                  { key: "gap", label: "档位差", value: `${formatTierGap(2)} · ${formatTierGap(0)}` },
                  { key: "count", label: "计数", value: formatCount(1234, "题") },
                  { key: "today", label: "现在是哪个学习日", value: formatDate(learningDay, { weekday: true }) },
                  { key: "before", label: "10月21日 03:59（北京时间）", value: `算 ${formatDate(today(boundary - minute, DEFAULT_DAY_SETTINGS))}` },
                  { key: "after", label: "10月21日 04:00（北京时间）", value: `算 ${formatDate(today(boundary, DEFAULT_DAY_SETTINGS))}` },
                ]}
              />
            </Card>
          </Section>

          <Section id="card" title="面板" note="原型里用得最多的部件：标题、补充、动作、内容、页脚；七种底色。">
            <div className="dev-grid">
              <Card title="完成度" meta={THREE_NUMBER_QUESTION.completion} actions={<Button size="sm">详情</Button>} footer="口径：学习范围内的工作量已完成多少">
                学习范围内共 312 个知识点，已完成 131 个的工作量。
              </Card>
              {(["sunk", "brand", "warning", "danger", "success", "ai"] as const).map((tone) => (
                <Card key={tone} tone={tone} title={`底色 ${tone}`} headingLevel={3}>
                  这一张面板用 {tone} 底色。
                </Card>
              ))}
            </div>
          </Section>

          <Section id="button" title="按钮" note="按钮写动作，同一个动作在流程里叫同一个名字；键盘 Tab 到按钮时有主色焦点框。">
            <div className="dev-row">
              <Button variant="primary" onClick={bump}>
                生成我的计划
              </Button>
              <Button onClick={bump}>加入今日</Button>
              <Button variant="ghost" onClick={bump}>
                查看全部
              </Button>
              <Button variant="danger" onClick={bump}>
                删除这张卡片
              </Button>
              <Button variant="ai" onClick={bump}>
                问导师
              </Button>
              <Button size="sm" onClick={bump}>
                小按钮
              </Button>
              <Button busy>保存中</Button>
              <Button disabled>暂不可用</Button>
              <IconButton label="关闭" icon="close" onClick={bump} />
              <span className="dev-note">已点 {clicks} 次</span>
            </div>
            <Button block variant="primary" onClick={bump}>
              占满一行的按钮
            </Button>
          </Section>

          <Section id="tag" title="标签">
            <div className="dev-row">
              <Tag>中性</Tag>
              <Tag tone="brand">高频</Tag>
              <Tag tone="success">已达标</Tag>
              <Tag tone="warning">还差 1 档</Tag>
              <Tag tone="danger">易错</Tag>
              <Tag tone="ai">AI 生成</Tag>
              <Tag tone="outline">{VOCAB.knowledge_type.concept}</Tag>
              <Tag size="sm" tone="brand">
                小标签
              </Tag>
            </div>
          </Section>

          <Section id="list" title="行列表" note="整行可点（按钮或链接）、行尾独立按钮、当前行。">
            <Card flush title="今天要复习的知识点" headingLevel={3}>
              <List>
                <ListRow title="会计等式" description="第一章 会计概述" trailing={<Tag tone="warning">今天到期</Tag>} onSelect={bump} />
                <ListRow title="借贷记账法" description="第二章 会计科目与账户" href="#list" current trailing="当前" />
                <ListRow title="资产的确认条件" description="第一章 会计概述" action={<Button size="sm">加入今日</Button>} />
                <ListRow title="试算平衡" leading={<Importance level={4} />} trailing={formatDuration(12)} />
              </List>
            </Card>
          </Section>

          <Section id="header" title="页头">
            <Card>
              <PageHeader
                eyebrow="初级会计实务 › 第一章 会计概述"
                title="会计等式"
                description="来源：官方知识地图"
                actions={
                  <>
                    <Button variant="primary">加入今日</Button>
                    <Button>攻坚包</Button>
                  </>
                }
                meta={
                  <>
                    <Tag tone="outline">{VOCAB.knowledge_type.concept}</Tag>
                    <Tag tone="outline">{VOCAB.knowledge_type.procedure}</Tag>
                    <Importance level={3} />
                  </>
                }
              />
            </Card>
          </Section>

          <Section id="table" title="表格" note="宽了在自身区域里横向滚动；容器窄于 700 时每行叠成一张小卡。">
            <Card>
              <DataTable
                caption="关联题目"
                captionVisible
                stackOnNarrow
                rowKey={(row) => row.id}
                rows={[
                  { id: "q1", title: "下列各项中，属于会计等式的是", type: VOCAB.question_type.single, result: "做错 2 次", freq: 4 },
                  { id: "q2", title: "关于资产的确认条件，说法正确的有", type: VOCAB.question_type.multiple, result: "没做过", freq: 3 },
                  { id: "q3", title: "收入会导致所有者权益增加", type: VOCAB.question_type.true_false, result: "做对 1 次", freq: 2 },
                ]}
                columns={[
                  { key: "title", header: "题目", label: "题目", render: (row) => row.title },
                  { key: "type", header: "题型", label: "题型", render: (row) => row.type },
                  { key: "result", header: "我的结果", label: "我的结果", render: (row) => row.result },
                  { key: "freq", header: "考频", label: "考频", align: "end", render: (row) => <Importance level={row.freq} /> },
                ]}
              />
            </Card>
            <Card>
              <DataTable caption="空表" captionVisible rowKey={() => ""} rows={[]} empty="还没有关联题目" columns={[{ key: "a", header: "题目", render: () => "" }]} />
            </Card>
          </Section>

          <Section id="stat" title="统计卡（三个数）" note="三个数各答一问，不互相代替；数字只显示接口返回的值。">
            <Card>
              <StatGroup>
                <Stat label={VOCAB.three_numbers.forecast_gap} question={THREE_NUMBER_QUESTION.forecast_gap} value={formatRange(57, 65)} unit="分" hint="最可能 61 分，离目标线还差 3 分" />
                <Stat label={VOCAB.three_numbers.completion} question={THREE_NUMBER_QUESTION.completion} value={formatPercent(0.42)} tone="brand" />
                <Stat label={VOCAB.three_numbers.health} question={THREE_NUMBER_QUESTION.health} value={formatPercent(0.9)} tone="warning" hint="近期速度 ÷ 按期需要的速度" />
              </StatGroup>
            </Card>
          </Section>

          <Section id="chips" title="筛选片">
            <FilterChips
              label="关联题目筛选"
              selected={chips}
              onChange={setChips}
              options={[
                { value: "wrong", label: "我做错的", count: 12 },
                { value: "new", label: "我没做过的", count: 30 },
                { value: "hot", label: "高频的", count: 8 },
                { value: "off", label: "暂不可选", disabled: true },
              ]}
            />
          </Section>

          <Section id="bars" title="横条图">
            <Card title="我在这里怎么错" headingLevel={3}>
              <BarList
                label="错因分布"
                items={[
                  { key: "c", label: VOCAB.error_cause.concept_unclear, value: 6, valueText: "6 次", tone: "danger" },
                  { key: "m", label: VOCAB.error_cause.misread, value: 4, valueText: "4 次", tone: "warning" },
                  { key: "f", label: VOCAB.error_cause.forgot, value: 3, valueText: "3 次" },
                  { key: "s", label: VOCAB.error_cause.slip, value: 1, valueText: "1 次" },
                ]}
              />
            </Card>
          </Section>

          <Section id="tabs" title="分段选择与标签页" note="方向键切换，Home/End 到两端。">
            <Segmented
              label="今天的档位"
              value={tier}
              onChange={setTier}
              options={(Object.keys(DEGRADE_TIER) as DegradeTierCode[]).map((code) => ({ value: code, label: DEGRADE_TIER[code] }))}
            />
            <Card>
              <Tabs
                label="关联内容"
                value={tab}
                onChange={setTab}
                items={[
                  { key: "questions", label: "题目", badge: 12 },
                  { key: "cards", label: "卡片", badge: 3 },
                  { key: "notes", label: "笔记", badge: 1 },
                  { key: "off", label: "暂不可选", disabled: true },
                ]}
              >
                <p>当前标签：{tab}</p>
              </Tabs>
            </Card>
          </Section>

          <Section id="ai" title="AI 标识与理由标签" note="AI 生成的内容一律带显式标识；从这里复制出去的文字开头带“【AI 生成】”。导师不可用时理由显示模板句、不带标识。">
            <div className="dev-row">
              <AiBadge />
              <AiBadge size="xs" />
            </div>
            <AiContent note="导师生成，未经你确认">会计等式“资产 = 负债 + 所有者权益”反映某一时点的财务状况；做题时先判断是静态等式还是动态等式。</AiContent>
            <ReasonTags reasons={["考频 4 级", "历年 2–4 分", "还差 1 档"]} aiPolished />
            <ReasonTags reasons={["今天到期", "上次答错"]} />
          </Section>

          <Section id="proposal" title="提议卡" note={`固定四行；按钮只有“${COPY.action.confirm}”和“${COPY.action.decline}”；确认后在期限内可撤销（期限从参数读取）。第一张可以点。`}>
            <div className="dev-grid">
              <ProposalCard
                {...proposalRows}
                status={proposal}
                aiGenerated
                undoHint={undoHint}
                onConfirm={() => setProposal("confirmed")}
                onDecline={() => setProposal("declined")}
                onUndo={() => setProposal("undone")}
              />
              <ProposalCard {...proposalRows} status="confirmed" undoHint={undoHint} onUndo={bump} />
              <ProposalCard {...proposalRows} status="declined" />
              <ProposalCard {...proposalRows} status="undone" />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setProposal("pending")}>
              重置第一张
            </Button>
          </Section>

          <Section id="states" title={`页面状态（七态加${VOCAB.page_state.locked}）`} note="每个页面都用同一个状态组件；开发时也可以在网址后面加 ?state=offline 之类直接看。文案取自 bk spec 的“七态”一节。">
            <div className="dev-row">
              <Segmented
                label="页面"
                size="sm"
                value={statePage}
                onChange={setStatePage}
                options={[
                  { value: "S06", label: copy.S06.page },
                  { value: "S10", label: copy.S10.page },
                ]}
              />
              <Segmented
                label="页面状态"
                size="sm"
                value={pageState}
                onChange={setPageState}
                options={PAGE_STATE_CODES.map((code) => ({ value: code, label: VOCAB.page_state[code] }))}
              />
            </div>
            <Card>
              <PageStates state={pageState} pageName={copy[statePage].page} {...(pageState === "normal" ? {} : stateProps(statePage, pageState, bump))}>
                <p>这里是{copy[statePage].page}的内容。</p>
              </PageStates>
            </Card>
            <div className="dev-grid">
              {ABNORMAL.map((state) => (
                <Card key={state} title={VOCAB.page_state[state]} headingLevel={3}>
                  <PageState compact state={state} pageName={copy.S06.page} {...stateProps("S06", state, bump)} />
                </Card>
              ))}
            </div>
          </Section>

          <Section id="ladder" title="掌握阶梯" note="同时标出系统判定、自评与目标档；差几档用接口给的值；证据不足画虚线并写明“不等于不会”。">
            <div className="dev-grid">
              <Card title="还差 2 档（自评待检验）" headingLevel={3}>
                <MasteryLadder system={2} self={3} selfPending target={4} gap={2} />
              </Card>
              <Card title="已达标" headingLevel={3}>
                <MasteryLadder system={4} target={4} gap={0} />
              </Card>
              <Card title="证据不足" headingLevel={3}>
                <MasteryLadder system={1} target={3} gap={2} evidenceSufficient={false} />
              </Card>
              <Card title="可改目标档" headingLevel={3}>
                <MasteryLadder system={2} target={target} gap={target - 2} onTargetChange={setTarget} />
              </Card>
              <Card title="迷你版" headingLevel={3}>
                <ul className="dev-stack">
                  {MASTERY_RANKS.map((rank) => (
                    <li key={rank}>
                      <MasteryLadder variant="mini" system={rank} target={3} gap={3 - rank} evidenceSufficient={rank !== 2} />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </Section>

          <Section id="grid" title="掌握方格" note="每格一个知识点；虚线格是证据不足、斜纹格是范围外，两者都不等于“不会”。点格子或用方向键移动。">
            <Card>
              <MasteryGrid label="第一章 会计概述" cells={demoCells()} onSelect={setPicked} />
              <p className="dev-note">{picked ? `点了：${picked}` : "还没点格子"}</p>
            </Card>
          </Section>

          <Section id="kp" title="知识点小卡与证据行">
            <div className="dev-grid">
              <KpCard
                name="会计等式"
                path="第一章 › 会计要素"
                system={2}
                target={3}
                gap={1}
                importance={4}
                types={["concept", "procedure"]}
                reasons={["考频 4 级", "还差 1 档"]}
                href="#kp"
                action={<Button size="sm">加入今日</Button>}
              />
              <KpCard name="资产的确认条件" path="第一章 › 会计要素" system={0} target={3} gap={3} evidenceSufficient={false} importance={3} types={["fact"]} scope="added" starred />
              <KpCard name="外币折算" path="第九章 › 外币业务" system={1} target={2} gap={1} importance={1} scope="removed" onSelect={bump} />
            </div>
            <Card flush title="我的证据" headingLevel={3}>
              <List>
                <EvidenceRow
                  when={formatDate(now, { timeZone: tz })}
                  title="单选：下列各项中，属于会计等式的是"
                  kind="作答"
                  result="correct"
                  confidence="sure"
                  duration={formatSeconds(48)}
                  strength="strong"
                  credibility="reviewed"
                />
                <EvidenceRow
                  when={formatDate(now - 86_400_000, { timeZone: tz })}
                  title="判断：收入会导致所有者权益增加"
                  kind="作答"
                  result="correct"
                  confidence="guess"
                  duration={formatSeconds(4)}
                  strength="pending"
                  credibility="generated_confirmed"
                  note="蒙的或秒答：先不升档，稍后换个问法再考"
                />
                <EvidenceRow
                  when={formatDate(now - 3 * 86_400_000, { timeZone: tz })}
                  title="回忆卡：会计等式的三种形式"
                  kind="回忆"
                  result="wrong"
                  confidence="vague"
                  duration={formatSeconds(65)}
                  strength="negative"
                  credibility="own"
                />
              </List>
            </Card>
          </Section>

          <Section id="task" title="今日任务条" note="先做推迟有损失的，再做推迟无损失的；完成看证据，手动勾选只记“看过”。理由里的数字只来自算法。">
            <div className="dev-row">
              <Button variant="primary">继续</Button>
              <Button>{interpolate(copy.demo.short_mode, { minutes: param("plan.short_mode.minutes") })}</Button>
            </div>
            <Card>
              <TaskGroup segment="consolidate" meta={formatDuration(35)}>
                <TaskStrip source="due_review" segment="consolidate" title="会计要素回忆卡 8 张" minutes={12} reasons={["今天到期", "遗忘风险高"]} onStart={bump} href="#task" />
                <TaskStrip source="mistake_retry" segment="consolidate" title="错题：资产的确认条件" minutes={8} state="done" />
                <TaskStrip source="verify_recheck" segment="consolidate" title="换个问法再考：收入的特征" minutes={5} reasons={["上次秒答"]} onStart={bump} />
              </TaskGroup>
              <TaskGroup segment="advance" meta={formatDuration(70)}>
                <TaskStrip source="new_learning" segment="advance" title="第二章 会计科目（读后即测）" minutes={40} reasons={["考频 4 级", "提分性价比 A"]} aiPolished state="doing" onStart={bump} startLabel="继续" />
                <TaskStrip source="practice" segment="advance" title="借贷记账法练习 10 题" minutes={20} state="seen" />
                <TaskStrip source="org_or_custom" segment="advance" title="机构作业：第一章小测" minutes={10} onStart={bump} />
              </TaskGroup>
              <TaskGroup segment="closing" meta={formatDuration(5)}>
                <TaskStrip source="bedtime_review" segment="closing" title="睡前口述：今天学了什么" minutes={5} onStart={bump} />
              </TaskGroup>
            </Card>
          </Section>

          <Section id="notice" title="撤销条与提示条" note="撤销期限从参数读取；提醒不出现“落后”“欠”，不展示累计未完成量。">
            <UndoBar message={interpolate(copy.demo.carryover, { count: 2 })} hint={undoHint} onUndo={bump} onDismiss={bump} />
            {notices.includes("info") && (
              <Banner title="周复盘已生成" onDismiss={() => setNotices((list) => list.filter((n) => n !== "info"))}>
                本周的复盘与报告可以看了。
              </Banner>
            )}
            {notices.includes("success") && <Banner tone="success" title="今天的巩固段做完了" />}
            {notices.includes("warning") && (
              <Banner tone="warning" title="报名还剩 5 天截止" action={<Button size="sm">去看看</Button>}>
                与你相关的节点提醒。
              </Banner>
            )}
            {notices.includes("danger") && <Banner tone="danger" title="这次作答没保存上">联网后会自动重试。</Banner>}
            {notices.includes("ai") && (
              <Banner tone="ai" title="导师暂不可用" onDismiss={() => setNotices((list) => list.filter((n) => n !== "ai"))}>
                清单与复习照常；理由先显示模板句。
              </Banner>
            )}
          </Section>

          <Section id="progress" title="进度条、键值行与占位骨架">
            <div className="dev-grid">
              <Card title="进度条" headingLevel={3}>
                <div className="dev-stack">
                  <ProgressBar label="本轮覆盖进度" value={0.42} />
                  <ProgressBar label="巩固段" value={0.75} tone="warning" />
                  <ProgressBar label={`${masteryLabel(4)}及以上`} value={0.18} tone="mastery" />
                  <ProgressBar label="AI 点数" value={0.6} tone="ai" valueText="还剩 60%" size="sm" />
                </div>
              </Card>
              <Card title="考点档案" headingLevel={3}>
                <KeyValueList
                  items={[
                    { key: "freq", label: "考频", value: <Importance level={4} /> },
                    { key: "score", label: "历年分值", value: formatRange(2, 4, "分") },
                    { key: "type", label: "主要题型", value: `${VOCAB.question_type.single}、${VOCAB.question_type.multiple}` },
                    { key: "maturity", label: "数据成熟度", value: VOCAB.data_maturity.maturing },
                  ]}
                />
              </Card>
              <Card title="占位骨架" headingLevel={3}>
                <Skeleton title lines={3} />
              </Card>
            </div>
          </Section>

          <Section id="overlay" title="对话框、抽屉与底部面板" note="打开时焦点进入、背景不能操作，Esc 或点遮罩关闭（确认框只能点按钮），关闭后焦点回到原按钮。">
            <div className="dev-row">
              <Button onClick={() => setOverlay("dialog")}>打开对话框</Button>
              <Button onClick={() => setOverlay("alert")}>打开确认框</Button>
              <Button onClick={() => setOverlay("left")}>打开左侧抽屉</Button>
              <Button onClick={() => setOverlay("right")}>打开右侧抽屉</Button>
              <Button onClick={() => setOverlay("sheet")}>打开底部面板</Button>
            </div>
            <Dialog
              open={overlay === "dialog"}
              onClose={() => setOverlay(null)}
              title="加入今日"
              description="预计 25 分钟，会挤掉今天的“借贷记账法练习”。"
              actions={
                <>
                  <Button onClick={() => setOverlay(null)}>取消</Button>
                  <Button variant="primary" onClick={() => setOverlay(null)}>
                    加入今日
                  </Button>
                </>
              }
            />
            <Dialog
              open={overlay === "alert"}
              role="alertdialog"
              onClose={() => setOverlay(null)}
              title="删除这张卡片？"
              description="删除后复习记录保留，卡片不再出现。"
              actions={
                <>
                  <Button onClick={() => setOverlay(null)}>先不删</Button>
                  <Button variant="danger" onClick={() => setOverlay(null)}>
                    删除
                  </Button>
                </>
              }
            />
            <Drawer open={overlay === "left"} side="left" onClose={() => setOverlay(null)} title="分组导航">
              <List>
                {["今日", "学", "记", "练", "考", "助", "我"].map((name) => (
                  <ListRow key={name} title={name} onSelect={() => setOverlay(null)} />
                ))}
              </List>
            </Drawer>
            <Drawer open={overlay === "right"} onClose={() => setOverlay(null)} title="通知" footer={<Button onClick={() => setOverlay(null)}>全部已读</Button>}>
              <p>报名还剩 5 天截止。</p>
            </Drawer>
            <BottomSheet open={overlay === "sheet"} onClose={() => setOverlay(null)} title="问导师">
              <AiContent>你可以问我这个知识点的任何问题。</AiContent>
            </BottomSheet>
          </Section>

          <Section id="layout" title="页面双栏（容器查询）" note="内容区宽度 ≥ 860 时左右两栏，≥ 1180 时主栏更宽，窄了上下排；切换“预览宽度”可以看到变化。">
            <Columns
              main={
                <Card title="左栏：阶梯卡" headingLevel={3}>
                  <MasteryLadder system={2} target={4} gap={2} />
                </Card>
              }
              aside={
                <Card title="右栏：在哪里学" headingLevel={3}>
                  <List>
                    <ListRow title="教材第 12–15 页" description="可解析" />
                    <ListRow title="视频 03:20–08:45" description="只外链" />
                  </List>
                </Card>
              }
            />
          </Section>
        </main>
      </div>
    </div>
  );
}

export default Gallery;
