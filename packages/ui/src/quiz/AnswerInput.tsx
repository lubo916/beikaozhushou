// 作答区（共用作答组件，S18-01 九种作答形态）：选择（单选、多选、判断、不定项）、填空、匹配排序、计算分步、简答论述、
// 材料组合（材料在题干里，作答带选项走选择、不带走文字）、听力（播放加选择）、口述（录音加要点）、实操自评（逐项打勾）。
// 揭晓后锁定，不能再改（S18-03）；揭晓后的选择题标出正确答案与你选的。只管输入与显示，不判对错。
import { useId } from "react";
import { Button } from "../basic/Button.tsx";
import { fill } from "../lib/copy.ts";
import { cx } from "../lib/cx.ts";
import { choosesOptions, moveItem, setText, toggleOption, type QuizResponse, type QuizShape } from "./answer.ts";
import copy from "./copy.zh-CN.json";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface AnswerInputProps extends QuizShape {
  value: QuizResponse;
  onChange: (value: QuizResponse) => void;
  /** 选择题可以选多个（多选、不定项）。 */
  multiple?: boolean | undefined;
  /** 揭晓后锁定（S18-03）。 */
  locked?: boolean | undefined;
  /** 揭晓后的正确选项（选择类），给了就标出对错。 */
  answer?: readonly number[] | undefined;
  /** 划掉的选项（纸笔动作）；strikeMode 开着时每个选项旁边有“划掉”。 */
  struck?: readonly number[] | undefined;
  strikeMode?: boolean | undefined;
  onStrike?: ((index: number) => void) | undefined;
  /** 听力：播放；口述：录音。由页面接上（还没有的提示即将上线）。 */
  onPlay?: (() => void) | undefined;
  onRecord?: (() => void) | undefined;
  /** 作答区的名称（读屏用）。 */
  label?: string | undefined;
  className?: string | undefined;
}

interface ChoiceListProps {
  readonly options: readonly string[];
  readonly value: QuizResponse;
  readonly onChange: (value: QuizResponse) => void;
  readonly multiple: boolean;
  readonly locked: boolean;
  readonly label: string;
  readonly answer: readonly number[] | undefined;
  readonly struck: readonly number[];
  readonly strikeMode: boolean;
  readonly onStrike: ((index: number) => void) | undefined;
}

function ChoiceList({ options, value, onChange, multiple, locked, label, answer, struck, strikeMode, onStrike }: ChoiceListProps) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{label}</legend>
      {multiple && !locked && <p className="text-small text-ink-secondary">{copy.choice.multiple}</p>}
      {options.map((option, index) => {
        const chosen = value.selected.includes(index);
        const right = answer?.includes(index) === true;
        const isStruck = struck.includes(index);
        const letter = LETTERS.charAt(index);
        const mark = answer === undefined ? null : right ? "right" : chosen ? "wrong" : null;
        return (
          <div key={`${index}-${option}`} className="flex items-stretch gap-2">
            <label
              className={cx(
                "flex min-h-12 flex-1 items-center gap-3 rounded-md border px-4 py-3 focus-within:ring-2 focus-within:ring-brand-primary",
                locked ? "cursor-default" : "cursor-pointer",
                mark === "right" && "border-status-success bg-status-success-soft",
                mark === "wrong" && "border-status-danger bg-status-danger-soft",
                mark === null && (chosen ? "border-brand-primary bg-brand-primary-soft" : "border-line-strong bg-bg-surface"),
              )}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                className="sr-only"
                checked={chosen}
                disabled={locked}
                onChange={() => onChange(toggleOption(value, index, multiple))}
              />
              <span
                aria-hidden="true"
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-small font-bold",
                  chosen ? "border-brand-primary bg-brand-primary text-bg-surface" : "border-line-strong text-ink-secondary",
                )}
              >
                {letter}
              </span>
              <span className={cx("flex-1", isStruck && "text-ink-tertiary line-through")}>{option}</span>
              {mark === "right" && <span className="text-small font-bold text-status-success">{chosen ? copy.choice.mine_right : copy.choice.correct}</span>}
              {mark === "wrong" && <span className="text-small font-bold text-status-danger">{copy.choice.mine}</span>}
            </label>
            {strikeMode && !locked && onStrike !== undefined && (
              <Button
                size="sm"
                variant="ghost"
                aria-pressed={isStruck}
                aria-label={fill(isStruck ? copy.choice.unstrike_named : copy.choice.strike_named, { letter })}
                onClick={() => onStrike(index)}
              >
                {isStruck ? copy.choice.unstrike : copy.choice.strike}
              </Button>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

function partLabel(kind: "fill" | "stepwise", index: number, name: string | undefined): string {
  const n = index + 1;
  if (kind === "stepwise") return name === undefined || name === "" ? fill(copy.stepwise.step, { n }) : fill(copy.stepwise.step_named, { n, name });
  return name === undefined || name === "" ? fill(copy.fill.blank, { n }) : fill(copy.fill.blank_named, { n, name });
}

function TextParts(props: {
  readonly kind: "fill" | "stepwise";
  readonly parts: readonly string[];
  readonly value: QuizResponse;
  readonly onChange: (value: QuizResponse) => void;
  readonly locked: boolean;
}) {
  const { kind, parts, value, onChange, locked } = props;
  const base = useId();
  const slots = parts.length > 0 ? parts : [""];
  return (
    <div className="flex flex-col gap-3">
      {slots.map((part, index) => {
        const id = `${base}-${index}`;
        return (
          <div key={id} className="flex flex-col gap-1">
            <label htmlFor={id} className="text-small text-ink-secondary">
              {partLabel(kind, index, part)}
            </label>
            <input
              id={id}
              type="text"
              autoComplete="off"
              value={value.texts[index] ?? ""}
              readOnly={locked}
              onChange={(event) => onChange(setText(value, index, event.target.value))}
              className="w-full rounded-md border border-line-strong bg-bg-surface px-3 py-2 text-ink-primary"
            />
          </div>
        );
      })}
    </div>
  );
}

function OrderList(props: {
  readonly options: readonly string[];
  readonly parts: readonly string[];
  readonly value: QuizResponse;
  readonly onChange: (value: QuizResponse) => void;
  readonly locked: boolean;
}) {
  const { options, parts, value, onChange, locked } = props;
  const last = value.selected.length - 1;
  return (
    <ol className="flex flex-col gap-2">
      {value.selected.map((optionIndex, position) => {
        const name = options[optionIndex] ?? "";
        return (
          <li key={optionIndex} className="flex flex-wrap items-center gap-2 rounded-md border border-line-strong bg-bg-surface px-3 py-2">
            <span className="shrink-0 text-small text-ink-secondary">{parts[position] ?? fill(copy.order.position, { n: position + 1 })}</span>
            <span className="min-w-[0] flex-1">{name}</span>
            {!locked && (
              <span className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={position === 0}
                  aria-label={fill(copy.order.up_named, { name })}
                  onClick={() => onChange(moveItem(value, position, -1))}
                >
                  {copy.order.up}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={position === last}
                  aria-label={fill(copy.order.down_named, { name })}
                  onClick={() => onChange(moveItem(value, position, 1))}
                >
                  {copy.order.down}
                </Button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Written(props: {
  readonly value: QuizResponse;
  readonly onChange: (value: QuizResponse) => void;
  readonly locked: boolean;
  readonly label: string;
  readonly placeholder: string;
}) {
  const { value, onChange, locked, label, placeholder } = props;
  const text = value.texts[0] ?? "";
  return (
    <div className="flex flex-col gap-1">
      <textarea
        aria-label={label}
        value={text}
        readOnly={locked}
        placeholder={placeholder}
        onChange={(event) => onChange(setText(value, 0, event.target.value))}
        className="min-h-40 w-full rounded-md border border-line-strong bg-bg-surface px-3 py-2 text-ink-primary"
      />
      <p className="text-right text-small text-ink-tertiary">{fill(copy.written.count, { n: text.length })}</p>
    </div>
  );
}

function Checklist(props: {
  readonly parts: readonly string[];
  readonly value: QuizResponse;
  readonly onChange: (value: QuizResponse) => void;
  readonly locked: boolean;
}) {
  const { parts, value, onChange, locked } = props;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-small text-ink-secondary">{copy.practical.title}</legend>
      {parts.map((part, index) => (
        <label key={`${index}-${part}`} className="flex items-center gap-3 rounded-md border border-line-strong bg-bg-surface px-4 py-3">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-brand-primary"
            checked={value.selected.includes(index)}
            disabled={locked}
            onChange={() => onChange(toggleOption(value, index, true))}
          />
          <span>{part}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function AnswerInput(props: AnswerInputProps) {
  const { form, value, onChange, multiple = false, locked = false, label = copy.choice.label, className } = props;
  const options = props.options ?? [];
  const parts = props.parts ?? [];
  const choices = choosesOptions(props) ? (
    <ChoiceList
      options={options}
      value={value}
      onChange={onChange}
      multiple={multiple}
      locked={locked}
      label={label}
      answer={props.answer}
      struck={props.struck ?? []}
      strikeMode={props.strikeMode ?? false}
      onStrike={props.onStrike}
    />
  ) : null;
  const written = <Written value={value} onChange={onChange} locked={locked} label={label} placeholder={copy.written.placeholder} />;
  return (
    <div data-form={form} className={cx("flex flex-col gap-3", className)}>
      {form === "listening" && props.onPlay !== undefined && (
        <Button className="self-start" onClick={props.onPlay}>
          {copy.listening.play}
        </Button>
      )}
      {form === "oral" && props.onRecord !== undefined && !locked && (
        <Button className="self-start" onClick={props.onRecord}>
          {copy.oral.record}
        </Button>
      )}
      {(form === "fill" || form === "stepwise") && <TextParts kind={form} parts={parts} value={value} onChange={onChange} locked={locked} />}
      {form === "match_order" && <OrderList options={options} parts={parts} value={value} onChange={onChange} locked={locked} />}
      {form === "practical_self" && <Checklist parts={parts} value={value} onChange={onChange} locked={locked} />}
      {form === "oral" && <Written value={value} onChange={onChange} locked={locked} label={copy.oral.notes} placeholder={copy.oral.notes} />}
      {(form === "choice" || form === "material" || form === "listening") && (choices ?? written)}
      {form === "written" && written}
    </div>
  );
}
