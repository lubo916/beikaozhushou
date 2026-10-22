/// <reference lib="dom" />
// 冒烟检查本身的回归测试（F06 第 2 轮，按第 1 轮收包复核找到的反例补）：随冒烟入口（pnpm e2e:smoke、bk verify）在 Chromium、WebKit、Firefox 里都跑。
// 页面来自本机小网站 tests/e2e/support/check-fixtures.ts，照学员端外壳的结构写；被测的检查与冒烟、黄金路径、页面画廊用的是同一份 support/checks.ts。
import { EventEmitter } from "node:events";
import { expect, test, type Page } from "@playwright/test";
import { pageById } from "../support/catalog.ts";
import { WHOLE_PAGE_STATES, closedPort, startCheckFixtures, type CheckFixtures } from "../support/check-fixtures.ts";
import {
  STATE_NAMES,
  expectLoaded,
  expectNoProblems,
  expectOpened,
  navigationProblem,
  settle,
  waitForAppReady,
  watchPage,
  type NavigationResponse,
  type StateCode,
} from "../support/checks.ts";

/** 小网站上的页面都按学员端 S06 今日核对（页名、页面模式取页面清单）。 */
const TODAY = pageById("S06");
const TODAY_VIEW = TODAY.views[0];

interface ApiFailure {
  readonly state: StateCode;
  /** 小网站 Service Worker 的参数：回哪个状态码，或断网。 */
  readonly fail: string;
  readonly label: string;
}

/** 出错、受限、离线三态里假数据层各自故意给的接口失败。 */
const API_FAILURES: readonly ApiFailure[] = [
  { state: "error", fail: "500", label: "接口回 500" },
  { state: "restricted", fail: "403", label: "接口回 403" },
  { state: "offline", fail: "network", label: "接口断网" },
];

/** WebKit trace 里实测的原文；这里刻意不用被测代码的常量，防止实现和反例一起改错。 */
const NATIVE_NETWORK_ERROR = "Response served by service worker is an error";
const NATIVE_NETWORK_CONSOLE = "Failed to load resource: Response served by service worker is an error";

/** 重放真实 trace 的原生事件，补足浏览器场景不易稳定制造的“没有请求证据”和“重复消息超过请求数”。 */
async function nativeFailureProbe(browserName: string) {
  const events = new EventEmitter();
  Object.assign(events, {
    context: () => ({ browser: () => ({ browserType: () => ({ name: () => browserName }) }) }),
    addInitScript: async () => {},
  });
  const watch = await watchPage(events as unknown as Page);
  return {
    watch,
    fail(url = "http://127.0.0.1/api/v1/today", errorText = NATIVE_NETWORK_ERROR) {
      events.emit("requestfailed", { url: () => url, failure: () => ({ errorText }) });
    },
    native() {
      const error = new Error(NATIVE_NETWORK_ERROR);
      error.name = "";
      error.stack = "";
      events.emit("pageerror", error);
      events.emit("console", {
        type: () => "error",
        text: () => NATIVE_NETWORK_CONSOLE,
        args: () => [],
        location: () => ({ url: "", lineNumber: 0, columnNumber: 0 }),
      });
    },
    firefox(url = "http://127.0.0.1/api/v1/today", locationUrl = "http://127.0.0.1/sw.js", lineNumber = 7) {
      const text = `[JavaScript Error: "Failed to load ‘${url}’. A ServiceWorker passed an Error Response to FetchEvent.respondWith(). This typically means the ServiceWorker performed an invalid fetch() call." {file: "http://127.0.0.1/sw.js" line: 7}]`;
      events.emit("console", {
        type: () => "error",
        text: () => text,
        args: () => [text],
        location: () => ({ url: locationUrl, lineNumber, columnNumber: 35 }),
      });
    },
    app() {
      // 应用 Error 保留名字与调用栈；即便 console 的来源恰巧为空，它仍有字符串实参。
      events.emit("pageerror", new Error(NATIVE_NETWORK_ERROR));
      events.emit("console", {
        type: () => "error",
        text: () => NATIVE_NETWORK_CONSOLE,
        args: () => [NATIVE_NETWORK_CONSOLE],
        location: () => ({ url: "", lineNumber: 0, columnNumber: 0 }),
      });
    },
  };
}

let site: CheckFixtures;
let unreachable = 0;

test.beforeAll(async () => {
  site = await startCheckFixtures(TODAY.name);
  unreachable = await closedPort();
});

test.afterAll(async () => {
  await site.close();
});

/** 造一个 page.goto 的回应（只用得到成功与否、状态码与状态文字）。 */
function reply(status: number, statusText: string): NavigationResponse {
  return { ok: () => status >= 200 && status < 300, status: () => status, statusText: () => statusText };
}

test.describe("自测：打开页面（复核问题 1：合法的缓存响应被误报）", () => {
  test("测试小网站的图标请求正常返回，其他未知资源照常失败", async ({ request }) => {
    const icon = await request.get(site.url("/favicon.ico"));
    expect(icon.status()).toBe(204);
    const missing = await request.get(site.url("/missing-resource.svg"));
    expect(missing.status()).toBe(404);
  });

  test("打开成功的判定：2xx 与缓存仍然有效的 304 算成功，没有回应、4xx、5xx 不算", () => {
    expect(navigationProblem(reply(200, "OK"), "/today")).toBeNull();
    expect(navigationProblem(reply(204, "No Content"), "/today")).toBeNull();
    expect(navigationProblem(reply(304, "Not Modified"), "/today"), "缓存仍然有效的 304 应算打开成功").toBeNull();
    expect(navigationProblem(reply(404, "Not Found"), "/today")).toContain("实际是 404 Not Found");
    expect(navigationProblem(reply(500, "Internal Server Error"), "/today")).toContain("实际是 500 Internal Server Error");
    expect(navigationProblem(null, "/today")).toContain("没有拿到回应");
  });

  test("重复打开同一地址（走缓存，WebKit 报 304）仍算打开成功，页面照常核对", async ({ page }) => {
    const watch = await watchPage(page);
    for (const visit of [1, 2, 3]) {
      await test.step(`第 ${visit} 次打开`, async () => {
        // WebKit 直接重载同一地址会绕过条件缓存；先到另一同源页面再返回，明确验证真实的 304 往返。
        if (visit > 1) await watch.open(site.url("/status/200"));
        await watch.open(site.url("/cached/today"));
        await expectOpened(page, TODAY, TODAY_VIEW);
        await expectLoaded(page, TODAY);
        expectNoProblems(watch, "normal");
      });
    }
    expect(site.notModified("/cached/today"), "再次打开应走缓存：服务器要回过 304").toBeGreaterThan(0);
  });

  test("打不开的地址照样报错：404、500、连不上", async ({ page }) => {
    const watch = await watchPage(page);
    await expect(watch.open(site.url("/status/404")), "404").rejects.toThrow(/应返回成功/);
    await expect(watch.open(site.url("/status/500")), "500").rejects.toThrow(/应返回成功/);
    await expect(watch.open(`http://127.0.0.1:${unreachable}/today`), "连不上").rejects.toThrow();
  });
});

test.describe("自测：浏览器报错的放行（复核问题 2：带接口网址的应用报错被漏掉）", () => {
  for (const failure of API_FAILURES) {
    test(`${STATE_NAMES[failure.state]}态：假数据层故意让${failure.label}，浏览器记下的报错在这一态放过，换到别的状态照样算报错`, async ({
      page,
    }) => {
      const watch = await watchPage(page);
      await watch.open(site.url(`/api-failure?fail=${failure.fail}`));
      const outcome = `${failure.fail},${failure.fail}`;
      await expect(page.locator("#outcome"), "页面要先真的拿到这种接口失败").toHaveAttribute("data-outcome", outcome);
      await settle(page);
      const all = watch.problems("normal");
      test.info().annotations.push({ type: "这个浏览器实际记下的报错", description: all.length === 0 ? "（没有）" : all.join("；") });
      expect(watch.problems(failure.state), `${STATE_NAMES[failure.state]}态应放过${failure.label}`).toEqual([]);
      // 别的状态里照样算报错（失败说明末尾会补一句为什么不放过，比较时去掉）
      const withoutNote = (texts: readonly string[]): string[] => texts.map((text) => text.replace(/（浏览器记[^）]*）$/, ""));
      for (const other of API_FAILURES.filter((item) => item.state !== failure.state)) {
        expect(withoutNote(watch.problems(other.state)), `${STATE_NAMES[other.state]}态不该放过${failure.label}`).toEqual(all);
      }
    });
  }

  for (const failure of API_FAILURES) {
    test(`${STATE_NAMES[failure.state]}态：应用自己的报错一律不放过（正文带接口网址、带这次真失败的接口网址、不带网址、未捕获的异常）`, async ({
      page,
    }) => {
      const watch = await watchPage(page);
      await watch.open(site.url(`/api-failure?fail=${failure.fail}&log=app`));
      await expect(page.locator("#outcome")).toHaveAttribute("data-outcome", `${failure.fail},${failure.fail}`);
      await settle(page);
      const fromApp = (text: string): boolean => text.includes("Application parser crashed");
      const message = "应用自己的四条报错都要报出来";
      await expect.poll(() => watch.problems(failure.state).filter(fromApp).length, { message }).toBe(4);
      const reported = watch.problems(failure.state);
      expect(
        reported.filter((text) => text.includes("http://127.0.0.1:5173/api/quiz/demo")),
        "复核里的反例原文",
      ).toHaveLength(1);
      expect(
        reported.filter((text) => text.startsWith("未捕获的异常")),
        "未捕获的异常",
      ).toHaveLength(1);
      expect(
        reported.filter((text) => !fromApp(text)),
        "假数据层故意给的接口失败照常放过",
      ).toEqual([]);
    });
  }

  test("离线态：与 WebKit 原生报错同文案的应用 Error 和 console 仍必须报错", async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(site.url("/api-failure?fail=network&log=native-text"));
    await expect(page.locator("#outcome")).toHaveAttribute("data-outcome", "network,network");
    await settle(page);
    await expect.poll(() => watch.problems("offline").filter((text) => text.startsWith("未捕获的异常")).length).toBe(1);
    expect(watch.problems("offline")).toEqual([
      expect.stringContaining(`控制台报错：${NATIVE_NETWORK_CONSOLE}`),
      `未捕获的异常：${NATIVE_NETWORK_ERROR}`,
    ]);
  });

  test("离线态：非接口资源被 Service Worker 断网，不能当作预期的接口失败放过", async ({ page, browserName }) => {
    const watch = await watchPage(page);
    await watch.open(site.url("/api-failure?fail=network&path=asset"));
    await expect(page.locator("#outcome")).toHaveAttribute("data-outcome", "network,network");
    await settle(page);
    const all = watch.problems("normal");
    if (browserName === "webkit") expect(all).toHaveLength(4);
    const withoutNote = (texts: readonly string[]): string[] => texts.map((text) => text.replace(/（浏览器记[^）]*）$/, ""));
    expect(withoutNote(watch.problems("offline"))).toEqual(all);
  });

  test("WebKit 原生离线错误必须有同文案的接口失败证据，每个失败请求只豁免各一条原生消息", async ({ browserName }) => {
    const missing = await nativeFailureProbe(browserName);
    missing.native();
    expect(missing.watch.problems("offline"), "没有请求证据不能豁免").toHaveLength(2);

    const cancelled = await nativeFailureProbe(browserName);
    cancelled.fail("http://127.0.0.1/api/v1/today", "Load request cancelled");
    cancelled.native();
    expect(cancelled.watch.problems("offline"), "取消请求不是强制离线的证据").toHaveLength(2);

    const asset = await nativeFailureProbe(browserName);
    asset.fail("http://127.0.0.1/fixture/failure");
    asset.native();
    expect(asset.watch.problems("offline"), "非接口失败不能豁免").toHaveLength(2);

    const exact = await nativeFailureProbe(browserName);
    exact.fail();
    exact.native();
    for (const state of ["normal", "error", "restricted"] as const) {
      expect(exact.watch.problems(state), "非离线态不能豁免").toHaveLength(2);
    }
    expect(exact.watch.problems("offline"), "仅 WebKit 精确原生消息可以豁免").toHaveLength(browserName === "webkit" ? 0 : 2);
    expect(exact.watch.problems("offline"), "重复读取不能消耗证据").toHaveLength(browserName === "webkit" ? 0 : 2);
    exact.native();
    expect(exact.watch.problems("offline"), "超出请求数的消息仍算报错").toHaveLength(browserName === "webkit" ? 2 : 4);
    exact.fail();
    expect(exact.watch.problems("offline"), "两个实际失败请求各有一份额度").toHaveLength(browserName === "webkit" ? 0 : 4);
    exact.app();
    expect(exact.watch.problems("offline"), "应用报错即便同文案也不占用原生消息额度").toHaveLength(browserName === "webkit" ? 2 : 6);
  });

  test("离线态：完整复制 Firefox 原生文案的应用 console 与 Error 仍必须报错", async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(site.url("/api-failure?fail=network&log=firefox-text"));
    await expect(page.locator("#outcome")).toHaveAttribute("data-outcome", "network,network");
    await settle(page);
    await expect.poll(() => watch.problems("offline").filter((text) => text.startsWith("未捕获的异常")).length).toBe(1);
    const reported = watch.problems("offline");
    expect(reported).toHaveLength(2);
    expect(reported[0]).toContain('控制台报错：[JavaScript Error: "Failed to load ‘');
    expect(reported[0]).toContain(`（${site.url("/api-failure?fail=network&log=firefox-text")}）`);
    expect(reported[1]).toContain('未捕获的异常：[JavaScript Error: "Failed to load ‘');
  });

  test("Firefox 原生离线消息必须匹配脚本来源、行号与这个接口的真实失败，不能重复借用额度", async ({ browserName }) => {
    const api = "http://127.0.0.1/api/v1/today";
    const missing = await nativeFailureProbe(browserName);
    missing.firefox();
    expect(missing.watch.problems("offline"), "没有请求证据不能豁免").toHaveLength(1);

    const different = await nativeFailureProbe(browserName);
    different.fail("http://127.0.0.1/api/v1/other", "<unknown error>");
    different.firefox();
    expect(different.watch.problems("offline"), "其他接口的失败不能作为证据").toHaveLength(1);

    const cancelled = await nativeFailureProbe(browserName);
    cancelled.fail(api, "Load request cancelled");
    cancelled.firefox();
    expect(cancelled.watch.problems("offline"), "取消请求不能作为证据").toHaveLength(1);

    const asset = await nativeFailureProbe(browserName);
    asset.fail("http://127.0.0.1/fixture/failure", "<unknown error>");
    asset.firefox("http://127.0.0.1/fixture/failure");
    expect(asset.watch.problems("offline"), "非接口失败不能豁免").toHaveLength(1);

    const metadata = await nativeFailureProbe(browserName);
    metadata.fail(api, "<unknown error>");
    metadata.firefox(api, "http://127.0.0.1/page.js");
    metadata.firefox(api, "http://127.0.0.1/sw.js", 99);
    expect(metadata.watch.problems("offline"), "脚本来源或行号不符时不能按原生消息处理").toHaveLength(2);

    const exact = await nativeFailureProbe(browserName);
    exact.fail(api, "<unknown error>");
    exact.firefox();
    for (const state of ["normal", "error", "restricted"] as const) {
      expect(exact.watch.problems(state), "非离线态不能豁免").toHaveLength(1);
    }
    expect(exact.watch.problems("offline"), "仅 Firefox 精确原生消息可以豁免").toHaveLength(browserName === "firefox" ? 0 : 1);
    expect(exact.watch.problems("offline"), "重复读取不能消耗证据").toHaveLength(browserName === "firefox" ? 0 : 1);
    exact.firefox();
    expect(exact.watch.problems("offline"), "超出请求数的消息仍算报错").toHaveLength(browserName === "firefox" ? 1 : 2);
    exact.fail(api, "<unknown error>");
    expect(exact.watch.problems("offline"), "两个真实失败请求各有一份额度").toHaveLength(browserName === "firefox" ? 0 : 2);
  });

  test("Firefox 取消后重发的离线日志按同 URL 确证失败配对，事件到达顺序不改变严格额度", async ({ browserName }) => {
    const api = "http://127.0.0.1/api/v1/today";
    const paired = await nativeFailureProbe(browserName);
    paired.fail(api, "NS_BINDING_ABORTED");
    paired.firefox();
    paired.firefox();
    expect(paired.watch.problems("offline"), "只有取消没有确证失败时，两条消息都应报错").toHaveLength(2);
    paired.fail(api, "<unknown error>");
    expect(paired.watch.problems("offline"), "同 URL 确证失败后，取消与重发各对应一条原生消息").toHaveLength(
      browserName === "firefox" ? 0 : 2,
    );
    paired.firefox();
    expect(paired.watch.problems("offline"), "超出这两个真实请求的消息仍应报错").toHaveLength(browserName === "firefox" ? 1 : 3);
    for (const state of ["normal", "error", "restricted"] as const) {
      expect(paired.watch.problems(state), "非离线态不能使用配对额度").toHaveLength(3);
    }
    paired.app();
    expect(paired.watch.problems("offline"), "配对额度不能吞掉应用同文案的报错").toHaveLength(browserName === "firefox" ? 3 : 5);

    const reordered = await nativeFailureProbe(browserName);
    reordered.firefox();
    reordered.firefox();
    reordered.fail(api, "<unknown error>");
    expect(reordered.watch.problems("offline"), "取消事件还没到达时不能预支它的额度").toHaveLength(browserName === "firefox" ? 1 : 2);
    reordered.fail(api, "NS_BINDING_ABORTED");
    expect(reordered.watch.problems("offline"), "取消事件后到也按同一套证据重新计算").toHaveLength(browserName === "firefox" ? 0 : 2);

    const otherCancelled = await nativeFailureProbe(browserName);
    otherCancelled.fail("http://127.0.0.1/api/v1/other", "NS_BINDING_ABORTED");
    otherCancelled.fail(api, "<unknown error>");
    otherCancelled.firefox();
    otherCancelled.firefox();
    expect(otherCancelled.watch.problems("offline"), "其他 URL 的取消不能补足本接口的额度").toHaveLength(browserName === "firefox" ? 1 : 2);

    const otherConfirmed = await nativeFailureProbe(browserName);
    otherConfirmed.fail(api, "NS_BINDING_ABORTED");
    otherConfirmed.fail("http://127.0.0.1/api/v1/other", "<unknown error>");
    otherConfirmed.firefox();
    expect(otherConfirmed.watch.problems("offline"), "其他 URL 的确证失败不能使本接口的取消变成证据").toHaveLength(1);

    const otherReason = await nativeFailureProbe(browserName);
    otherReason.fail(api, "Load request cancelled");
    otherReason.fail(api, "<unknown error>");
    otherReason.firefox();
    otherReason.firefox();
    expect(otherReason.watch.problems("offline"), "未观察到的取消格式不能获得额外额度").toHaveLength(browserName === "firefox" ? 1 : 2);
  });
});

test.describe("自测：正常态的正文（复核问题 3：顶栏正确、正文整页出错仍能通过）", () => {
  for (const state of WHOLE_PAGE_STATES) {
    test(`顶栏页名正确、正文整页是${STATE_NAMES[state]}占位：正常态的检查不通过`, async ({ page }) => {
      const watch = await watchPage(page);
      await watch.open(site.url(`/shell/whole-${state}`));
      // 顶栏里的页名让“能打开”照样通过；正文整页是状态占位，要由正常态的加载检查拦下
      await expectOpened(page, TODAY, TODAY_VIEW);
      await expect(expectLoaded(page, TODAY)).rejects.toThrow(/正常态的正文区不应整页显示状态占位：\S/);
      expectNoProblems(watch, "normal");
    });
  }

  test("顶栏页名正确、正文区空白：正常态的检查不通过", async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(site.url("/shell/blank"));
    await expectOpened(page, TODAY, TODAY_VIEW);
    await expect(expectLoaded(page, TODAY)).rejects.toThrow(/正常态的正文区除了状态占位还应有看得见的正文/);
  });

  test("正常页面里卡片中的局部空态、数据不足和加载完就换成内容的加载：不误判", async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(site.url("/shell/local-states"));
    await expectOpened(page, TODAY, TODAY_VIEW);
    await expectLoaded(page, TODAY);
    expectNoProblems(watch, "normal");
    await expect(page.locator("main#main .ui-state--empty"), "卡片里的局部空态确实显示着").toBeVisible();
    await expect(page.locator("main#main .ui-state--insufficient_data"), "卡片里的数据不足确实显示着").toBeVisible();
  });
});

test.describe("自测：等页面就绪（Firefox 冒烟里外壳超过 5 秒才出现、期间还有导航）", () => {
  test("打开后页面自己刷新一次、6 秒后才出外壳（学员端等假数据层重新接上时就是这样）：等到最终页面就绪再核对", async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(site.url("/late-shell?delay=6000"));
    await expectOpened(page, TODAY, TODAY_VIEW);
    await expectLoaded(page, TODAY);
    expectNoProblems(watch, "normal");
    expect(await page.evaluate(() => sessionStorage.getItem("bk-fixture-reloaded")), "页面确实自己刷新过一次").toBe("1");
  });

  test("外壳一直不出现：在给定的上限内报错，并写明地址、等待期间的导航与页面状态", async ({ page }) => {
    await page.goto(site.url("/no-shell?reloads=2"));
    const error = await waitForAppReady(page, 3_000).then(
      () => null,
      (reason: unknown) => String(reason),
    );
    expect(error, "外壳没出现时应报错").toContain("外壳的正文区 main#main 在 3 秒内没出现");
    expect(error).toMatch(/地址 \S*no-shell/);
    expect(error).toMatch(/等待期间主框架导航 \d+ 次/);
    expect(error).toContain("受 Service Worker 控制：否");
  });
});
