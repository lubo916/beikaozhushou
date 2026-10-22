// 加载时的骨架：页头一块，左右两栏各几张卡片的轮廓（骨架占位，不用转圈遮住整页，ui-rules 第 4 节）。
import { Columns, Skeleton } from "@exam-prep/ui";

export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton title lines={2} />
      <Columns
        main={
          <div className="flex flex-col gap-4">
            <Skeleton title lines={4} block />
            <Skeleton title lines={3} block />
            <Skeleton title lines={3} block />
          </div>
        }
        aside={
          <div className="flex flex-col gap-4">
            <Skeleton title lines={3} block />
            <Skeleton title lines={4} block />
          </div>
        }
      />
    </div>
  );
}
