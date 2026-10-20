import { AppRoutes } from "./router/AppRoutes.tsx";
import { BrowserRouter } from "./router/history.tsx";

/** 外壳与全部页面的路由空壳（F05）。路径在 routes.ts，页面登记在 router/pages.ts，页面在 pages/<页ID>/。 */
export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
