/**
 * 路由配置
 * 直接导入页面组件（不使用懒加载，避免 Suspense 闪屏卡顿）
 */
import {
  createHashRouter,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { ROUTE_PATHS } from "@/constants/routes";
import { startProgress, doneProgress } from "@/utils/nprogress";
import CleanPage from "@/pages/CleanPage";
import UninstallPage from "@/pages/UninstallPage";
import NetworkSpeedPage from "@/pages/NetworkSpeedPage";

/** 路由配置列表 */
export const routes: RouteObject[] = [
  {
    path: ROUTE_PATHS.HOME,
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <CleanPage />,
      },
      {
        path: ROUTE_PATHS.CLEAN,
        element: <CleanPage />,
      },
      {
        path: ROUTE_PATHS.UNINSTALL,
        element: <UninstallPage />,
      },
      {
        path: ROUTE_PATHS.NETWORK_SPEED,
        element: <NetworkSpeedPage />,
      },
    ],
  },
];

/** 创建 Hash 路由（Tauri 推荐使用 hash 路由） */
export const router = createHashRouter(routes);

/** 路由变更时控制进度条 */
router.subscribe((state) => {
  if (state.navigation.state === "loading") {
    startProgress();
  } else if (state.navigation.state === "idle") {
    doneProgress();
  }
});

/** 路由 Provider 组件 */
export function AppRouter() {
  return <RouterProvider router={router} />;
}
