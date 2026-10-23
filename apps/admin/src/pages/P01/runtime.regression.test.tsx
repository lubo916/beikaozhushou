// W01 收包回归：筛选或考试切换失败不能把上一范围的数据当成新结果。
import { act, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import type { P02MetricDictionary } from "@exam-prep/contract";
import { mount, settle } from "../../app/testing.tsx";
import { p01Fixture } from "../../mocks/pages/P01.ts";
import { p02Fixture } from "../../mocks/pages/P02.ts";
import { dictionaryView } from "../P02/view.ts";
import { cockpitView } from "./view.ts";
import { usePageQuery, type PageQuery } from "./runtime.ts";

const noRetry = () => false;

afterEach(() => vi.restoreAllMocks());

describe("后台查询范围隔离", () => {
  it("切到成本分类后请求失败，收起旧字典并显示错误；重试能恢复该分类", async () => {
    const dictionary = p02Fixture().dictionary;
    const cost = { ...dictionary, items: dictionary.items.filter((item) => item.category === "cost") };
    let rejectChanged: (reason: unknown) => void = () => {};
    let changeKey: (key: string) => void = () => {};
    let query: (PageQuery<P02MetricDictionary> & { readonly refetch: () => void }) | undefined;
    const load = vi.fn(async (key: string) => {
      if (key === "all") return dictionary;
      return new Promise<P02MetricDictionary>((_resolve, reject) => {
        rejectChanged = reject;
      });
    });
    function Probe() {
      const [key, setKey] = useState("all");
      changeKey = setKey;
      query = usePageQuery(key, load, noRetry);
      return <output>{dictionaryView(query).state}</output>;
    }
    const { host, unmount } = await mount(<Probe />);
    try {
      await settle(() => query?.data === dictionary);
      expect(host.textContent).toBe("normal");
      await act(async () => changeKey("cost"));
      expect(query?.data).toBeUndefined();
      expect(host.textContent).toBe("loading");
      await act(async () => rejectChanged(new ApiError("COMMON_INTERNAL")));
      expect(query?.data).toBeUndefined();
      expect(host.textContent).toBe("error");
      load.mockResolvedValue(cost);
      await act(async () => query?.refetch());
      await settle(() => query?.data === cost);
      expect(host.textContent).toBe("normal");
      expect(query?.data?.items.every((item) => item.category === "cost")).toBe(true);
    } finally {
      await unmount();
    }
  });

  it("离线切换考试时不沿用上一考试数据，联网后加载新范围", async () => {
    const previous = p02Fixture("kj").dictionary;
    const next = p02Fixture("en").dictionary;
    let changeKey: (key: string) => void = () => {};
    let query: PageQuery<P02MetricDictionary> | undefined;
    const load = vi.fn(async (key: string) => (key === "kj" ? previous : next));
    function Probe() {
      const [key, setKey] = useState("kj");
      changeKey = setKey;
      query = usePageQuery(key, load, noRetry);
      return <output>{dictionaryView(query).state}</output>;
    }
    const { host, unmount } = await mount(<Probe />);
    try {
      await settle(() => query?.data === previous);
      const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      await act(async () => changeKey("en"));
      expect(query?.data).toBeUndefined();
      expect(host.textContent).toBe("offline");
      online.mockReturnValue(true);
      await act(async () => window.dispatchEvent(new Event("online")));
      await settle(() => query?.data === next);
      expect(query?.data?.exam_name).toBe(next.exam_name);
      expect(host.textContent).toBe("normal");
    } finally {
      await unmount();
    }
  });

  it("同键服务错误后的重试等待不误报离线，网络失败后恢复联网会自动重取", async () => {
    const dictionary = p02Fixture().dictionary;
    let query: (PageQuery<P02MetricDictionary> & { readonly refetch: () => void }) | undefined;
    let finishRetry: (value: P02MetricDictionary) => void = () => {};
    const load = vi.fn(async () => dictionary);
    function Probe() {
      query = usePageQuery("same-scope", load, noRetry);
      const view = dictionaryView(query);
      return <output>{`${view.state}/${String(view.stale)}`}</output>;
    }
    const { host, unmount } = await mount(<Probe />);
    try {
      await settle(() => query?.data === dictionary);
      load.mockRejectedValueOnce(new ApiError("COMMON_INTERNAL"));
      await act(async () => query?.refetch());
      await settle(() => query?.status === "error");
      expect(host.textContent).toBe("error/false");
      load.mockImplementationOnce(
        () =>
          new Promise<P02MetricDictionary>((resolve) => {
            finishRetry = resolve;
          }),
      );
      await act(async () => query?.refetch());
      expect(query?.fetchStatus).toBe("fetching");
      expect(host.textContent).toBe("normal/false");
      await act(async () => finishRetry(dictionary));
      load.mockRejectedValueOnce(new TypeError("network unavailable"));
      await act(async () => query?.refetch());
      await settle(() => query?.status === "error");
      expect(host.textContent).toBe("normal/true");
      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });
      await settle(() => query?.status === "success");
      expect(load).toHaveBeenCalledTimes(5);
      expect(host.textContent).toBe("normal/false");
    } finally {
      await unmount();
    }
  });

  it("同一范围刷新遇到服务错误也显示错误，只有断网才保留并标明旧数据", () => {
    const error = { status: "error" as const, fetchStatus: "idle" as const, error: new ApiError("COMMON_INTERNAL") };
    expect(cockpitView({ ...error, data: p01Fixture().normal.cockpit }).state).toBe("error");
    expect(dictionaryView({ ...error, data: p02Fixture().dictionary }).state).toBe("error");
    const offline = { ...error, error: new TypeError("offline") };
    expect(cockpitView({ ...offline, data: p01Fixture().normal.cockpit })).toMatchObject({ state: "normal", stale: true });
    expect(dictionaryView({ ...offline, data: p02Fixture().dictionary })).toMatchObject({ state: "normal", stale: true });
  });
});
