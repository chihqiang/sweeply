import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { PermissionBanner } from "@/components/ui";
import { usePermissionCheck } from "@/hooks/usePermissionCheck";

/** 固定侧边栏 + 主内容区，简洁无多余装饰 */
export function AppLayout() {
  const location = useLocation();
  const { permission, hasWarning } = usePermissionCheck(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-gray-50 via-white to-indigo-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/10">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* 权限提示横幅 — 缺少权限时显示 */}
        {hasWarning && (
          <div className="px-4 pt-3">
            <PermissionBanner permission={permission} />
          </div>
        )}
        {/* 页面切换过渡动画 — key 变化触发淡入 */}
        <div
          key={location.pathname}
          className="flex-1 overflow-hidden animate-page-enter"
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
