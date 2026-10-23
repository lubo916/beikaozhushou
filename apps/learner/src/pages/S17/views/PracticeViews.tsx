import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S17PracticeCenter, S17Bank } from "@exam-prep/contract";
import { formatCount, formatDate, formatDuration } from "@exam-prep/shared/format";
import { credibilityLabel } from "@exam-prep/shared/vocab";
import {
  AiBadge,
  AiContent,
  Button,
  Card,
  Columns,
  DataTable,
  PageState,
  Segmented,
  Tag,
  buttonClass,
  type TableColumn,
} from "@exam-prep/ui";
import { DEMO_PARAM, pathTo } from "../../../routes.ts";
import { useToast } from "../../../app/toast.tsx";
export type DialogKind = "newQuestion" | "photo" | "import" | "tutor" | "settings" | "auto" | "manual" | "bank" | "past" | "special";
export interface ViewProps {
  data: S17PracticeCenter;
  open: (kind: DialogKind) => void;
}
function ExerciseLink({ sessionId, sample, children }: { sessionId: string; sample: boolean; children: React.ReactNode }) {
  // 示例会话尚未创建：沿用 S18 当前考试的示范题组，真实会话 ID 原样交给路由。
  return (
    <Link className={buttonClass("primary")} to={pathTo("S18", { sessionId: sample ? DEMO_PARAM : sessionId })}>
      {children}
    </Link>
  );
}
export function RecommendView({ data, open }: ViewProps) {
  const { t } = useTranslation("S17");
  const toast = useToast();
  const [sentence, setSentence] = useState("");
  const [parsed, setParsed] = useState(false);
  const rec = data.recommendation;
  return (
    <Columns
      main={
        <div className="s17-stack">
          {/* feat:S17-01 按档位与性价比选题，推荐条件和数字由接口提供 */}
          <Card
            className="s17-smart"
            title={t("recommend.smart")}
            tone="brand"
            meta={<Tag tone="brand">{t("recommend.badge")}</Tag>}
            actions={
              <Button size="sm" variant="ghost" onClick={() => toast(t("soon"))}>
                {t("recommend.change")}
              </Button>
            }
          >
            <div className="s17-stack s17-hero">
              <h3 className="s17-hero-title">{rec.title}</h3>
              <p className="s17-soft">{rec.reason}</p>
              <div className="s17-row">
                <Tag>{t("count", { n: formatCount(rec.question_count) })}</Tag>
                <Tag>{formatDuration(rec.minutes)}</Tag>
                <Tag tone="success">{rec.accuracy_label}</Tag>
              </div>
              <div className="s17-row">
                <ExerciseLink sessionId={rec.session_id} sample={data.data_source === "sample"}>
                  {t("practice")}
                </ExerciseLink>
                <Button onClick={() => open("settings")}>{t("settings")}</Button>
              </div>
            </div>
          </Card>
          {/* feat:S17-02 多种练习入口；feat:S17-17 真题套卷；feat:S17-18 限时；feat:S17-19 每日一练 */}
          <div className="s17-card-grid @tablet:grid-cols-2 @content-md:grid-cols-3">
            <Card title={t("recommend.daily")}>
              <div className="s17-stack">
                <p className="s17-soft">{t("recommend.dailyDesc")}</p>
                <p>
                  {t("count", { n: formatCount(data.daily.question_count) })} · {formatDuration(data.daily.minutes)}
                </p>
                <ExerciseLink sessionId={data.daily.session_id} sample={data.data_source === "sample"}>
                  {t("practice")}
                </ExerciseLink>
              </div>
            </Card>
            <Card title={t("recommend.past")}>
              <div className="s17-stack">
                <p className="s17-soft">{t("recommend.pastDesc")}</p>
                <Button onClick={() => open("past")}>{t("recommend.pastAction")}</Button>
              </div>
            </Card>
            <Card title={t("recommend.special")}>
              <div className="s17-stack">
                <p className="s17-soft">{t("recommend.specialDesc")}</p>
                <Button onClick={() => open("special")}>{t("recommend.specialAction")}</Button>
              </div>
            </Card>
          </div>
          {/* feat:S17-12 一句话组卷：解析结果需确认，不自动改状态 */}
          <Card title={t("recommend.sentence")}>
            <div className="s17-stack">
              <p className="s17-soft">{t("recommend.sentenceDesc")}</p>
              <label className="s17-field">
                <span>{t("recommend.sentence")}</span>
                <textarea
                  className="s17-input"
                  placeholder={t("recommend.sentencePlaceholder")}
                  value={sentence}
                  onChange={(e) => {
                    setSentence(e.target.value);
                    setParsed(false);
                  }}
                />
              </label>
              <Button disabled={!sentence.trim()} onClick={() => setParsed(true)}>
                {t("recommend.parse")}
              </Button>
              {parsed && (
                <AiContent note={t("recommend.preview")}>
                  <div className="s17-stack">
                    <h3>{t("recommend.parsed")}</h3>
                    <p>{sentence}</p>
                    <p>
                      {t("form.scope")}：{rec.point_name}
                    </p>
                    <p>
                      {t("count", { n: formatCount(rec.question_count) })} · {formatDuration(rec.minutes)}
                    </p>
                    <Button onClick={() => open("auto")}>{t("recommend.make")}</Button>
                  </div>
                </AiContent>
              )}
            </div>
          </Card>
          <Card title={t("recommend.shortcuts")}>
            <div className="s17-stack">
              <div className="s17-row">
                <Link className={buttonClass()} to={pathTo("S10", { kpId: rec.point_id })}>
                  {t("recommend.chapter")}
                </Link>
                <Button onClick={() => toast(t("soon"))}>{t("recommend.quick")}</Button>
                <Button onClick={() => toast(t("soon"))}>{t("recommend.favorites")}</Button>
                <Link className={buttonClass()} to={pathTo("S19")}>
                  {t("recommend.mistakes")}
                </Link>
              </div>
              {/* feat:S17-20 快刷及把握度证据提醒 */}
              <p className="s17-soft">{t("recommend.quickDesc")}</p>
            </div>
          </Card>
        </div>
      }
      aside={
        <div className="s17-stack">
          <Card title={t("notice.title")} tone="warning">
            <div className="s17-stack">
              {/* feat:S17-15 前置提醒；feat:S17-22 熟练错觉提醒 */}
              <h3>{t("notice.prerequisite")}</h3>
              <p>{data.notice.prerequisite}</p>
              <Link className={buttonClass("secondary", "sm")} to={pathTo("S10", { kpId: rec.point_id })}>
                {t("notice.learn")}
              </Link>
              <h3>{t("notice.illusion")}</h3>
              <p>{data.notice.illusion}</p>
            </div>
          </Card>
          <Card title={t("notice.ai")} tone="ai" meta={<AiBadge />}>
            <div className="s17-stack">
              {data.availability === "restricted" || !data.ai.available ? (
                <PageState
                  compact
                  state="restricted"
                  title={t("state.restricted.title")}
                  body={t("state.restricted.body")}
                  action={
                    <Link className={buttonClass()} to={pathTo("S31")}>
                      {t("state.restricted.action")}
                    </Link>
                  }
                />
              ) : data.availability === "insufficient_data" ? (
                <PageState
                  compact
                  state="insufficient_data"
                  title={t("state.insufficient_data.title")}
                  body={t("state.insufficient_data.body")}
                  action={<Button onClick={() => open("newQuestion")}>{t("state.insufficient_data.action")}</Button>}
                />
              ) : (
                <>
                  <p>{t("notice.aiDesc")}</p>
                  <p className="s17-soft">{t("notice.cost", { cost: data.ai.cost_label })}</p>
                  <Button variant="ai" onClick={() => open("tutor")}>
                    {t("tutor")}
                  </Button>
                </>
              )}
              {/* feat:S17-05 题目四级可信度；feat:S17-11 导师出题先做后核 */}
              <p className="s17-soft">{t("notice.evidence")}</p>
            </div>
          </Card>
        </div>
      }
    />
  );
}
export function BanksView({ data, open }: ViewProps) {
  const { t } = useTranslation("S17");
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState<string[]>([]);
  const [display, setDisplay] = useState("list");
  const questions = data.questions.filter(
    (q) => (!query || q.title.includes(query) || q.point_name.includes(query)) && (!tag || q.tag === tag),
  );
  const shown = sort === "title" ? questions.toSorted((a, b) => a.title.localeCompare(b.title, "zh-CN")) : questions;
  const columns: readonly TableColumn<S17Bank>[] = [
    {
      key: "title",
      header: t("banks.name"),
      label: t("banks.name"),
      render: (bank) => (
        <label className="s17-check">
          <input
            type="checkbox"
            checked={selected.includes(bank.id)}
            aria-label={t("banks.select", { title: bank.title })}
            onChange={(e) => setSelected(e.target.checked ? [...selected, bank.id] : selected.filter((id) => id !== bank.id))}
          />
          {bank.title}
        </label>
      ),
    },
    { key: "source", header: t("banks.source"), label: t("banks.source"), render: (bank) => <span>{bank.source}</span> },
    {
      key: "credibility",
      header: t("banks.credibility"),
      label: t("banks.credibility"),
      render: (bank) => <Tag tone={bank.credibility === "reviewed" ? "success" : "outline"}>{credibilityLabel(bank.credibility)}</Tag>,
    },
    { key: "count", header: t("banks.questions"), label: t("banks.questions"), render: (bank) => formatCount(bank.question_count) },
    { key: "done", header: t("banks.done"), label: t("banks.done"), render: (bank) => formatCount(bank.done_count) },
    { key: "accuracy", header: t("banks.accuracy"), label: t("banks.accuracy"), render: (bank) => bank.accuracy_label },
  ];
  return (
    <div className="s17-stack">
      {/* feat:S17-03 我的题库；feat:S17-06 列表、筛选排序、合并与保存 */}
      <Card
        title={t("banks.title")}
        actions={<Button onClick={() => open("bank")}>{t("banks.new")}</Button>}
        footer={
          <div className="s17-row">
            <Button disabled={selected.length === 0} onClick={() => toast(t("soon"))}>
              {t("banks.merge")}
            </Button>
            <Button onClick={() => open("settings")}>{t("settings")}</Button>
          </div>
        }
      >
        <DataTable caption={t("banks.title")} rows={data.banks} columns={columns} rowKey={(row) => row.id} stackOnNarrow />
      </Card>
      <Card
        title={t("banks.filter")}
        actions={
          <Button size="sm" onClick={() => toast(t("soon"))}>
            {t("banks.saveFilter")}
          </Button>
        }
      >
        <div className="s17-stack">
          <label className="s17-field">
            <span>{t("banks.search")}</span>
            <input className="s17-input" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {/* feat:S17-23 私有标签用于筛选与组卷 */}
          <div className="s17-row">
            <label className="s17-field">
              {t("banks.tag")}
              <select aria-label={t("banks.tag")} className="s17-input" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">{t("banks.tagAll")}</option>
                {[...new Set(data.questions.map((q) => q.tag))].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="s17-field">
              {t("banks.sort")}
              <select aria-label={t("banks.sort")} className="s17-input" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recent">{t("banks.sortRecent")}</option>
                <option value="title">{t("banks.sortTitle")}</option>
              </select>
            </label>
            <Button onClick={() => toast(t("soon"))}>{t("banks.tagAction")}</Button>
          </div>
          <Segmented
            label={t("banks.display")}
            value={display}
            onChange={setDisplay}
            options={[
              { value: "list", label: t("banks.list") },
              { value: "paper", label: t("banks.paper") },
            ]}
          />
          {display === "paper" && (
            <>
              <h3>{t("banks.section")}</h3>
              <p className="s17-soft">{t("banks.sectionDesc")}</p>
            </>
          )}
          {shown.length === 0 ? (
            <p>{t("banks.none")}</p>
          ) : (
            shown.map((q) => (
              <Card
                key={q.id}
                title={q.type_label}
                headingLevel={3}
                meta={<Tag>{credibilityLabel(q.credibility)}</Tag>}
                actions={
                  <Button size="sm" onClick={() => open("newQuestion")}>
                    {t("banks.edit")}
                  </Button>
                }
              >
                <div className="s17-stack">
                  <p>{q.title}</p>
                  <div className="s17-row">
                    {/* feat:S17-07 题与知识点关联强度；feat:S17-16 仅审定题显示群体正确率 */}
                    <Link to={pathTo("S10", { kpId: q.point_id })}>{q.point_name}</Link>
                    <Tag>{q.tag}</Tag>
                    {q.credibility === "reviewed" && <span className="s17-soft">{q.peer_accuracy_label}</span>}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>
      {/* feat:S17-08 四个组卷预设与四步；feat:S17-13 手动组卷与打印 */}
      <Card
        title={t("banks.preset")}
        actions={
          <div className="s17-row">
            <Button variant="primary" onClick={() => open("auto")}>
              {t("banks.auto")}
            </Button>
            <Button onClick={() => open("manual")}>{t("banks.manual")}</Button>
          </div>
        }
      >
        <div className="s17-card-grid @tablet:grid-cols-2 @content-md:grid-cols-3">
          {data.presets.map((preset) => (
            <Card key={preset.id} title={preset.title} headingLevel={3}>
              <div className="s17-stack">
                <p className="s17-soft">{preset.description}</p>
                <p>
                  {t("count", { n: formatCount(preset.question_count) })} · {formatDuration(preset.minutes)}
                </p>
                <Button onClick={() => open("auto")}>{t("form.create")}</Button>
              </div>
            </Card>
          ))}
        </div>
      </Card>
      <Card title={t("banks.trust")}>
        <p className="s17-soft">{t("banks.trustDesc")}</p>
      </Card>
    </div>
  );
}
export function RecordsView({ data }: ViewProps) {
  const { t } = useTranslation("S17");
  // feat:S17-09 历次练习可回看续做，显示当时档位快照
  return (
    <Card title={t("records.title")}>
      {data.data_source === "sample" && <p className="mb-3 text-small text-ink-secondary">{t("records.sampleNotice")}</p>}
      <DataTable
        caption={t("records.title")}
        rows={data.records}
        rowKey={(row) => row.id}
        stackOnNarrow
        columns={[
          {
            key: "title",
            header: t("records.name"),
            label: t("records.name"),
            render: (row) => (
              <div className="s17-stack">
                <strong>{row.title}</strong>
                <Tag tone={row.status === "completed" ? "success" : "warning"}>{t("records." + row.status)}</Tag>
              </div>
            ),
          },
          { key: "day", header: t("records.date"), label: t("records.date"), render: (row) => formatDate(row.day) },
          { key: "progress", header: t("records.progress"), label: t("records.progress"), render: (row) => row.progress_label },
          { key: "accuracy", header: t("records.accuracy"), label: t("records.accuracy"), render: (row) => row.accuracy_label },
          { key: "snapshot", header: t("records.snapshot"), label: t("records.snapshot"), render: (row) => row.mastery_snapshot },
          {
            key: "action",
            header: t("records.action"),
            label: t("records.action"),
            render: (row) => (
              <ExerciseLink sessionId={row.session_id} sample={data.data_source === "sample"}>
                {t(row.status === "in_progress" ? "records.resume" : "records.review")}
              </ExerciseLink>
            ),
          },
        ]}
      />
    </Card>
  );
}
