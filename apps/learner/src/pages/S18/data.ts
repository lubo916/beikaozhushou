// S18 的数据（ui-rules 第 8、13 节，api-rules 第 3、6 节）：页面只经生成的钩子拿数据与提交；“该显示七态里的哪一态”也在这里按请求结果判断，
// 页面组件只管显示。?state= 由接口层制造（加载挂起、出错回 500、离线断网，空、受限、数据不足给特定数据），页面不为测试写分支。
// 作答、核对、交卷成功后按契约的 x-invalidates 让相关查询失效（invalidateAfter）：本组进度、错题本、今日清单回来就是新的。
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetQuizSessionQueryKey,
  isApiError,
  useAskQuizTutor,
  useCheckGeneratedQuestion,
  useFinishQuizSession,
  useGetQuizSession,
  useSaveQuizErrorCause,
  useSubmitQuizAnswer,
  useTakeQuizHint,
  type S18ErrorCause,
  type S18ItemResult,
  type S18QuizItem,
  type S18QuizSession,
  type S18SolutionLayers,
  type S18SourceKind,
  type S18SourceRef,
} from "@exam-prep/contract";
import { choosesOptions, type NavStatus, type QuizShape } from "../../../../../packages/ui/src/quiz/index.ts";
import { invalidateAfter } from "../../api/refresh.ts";
import { DEMO_PARAM } from "../../routes.ts";

/** 网络或服务异常自动再试一次（约一秒后出结果，F08-Q3）；4xx（受限、找不到）再试也没用，不重试。 */
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

/** 导师出题的示范题组：开发时 gen 视图打开 /quiz/demo 用它（假数据层认得这个 ID）。 */
export const DEMO_GENERATED = `${DEMO_PARAM}-gen`;
export const VIEW_OBJECTIVE = "obj";
export const VIEW_GENERATED = "gen";

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}

/** 要取的题组：开发时路由里的 demo 在 gen 视图下换成导师出题的示范题组；真实的题组 ID 原样用。 */
export function sessionIdFor(routeId: string, viewKey: string | undefined): string {
  return routeId === DEMO_PARAM && viewKey === VIEW_GENERATED ? DEMO_GENERATED : routeId;
}

/** 真实使用时按题组来源选视图（ui-rules 第 5 节）：导师出的生成题用 gen，其他用 obj。 */
export function viewOfKind(kind: S18QuizSession["kind"]): string {
  return kind === "generated" ? VIEW_GENERATED : VIEW_OBJECTIVE;
}

/** 整页的状态。本页的“受限”（测评态不能切换模式、不能看提示）与“数据不足”（没有群体数据）只落在题目卡与揭晓里，整页照常。 */
export type SessionState = "loading" | "error" | "offline" | "restricted" | "empty" | "normal";

/** 判断要用到的请求结果（TanStack Query 结果里的几项）；单独写出来，测试可以直接喂。 */
export interface SessionQuery {
  readonly data: S18QuizSession | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}

export interface SessionView {
  readonly state: SessionState;
  readonly data: S18QuizSession | undefined;
  /** 有上次取到的数据，但这次因为没联网没取到：照常显示，顶上加一条离线提示。 */
  readonly stale: boolean;
}

function isOffline(query: SessionQuery): boolean {
  return query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
}

/** 空态：这一组题做完了（bk spec：这一组题做完了｜看练习小结，或再来一组）。只看接口给的 finished 与题目列表，不算业务数字。 */
export function isDone(data: S18QuizSession): boolean {
  // 交卷结束作答，但已揭晓的生成题仍需显示核对入口；未作答题的 pending 不算核对任务。
  if (data.items.some((item) => item.status === "revealed" && item.check === "pending")) return false;
  return data.finished || data.items.length === 0;
}

export function sessionView(query: SessionQuery): SessionView {
  const { data } = query;
  if (data !== undefined) return { state: isDone(data) ? "empty" : "normal", data, stale: isOffline(query) };
  if (isOffline(query)) return { state: "offline", data, stale: false };
  if (query.status === "pending") return { state: "loading", data, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data, stale: false };
  return { state: "error", data, stale: false };
}

/** 本页的数据钩子：生成的钩子，加上重试策略与七态判断。 */
export function useQuizSession(sessionId: string): SessionView & { readonly retry: () => void } {
  const query = useGetQuizSession(sessionId, { query: { queryKey: getGetQuizSessionQueryKey(sessionId), retry: shouldRetry } });
  return { ...sessionView(query), retry: () => void query.refetch() };
}

/** 本页的写操作：提交一题、生成题核对、测评态交卷，以及提示阶梯、错因确认（U18b）；成功后按契约的 x-invalidates 让受影响的查询失效。 */
export function useQuizActions() {
  const queryClient = useQueryClient();
  const submit = useSubmitQuizAnswer({ mutation: { onSuccess: () => invalidateAfter(queryClient, "submitQuizAnswer") } });
  const check = useCheckGeneratedQuestion({ mutation: { onSuccess: () => invalidateAfter(queryClient, "checkGeneratedQuestion") } });
  const finish = useFinishQuizSession({ mutation: { onSuccess: () => invalidateAfter(queryClient, "finishQuizSession") } });
  const hint = useTakeQuizHint({ mutation: { onSuccess: () => invalidateAfter(queryClient, "takeQuizHint") } });
  const cause = useSaveQuizErrorCause({ mutation: { onSuccess: () => invalidateAfter(queryClient, "saveQuizErrorCause") } });
  return { submit, check, finish, hint, cause };
}

/** 讲解与追问、引导我想（S18-13、S18-17）：只读，不改别的数据，所以不用让查询失效。 */
export function useQuizTutor() {
  return useAskQuizTutor();
}

/** 题号导航的状态：只看接口给的作答状态与判分结果。 */
export function navStatus(item: S18QuizItem): NavStatus {
  if (item.status === "unanswered") return "unanswered";
  if (item.result === undefined) return "answered";
  if (item.result.correct === true) return "correct";
  if (item.result.correct === false) return "wrong";
  return "ungraded";
}

/** 下一道仍有操作的题：先未答题，再已揭晓的待核对题；交卷后只找待核对题。不算当前题。 */
export function nextOpenIndex(items: readonly S18QuizItem[], from: number, answeringClosed = false): number | null {
  const find = (matches: (item: S18QuizItem) => boolean): number | null => {
    const after = items.findIndex((item, index) => index > from && matches(item));
    if (after >= 0) return after;
    const before = items.findIndex((item, index) => index !== from && matches(item));
    return before >= 0 ? before : null;
  };
  const unanswered = answeringClosed ? null : find((item) => item.status === "unanswered");
  return unanswered ?? find((item) => item.status === "revealed" && item.check === "pending");
}

/** 给共用作答组件的题目形状。 */
export function shapeOf(item: S18QuizItem): QuizShape {
  return { form: item.question.response_form, options: item.question.options, parts: item.parts };
}

/** 选择题能不能选多个：多选、不定项。 */
export function isMultiple(item: S18QuizItem): boolean {
  return item.question.question_type === "multi_choice" || item.question.question_type === "indefinite_choice";
}

/** 选项字母（揭晓、讲解里说“你选的 B”）。 */
export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** 错因七类，按术语表 error_cause 的顺序。 */
export const ERROR_CAUSES: readonly S18ErrorCause[] = [
  "not_learned",
  "forgot",
  "concept_unclear",
  "method_unknown",
  "misread",
  "slip",
  "time_short",
];

/** 提示按钮（S18-16）：下一级是第几级、一共几级、是否已用完；只看接口给的提示阶梯。 */
export function hintLadder(item: S18QuizItem): { readonly next: number; readonly total: number; readonly done: boolean } {
  const given = item.hints.shown.length;
  return { next: given + 1, total: item.hints.total, done: given >= item.hints.total };
}

/** 我选了但不在正确答案里的选项（选择题）：只比对接口给的答案与我交的选项。 */
export function wrongPicks(item: S18QuizItem): number[] {
  const answer = item.result?.solution.answer ?? [];
  if (!choosesOptions(shapeOf(item))) return [];
  return (item.answer?.response.selected ?? []).filter((index) => !answer.includes(index));
}

/** 揭晓第一行的色调：做错、待验证（蒙对、秒答）、做对；不计证据或待批改的用中性色。 */
export type RevealTone = "wrong" | "pending" | "correct" | "neutral";

export function revealTone(result: S18ItemResult): RevealTone {
  if (result.correct === false) return "wrong";
  if (result.correct === null || !result.evidence_counted) return "neutral";
  return result.evidence_strength === "pending" ? "pending" : "correct";
}

/** 资料定位里第一处资料或视频（S18-06）。 */
export function sourceOf(layers: S18SolutionLayers, kind: S18SourceKind): S18SourceRef | undefined {
  return layers.sources.find((source) => source.kind === kind);
}
