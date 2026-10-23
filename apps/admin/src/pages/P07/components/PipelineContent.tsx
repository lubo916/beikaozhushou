import type { P07Pipeline } from "@exam-prep/contract";
import { Columns } from "@exam-prep/ui";
import type { KindFilter } from "../data.ts";
import { MaterialsCard } from "./MaterialsCard.tsx";
import { ProductionsCard } from "./ProductionsCard.tsx";
import { QueueStats } from "./QueueStats.tsx";
import { ReviewDesk } from "./ReviewDesk.tsx";

interface PipelineContentProps {
  readonly data: P07Pipeline;
  readonly kind: KindFilter;
  readonly onKind: (kind: KindFilter) => void;
  readonly onSoon: () => void;
}

/** 正常态与数据不足态的正文：待办数一行，下面左栏审核台与教材处理、右栏解析与卡片生产（容器 ≥ 860 时分两栏）。 */
export function PipelineContent({ data, kind, onKind, onSoon }: PipelineContentProps) {
  return (
    <div className="flex flex-col gap-4">
      <QueueStats queue={data.queue} />
      <Columns
        main={
          <>
            <ReviewDesk data={data} kind={kind} onKind={onKind} onSoon={onSoon} />
            <MaterialsCard data={data} onSoon={onSoon} />
          </>
        }
        aside={<ProductionsCard productions={data.productions} onSoon={onSoon} />}
      />
    </div>
  );
}
