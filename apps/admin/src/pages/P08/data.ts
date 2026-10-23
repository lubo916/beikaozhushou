// P08 的数据钩子：只经生成的请求函数（getP08QuestionReview）与本页假数据层拿数；质检结论、证据上限与计数都由接口给。
// 数据桥与 P01、P02 共用 ../P01/runtime.ts（整合任务补齐后台查询依赖后，这里改用生成的 useGetP08QuestionReview，见 W04 交接单）。
import { getP08QuestionReview, type GetP08QuestionReviewParams, type P08QuestionReview, type P08ReviewOrigin } from "@exam-prep/contract";
import { requestThroughMock, usePageQuery, type MockHandler } from "../P01/runtime.ts";
import { questionReviewView, shouldRetry } from "./view.ts";

export type OriginFilter = "all" | P08ReviewOrigin;
export const ORIGINS: readonly P08ReviewOrigin[] = ["new", "modified"];

const mockHandler = (): Promise<MockHandler> => import("../../mocks/pages/P08.ts").then((module) => module.handleP08);

function loadQuestionReview(query: string, signal: AbortSignal): Promise<P08QuestionReview> {
  const params = Object.fromEntries(new URLSearchParams(query)) as GetP08QuestionReviewParams;
  return requestThroughMock("/admin/question-review", query, signal, mockHandler, () => getP08QuestionReview(params, { signal }));
}

export interface QuestionReviewFilters {
  /** 演示考试（开发与测试时由 ?exam= 切换）。 */
  readonly exam: string;
  /** 强制页面状态（开发与测试时由 ?state= 传给假数据层）。 */
  readonly state: string;
  /** 审核队列的来源筛选（由接口筛）。 */
  readonly origin: OriginFilter;
}

export function useQuestionReview(filters: QuestionReviewFilters) {
  const search = new URLSearchParams({ exam: filters.exam, state: filters.state });
  if (filters.origin !== "all") search.set("origin", filters.origin);
  const query = usePageQuery(search.toString(), loadQuestionReview, shouldRetry);
  return { ...questionReviewView(query), retry: query.refetch };
}
