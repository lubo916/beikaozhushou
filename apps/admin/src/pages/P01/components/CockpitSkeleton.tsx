import { Columns, Skeleton } from "@exam-prep/ui";

/** 加载时的骨架：与正常态同样的块面，不用转圈遮住整页。 */
export function CockpitSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton block />
      <Columns
        main={
          <>
            <Skeleton title lines={4} />
            <Skeleton title lines={5} />
          </>
        }
        aside={<Skeleton title lines={4} />}
      />
    </div>
  );
}
