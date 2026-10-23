// S18-22 回归：题号切换不丢用时，别题与提交后的等待不计入；卸载后清理计时。
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App.tsx";
import { click, mountAt, settle, type Mounted } from "../../app/testing.tsx";
import pageCopy from "../../i18n/zh-CN/S18.json";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import quizCopy from "../../../../../packages/ui/src/quiz/copy.zh-CN.json";

const NOW = Date.parse("2026-10-23T01:00:00Z");
let mounted: Mounted | undefined;

afterEach(async () => {
  await mounted?.unmount();
  mounted = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function button(host: ParentNode, label: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>("button")].find((entry) => entry.textContent?.trim() === label);
}

function navButtons(host: ParentNode): NodeListOf<HTMLButtonElement> {
  return host.querySelectorAll<HTMLButtonElement>(`nav[aria-label="${quizCopy.nav.label}"] button`);
}

async function setupQuiz(state = "") {
  let now = NOW;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const fixtures = loadDemoFixtures();
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes: collectRoutes(loadRouteModules()) });
  const submitted: { item_id: string; duration_ms: number }[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    if (new URL(url, "http://localhost").pathname.endsWith("/answers")) submitted.push(body as { item_id: string; duration_ms: number });
    const outcome = await api.handle({
      method: init?.method ?? "GET",
      url: new URL(url, "http://localhost").href,
      headers: new Headers(init?.headers),
      body,
    });
    if (outcome.kind === "hang") return new Promise<Response>(() => undefined);
    if (outcome.kind !== "json") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
  });
  mounted = await mountAt("/quiz/demo", <App />);
  const { host } = mounted;
  await settle(() => host.querySelector("main input[type=radio]") !== null);
  return {
    host,
    submitted,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}

describe("S18 每题累计计时", () => {
  it("切到别题后切回：提交累计两段用时，排除停在别题的时间；计时只建一次并在卸载清理", async () => {
    const intervals = vi.spyOn(globalThis, "setInterval");
    const clear = vi.spyOn(globalThis, "clearInterval");
    const { host, submitted, advance } = await setupQuiz();
    await click(host.querySelector("main input[type=radio]"));
    await click(host.querySelector("main input[value=sure]"));

    advance(15000);
    await click(navButtons(host)[4]);
    advance(7000);
    await click(navButtons(host)[3]);
    advance(2000);
    await click(button(host, quizCopy.submit.action));
    await settle(() => submitted.length > 0);

    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.duration_ms).toBe(17000);
    await settle(() => host.textContent?.includes(pageCopy.reveal.title) === true);

    // 第五题保留第一次的 7 秒，再加第二次的 3 秒；第四题的用时不混进来。
    await click(navButtons(host)[4]);
    await click(host.querySelector("main input[value=sure]"));
    advance(3000);
    await click(button(host, quizCopy.submit.action));
    await settle(() => submitted.length === 2);
    expect(submitted[1]?.duration_ms).toBe(10000);

    const timerCalls = intervals.mock.calls.flatMap((args, index) => (args[1] === 1000 ? [index] : []));
    expect(timerCalls).toHaveLength(1);
    const timerId = intervals.mock.results[timerCalls[0] ?? -1]?.value;
    await mounted?.unmount();
    mounted = undefined;
    expect(clear).toHaveBeenCalledWith(timerId);
  });

  it("测评态已保存的题停止计时，再提交时不把等待揭晓的时间计入", async () => {
    const { host, submitted, advance } = await setupQuiz("restricted");
    await click(host.querySelector("main input[type=radio]"));
    await click(host.querySelector("main input[value=sure]"));
    advance(10000);
    await click(button(host, quizCopy.submit.action));
    await settle(() => host.textContent?.includes(pageCopy.question.answered_wait) === true);
    expect(submitted[0]?.duration_ms).toBe(10000);

    advance(50000);
    await click(button(host, quizCopy.submit.action));
    await settle(() => submitted.length === 2);
    expect(submitted.map((answer) => answer.duration_ms)).toEqual([10000, 10000]);
  });
});
