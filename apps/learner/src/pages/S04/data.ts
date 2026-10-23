// S04 的数据（ui-rules 第 8、13 节，api-rules 第 3、6 节）：页面只经生成的钩子拿数据与提交；“该显示七态里的哪一态”也在这里按请求结果判断，
// 页面组件只管显示。?state= 由接口层制造（加载挂起、出错回 500、离线断网，空、受限、数据不足给特定数据），页面不为测试写分支。
// 视图（ui-rules 第 5 节）：开发与测试时把地址里的 ?view= 传给接口；接口回的 view 交给外壳（setView），正式环境由数据决定视图。
// 写操作成功后按契约的 x-invalidates 让相关查询失效（invalidateAfter）：开始、交一题、暂停之后，本页回来就是新的。
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDiagnosisQueryKey,
  isApiError,
  useAddDiagnosisMistakes,
  useGetDiagnosis,
  usePauseDiagnosis,
  useResumeDiagnosis,
  useStartDiagnosis,
  useSubmitDiagnosisAnswer,
  useSubmitDiagnosisRatings,
  useSwitchDiagnosisToQuick,
  type GetDiagnosisParams,
  type S04Confidence,
  type S04Diagnosis,
  type S04Item,
  type S04View,
} from "@exam-prep/contract";
import { isAnswered, type QuizResponse, type QuizShape, type SubmitBlocker } from "../../../../../packages/ui/src/quiz/index.ts";
import { invalidateAfter } from "../../api/refresh.ts";

/** 网络或服务异常自动再试一次（约一秒后出结果，F08-Q3）；4xx（受限、找不到）再试也没用，不重试。 */
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

export const VIEW_START: S04View = "start";
export const VIEW_TEST: S04View = "test";
/** 本页的两个视图（pages.md）：开始页、测评中。 */
export const DIAGNOSIS_VIEWS: readonly S04View[] = [VIEW_START, VIEW_TEST];

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}

/** 地址里的 ?view= 转成视图；不认识的不传，由接口按数据定。 */
export function forcedView(value: string | null): S04View | undefined {
  return DIAGNOSIS_VIEWS.find((view) => view === value);
}

/** 整页的状态。本页的“受限”（测评中不出现导师、提示与推送）与“数据不足”（有模块用同类数据代替）只落在规则卡与分模块进度里，整页照常。 */
export type DiagnosisState = "loading" | "error" | "offline" | "restricted" | "empty" | "normal";

/** 判断要用到的请求结果（TanStack Query 结果里的几项）；单独写出来，测试可以直接喂。 */
export interface DiagnosisQuery {
  readonly data: S04Diagnosis | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}

export interface DiagnosisView {
  readonly state: DiagnosisState;
  readonly data: S04Diagnosis | undefined;
  /** 有上次取到的数据，但这次因为没联网没取到：照常显示，顶上加一条离线提示。 */
  readonly stale: boolean;
}

function isOffline(query: DiagnosisQuery): boolean {
  return query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
}

/** 空态：题源不足（只能快速定位，规则卡 R3）并且还没有会话。只看接口给的判断，不算业务数字。 */
export function isEmptyDiagnosis(data: S04Diagnosis): boolean {
  return !data.pool_sufficient && data.session === undefined;
}

export function diagnosisView(query: DiagnosisQuery): DiagnosisView {
  const { data } = query;
  if (data !== undefined) return { state: isEmptyDiagnosis(data) ? "empty" : "normal", data, stale: isOffline(query) };
  if (isOffline(query)) return { state: "offline", data, stale: false };
  if (query.status === "pending") return { state: "loading", data, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data, stale: false };
  return { state: "error", data, stale: false };
}

/** 本页的数据钩子：生成的钩子，加上重试策略与七态判断。view 只在开发与测试时传（地址里的 ?view=）。 */
export function useDiagnosis(view: S04View | undefined): DiagnosisView & { readonly retry: () => void } {
  const params: GetDiagnosisParams = view === undefined ? {} : { view };
  const query = useGetDiagnosis(params, { query: { queryKey: getGetDiagnosisQueryKey(params), retry: shouldRetry } });
  return { ...diagnosisView(query), retry: () => void query.refetch() };
}

/** 本页的七个写操作；成功后按契约的 x-invalidates 让受影响的查询失效。 */
export function useDiagnosisActions() {
  const queryClient = useQueryClient();
  const start = useStartDiagnosis({ mutation: { onSuccess: () => invalidateAfter(queryClient, "startDiagnosis") } });
  const submit = useSubmitDiagnosisAnswer({ mutation: { onSuccess: () => invalidateAfter(queryClient, "submitDiagnosisAnswer") } });
  const pause = usePauseDiagnosis({ mutation: { onSuccess: () => invalidateAfter(queryClient, "pauseDiagnosis") } });
  const resume = useResumeDiagnosis({ mutation: { onSuccess: () => invalidateAfter(queryClient, "resumeDiagnosis") } });
  const switchQuick = useSwitchDiagnosisToQuick({ mutation: { onSuccess: () => invalidateAfter(queryClient, "switchDiagnosisToQuick") } });
  const rate = useSubmitDiagnosisRatings({ mutation: { onSuccess: () => invalidateAfter(queryClient, "submitDiagnosisRatings") } });
  const addMistakes = useAddDiagnosisMistakes({ mutation: { onSuccess: () => invalidateAfter(queryClient, "addDiagnosisMistakes") } });
  return { start, submit, pause, resume, switchQuick, rate, addMistakes };
}

/** 给共用作答组件的题目形状。 */
export function shapeOf(item: S04Item): QuizShape {
  return { form: item.question.response_form, options: item.question.options, parts: item.parts };
}

/** 选择题能不能选多个：多选、不定项。 */
export function isMultiple(item: S04Item): boolean {
  return item.question.question_type === "multi_choice" || item.question.question_type === "indefinite_choice";
}

/** 还差哪一步才能提交（规则卡 R6）：每题必须在确定、模糊、蒙的、不会里选一项，不设默认；选“不会”可以不作答。 */
export function diagnosisBlocker(shape: QuizShape, response: QuizResponse, confidence: S04Confidence | null): SubmitBlocker | null {
  if (confidence === "unknown") return null;
  if (!isAnswered(shape, response)) return "answer";
  return confidence === null ? "confidence" : null;
}
