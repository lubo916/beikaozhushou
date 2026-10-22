// 英雄区：日期、轮次与周、一句话、继续、我只有 N 分钟、倒计时（bk spec 布局：桌面左栏最上面，手机也在最上面）。
// 一句话是模板句加接口给的数：件数、分钟数、已完成几件都由接口算好（红线 5）；六个视图的句子与按钮各不相同。
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S06TodayHome } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { formatCount, formatDate, formatDuration } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { Button, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { goPath, nextTask } from "../data.ts";
import { TomorrowDialog } from "./TomorrowDialog.tsx";

export interface HeroProps {
  readonly data: S06TodayHome;
  /** 空态只留日期、轮次与倒计时（空态保留页头，F08-Q2）。 */
  readonly bare?: boolean | undefined;
}

/** 深色底上的次要按钮：浅色描边与文字（只用令牌）。 */
const ON_DARK = "border border-brand-primary-soft bg-transparent text-bg-surface";

export function Hero({ data, bare = false }: HeroProps) {
  const { t } = useTranslation("S06");
  const toast = useToast();
  const [tomorrow, setTomorrow] = useState(false);
  const { summary, countdown, round } = data;
  const next = nextTask(data);
  const duration = formatDuration(summary.minutes_total);
  let when: string | undefined;
  if (round !== undefined) when = t("hero.round", { index: round.index, name: round.name, week: round.week });
  else if (data.day_no !== undefined) when = t("hero.day_no", { n: data.day_no });

  const counts = { tasks: summary.task_count, done: summary.done_count, duration };
  let line = t("hero.line.normal", counts);
  if (next !== undefined) line += t("hero.line.next", { task: next.task.title });
  if (data.view === "first") line = t("hero.line.first", counts);
  if (data.view === "done") line = t("hero.line.done", { tasks: summary.task_count, spent: formatDuration(summary.minutes_spent) });
  if (data.view === "off") line = t("hero.line.off", { duration });
  if (data.view === "back") line = t("hero.line.back", { duration });

  const start = (label: string) =>
    next === undefined ? null : (
      // feat:S06-06 一键开始与自动串联：直达这一项的具体位置；做完回到今日，“继续”自动指向下一项（下一项由接口给）
      <Link to={goPath(next.go)} className={buttonClass("secondary")}>
        {label}
      </Link>
    );
  const source = next === undefined ? "" : VOCAB.task_source[next.task.source];
  let actions: ReactNode;
  if (data.view === "done") {
    // feat:S06-16 全部完成态：给“明天第一件事”预览与可选加练，不留空白
    actions = data.tomorrow_first !== undefined && (
      <Button className={ON_DARK} onClick={() => setTomorrow(true)}>
        {t("hero.tomorrow")}
      </Button>
    );
  } else if (data.view === "off") {
    // feat:S06-17 今天不可学态：只做到期复习的最小版；改回可学日是写操作，接后端前提示“即将上线”
    actions = (
      <>
        {start(t("hero.off_start", { duration }))}
        <Button className={ON_DARK} onClick={() => toast(t("soon.off_cancel"))}>
          {t("hero.off_cancel")}
        </Button>
      </>
    );
  } else if (data.view === "back") {
    // feat:S06-18 中断回归态：先给一个很短的启动任务（重组方案以提议给出，在 U06b）
    actions = start(t("hero.back_start", { duration }));
  } else {
    actions = (
      <>
        {start(t(next?.task.status === "in_progress" ? "hero.continue" : "hero.start", { source }))}
        {/* feat:S06-08 短时重组：时长是参数 plan.short_mode.minutes；即时重组要计划引擎，接后端前提示“即将上线” */}
        <Button className={ON_DARK} onClick={() => toast(t("soon.short"))}>
          {t("hero.short", { minutes: param("plan.short_mode.minutes") })}
        </Button>
      </>
    );
  }

  return (
    <section aria-label={t("hero.label")} className="rounded-md bg-brand-primary-ink p-5 text-bg-surface">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-[0] flex-1">
          {/* feat:S06-01 倒计时与轮次：日期、当前轮次与周次（多目标的切换在顶栏的目标切换里） */}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-brand-primary-soft">
            <span>{formatDate(data.day, { weekday: true })}</span>
            {when !== undefined && <span>{when}</span>}
            {data.data_source === "sample" && (
              <Tag size="sm" tone="warning">
                {t("sample")}
              </Tag>
            )}
          </p>
          {!bare && <p className="mt-2 text-title font-bold leading-body">{line}</p>}
        </div>
        <p className="shrink-0 text-right">
          <span className="block font-serif text-title font-bold tabular-nums">{formatCount(countdown.days)}</span>
          <span className="text-small text-brand-primary-soft">
            {t("hero.countdown_unit")}
            {countdown.estimated && t("hero.countdown_estimated")}
          </span>
        </p>
      </div>
      {!bare && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      {data.tomorrow_first !== undefined && (
        <TomorrowDialog open={tomorrow} preview={data.tomorrow_first} onClose={() => setTomorrow(false)} />
      )}
    </section>
  );
}
