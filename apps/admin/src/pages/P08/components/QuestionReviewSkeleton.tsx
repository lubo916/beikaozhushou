import { Columns, Skeleton } from "@exam-prep/ui";

/** 加载时的骨架：与正常态同样的块面，不用转圈遮住整页。 */
export function QuestionReviewSkeleton() {
  return (
    <Columns
      main={
        <>
          <Skeleton title lines={5} />
          <Skeleton title lines={4} />
          <Skeleton title lines={4} />
        </>
      }
      aside={<Skeleton title lines={6} />}
    />
  );
}
