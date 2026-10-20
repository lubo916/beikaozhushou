// 开发工具条（只在开发模式出现，api-rules 第 5 节）：切换演示考试 kj/js/en/ds、强制页面状态 ?state=、时间旅行、重置演示数据；
// 并用生成的钩子读示范接口 /me/context，演示“契约 → 生成的钩子 → 假数据 → 界面”整条链路。文案在 copy.zh-CN.json。
import { useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { isApiError, useGetMeContext } from "@exam-prep/contract";
import { addDays, dayStart } from "@exam-prep/shared/today";
import { PAGE_STATE_CODES, VOCAB } from "@exam-prep/shared/vocab";
import { Button, Card, Segmented } from "@exam-prep/ui";
import { shiftDays } from "../clock.ts";
import type { DevControl } from "../control.ts";
import type { MockDb } from "../db.ts";
import type { DemoExam, DemoFixtures } from "../demo.ts";
import copy from "./copy.zh-CN.json";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole: string, key: string) => String(values[key] ?? whole));
}

function examLabel(exam: DemoExam): string {
  return `${exam.key} ${exam.profile.short_name ?? exam.profile.name}`;
}

/** 改 ?state= 后整页重新打开：页面与接口层读到的是同一个状态。 */
function applyState(code: string): void {
  const url = new URL(window.location.href);
  if (code === "normal") url.searchParams.delete("state");
  else url.searchParams.set("state", code);
  window.location.assign(url.toString());
}

function ContextLine() {
  const query = useGetMeContext();
  if (query.isPending) return <p>{copy.contextLoading}</p>;
  if (query.isError) {
    const code = isApiError(query.error) ? query.error.code : String(query.error);
    return <p>{fill(copy.contextError, { code })}</p>;
  }
  const data = query.data;
  const goal = data?.goal;
  if (data === undefined || goal === undefined) return <p>{copy.contextEmpty}</p>;
  const values = { user: data.user.display_name, exam: goal.exam_name, today: data.today, days: goal.days_to_target };
  return <p>{fill(copy.context, values)}</p>;
}

export interface DevToolbarProps {
  readonly control: DevControl;
  readonly db: MockDb;
  readonly fixtures: DemoFixtures;
  readonly failure: string | null;
}

export function DevToolbar({ control, db, fixtures, failure }: DevToolbarProps) {
  const [open, setOpen] = useState(false);
  useSyncExternalStore(control.subscribe, control.version);
  const queryClient = useQueryClient();
  const settings = db.daySettings();
  const now = control.now();
  const day = db.learningDay(now);
  const run = (act: () => void): void => {
    act();
    void queryClient.invalidateQueries();
  };

  if (!open) {
    return (
      <div className="fixed bottom-[0] left-[0] z-50 p-2">
        <Button size="sm" onClick={() => setOpen(true)}>
          {copy.toggle}
        </Button>
      </div>
    );
  }
  const examOptions = fixtures.exams.map((exam) => ({ value: exam.key, label: examLabel(exam) }));
  const chooseExam = (key: string) => run(() => control.setExam(key));
  const real = [...control.realDomains];
  const actions = [
    { label: copy.prevDay, act: () => shiftDays(control, settings, -1) },
    { label: copy.nextDay, act: () => shiftDays(control, settings, 1) },
    { label: copy.nextHour, act: () => control.travelTo(now + HOUR_MS) },
    { label: copy.toBoundary, act: () => control.travelTo(dayStart(addDays(day, 1), settings).getTime() - MINUTE_MS) },
    { label: copy.resetClock, act: () => control.resetClock() },
    { label: copy.resetData, act: () => db.reset() },
  ];
  return (
    <div className="fixed bottom-[0] left-[0] z-50 p-2">
      <Card
        title={copy.title}
        actions={
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            {copy.close}
          </Button>
        }
      >
        {failure !== null && <p>{fill(copy.mockOff, { reason: failure })}</p>}
        <Segmented label={copy.exam} size="sm" options={examOptions} value={control.examKey()} onChange={chooseExam} />
        <label className="flex flex-wrap gap-2">
          {copy.state}
          <select value={control.forcedState()} onChange={(event) => applyState(event.target.value)}>
            {PAGE_STATE_CODES.map((code) => (
              <option key={code} value={code}>
                {VOCAB.page_state[code]}
              </option>
            ))}
          </select>
        </label>
        <p>{fill(copy.clock, { now: new Date(now).toISOString(), zone: settings.timeZone, day })}</p>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action.label} size="sm" variant="ghost" onClick={() => run(action.act)}>
              {action.label}
            </Button>
          ))}
        </div>
        <p>{real.length > 0 ? fill(copy.real, { domains: real.join("、") }) : copy.realNone}</p>
        <ContextLine />
        <p>{copy.sampleNote}</p>
      </Card>
    </div>
  );
}
