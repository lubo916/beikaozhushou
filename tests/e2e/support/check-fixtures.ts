// 冒烟检查自测（tests/e2e/smoke/checks.spec.ts）用的本机小网站：只用 Node 自带的 http 模块，不依赖三端的开发服务器。
// 页面照学员端外壳的结构写（外壳根节点的 data-mode、顶栏里的页名、正文区 main#main、公共状态组件的类名），用来复现
// F06 第 1 轮收包复核找到的反例：再次打开走缓存（304）、顶栏页名正确而正文整页出错或空白、假数据层的接口失败与应用自己的报错、外壳迟迟才出现。
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface CheckFixtures {
  /** 地址前缀，如 http://127.0.0.1:41234。 */
  readonly origin: string;
  /** 小网站上某个路径的完整地址。 */
  url(path: string): string;
  /** 给某个路径回过几次 304（浏览器带着缓存来问，缓存仍然有效）。 */
  notModified(path: string): number;
  close(): Promise<void>;
}

/** 正文整页显示的几种状态占位（类名与公共状态组件 PageState 一致）。 */
export const WHOLE_PAGE_STATES = ["error", "offline", "restricted", "empty", "insufficient_data"] as const;
type WholePageState = (typeof WHOLE_PAGE_STATES)[number];

const OK = 200;
const NOT_MODIFIED = 304;
const NOT_FOUND = 404;
/** 接口请求居然到了服务器（Service Worker 没接住）时回的状态：测试据此看出场景没搭起来。 */
const NOT_INTERCEPTED = 418;
const CACHED_PATH = "/cached/today";
const CACHED_TAG = '"bk-fixture-1"';

const STATE_TITLES: Readonly<Record<WholePageState, string>> = {
  error: "没能加载",
  offline: "现在离线",
  restricted: "暂时用不了",
  empty: "还没有内容",
  insufficient_data: "数据还不够",
};

const ERROR_ACTIONS = '<div class="ui-state__actions"><button type="button">重试</button><button type="button">反馈问题</button></div>';

/** 模仿假数据层的 Service Worker（MSW，接线在 packages/contract/src/mock-browser.ts）的三种失败：断网回 Response.error()，出错、受限回带状态文字的 JSON 错误体。 */
const SERVICE_WORKER = `self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (url.pathname.indexOf("/api/") !== 0) return;
  var fail = url.searchParams.get("fail");
  if (fail === "network") { event.respondWith(Response.error()); return; }
  var forbidden = fail === "403";
  var body = JSON.stringify({ code: forbidden ? "COMMON_FORBIDDEN" : "COMMON_INTERNAL", details: { forced_state: forbidden ? "restricted" : "error" } });
  var init = { status: Number(fail), statusText: forbidden ? "Forbidden" : "Internal Server Error", headers: { "content-type": "application/json" } };
  event.respondWith(new Response(body, init));
});
`;

const API_FAILURE_MAIN = '<p id="outcome">正在请求接口</p>';

/** 等 Service Worker 接管后请求两次接口（假数据层失败后查询会自动重试）；log=app 时再记下应用自己的报错：复核里的反例原文、带这次真失败的接口地址、不带地址，外加一个未捕获的异常。 */
const API_FAILURE_SCRIPT = `(async function () {
  var query = new URLSearchParams(location.search);
  var outcome = document.getElementById("outcome");
  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise(function (resolve) { navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }); });
  }
  var api = new URL("/api/v1/today?fail=" + query.get("fail"), location.href).href;
  var results = [];
  for (var attempt = 0; attempt < 2; attempt += 1) {
    try { results.push(String((await fetch(api)).status)); } catch (error) { results.push("network"); }
  }
  if (query.get("log") === "app") {
    console.error("Application parser crashed for http://127.0.0.1:5173/api/quiz/demo");
    console.error("Application parser crashed for " + api);
    console.error("Application parser crashed");
    setTimeout(function () { throw new Error("Application parser crashed for " + api); }, 0);
  }
  outcome.textContent = "接口请求结果：" + results.join(",");
  outcome.setAttribute("data-outcome", results.join(","));
})();`;

/** 外壳一直不出来：只有一段字，打开后按 ?reloads= 自己刷新几次。 */
const NO_SHELL_BODY = `<p>外壳没有出来</p>
<script>
addEventListener("load", function () {
  var wanted = Number(new URLSearchParams(location.search).get("reloads") || "0");
  var done = Number(sessionStorage.getItem("bk-fixture-reloads") || "0");
  if (done < wanted) {
    sessionStorage.setItem("bk-fixture-reloads", String(done + 1));
    setTimeout(function () { location.reload(); }, 300);
  }
});
</script>`;

function htmlPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${title}</title></head>
<body>
${body}
</body>
</html>
`;
}

/** 学员端外壳的样子：根节点带页面模式、占满一屏，顶栏里有页名，正文区 main#main 撑满其余高度（和真外壳一样，正文空白时也看得见）。 */
function shell(name: string, main: string): string {
  const layout = 'style="display: flex; flex-direction: column; height: 100vh"';
  return `<div data-mode="standard" ${layout}><header><span>${name}</span></header><main id="main" style="flex: 1">${main}</main></div>`;
}

/** 正常的正文：页头（h1 页名）加一张卡片。整段在一行里，好放进页面脚本的字符串。 */
function normalMain(name: string): string {
  const head = `<header class="ui-pagehead"><h1 class="ui-pagehead__title">${name}</h1></header>`;
  return `${head}<section class="ui-card"><div class="ui-card__body"><p>今天要做的三件事</p></div></section>`;
}

/** 整页的状态占位（照公共状态组件 PageState 的结构）：出错态是“<页名>没能加载”加“重试”“反馈问题”。 */
function wholePageMain(name: string, state: WholePageState): string {
  const title = state === "error" ? `${name}${STATE_TITLES.error}` : STATE_TITLES[state];
  const role = state === "error" ? "alert" : "status";
  const actions = state === "error" ? ERROR_ACTIONS : "";
  return `<div class="mx-auto flex w-full flex-col gap-4"><div role="${role}" class="ui-state ui-state--${state}">
<span class="ui-state__icon" aria-hidden="true"></span><h2 class="ui-state__title">${title}</h2>
<p class="ui-state__body">${name}的数据暂时没取到。已保存的内容不受影响。</p>${actions}</div></div>`;
}

/** 正常页面里的局部提示：卡片里的紧凑版空态、卡片里的数据不足、卡片里加载完就换成内容的加载。 */
function localStatesMain(name: string): string {
  return `<header class="ui-pagehead"><h1 class="ui-pagehead__title">${name}</h1></header>
<section class="ui-card"><header class="ui-card__head"><h2 class="ui-card__title">错题回炉</h2></header><div class="ui-card__body">
<div role="status" class="ui-state ui-state--empty ui-state--compact"><h2 class="ui-state__title">今天没有要回炉的错题</h2></div></div></section>
<section class="ui-card"><header class="ui-card__head"><h2 class="ui-card__title">三个数</h2></header><div class="ui-card__body">
<div role="status" class="ui-state ui-state--insufficient_data"><h2 class="ui-state__title">数据还不够</h2><p class="ui-state__body">再做几道题就能看到</p></div>
</div></section>
<section class="ui-card"><header class="ui-card__head"><h2 class="ui-card__title">导师建议</h2></header><div class="ui-card__body" id="later">
<div role="status" aria-live="polite" class="ui-state ui-state--loading"><span>正在加载</span></div></div></section>
<script>setTimeout(function () { document.getElementById("later").innerHTML = "<p>先复习第三章</p>"; }, 300);</script>`;
}

/** 打开后自己刷新一次，再过 ?delay= 毫秒才把外壳放出来：像学员端赶上 MSW 重新注册时那样（刷新一次、等假数据层接上才显示页面）。 */
function lateShellBody(name: string): string {
  const ready = shell(name, normalMain(name));
  return `<div id="root"></div>
<script>
addEventListener("load", function () {
  if (sessionStorage.getItem("bk-fixture-reloaded") === null) {
    sessionStorage.setItem("bk-fixture-reloaded", "1");
    setTimeout(function () { location.reload(); }, 300);
    return;
  }
  var delay = Number(new URLSearchParams(location.search).get("delay") || "0");
  setTimeout(function () { document.getElementById("root").innerHTML = '${ready}'; }, delay);
});
</script>`;
}

function respond(request: IncomingMessage, response: ServerResponse, name: string, notModified: Map<string, number>): void {
  const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");
  const send = (status: number, type: string, body: string, headers: Readonly<Record<string, string>> = {}): void => {
    response.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store", ...headers });
    response.end(body);
  };
  const html = (body: string, status = OK): void => send(status, "text/html", htmlPage(name, body));
  if (pathname === CACHED_PATH) {
    // 每次用缓存前都要先问（no-cache），带版本标记：浏览器再次打开时带 If-None-Match 来问，缓存仍然有效就回 304
    const cache = { etag: CACHED_TAG, "cache-control": "no-cache" };
    if (request.headers["if-none-match"] === CACHED_TAG) {
      notModified.set(pathname, (notModified.get(pathname) ?? 0) + 1);
      response.writeHead(NOT_MODIFIED, cache);
      response.end();
      return;
    }
    send(OK, "text/html", htmlPage(name, shell(name, normalMain(name))), cache);
    return;
  }
  const status = /^\/status\/(\d{3})$/.exec(pathname)?.[1];
  if (status !== undefined) return html(shell(name, normalMain(name)), Number(status));
  const whole = WHOLE_PAGE_STATES.find((state) => pathname === `/shell/whole-${state}`);
  if (whole !== undefined) return html(shell(name, wholePageMain(name, whole)));
  if (pathname === "/shell/local-states") return html(shell(name, localStatesMain(name)));
  if (pathname === "/shell/blank") return html(shell(name, ""));
  if (pathname === "/api-failure") return html(`${shell(name, API_FAILURE_MAIN)}\n<script>${API_FAILURE_SCRIPT}</script>`);
  if (pathname === "/late-shell") return html(lateShellBody(name));
  if (pathname === "/no-shell") return html(NO_SHELL_BODY);
  if (pathname === "/sw.js") return send(OK, "text/javascript", SERVICE_WORKER);
  if (pathname.startsWith("/api/")) return send(NOT_INTERCEPTED, "application/json", '{"code":"FIXTURE_NOT_INTERCEPTED"}');
  send(NOT_FOUND, "text/plain", "没有这个页面");
}

/** 在本机随便一个空闲端口上起小网站；页面里的页名用 name（与页面清单一致）。 */
export async function startCheckFixtures(name: string): Promise<CheckFixtures> {
  const notModified = new Map<string, number>();
  const server = createServer((request, response) => respond(request, response, name, notModified));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    origin,
    url: (path) => `${origin}${path}`,
    notModified: (path) => notModified.get(path) ?? 0,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      }),
  };
}

/** 一个这时没人监听的本机端口：打开它的地址会连不上。 */
export async function closedPort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}
