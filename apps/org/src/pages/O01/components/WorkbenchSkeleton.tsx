import { Card, Skeleton } from "@exam-prep/ui";
export function WorkbenchSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton lines={2} />
      <Card>
        <Skeleton lines={4} />
      </Card>
      <Card>
        <Skeleton lines={5} />
      </Card>
    </div>
  );
}
