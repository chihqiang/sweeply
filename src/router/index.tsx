import { lazy, Suspense } from "react";
import {
  createHashRouter,
  RouterProvider,
  Navigate,
  type RouteObject,
} from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { ROUTE_PATHS } from "@/constants/routes";
import { startProgress, doneProgress } from "@/utils/nprogress";
import { Button, PageLoading } from "@/components/ui";
import { FileQuestion } from "lucide-react";

/** 路由级懒加载 — 按需加载页面，消除点击卡顿 */
const CleanPage = lazy(() => import("@/pages/CleanPage"));
const UninstallPage = lazy(() => import("@/pages/UninstallPage"));
const NetworkSpeedPage = lazy(() => import("@/pages/NetworkSpeedPage"));
const KeychainPage = lazy(() => import("@/pages/KeychainPage"));
const SystemInfoPage = lazy(() => import("@/pages/SystemInfoPage"));
const LoginItemsPage = lazy(() => import("@/pages/LoginItemsPage"));
const DuplicateFilesPage = lazy(() => import("@/pages/DuplicateFilesPage"));
const DiskUsagePage = lazy(() => import("@/pages/DiskUsagePage"));
const LargeFilesPage = lazy(() => import("@/pages/LargeFilesPage"));

/** Suspense fallback — 路由切换时即时展示 */
function RouteLoading() {
  return <PageLoading label="正在加载..." />;
}

/** #38: 404 页面 */
function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-800">
        <FileQuestion className="h-8 w-8 text-gray-300 dark:text-gray-600" />
      </div>
      <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">页面不存在</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">您访问的页面可能已被移除或暂时不可用</p>
      <a href="#/" className="mt-4">
        <Button variant="outline" size="sm">返回首页</Button>
      </a>
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    path: ROUTE_PATHS.HOME,
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to={ROUTE_PATHS.CLEAN} replace />,
      },
      {
        path: ROUTE_PATHS.CLEAN,
        element: <Suspense fallback={<RouteLoading />}><CleanPage /></Suspense>,
      },
      {
        path: ROUTE_PATHS.UNINSTALL,
        element: <Suspense fallback={<RouteLoading />}><UninstallPage /></Suspense>,
      },
      {
        path: ROUTE_PATHS.NETWORK_SPEED,
        element: <Suspense fallback={<RouteLoading />}><NetworkSpeedPage /></Suspense>,
      },
      {
        path: ROUTE_PATHS.KEYCHAIN,
        element: <Suspense fallback={<RouteLoading />}><KeychainPage /></Suspense>,
      },
      {
        path: ROUTE_PATHS.SYSTEM_INFO,
        element: <Suspense fallback={<RouteLoading />}><SystemInfoPage /></Suspense>,
      },
      {
        path: ROUTE_PATHS.LOGIN_ITEMS,
        element: <Suspense fallback={<RouteLoading />}><LoginItemsPage /></Suspense>,
      },
      {
        path: ROUTE_PATHS.DUPLICATE_FILES,
        element: <Suspense fallback={<RouteLoading />}><DuplicateFilesPage /></Suspense>,
      },
      {
        path: ROUTE_PATHS.DISK_USAGE,
        element: <Suspense fallback={<RouteLoading />}><DiskUsagePage /></Suspense>,
      },
      {
        path: ROUTE_PATHS.LARGE_FILES,
        element: <Suspense fallback={<RouteLoading />}><LargeFilesPage /></Suspense>,
      },
      // #38: 通配路由 → 404
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
];

export const router = createHashRouter(routes);

const ROUTE_TITLES: Record<string, string> = {
  [ROUTE_PATHS.CLEAN]: "垃圾清理",
  [ROUTE_PATHS.UNINSTALL]: "应用卸载",
  [ROUTE_PATHS.NETWORK_SPEED]: "网络测速",
  [ROUTE_PATHS.KEYCHAIN]: "钥匙串管理",
  [ROUTE_PATHS.SYSTEM_INFO]: "系统信息",
  [ROUTE_PATHS.LOGIN_ITEMS]: "启动项管理",
  [ROUTE_PATHS.DUPLICATE_FILES]: "重复文件查找",
  [ROUTE_PATHS.DISK_USAGE]: "磁盘空间分析",
  [ROUTE_PATHS.LARGE_FILES]: "大文件查找",
};

// #40: 简化路由订阅逻辑
router.subscribe((state) => {
  const isLoading = state.navigation.state === "loading";
  if (isLoading) {
    startProgress();
  } else {
    doneProgress();
    document.title = `${ROUTE_TITLES[state.location.pathname] ?? "Sweeply"} - Sweeply`;
  }
});

export function AppRouter() {
  return <RouterProvider router={router} />;
}
