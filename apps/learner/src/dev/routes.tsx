import { Suspense, lazy } from "react";
import { Route } from "react-router";

/** 组件陈列页的路径。只在开发与测试时挂上（F03 用户拍板：正式版本里没有）。 */
export const DEV_UI_PATH = "/dev/ui";

const Gallery = import.meta.env.DEV ? lazy(() => import("./Gallery.tsx")) : null;

/** 学员端路由表里的开发页；正式构建时为 null，陈列页的代码不进正式包。 */
export const devRoutes =
  Gallery === null ? null : (
    <Route
      path={DEV_UI_PATH}
      element={
        <Suspense fallback={null}>
          <Gallery />
        </Suspense>
      }
    />
  );
