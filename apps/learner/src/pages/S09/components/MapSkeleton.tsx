// 加载时的骨架：页头一块，左边视图卡、右边几张小卡的轮廓（骨架占位，不用转圈遮住整页，ui-rules 第 4 节）。
import { Columns, Skeleton } from "@exam-prep/ui";

export function MapSkeleton() {
  return (
    <div className="s09-stack">
      <Skeleton title lines={2} />
      <Columns
        main={<Skeleton title lines={8} block />}
        aside={
          <div className="s09-stack">
            <Skeleton title lines={2} block />
            <Skeleton title lines={3} block />
            <Skeleton title lines={3} block />
          </div>
        }
      />
    </div>
  );
}
