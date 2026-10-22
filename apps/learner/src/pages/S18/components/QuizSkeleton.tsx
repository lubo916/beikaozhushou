// 加载时的骨架：左边题目卡、右边本组进度，和正常态的布局一样（ui-rules 第 4 节：骨架占位，不用转圈遮住整页）。
import { Card, Columns, Skeleton } from "@exam-prep/ui";

export function QuizSkeleton() {
  return (
    <Columns
      main={
        <Card>
          <Skeleton title lines={6} block />
        </Card>
      }
      aside={
        <Card>
          <Skeleton lines={4} />
        </Card>
      }
    />
  );
}
