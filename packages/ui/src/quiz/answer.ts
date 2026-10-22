// 作答的数据形状与判断（U18a 共用作答组件，S04 摸底、S18 做题、S22 模考、错题回炉都用）：九种作答形态（vocabulary.md 第 3 节）
// 在组件里统一成“选了哪些”加“写了什么”，交给接口时再换成 AnswerResponse（selected 选项序号、text 文字）。
// 这里只判断“答完没有、能不能提交”，不判对错（对错、证据都由服务端算，红线 5）。

/** 作答形态九种（术语表 response_form）。 */
export type QuizResponseForm = "choice" | "fill" | "match_order" | "stepwise" | "written" | "material" | "listening" | "oral" | "practical_self";

/** 把握度三档（术语表 confidence）；日常做题不提供“不会”（F01-Q1，勘误第 5 条）。 */
export type QuizConfidence = "sure" | "vague" | "guess";

export const QUIZ_CONFIDENCES: readonly QuizConfidence[] = ["sure", "vague", "guess"];

/** 组件里的作答：选了哪些（选择的选项、排序后的次序、自评勾上的项）与写了什么（每个空、每一步或整段文字）。 */
export interface QuizResponse {
  readonly selected: readonly number[];
  readonly texts: readonly string[];
}

/** 接口里的作答（契约 AnswerResponse）：选择、排序、自评填 selected，文字题填 text。 */
export interface WireResponse {
  selected?: number[];
  text?: string;
}

/** 作答要用到的题目信息：作答形态、选项、各部分名称（填空的空、分步的步、排序的位置、自评的核对项）。 */
export interface QuizShape {
  readonly form: QuizResponseForm;
  readonly options?: readonly string[] | undefined;
  readonly parts?: readonly string[] | undefined;
}

/** 还差哪一步才能提交：先作答，再选把握度。 */
export type SubmitBlocker = "answer" | "confidence";

/** 多段文字（填空、分步）交给接口时用换行隔开。 */
const PART_SEPARATOR = "\n";

/** 这道题是不是“选”出来的：选择题，以及带选项的听力题与材料题。 */
export function choosesOptions(shape: QuizShape): boolean {
  const hasOptions = (shape.options?.length ?? 0) > 0;
  return shape.form === "choice" || ((shape.form === "listening" || shape.form === "material") && hasOptions);
}

/** 要写几段文字：填空与分步按部分数（至少一段），其他文字题一段。 */
export function textSlots(shape: QuizShape): number {
  if (shape.form === "fill" || shape.form === "stepwise") return Math.max(1, shape.parts?.length ?? 0);
  return 1;
}

/** 还没作答时的样子：排序题先按原来的次序摆好，其他都是空的。 */
export function emptyResponse(shape: QuizShape): QuizResponse {
  if (shape.form === "match_order") return { selected: (shape.options ?? []).map((_option, index) => index), texts: [] };
  return { selected: [], texts: [] };
}

/** 答完没有。实操自评可以一项都不勾（如实自评也是作答）。 */
export function isAnswered(shape: QuizShape, response: QuizResponse): boolean {
  if (choosesOptions(shape)) return response.selected.length > 0;
  if (shape.form === "match_order") return response.selected.length > 0 && response.selected.length === (shape.options?.length ?? 0);
  if (shape.form === "practical_self") return true;
  return Array.from({ length: textSlots(shape) }, (_slot, index) => (response.texts[index] ?? "").trim() !== "").every(Boolean);
}

/** 还差哪一步（固定流程：作答 → 选把握度 → 提交 → 揭晓）；都齐了为 null。把握度关着时不用选。 */
export function submitBlocker(shape: QuizShape, response: QuizResponse, confidence: QuizConfidence | null, confidenceOn: boolean): SubmitBlocker | null {
  if (!isAnswered(shape, response)) return "answer";
  if (confidenceOn && confidence === null) return "confidence";
  return null;
}

/** 点一个选项：单选换成它；多选加上或去掉它（按序号排好）。 */
export function toggleOption(response: QuizResponse, index: number, multiple: boolean): QuizResponse {
  if (!multiple) return { ...response, selected: [index] };
  const on = response.selected.includes(index);
  const selected = on ? response.selected.filter((value) => value !== index) : [...response.selected, index].sort((a, b) => a - b);
  return { ...response, selected };
}

/** 排序题：把第 position 位往前（-1）或往后（1）挪一位。 */
export function moveItem(response: QuizResponse, position: number, offset: -1 | 1): QuizResponse {
  const target = position + offset;
  const next = [...response.selected];
  const here = next[position];
  const there = next[target];
  if (here === undefined || there === undefined) return response;
  next[position] = there;
  next[target] = here;
  return { ...response, selected: next };
}

/** 改第 index 段文字。 */
export function setText(response: QuizResponse, index: number, text: string): QuizResponse {
  const texts = Array.from({ length: Math.max(response.texts.length, index + 1) }, (_slot, i) => response.texts[i] ?? "");
  texts[index] = text;
  return { ...response, texts };
}

/** 交给接口的作答（契约 AnswerResponse）。 */
export function toWireResponse(shape: QuizShape, response: QuizResponse): WireResponse {
  if (choosesOptions(shape) || shape.form === "match_order" || shape.form === "practical_self") return { selected: [...response.selected] };
  if (shape.form === "fill" || shape.form === "stepwise") {
    return { text: Array.from({ length: textSlots(shape) }, (_slot, index) => (response.texts[index] ?? "").trim()).join(PART_SEPARATOR) };
  }
  return { text: response.texts[0] ?? "" };
}

/** 接口给回的作答（我交过的）换成组件里的样子，揭晓后照原样显示。 */
export function fromWireResponse(shape: QuizShape, wire: { readonly selected?: readonly number[] | undefined; readonly text?: string | undefined }): QuizResponse {
  const selected = [...(wire.selected ?? [])];
  if (wire.text === undefined) return { selected, texts: [] };
  if (shape.form === "fill" || shape.form === "stepwise") return { selected, texts: wire.text.split(PART_SEPARATOR) };
  return { selected, texts: [wire.text] };
}
