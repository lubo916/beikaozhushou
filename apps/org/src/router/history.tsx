// 机构端与平台后台的小路由（F05）：这两端还没装 react-router（新增依赖由整合任务统一处理，交接单已写），
// 先用浏览器的 History 接口顶上，只做三件事：读当前地址、跳转、链接。装上 react-router 后换成 BrowserRouter + Routes，路由表与页面不用改。
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

export interface Location {
  readonly pathname: string;
  readonly search: string;
}

export interface NavigateOptions {
  readonly replace?: boolean;
}

interface RouterValue {
  readonly location: Location;
  readonly navigate: (to: string, options?: NavigateOptions) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function parse(href: string): Location {
  const at = href.indexOf("?");
  return at < 0 ? { pathname: href, search: "" } : { pathname: href.slice(0, at), search: href.slice(at) };
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

const currentHref = (): string => `${window.location.pathname}${window.location.search}`;

function browserNavigate(to: string, options: NavigateOptions = {}): void {
  if (options.replace === true) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  for (const listener of listeners) listener();
}

/** 正式运行：地址栏就是路由。 */
export function BrowserRouter({ children }: { children: ReactNode }) {
  const href = useSyncExternalStore(subscribe, currentHref);
  const value = useMemo<RouterValue>(() => ({ location: parse(href), navigate: browserNavigate }), [href]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

/** 测试用：地址只在内存里。 */
export function MemoryRouter({ initial, children }: { initial: string; children: ReactNode }) {
  const [href, setHref] = useState(initial);
  const value = useMemo<RouterValue>(() => ({ location: parse(href), navigate: (to: string) => setHref(to) }), [href]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (value === null) throw new Error("路由没有挂上：组件要放在 BrowserRouter 或 MemoryRouter 里");
  return value;
}

export function useLocation(): Location {
  return useRouter().location;
}

export function useNavigate(): RouterValue["navigate"] {
  return useRouter().navigate;
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  readonly to: string;
}

/** 站内链接：普通点击走路由（不整页刷新）；按住修饰键或新窗口打开时交给浏览器。 */
export function Link({ to, onClick, target, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
    if (target !== undefined && target !== "_self") return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a {...rest} href={to} target={target} onClick={handle}>
      {children}
    </a>
  );
}

/** 路由匹配：/students/:studentId 对 /students/abc → { studentId: "abc" }；对不上返回 null。 */
export function matchRoute(pattern: string, pathname: string): Readonly<Record<string, string>> | null {
  const want = pattern.split("/").filter(Boolean);
  const got = pathname.split("/").filter(Boolean);
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (const [index, part] of want.entries()) {
    const value = got[index] ?? "";
    if (part.startsWith(":")) {
      try {
        params[part.slice(1)] = decodeURIComponent(value);
      } catch {
        return null;
      }
    } else if (part !== value) return null;
  }
  return params;
}
