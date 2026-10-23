import { Columns, Skeleton } from "@exam-prep/ui";

/** 加载时的骨架：与正常态同样的块面，不用转圈遮住整页。 */
export function PipelineSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton block />
        <Skeleton block />
      </div>
      <Columns
        main={
          <>
            <Skeleton title lines={6} />
            <Skeleton title lines={4} />
          </>
        }
        aside={<Skeleton title lines={5} />}
      />
    </div>
  );
}
