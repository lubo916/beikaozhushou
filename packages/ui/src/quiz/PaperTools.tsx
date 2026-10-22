// 纸笔动作（共用作答组件，S18-05）：草稿、划掉选项、计算器、标记；题号导航见 QuestionNav。
// 草稿内容由页面保存（讲解与追问时一并带上，S18-13）；揭晓后划掉选项不再可用，草稿与计算器照常。
import { useState } from "react";
import { Button } from "../basic/Button.tsx";
import { Dialog, Sheet } from "../basic/Overlay.tsx";
import { cx } from "../lib/cx.ts";
import { CALC_START, pressKey, type CalcState } from "./calculator.ts";
import copy from "./copy.zh-CN.json";

export interface PaperToolsProps {
  draft: string;
  onDraft: (text: string) => void;
  strikeMode: boolean;
  onStrikeMode: (on: boolean) => void;
  /** 有选项可划（选择类作答）。 */
  canStrike: boolean;
  flagged: boolean;
  onFlag: () => void;
  locked?: boolean | undefined;
  className?: string | undefined;
}

const KEYS: readonly string[] = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];

const SHOWN: Readonly<Record<string, string>> = { "/": "÷", "*": "×", "-": "−" };

const NAMES: Readonly<Record<string, string>> = {
  "+": copy.calc.plus,
  "-": copy.calc.minus,
  "*": copy.calc.times,
  "/": copy.calc.divide,
  "=": copy.calc.equals,
  ".": copy.calc.point,
};

export function Calculator() {
  const [state, setState] = useState<CalcState>(CALC_START);
  return (
    <div className="flex flex-col gap-2">
      <output aria-live="polite" className="rounded-md bg-bg-sunk px-3 py-2 text-right text-title tabular-nums">
        {state.error ? copy.tools.calc_error : state.display}
      </output>
      <div className="grid grid-cols-4 gap-2">
        {KEYS.map((key) => (
          <Button key={key} aria-label={NAMES[key]} onClick={() => setState((current) => pressKey(current, key))}>
            {SHOWN[key] ?? key}
          </Button>
        ))}
        <Button className="col-span-4" onClick={() => setState(CALC_START)}>
          {copy.tools.calc_clear}
        </Button>
      </div>
    </div>
  );
}

export function PaperTools({
  draft,
  onDraft,
  strikeMode,
  onStrikeMode,
  canStrike,
  flagged,
  onFlag,
  locked = false,
  className,
}: PaperToolsProps) {
  const [draftOpen, setDraftOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  return (
    <div role="toolbar" aria-label={copy.tools.label} className={cx("flex flex-wrap gap-2", className)}>
      <Button size="sm" onClick={() => setDraftOpen(true)}>
        {copy.tools.draft}
      </Button>
      {canStrike && !locked && (
        <Button size="sm" aria-pressed={strikeMode} onClick={() => onStrikeMode(!strikeMode)}>
          {strikeMode ? copy.tools.strike_on : copy.tools.strike}
        </Button>
      )}
      <Button size="sm" onClick={() => setCalcOpen(true)}>
        {copy.tools.calculator}
      </Button>
      <Button size="sm" aria-pressed={flagged} onClick={onFlag}>
        {flagged ? copy.tools.flagged : copy.tools.flag}
      </Button>
      <Sheet open={draftOpen} onClose={() => setDraftOpen(false)} title={copy.tools.draft_title}>
        <textarea
          aria-label={copy.tools.draft_title}
          value={draft}
          placeholder={copy.tools.draft_placeholder}
          onChange={(event) => onDraft(event.target.value)}
          className="min-h-60 w-full rounded-md border border-line-strong bg-bg-surface px-3 py-2 text-ink-primary"
        />
      </Sheet>
      <Dialog open={calcOpen} onClose={() => setCalcOpen(false)} title={copy.tools.calc_title}>
        <Calculator />
      </Dialog>
    </div>
  );
}
