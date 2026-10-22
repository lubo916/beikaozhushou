// S18-22 每题用时：切走暂停、切回续计；提交固定本次用时，失败后再继续。
// 只记录本次打开期间的计时，已保存的作答用时仍以接口为准。
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const MS_PER_SECOND = 1000;

interface QuestionClock {
  elapsedMs: number;
  startedAt: number | null;
  submitted: boolean;
}

function elapsedAt(clock: QuestionClock, now: number): number {
  return clock.elapsedMs + (clock.startedAt === null ? 0 : Math.max(0, now - clock.startedAt));
}

function pause(clock: QuestionClock, now: number): void {
  clock.elapsedMs = elapsedAt(clock, now);
  clock.startedAt = null;
}

/** 每秒刷新由 QuizRunner 唯一的 interval 调用，切题与提交不会重建 interval。 */
export function useQuestionTiming(key: string | undefined, savedDurationMs: number | undefined, running: boolean) {
  const clocks = useRef(new Map<string, QuestionClock>());
  const active = useRef<{ key: string | undefined; running: boolean }>({ key: undefined, running: false });
  const [seconds, setSeconds] = useState(0);

  const refresh = useCallback(() => {
    const selected = active.current.key;
    const clock = selected === undefined ? undefined : clocks.current.get(selected);
    setSeconds(clock === undefined ? 0 : Math.floor(elapsedAt(clock, Date.now()) / MS_PER_SECOND));
  }, []);

  useLayoutEffect(() => {
    active.current = { key, running };
    if (key === undefined) {
      refresh();
      return;
    }
    let clock = clocks.current.get(key);
    if (clock === undefined) {
      clock = { elapsedMs: savedDurationMs ?? 0, startedAt: null, submitted: false };
      clocks.current.set(key, clock);
    }
    if (!running) {
      pause(clock, Date.now());
      if (savedDurationMs !== undefined) clock.elapsedMs = savedDurationMs;
    } else if (!clock.submitted) {
      clock.startedAt ??= Date.now();
    }
    refresh();
    // 切走、服务器更新作答状态和卸载时，都结清当前这段；不把别题时间算进来。
    return () => {
      pause(clock, Date.now());
    };
  }, [key, savedDurationMs, running, refresh]);

  const pauseForSubmit = useCallback(() => {
    const clock = key === undefined ? undefined : clocks.current.get(key);
    if (clock === undefined) return 0;
    pause(clock, Date.now());
    clock.submitted = true;
    refresh();
    return clock.elapsedMs;
  }, [key, refresh]);

  const resumeAfterFailure = useCallback(() => {
    const clock = key === undefined ? undefined : clocks.current.get(key);
    if (clock === undefined) return;
    clock.submitted = false;
    if (active.current.key === key && active.current.running) clock.startedAt = Date.now();
    refresh();
  }, [key, refresh]);

  return { seconds, refresh, pauseForSubmit, resumeAfterFailure };
}
