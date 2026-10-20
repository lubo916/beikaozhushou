// 路由：根路径跳首页；各页挂在外壳下按需加载（pages/<页ID>/index.tsx）；没有的地址显示“没有这个页面”。
import { lazy, useEffect, type ComponentType } from "react";
import { NotFound } from "../app/NotFound.tsx";
import { StaffShell } from "../app/StaffShell.tsx";
import { HOME_ID, pathTo } from "../routes.ts";
import { useLocation, useNavigate } from "./history.tsx";
import { PAGES, findPage } from "./pages.ts";

const modules = import.meta.glob<{ default: ComponentType }>("../pages/*/index.tsx");

const PAGE_COMPONENTS = new Map(
  PAGES.map((page) => {
    const load = modules[`../pages/${page.id}/index.tsx`];
    return [page.id, load === undefined ? NotFound : lazy(load)] as const;
  }),
);

export function AppRoutes() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const atRoot = pathname === "/";
  useEffect(() => {
    if (atRoot) navigate(`${pathTo(HOME_ID)}${search}`, { replace: true });
  }, [atRoot, navigate, search]);
  const page = findPage(pathname);
  const Page = page === undefined ? undefined : PAGE_COMPONENTS.get(page.id);
  return <StaffShell page={page}>{atRoot ? null : Page === undefined ? <NotFound /> : <Page key={page?.id} />}</StaffShell>;
}
