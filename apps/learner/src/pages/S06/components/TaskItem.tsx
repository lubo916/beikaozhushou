// 一条任务：公共任务条（来源、标题、理由、用时、开始或继续），点标题或按钮直达具体位置。
// feat:S06-03 八类任务来源（任务条左上的来源标签）；feat:S06-05 每项任务的理由：模板句加接口给的数字，导师润色过的带 AI 标识；
// feat:S06-19 导师不可用（或额度用完）时接口不给润色句，这里照样显示带数字的模板句，不带标识（errata 第 10 条）。
// feat:S06-07 完成看证据：有证据的完成显示“已完成”，手动勾选只显示“看过”（状态由接口给）。
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { S06Reason, S06Task, TaskStatus } from "@exam-prep/contract";
import { formatPercent, formatScore } from "@exam-prep/shared/format";
import { COPY, TaskStrip, type TaskState } from "@exam-prep/ui";
import { goPath } from "../data.ts";

/** 接口的任务状态对应任务条的显示：进行中显示“继续”。 */
const STATE: Readonly<Record<TaskStatus, TaskState>> = { todo: "todo", in_progress: "doing", done: "done", seen: "seen" };

/** 一条理由：按代码取模板句，数字由接口给（页面只做显示格式）。 */
function ReasonText({ reason }: { reason: S06Reason }) {
  const { t } = useTranslation("S06");
  return (
    <>
      {t(`reason.${reason.kind}`, {
        n: reason.count ?? 0,
        days: reason.days ?? 0,
        gap: reason.gap ?? 0,
        tier: reason.tier ?? "",
        years: reason.years ?? 0,
        times: reason.times ?? 0,
        score: formatScore(reason.score ?? 0),
        rank: reason.rank ?? 0,
        low: formatPercent(reason.low ?? 0),
        high: formatPercent(reason.high ?? 0),
        name: reason.name ?? "",
      })}
    </>
  );
}

export function TaskItem({ item }: { item: S06Task }) {
  const { t } = useTranslation("S06");
  const navigate = useNavigate();
  const { task, polished } = item;
  const path = goPath(item.go);
  const reasons =
    polished === undefined
      ? item.reasons.map((reason, index) => <ReasonText key={`${reason.kind}-${index}`} reason={reason} />)
      : [polished];
  return (
    <TaskStrip
      source={task.source}
      segment={task.segment}
      title={task.title}
      minutes={task.minutes}
      reasons={reasons}
      aiPolished={polished !== undefined}
      state={STATE[task.status]}
      href={path}
      onStart={() => void navigate(path)}
      startLabel={task.status === "in_progress" ? t("list.continue") : COPY.action.start}
    />
  );
}
