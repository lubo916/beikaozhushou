import { describe, expect, it } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { ApiError, type S24Progress } from "@exam-prep/contract";
import fixture from "../../../../../fixtures/pages/S24/junior-accounting.json";
import {
  CURRENT_SLOT,
  PROGRESS_CACHE_PREFIX,
  confirmedExamId,
  confirmedProgressExamId,
  progressForTarget,
  readCachedProgress,
  writeCachedProgress,
  type CacheStore,
  type GoalQuery,
  type FreshProgressQuery,
  type ProgressQuery,
} from "./data.ts";

const data = fixture as S24Progress;
function memoryStore(): CacheStore & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}
const offline: ProgressQuery = { status: "error", fetchStatus: "idle", error: new TypeError("offline") };
const identity: GoalQuery = {
  data: { goal: { exam_id: data.exam_id } },
  status: "success",
  fetchStatus: "idle",
  isStale: false,
  error: null,
};

describe("S24 缓存的目标身份", () => {
  it("合法的初级会计响应放进其他考试格子也不能读出", () => {
    const store = memoryStore();
    store.setItem(PROGRESS_CACHE_PREFIX + "en", JSON.stringify(data));
    expect(readCachedProgress("en", store)).toBeUndefined();
    expect(store.map.has(PROGRESS_CACHE_PREFIX + "en")).toBe(false);
  });
  it("写缓存使用响应中的真实考试身份，不使用 current 或地址别名", () => {
    const store = memoryStore();
    writeCachedProgress("current", data, store);
    expect(store.map.has(PROGRESS_CACHE_PREFIX + data.exam_id)).toBe(true);
    expect(store.map.has(PROGRESS_CACHE_PREFIX + "current")).toBe(false);
  });
  it("已确认考试可读取自己的缓存，且保留原计算时间", () => {
    const store = memoryStore();
    writeCachedProgress("kj", data, store);
    expect(readCachedProgress(data.exam_id, store)?.computed_at).toBe(data.computed_at);
    expect(readCachedProgress("kj", store, data.exam_id)?.exam_id).toBe(data.exam_id);
    expect(readCachedProgress("cet-6", store)).toBeUndefined();
    expect(readCachedProgress(CURRENT_SLOT, store)).toBeUndefined();
  });
  it("仅新鲜、成功且未刷新中的公开上下文能确认目标", () => {
    expect(confirmedExamId(identity)).toBe(data.exam_id);
    for (const changed of [
      { status: "error" as const },
      { status: "pending" as const },
      { fetchStatus: "fetching" as const },
      { fetchStatus: "paused" as const },
      { isStale: true },
      { data: undefined },
      { data: { goal: undefined } },
    ])
      expect(confirmedExamId({ ...identity, ...changed })).toBeUndefined();
  });
  it("没有确认目标时不显示旧查询或缓存中的任何业务数字", () => {
    const result = progressForTarget({ ...offline, data }, undefined, data);
    expect(result.state).toBe("offline");
    expect(result.data).toBeUndefined();
    expect(result.stale).toBe(false);
  });
  it("切考试后旧 query.data 与旧缓存都不能冒充新目标", () => {
    const result = progressForTarget({ ...offline, data }, "cet-6", data);
    expect(result.state).toBe("offline");
    expect(result.data).toBeUndefined();
  });
  it("已确认目标的进度离线仍可显示该目标缓存与原计算时间", () => {
    const result = progressForTarget(offline, confirmedExamId(identity), data);
    expect(result.state).toBe("normal");
    expect(result.stale).toBe(true);
    expect(result.data?.exam_id).toBe(data.exam_id);
    expect(result.data?.computed_at).toBe(data.computed_at);
  });
  it("其他考试的查询残留不遮住已确认目标自己的离线缓存", () => {
    const other = { ...data, exam_id: "cet-6" };
    const result = progressForTarget({ ...offline, data: other }, data.exam_id, data);
    expect(result.data?.exam_id).toBe(data.exam_id);
    expect(result.stale).toBe(true);
  });
  it("上下文无目标或受限时，仅本次新成功的本页响应可确认考试", () => {
    const fresh: FreshProgressQuery = {
      status: "success",
      fetchStatus: "idle",
      error: null,
      data,
      isStale: false,
      isFetchedAfterMount: true,
    };
    expect(confirmedProgressExamId(fresh)).toBe(data.exam_id);
    for (const changed of [
      { status: "error" as const },
      { fetchStatus: "fetching" as const },
      { isStale: true },
      { isFetchedAfterMount: false },
    ])
      expect(confirmedProgressExamId({ ...fresh, ...changed })).toBeUndefined();
    expect(progressForTarget({ ...fresh, data: { ...data, has_progress: false } }, confirmedProgressExamId(fresh)).state).toBe("empty");
    const blocked = { ...data, map_check: "blocked" as const };
    expect(progressForTarget({ ...fresh, data: blocked }, confirmedProgressExamId(fresh)).data?.map_check).toBe("blocked");
  });
  it("身份未知时仍保留本页的加载、出错、离线状态，不把失败当作持续加载", () => {
    expect(progressForTarget({ status: "pending", fetchStatus: "fetching", error: null }, undefined).state).toBe("loading");
    expect(progressForTarget({ status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") }, undefined).state).toBe(
      "error",
    );
    expect(progressForTarget({ status: "error", fetchStatus: "idle", error: new Error("offline") }, undefined).state).toBe("offline");
  });
});

describe("S24 身份与查询的实际缓存行为", () => {
  it("挂载前旧成功、失效和失败后的残留不能当作本次身份", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = ["S24-cache-identity"];
    client.setQueryData(key, data);
    const options = { queryKey: key, queryFn: async () => data, staleTime: Number.POSITIVE_INFINITY, refetchOnMount: "always" as const };
    const observer = new QueryObserver(client, options);
    expect(confirmedProgressExamId(observer.getCurrentResult())).toBeUndefined();
    const stop = observer.subscribe(() => undefined);
    try {
      await observer.refetch();
      expect(confirmedProgressExamId(observer.getCurrentResult())).toBe(data.exam_id);
      await client.invalidateQueries({ queryKey: key, refetchType: "none" });
      expect(confirmedProgressExamId(observer.getCurrentResult())).toBeUndefined();
      observer.setOptions({
        ...options,
        queryFn: async () => {
          throw new TypeError("offline");
        },
      });
      await observer.refetch();
      expect(observer.getCurrentResult().data?.exam_id).toBe(data.exam_id);
      expect(confirmedProgressExamId(observer.getCurrentResult())).toBeUndefined();
    } finally {
      stop();
      observer.destroy();
      client.clear();
    }
  });
  it("上下文成功确认目标后，进度请求离线仍能显示该目标的缓存", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const context = new QueryObserver(client, {
      queryKey: ["S24-context"],
      queryFn: async () => ({ goal: { exam_id: data.exam_id } }),
      staleTime: Number.POSITIVE_INFINITY,
    });
    const stopContext = context.subscribe(() => undefined);
    const key = ["S24-progress"];
    client.setQueryData(key, data);
    const progress = new QueryObserver<S24Progress>(client, {
      queryKey: key,
      queryFn: async () => {
        throw new TypeError("offline");
      },
      staleTime: Number.POSITIVE_INFINITY,
    });
    const stopProgress = progress.subscribe(() => undefined);
    try {
      await context.refetch();
      await progress.refetch();
      const target = confirmedExamId(context.getCurrentResult());
      expect(target).toBe(data.exam_id);
      expect(progress.getCurrentResult().status).toBe("error");
      const view = progressForTarget(progress.getCurrentResult(), target, data);
      expect(view.state).toBe("normal");
      expect(view.stale).toBe(true);
      expect(view.data?.computed_at).toBe(data.computed_at);
    } finally {
      stopContext();
      stopProgress();
      context.destroy();
      progress.destroy();
      client.clear();
    }
  });
});
