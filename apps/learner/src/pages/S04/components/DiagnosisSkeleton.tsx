// 加载时的骨架：页头、三张方式卡、两张说明卡的位置（不用转圈遮住整页，ui-rules 第 4 节）。
import { Skeleton } from "@exam-prep/ui";

const HEADER_LINES = 2;
const CARD_LINES = 4;

export function DiagnosisSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton title lines={HEADER_LINES} />
      <div className="grid gap-3 @tablet:grid-cols-3">
        <Skeleton block />
        <Skeleton block />
        <Skeleton block />
      </div>
      <div className="grid gap-4 @tablet:grid-cols-2">
        <Skeleton lines={CARD_LINES} />
        <Skeleton lines={CARD_LINES} />
      </div>
    </div>
  );
}
