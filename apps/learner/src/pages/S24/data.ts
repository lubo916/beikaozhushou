import { useEffect } from "react";
import { getS24ProgressResponse } from "@exam-prep/contract/zod";
import { useSearchParams } from "react-router";
import { getGetS24ProgressQueryKey, isApiError, useGetS24Progress, type S24Progress } from "@exam-prep/contract";

const RETRIES = 1;
const SERVER_ERROR = 500;
export function shouldRetry(count: number, error: unknown): boolean {
  return count < RETRIES && (!isApiError(error) || error.status >= SERVER_ERROR);
}
export interface ProgressQuery {
  readonly data?: S24Progress | undefined;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly error: unknown;
}
export function progressView(query: ProgressQuery, cached?: S24Progress) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  const data = query.data ?? (offline ? cached : undefined);
  if (data) return { data, state: data.has_progress ? ("normal" as const) : ("empty" as const), stale: offline };
  if (offline) return { data, state: "offline" as const, stale: false };
  if (query.status === "pending") return { data, state: "loading" as const, stale: false };
  return { data, state: "error" as const, stale: false };
}
const cache = new Map<string, S24Progress>();
const cacheKey = (exam: string) => "S24:sample:v1:" + exam;
function cachedProgress(exam: string): S24Progress | undefined {
  if (cache.has(exam)) return cache.get(exam);
  try {
    const raw = window.sessionStorage.getItem(cacheKey(exam));
    if (!raw) return undefined;
    const result = getS24ProgressResponse.safeParse(JSON.parse(raw) as unknown);
    return result.success ? (result.data as S24Progress) : undefined;
  } catch {
    return undefined;
  }
}
/** 只缓存通过接口拿到的结果，离线时保留原计算时间；考试之间不混用。 */
export function useProgress() {
  const [search] = useSearchParams();
  const exam = search.get("exam") ?? "kj";
  const query = useGetS24Progress({ query: { queryKey: [...getGetS24ProgressQueryKey(), exam], retry: shouldRetry } });
  useEffect(() => {
    if (query.data) {
      cache.set(exam, query.data);
      try {
        window.sessionStorage.setItem(cacheKey(exam), JSON.stringify(query.data));
      } catch {
        /* 浏览器禁用缓存时仍能在线查看。 */
      }
    }
  }, [exam, query.data]);
  return { ...progressView(query, cachedProgress(exam)), retry: () => void query.refetch() };
}
