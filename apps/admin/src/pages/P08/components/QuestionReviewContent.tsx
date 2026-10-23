import type { P08QuestionReview } from "@exam-prep/contract";
import { Columns } from "@exam-prep/ui";
import type { OriginFilter } from "../data.ts";
import { QualityChecksCard } from "./QualityChecksCard.tsx";
import { ReportsCard } from "./ReportsCard.tsx";
import { ReviewQueueCard } from "./ReviewQueueCard.tsx";
import { VariantPoolCard } from "./VariantPoolCard.tsx";

interface QuestionReviewContentProps {
  readonly data: P08QuestionReview;
  readonly origin: OriginFilter;
  readonly onOrigin: (origin: OriginFilter) => void;
  readonly onSoon: () => void;
}

/** 正常态与数据不足态的正文：左栏审核队列、七道质检与变式题池，右栏报错闭环（容器 ≥ 860 时分两栏）。 */
export function QuestionReviewContent({ data, origin, onOrigin, onSoon }: QuestionReviewContentProps) {
  return (
    <Columns
      main={
        <>
          <ReviewQueueCard data={data} origin={origin} onOrigin={onOrigin} onSoon={onSoon} />
          <QualityChecksCard checks={data.checks} />
          <VariantPoolCard data={data} onSoon={onSoon} />
        </>
      }
      aside={<ReportsCard data={data} onSoon={onSoon} />}
    />
  );
}
