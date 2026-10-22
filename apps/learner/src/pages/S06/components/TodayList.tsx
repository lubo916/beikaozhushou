// 今日清单：三段任务条，底部换档与完成口径（bk spec 布局：桌面左栏英雄区下面；手机在英雄区与待确认提议下面）。
// feat:S06-04 排序规则：先做推迟有损失的，再做推迟无损失的（顺序由接口排好，“为什么这样排”里说明）；
// feat:S06-13 巩固段（保底占比由接口给）；feat:S06-14 推进段（按配比模式排序）；feat:S06-15 收尾段（口述回顾）；
// feat:S06-25 周复盘入口：每周一次出现在收尾段末尾，指向复盘与报告（接口给）。
// 任务条用公共的 TaskStrip 与 TaskGroup（ui-rules 第 8 节）。原型里每项下面的说明行、行首的勾选圈与“⋯”菜单公共任务条还没有
// （U06a-Q2＝A，交整合任务补），手动勾选与“今天不想学这个”先放在底部的“手动勾选或剔除”里。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { S06Segment, S06TodayHome } from "@exam-prep/contract";
import { formatDuration, formatPercent } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { Button, Card, PageState, TaskGroup } from "@exam-prep/ui";
import { AdjustDialog } from "./AdjustDialog.tsx";
import { OrderDialog } from "./OrderDialog.tsx";
import { TaskItem } from "./TaskItem.tsx";
import { TierSwitch } from "./TierSwitch.tsx";

function SegmentMeta({ group, data }: { group: S06Segment; data: S06TodayHome }) {
  const { t } = useTranslation("S06");
  const duration = formatDuration(group.minutes);
  // feat:S06-02 时间预算与配比：每段分到的时间、巩固段保底占比与推进段的配比模式都由接口给
  if (group.segment === "consolidate") {
    return (
      <>
        {t("list.consolidate_meta", { ratio: formatPercent(data.budget.floor_ratio), duration })}
        {/* feat:S06-24 到期过多保护：只给最要紧的一批，其余顺延，不显示积压数 */}
        {group.capped && <span className="block text-status-warning">{t("list.capped")}</span>}
      </>
    );
  }
  if (group.segment === "advance") return <>{t("list.advance_meta", { mode: VOCAB.mix_mode[data.budget.mix_mode], duration })}</>;
  return <>{t("list.closing_meta", { duration })}</>;
}

export function TodayList({ data }: { data: S06TodayHome }) {
  const { t } = useTranslation("S06");
  const [why, setWhy] = useState(false);
  const [adjust, setAdjust] = useState(false);
  return (
    <Card
      title={t("list.title")}
      meta={t("list.meta")}
      actions={
        <Button variant="ghost" size="sm" onClick={() => setWhy(true)}>
          {t("list.why")}
        </Button>
      }
      footer={
        <div className="flex flex-col gap-2">
          {data.tiers !== undefined && <TierSwitch tiers={data.tiers} />}
          {/* feat:S06-07 完成看证据：卡片要回忆、题目要作答、阅读要过读后即测；手动勾选只记“看过” */}
          <p className="flex flex-wrap items-center gap-2 text-small text-ink-secondary">
            <span>{t("list.evidence")}</span>
            <Button variant="ghost" size="sm" onClick={() => setAdjust(true)}>
              {t("list.adjust")}
            </Button>
          </p>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 数据不足：前两周按同类考生的典型节奏排（bk spec 七态），清单照常 */}
        {data.pace === "typical" && (
          <PageState state="insufficient_data" compact title={t("state.insufficient_data.title")} body={t("state.insufficient_data.body")} />
        )}
        {data.segments.map((group) => (
          <TaskGroup key={group.segment} segment={group.segment} meta={<SegmentMeta group={group} data={data} />}>
            {group.items.map((item) => (
              <TaskItem key={item.task.id} item={item} />
            ))}
            {group.items.length === 0 && <li className="py-2 text-small text-ink-tertiary">{t("list.empty_segment")}</li>}
          </TaskGroup>
        ))}
      </div>
      <OrderDialog open={why} budget={data.budget} onClose={() => setWhy(false)} />
      <AdjustDialog open={adjust} data={data} onClose={() => setAdjust(false)} />
    </Card>
  );
}
