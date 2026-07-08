/**
 * 应用主布局组件
 */
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

/** 主布局：左侧导航 + 右侧内容区 */
export function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
