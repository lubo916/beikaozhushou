import { Columns, Skeleton } from "@exam-prep/ui";

/** 加载时的骨架：与正常态同样的块面，不用转圈遮住整页。 */
export function ImpactSkeleton() {
  return <Columns main={<Skeleton title lines={5} />} aside={<Skeleton title lines={3} />} />;
}
