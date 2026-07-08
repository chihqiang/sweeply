/**
 * 侧边栏导航组件
 */
import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import { NAV_ITEMS } from "@/constants/navigation";
import { cn } from "@/utils/cn";
import { APP_NAME } from "@/constants/app";

/** 侧边栏组件 */
export function Sidebar() {
  const [appVersion, setAppVersion] = useState<string>("...");

  useEffect(() => {
    void getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => setAppVersion("unknown"));
  }, []);

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
      {/* 应用 Logo 区域 */}
      <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-700">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white">
          <span className="text-sm font-bold">S</span>
        </div>
        <span className="text-base font-semibold text-gray-800 dark:text-gray-100">
          {APP_NAME}
        </span>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700",
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <div className="flex flex-col">
                <span>{item.label}</span>
                <span className="text-xs font-normal opacity-70">
                  {item.description}
                </span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* 底部版本信息 */}
      <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          v{appVersion}
        </p>
      </div>
    </aside>
  );
}
