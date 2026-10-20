// 时间旅行按学习日挪（data-model.md 硬规则：所有跨天逻辑共用一个“今天”函数）：挪到 n 个学习日后的同一当地钟点。
import { addDays, dayStart, today, type DaySettings } from "@exam-prep/shared/today";
import type { DevControl } from "./control.ts";

export function shiftDays(control: DevControl, settings: DaySettings, days: number): void {
  const now = control.now();
  const day = today(now, settings);
  const intoDay = now - dayStart(day, settings).getTime();
  control.travelTo(dayStart(addDays(day, days), settings).getTime() + intoDay);
}
