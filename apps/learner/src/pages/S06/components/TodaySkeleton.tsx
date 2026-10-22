// 加载时的骨架：左栏英雄区与清单，右栏两张卡片的轮廓（骨架占位，不用转圈遮住整页，ui-rules 第 4 节）。
import { Columns, Skeleton } from "@exam-prep/ui";

export function TodaySkeleton() {
  return (
    <Columns
      main={
        <div className="flex flex-col gap-4">
          <Skeleton lines={2} block />
          <Skeleton title lines={6} block />
        </div>
      }
      aside={
        <div className="flex flex-col gap-4">
          <Skeleton title lines={3} block />
          <Skeleton title lines={3} block />
        </div>
      }
    />
  );
}
