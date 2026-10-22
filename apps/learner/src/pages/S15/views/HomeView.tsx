import { useState, type ClipboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S15ReviewHome } from "@exam-prep/contract";
import { formatCount, formatDate, formatDuration, formatPercent, markAiGenerated } from "@exam-prep/shared/format";
import {
  AiContent,
  Banner,
  Button,
  Card,
  Columns,
  DataTable,
  Dialog,
  KeyValueList,
  Stat,
  StatGroup,
  Tabs,
  Tag,
  buttonClass,
} from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

type Tab = "today" | "groups" | "pending" | "calendar";
export const CARD_KINDS = ["qa", "cloze", "comparison", "number", "ordering", "diagram", "context", "audio", "mnemonic"] as const;
export function HomeView({ data, onStart }: { data: S15ReviewHome; onStart: () => void }) {
  const { t } = useTranslation("S15");
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("today");
  const [editing, setEditing] = useState<S15ReviewHome["pending_cards"][number] | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const soon = () => toast(t("soon"));
  function copyGenerated(event: ClipboardEvent<HTMLTextAreaElement>) {
    const input = event.currentTarget;
    const selected = input.value.slice(input.selectionStart, input.selectionEnd);
    if (!selected) return;
    event.preventDefault();
    event.stopPropagation();
    event.clipboardData.setData("text/plain", markAiGenerated(selected));
  }
  const itemCount = (n: number) => formatCount(n, t("queue.unit"));
  return (
    <>
      <Tabs
        label={t("tabs.label")}
        value={tab}
        onChange={setTab}
        items={(["today", "groups", "pending", "calendar"] as const).map((key) => ({ key, label: t(`tabs.${key}`) }))}
      >
        {tab === "today" && (
          <Columns
            main={
              <div className="flex flex-col gap-4">
                {/* feat:S15-01 到期数、新卡数、按个人速度估算的用时全部由接口返回。 */}
                <Card title={t("queue.title")} tone="brand" footer={<Button onClick={onStart}>{t("queue.start")}</Button>}>
                  <StatGroup>
                    <Stat label={t("queue.due")} value={formatCount(data.queue.due)} unit={t("queue.unit")} tone="brand" />
                    <Stat label={t("queue.new")} value={formatCount(data.queue.new_cards)} unit={t("queue.unit")} />
                    <Stat label={t("queue.minutes")} value={formatDuration(data.queue.minutes)} />
                  </StatGroup>
                  <p className="mt-3 text-small text-ink-secondary">{t("queue.hint")}</p>
                  {/* feat:S15-17 选忘了的内容当天稍后再出现，不由前端计算重学计划。 */}
                  <p className="mt-2 text-small text-status-warning">{t("queue.relearning", { n: formatCount(data.queue.relearning) })}</p>
                </Card>
                {/* feat:S15-03 每个在学知识点自动具有知识点回忆卡。 */}
                <Card title={t("queue.auto")}>
                  <p>{t("queue.auto_body")}</p>
                </Card>
                {/* feat:S15-04 多卡型；呈现与制卡选择覆盖九种卡型。 */}
                <Card title={t("queue.types")}>
                  <div className="flex flex-wrap gap-2">
                    {CARD_KINDS.map((kind) => (
                      <Tag key={kind}>{t(`kind.${kind}`)}</Tag>
                    ))}
                  </div>
                </Card>
              </div>
            }
            aside={
              <div className="flex flex-col gap-4">
                {/* feat:S15-14 保持率和负荷由接口给，不在页面推算。 */}
                <Card title={t("memory.title")}>
                  {data.state !== "insufficient_data" ? (
                    <StatGroup>
                      <Stat label={t("memory.retention")} value={formatPercent(data.memory.retention)} tone="success" />
                      <Stat label={t("memory.target")} value={formatPercent(data.memory.target_retention)} />
                    </StatGroup>
                  ) : (
                    <p className="text-small text-ink-secondary">{t("state.insufficient_data.title")}</p>
                  )}
                  <KeyValueList
                    items={[
                      { key: "load", label: t("memory.load"), value: itemCount(data.memory.daily_load) },
                      {
                        key: "warning",
                        label: t("memory.warning"),
                        value: t(
                          data.state === "insufficient_data"
                            ? "state.insufficient_data.title"
                            : data.memory.warning
                              ? "memory.warning_yes"
                              : "memory.warning_no",
                        ),
                      },
                    ]}
                  />
                  <p className="mt-3 text-small text-ink-secondary">{t("memory.impact")}</p>
                  <Link to={pathTo("S33")} className={buttonClass("ghost", "sm")}>
                    {t("settings")}
                  </Link>
                </Card>
                {/* feat:S15-07 目标日感知调度；feat:S15-08 负荷平滑与积压保护。 */}
                <Card title={t("policy.title")}>
                  <p>{t("policy.target")}</p>
                  <p className="mt-3">{t("policy.cap", { n: formatCount(data.policy.daily_cap) })}</p>
                  {/* feat:S15-15 考前保温。 */}
                  <p className="mt-3">{t("policy.warm")}</p>
                  <Button variant="ghost" size="sm" onClick={soon}>
                    {t("policy.warm_action")}
                  </Button>
                </Card>
                {/* feat:S15-16 缓存与离线同步能力由后端接入，当前明确说明演示边界。 */}
                <Banner title={t("policy.offline")}>{t("policy.offline_body")}</Banner>
              </div>
            }
          />
        )}
        {/* feat:S15-12 按知识点分组，卡组状态分布与暂停、埋藏、编辑入口。 */}
        {tab === "groups" && (
          <Card title={t("groups.title")}>
            <ul className="flex flex-col gap-4">
              {data.groups.map((group) => (
                <li key={group.id} className="rounded-sm border border-line-soft p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold">{group.title}</h3>
                    <Tag>{t(`groups.${group.status}`)}</Tag>
                  </div>
                  <p className="mt-2 text-small text-ink-secondary">
                    {t("groups.total", { n: formatCount(group.total) })} · {t("groups.due", { n: formatCount(group.due) })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={soon}>
                      {t(group.status === "active" ? "groups.pause" : "groups.resume")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={soon}>
                      {t("groups.bury")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={soon}>
                      {t("groups.edit")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {/* feat:S15-06 确认前不入队；feat:S15-13 反复混淆时生成辨析对比卡。 */}
        {tab === "pending" && (
          <div className="flex flex-col gap-4">
            <Banner title={t("pending.title")} tone="ai">
              {t("pending.hint")}
              <p>{t("pending.filter")}</p>
            </Banner>
            {data.pending_cards.map((card) => (
              <Card
                key={card.id}
                title={card.card_type}
                footer={
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={soon}>{t("pending.accept")}</Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(card);
                        setFront(card.front);
                        setBack(card.back);
                      }}
                    >
                      {t("pending.edit")}
                    </Button>
                    <Button variant="ghost" onClick={soon}>
                      {t("pending.discard")}
                    </Button>
                  </div>
                }
              >
                <AiContent note={t("pending.origin", { source: card.source_title })}>
                  <h3 className="font-bold">{card.front}</h3>
                  <p className="mt-3 whitespace-pre-line">{card.back}</p>
                </AiContent>
              </Card>
            ))}
          </div>
        )}
        {/* feat:S15-10 日期使用用户学习日，不做UTC时区偏移。 */}
        {tab === "calendar" && (
          <Card title={t("calendar.title")}>
            <p className="mb-4 text-small text-ink-secondary">{t("calendar.hint")}</p>
            <DataTable
              caption={t("calendar.title")}
              stackOnNarrow
              rows={data.calendar}
              rowKey={(row) => row.day}
              columns={[
                { key: "day", header: t("calendar.day"), render: (row) => formatDate(row.day, { weekday: true }) },
                { key: "due", header: t("calendar.due"), render: (row) => itemCount(row.due) },
                { key: "completed", header: t("calendar.completed"), render: (row) => itemCount(row.completed) },
                {
                  key: "status",
                  header: t("calendar.status"),
                  render: (row) => (
                    <Tag tone={row.overloaded ? "warning" : "success"}>{t(row.overloaded ? "calendar.overloaded" : "calendar.normal")}</Tag>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </Tabs>
      <Dialog
        open={editing !== null}
        title={t("pending.edit_title")}
        onClose={() => setEditing(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {t("pending.cancel")}
            </Button>
            <Button onClick={soon}>{t("pending.save")}</Button>
          </>
        }
      >
        <AiContent note={t("pending.hint")}>
          <div className="flex flex-col gap-4">
            <label>
              {t("pending.front")}
              <textarea
                className="mt-2 w-full rounded-sm border border-line-strong bg-bg-surface p-3"
                onCopy={copyGenerated}
                value={front}
                onChange={(event) => setFront(event.target.value)}
              />
            </label>
            <label>
              {t("pending.back")}
              <textarea
                className="mt-2 w-full rounded-sm border border-line-strong bg-bg-surface p-3"
                onCopy={copyGenerated}
                value={back}
                onChange={(event) => setBack(event.target.value)}
              />
            </label>
          </div>
        </AiContent>
      </Dialog>
    </>
  );
}
