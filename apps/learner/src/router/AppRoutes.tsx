// 学员端路由（声明式，ADR-025）：根路径跳今日；35 页挂在外壳下，各页按需加载（pages/<页ID>/index.tsx）；没有的地址显示“没有这个页面”。
// 页面清单只有一处（pages.ts）：加页面先改 pages.md、routes.ts 与 pages.ts，再建 pages/<页ID>/。
import { lazy, type ComponentType } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { AppShell } from "../app/AppShell.tsx";
import { NotFound } from "../app/NotFound.tsx";
import { devRoutes } from "../dev/routes.tsx";
import { HOME_ID, pathTo } from "../routes.ts";
import { PAGES } from "./pages.ts";

const modules = import.meta.glob<{ default: ComponentType }>("../pages/*/index.tsx");

const PAGE_ELEMENTS = PAGES.map((page) => {
  const load = modules[`../pages/${page.id}/index.tsx`];
  const Page = load === undefined ? NotFound : lazy(load);
  return <Route key={page.id} path={page.path} element={<Page />} />;
});

/** 根路径跳今日，地址里的开发参数（?exam= ?state= ?now=）带过去。 */
function ToHome() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: pathTo(HOME_ID), search }} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      {devRoutes}
      <Route path="/" element={<ToHome />} />
      <Route element={<AppShell />}>
        {PAGE_ELEMENTS}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
