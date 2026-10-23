// 右栏（bk spec 布局：桌面右栏是三个数、计划调整、节点提醒；窄屏排在清单下面）。三个数常驻；计划调整、节点提醒、收件箱有数据才出现
// （首次进入还没有计划调整与收件箱，节点提醒按条件出现）。三个数在手机上折叠成一行摘要，平板与桌面整张显示：
// 用容器查询按页面内容区的宽度切换（≥ 平板断点显示整张），不按设备判断（ui-rules 第 2 节）。
import type { S06TodayHome } from "@exam-prep/contract";
import { InboxCard } from "./InboxCard.tsx";
import { MetricsCard, MetricsSummary } from "./Metrics.tsx";
import { Milestones } from "./Milestones.tsx";
import { PlanAdjust } from "./PlanAdjust.tsx";

export function TodayAside({ data }: { data: S06TodayHome }) {
  return (
    <>
      <div className="@tablet:hidden">
        <MetricsSummary metrics={data.metrics} />
      </div>
      <div className="hidden @tablet:block">
        <MetricsCard metrics={data.metrics} />
      </div>
      {data.adjustments !== undefined && <PlanAdjust adjustments={data.adjustments} today={data.day} />}
      {data.milestones !== undefined && <Milestones milestones={data.milestones} />}
      {data.inbox !== undefined && <InboxCard inbox={data.inbox} />}
    </>
  );
}
