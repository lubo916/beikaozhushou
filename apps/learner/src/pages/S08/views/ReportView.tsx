import type { S08Report } from "@exam-prep/contract";
import { Columns } from "@exam-prep/ui";
import { ReportData } from "../components/ReportData.tsx";
import { Reflection } from "../components/Reflection.tsx";
// feat:S08-11 周、月和轮次采用同一结构，数据完全由周期接口决定。
export function ReportView({ data, offline }: { data: S08Report; offline: boolean }) {
  return (
    <Columns main={<ReportData data={data} />} aside={<Reflection key={`${data.exam_id}-${data.view}`} data={data} offline={offline} />} />
  );
}
